import { config as loadEnv } from "dotenv";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { getAddress, isAddress, formatUnits, type Address, type Hash, type Hex } from "viem";
import {
  EIP3009_ABI,
  EIP3009_TYPES,
  EMPTY_BYTES,
  SUPER_TOKEN_ABI,
  calculateFlowRate,
  checkFlowPermissions,
  createBasePublicClient,
  createFacilitatorWalletClient,
  createFlow,
  ensureAllowance,
  getEIP3009Domain,
  getFlowRate,
  getWrapPreflight,
} from "./superfluid.js";
import { SUPER_TOKEN_CONFIG } from "./config.js";

loadEnv();

// Required environment variables
const privateKeyEnv = process.env.FACILITATOR_PRIVATE_KEY;
if (!privateKeyEnv) {
  console.error("❌ Missing required environment variable: FACILITATOR_PRIVATE_KEY");
  process.exit(1);
}

const rpcUrl = process.env.BASE_RPC_URL;
if (!rpcUrl) {
  console.error("❌ Missing required environment variable: BASE_RPC_URL");
  process.exit(1);
}

// Optional environment variables with defaults
const port = Number(process.env.PORT || 4020);
const allowedOrigins = process.env.ALLOWED_ORIGIN 
  ? process.env.ALLOWED_ORIGIN.split(",") 
  : ["http://localhost:3000", "http://localhost:5173"];

const facilitatorPrivateKey = (privateKeyEnv.startsWith("0x") ? privateKeyEnv : `0x${privateKeyEnv}`) as Hex;

const publicClient = createBasePublicClient(rpcUrl);
const walletClient = createFacilitatorWalletClient(facilitatorPrivateKey, rpcUrl);
const facilitatorAccount = walletClient.account;
const facilitatorAddress = facilitatorAccount.address;

// Fee calculation: max(0.1 USDC, 0.1% of desired wrap amount)
const MIN_FEE = 100000n; // 0.1 USDC (6 decimals)
const FEE_PERCENTAGE = 1000n; // 0.1% = 1/1000

function calculateFee(wrapAmount: bigint): bigint {
  const percentageFee = wrapAmount / FEE_PERCENTAGE;
  return percentageFee > MIN_FEE ? percentageFee : MIN_FEE;
}

function calculateTotalWithFee(wrapAmount: bigint): bigint {
  return wrapAmount + calculateFee(wrapAmount);
}

const app = new Hono();

app.use(
  "*",
  cors({
    origin: allowedOrigins,
    allowHeaders: ["Content-Type", "X-Payment", "Access-Control-Expose-Headers"],
    exposeHeaders: ["X-Payment-Response"], // x402 requires this header to be exposed
    allowMethods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  }),
);

const accountQuerySchema = z.object({
  account: z
    .string()
    .trim()
    .refine((value) => isAddress(value), "Account must be a valid address"),
});

app.get("/supported", (c) => {
  return c.json({
    kinds: [
      {
        scheme: "exact",
        network: "base",
      },
    ],
  });
});

app.get("/info", (c) => {
  return c.json({
    facilitator: facilitatorAddress,
    network: "base",
    chainId: SUPER_TOKEN_CONFIG.chain.id,
    superToken: SUPER_TOKEN_CONFIG.superToken.address,
    underlyingToken: SUPER_TOKEN_CONFIG.underlyingToken.address,
  });
});


app.get("/resource", async (c) => {
  const account = c.req.query("account");
  const recipient = c.req.query("recipient");
  
  const parseResult = accountQuerySchema.safeParse({ account });

  if (!parseResult.success) {
    return c.json({ error: "Invalid account", details: parseResult.error.flatten() }, 400);
  }

  if (!recipient) {
    return c.json({ error: "Missing required query parameter: recipient" }, 400);
  }

  if (!isAddress(recipient)) {
    return c.json({ error: "Invalid recipient address" }, 400);
  }

  const accountChecksum = getAddress(parseResult.data.account);
  const recipientAddress = getAddress(recipient);
  
  const xPaymentHeader = c.req.header("X-PAYMENT");
  
  if (xPaymentHeader) {
    try {
      const decoded = Buffer.from(xPaymentHeader, "base64").toString("utf-8");
      const paymentPayload = JSON.parse(decoded);
      
      const { signature, authorization } = paymentPayload.payload;
      const paymentAccount = authorization.from;
      const sig = signature as Hex;
      const r = `0x${sig.slice(2, 66)}` as Hex;
      const s = `0x${sig.slice(66, 130)}` as Hex;
      const v = parseInt(sig.slice(130, 132), 16);
      const totalPaid = BigInt(authorization.value);
      const executedTxs: Hash[] = [];
      
      console.log("💰 [/resource] Received X-PAYMENT", {
        from: paymentAccount,
        totalPaidRaw: totalPaid.toString(),
        totalPaidUSDC: formatUnits(totalPaid, 6),
      });
      
      let amountToWrap: bigint;
      let fee: bigint;
      
      // If total <= 100.1 USDC, fee is fixed at 0.1, so wrap = total - 0.1
      if (totalPaid <= calculateTotalWithFee(100000000n)) {
        fee = MIN_FEE;
        amountToWrap = totalPaid - fee;
      } else {
        // Fee is 0.1% of wrap, so: total = wrap + wrap/1000 = wrap * 1.001
        amountToWrap = (totalPaid * 1000n) / 1001n;
        fee = totalPaid - amountToWrap;
      }
      
      // 1. Transfer USDC (full amount including fee)
      const transferTxHash = await walletClient.writeContract({
        account: facilitatorAccount,
        chain: undefined,
        address: SUPER_TOKEN_CONFIG.underlyingToken.address,
        abi: EIP3009_ABI,
        functionName: "transferWithAuthorization",
        args: [paymentAccount as Address, facilitatorAddress, totalPaid, BigInt(authorization.validAfter), BigInt(authorization.validBefore), authorization.nonce as Hex, v, r, s],
      });
      executedTxs.push(transferTxHash);
      await publicClient.waitForTransactionReceipt({ hash: transferTxHash });
      
      console.log("✅ [/resource] transferWithAuthorization", {
        from: paymentAccount,
        to: facilitatorAddress,
        totalPaidUSDC: formatUnits(totalPaid, 6),
        txHash: transferTxHash,
      });
      
      // 2. Approve (only for amount to wrap, excluding fee)
      const approvalHash = await ensureAllowance(publicClient, walletClient, facilitatorAddress, SUPER_TOKEN_CONFIG.superToken.address, SUPER_TOKEN_CONFIG.underlyingToken.address, amountToWrap);
      if (approvalHash) {
        executedTxs.push(approvalHash);
        await publicClient.waitForTransactionReceipt({ hash: approvalHash });
      }
      
      // 3. Wrap (only the amount after fee deduction)
      const decimalDiff = SUPER_TOKEN_CONFIG.superToken.decimals - SUPER_TOKEN_CONFIG.underlyingToken.decimals;
      const superTokenAmount = amountToWrap * (10n ** BigInt(decimalDiff));
      
      let wrapTxHash: Hash;
      try {
        wrapTxHash = await walletClient.writeContract({
          account: facilitatorAccount,
          chain: undefined,
          address: SUPER_TOKEN_CONFIG.superToken.address,
          abi: SUPER_TOKEN_ABI,
          functionName: "upgradeTo",
          args: [paymentAccount as Address, superTokenAmount, EMPTY_BYTES],
        });
        executedTxs.push(wrapTxHash);
        await publicClient.waitForTransactionReceipt({ hash: wrapTxHash });
        
        console.log("✅ [/resource] upgradeTo (wrap underlying → super token)", {
          to: paymentAccount,
          superToken: SUPER_TOKEN_CONFIG.superToken.address,
          amountSuperTokenRaw: superTokenAmount.toString(),
          amountUnderlyingUSDC: formatUnits(amountToWrap, 6),
          txHash: wrapTxHash,
        });
      } catch {
        const upgradeHash = await walletClient.writeContract({
          account: facilitatorAccount,
          chain: undefined,
          address: SUPER_TOKEN_CONFIG.superToken.address,
          abi: SUPER_TOKEN_ABI,
          functionName: "upgrade",
          args: [superTokenAmount],
        });
        executedTxs.push(upgradeHash);
        await publicClient.waitForTransactionReceipt({ hash: upgradeHash });
        
        wrapTxHash = await walletClient.writeContract({
          account: facilitatorAccount,
          chain: undefined,
          address: SUPER_TOKEN_CONFIG.superToken.address,
          abi: SUPER_TOKEN_ABI,
          functionName: "transfer",
          args: [paymentAccount as Address, superTokenAmount],
        });
        executedTxs.push(wrapTxHash);
        await publicClient.waitForTransactionReceipt({ hash: wrapTxHash });
        
        console.log("✅ [/resource] upgrade + transfer (wrap & send super token)", {
          to: paymentAccount,
          superToken: SUPER_TOKEN_CONFIG.superToken.address,
          amountSuperTokenRaw: superTokenAmount.toString(),
          amountUnderlyingUSDC: formatUnits(amountToWrap, 6),
          upgradeTxHash: upgradeHash,
          transferTxHash: wrapTxHash,
        });
      }
      
      // 4. Create stream if recipient provided
      let streamTxHash: Hash | null = null;
      const recipientParam = c.req.query("recipient");
      
      if (recipientParam && isAddress(recipientParam)) {
        const recipientAddress = getAddress(recipientParam);
        
        // Check if facilitator has ACL permissions
        const { hasPermissions } = await checkFlowPermissions(
          publicClient as any,
          paymentAccount as Address,
          facilitatorAddress
        );

        if (hasPermissions) {
          try {
            // Calculate flow rate from payment requirements or default to 1 USDC/month
            const monthlyAmountParam = c.req.query("monthlyAmount");
            const monthlyAmountUSDC = monthlyAmountParam ? BigInt(monthlyAmountParam) : 1000000n;
            const decimalDiff = SUPER_TOKEN_CONFIG.superToken.decimals - SUPER_TOKEN_CONFIG.underlyingToken.decimals;
            const monthlyAmountSuper = monthlyAmountUSDC * (10n ** BigInt(decimalDiff));
            const streamFlowRate = calculateFlowRate(monthlyAmountSuper);
            
            streamTxHash = await createFlow(
              walletClient,
              paymentAccount as Address,
              recipientAddress,
              streamFlowRate,
            );
            executedTxs.push(streamTxHash);
            await publicClient.waitForTransactionReceipt({ hash: streamTxHash });
            
            console.log("🌊 [/resource] Created Superfluid stream", {
              from: paymentAccount,
              to: recipientAddress,
              monthlyAmountUSDC: formatUnits(monthlyAmountUSDC, 6),
              flowRateWeiPerSecond: streamFlowRate.toString(),
              txHash: streamTxHash,
            });
          } catch (streamError) {
            // Stream creation failed, but wrap succeeded - log but don't fail
            console.warn("⚠️ [/resource] Stream creation failed", {
              from: paymentAccount,
              recipient: recipientAddress,
              error: `${streamError}`,
            });
          }
        } else {
          console.log("ℹ️ [/resource] Facilitator lacks ACL permissions for stream creation", {
            from: paymentAccount,
            operator: facilitatorAddress,
            recipient: recipientAddress,
          });
        }
      }
      
      // Set X-PAYMENT-RESPONSE header
      const paymentResponse = { 
        success: true, 
        txHash: wrapTxHash, 
        transactions: executedTxs,
        fee: fee.toString(),
        wrapped: amountToWrap.toString(),
        streamCreated: streamTxHash !== null,
        streamTxHash: streamTxHash,
      };
      c.header("X-PAYMENT-RESPONSE", Buffer.from(JSON.stringify(paymentResponse)).toString("base64"));
      
      const updatedBalances = await getWrapPreflight(publicClient, paymentAccount as Address);
      
      // Format amounts for display (USDC has 6 decimals)
      const wrappedFormatted = formatUnits(amountToWrap, 6);
      const feeFormatted = formatUnits(fee, 6);
      
      const responseBody = {
        status: "ok",
        account: paymentAccount,
        superTokenBalance: updatedBalances.superTokenBalance.toString(),
        message: streamTxHash 
          ? `Access granted! Wrapped ${wrappedFormatted} USDC to USDCx and created stream (fee: ${feeFormatted} USDC)`
          : `Access granted! Wrapped ${wrappedFormatted} USDC to USDCx (fee: ${feeFormatted} USDC)`,
        transactions: executedTxs,
        fee: fee.toString(),
        wrapped: amountToWrap.toString(),
        streamCreated: streamTxHash !== null,
        streamTxHash: streamTxHash,
        imageUrl: "https://i.imgur.com/k2tPAGC.jpeg",
      };

      console.log("✅ [/resource] Payment + wrap completed", {
        account: paymentAccount,
        wrappedUSDC: wrappedFormatted,
        feeUSDC: feeFormatted,
        streamCreated: responseBody.streamCreated,
        streamTxHash: responseBody.streamTxHash,
      });

      return c.json(responseBody);
    } catch (error) {
      console.error("❌ [/resource] Payment processing failed", {
        error: `${error}`,
      });
      return c.json({ error: "Payment processing failed", details: `${error}` }, 500);
    }
  }
  
  // No payment, check if user has active stream to recipient
  const flowRate = await getFlowRate(publicClient as any, accountChecksum, recipientAddress);

  if (flowRate > 0n) {
    console.log("✅ [/resource] Existing stream found, granting access", {
      account: accountChecksum,
      recipient: recipientAddress,
      flowRateWeiPerSecond: flowRate.toString(),
    });

    return c.json({
      status: "ok",
      account: accountChecksum,
      flowRate: flowRate.toString(),
      recipient: recipientAddress,
      message: `Access granted! You have an active stream to ${recipientAddress}`,
      imageUrl: "https://i.imgur.com/k2tPAGC.jpeg",
    });
  }

  // Get stream configuration from query params (optional monthly amount)
  const monthlyAmountParam = c.req.query("monthlyAmount"); // in USDC

  const host = c.req.header("host") ?? `localhost:${port}`;
  const protocol = c.req.header("x-forwarded-proto") ?? "http";
  const resourceUrl = `${protocol}://${host}${c.req.path}`;

  // Parse monthly amount (default to 1 USDC/month if not specified)
  let monthlyAmountUSDC = 1000000n; // 1 USDC (6 decimals) default
  if (monthlyAmountParam) {
    try {
      monthlyAmountUSDC = BigInt(monthlyAmountParam);
    } catch {
      return c.json({ error: "Invalid monthlyAmount parameter" }, 400);
    }
  }

  // Validate user is not trying to stream to themselves
  if (accountChecksum === recipientAddress) {
    return c.json({ error: "Cannot create stream to yourself" }, 400);
  }

  const desiredWrapAmount = monthlyAmountUSDC; 
  const fee = calculateFee(desiredWrapAmount);
  const totalRequired = desiredWrapAmount + fee;
  
  const decimalDiff = SUPER_TOKEN_CONFIG.superToken.decimals - SUPER_TOKEN_CONFIG.underlyingToken.decimals;
  const monthlyAmountSuper = monthlyAmountUSDC * (10n ** BigInt(decimalDiff));
  const streamFlowRate = calculateFlowRate(monthlyAmountSuper);

  const extra: Record<string, any> = {
    name: "USD Coin",
    version: "2",
    autoWrap: true,
    superToken: SUPER_TOKEN_CONFIG.superToken.address,
    wrapAmount: desiredWrapAmount.toString(),
    fee: fee.toString(),
    facilitator: facilitatorAddress,
    cfaV1Forwarder: SUPER_TOKEN_CONFIG.superfluid.cfaV1Forwarder,
    stream: {
      recipient: recipientAddress,
      monthlyAmount: monthlyAmountSuper.toString(), // in USDCx (18 decimals)
      flowRate: streamFlowRate.toString(), // wei per second
    },
  };

  console.log("ℹ️ [/resource] Returning 402 payment required", {
    account: accountChecksum,
    recipient: recipientAddress,
    monthlyAmountUSDC: formatUnits(monthlyAmountUSDC, 6),
    totalRequiredUSDC: formatUnits(totalRequired, 6),
    feeUSDC: formatUnits(fee, 6),
  });

  return c.json(
    {
      x402Version: 1,
      error: `Payment required: Must have an active stream to ${recipientAddress}`,
      accepts: [
        {
          scheme: "exact",
          network: "base",
          maxAmountRequired: totalRequired.toString(),
          asset: SUPER_TOKEN_CONFIG.underlyingToken.address,
          payTo: facilitatorAddress,
          resource: resourceUrl,
          description: `Wrap ${desiredWrapAmount.toString()} USDC & start stream to ${recipientAddress} (${fee.toString()} USDC fee)`,
          mimeType: "application/json",
          maxTimeoutSeconds: 120,
          extra,
        },
      ],
    },
    402,
  );
});


app.post("/verify", async (c) => {
  try {
    const body = await c.req.json();
    const { x402Version, paymentHeader, paymentRequirements } = body;

    if (x402Version !== 1) {
      return c.json({ isValid: false, invalidReason: "Unsupported x402 version" });
    }

    // Parse the X-PAYMENT header (base64 encoded JSON)
    let paymentPayload;
    try {
      const decoded = Buffer.from(paymentHeader, "base64").toString("utf-8");
      paymentPayload = JSON.parse(decoded);
    } catch {
      return c.json({ isValid: false, invalidReason: "Invalid payment header format" });
    }

    if (paymentPayload.scheme !== "exact") {
      return c.json({ isValid: false, invalidReason: "Unsupported payment scheme (expected 'exact')" });
    }

    if (paymentPayload.network !== "base") {
      return c.json({ isValid: false, invalidReason: "Unsupported network" });
    }

    const { signature, authorization, account } = paymentPayload.payload;

    if (!signature || !authorization || !account) {
      return c.json({ isValid: false, invalidReason: "Missing required payload fields" });
    }

    // Verify the EIP-3009 signature
    const authMessage = {
      from: account as Address,
      to: facilitatorAddress,
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce as Hex,
    };

    try {
      const isValid = await publicClient.verifyTypedData({
        address: account as Address,
        domain: getEIP3009Domain(),
        types: EIP3009_TYPES,
        primaryType: "TransferWithAuthorization",
        message: authMessage,
        signature: signature as Hex,
      });

      if (!isValid) {
        return c.json({ isValid: false, invalidReason: "Invalid signature" });
      }

      const now = BigInt(Math.floor(Date.now() / 1000));
      if (now > authMessage.validBefore) {
        return c.json({ isValid: false, invalidReason: "Authorization expired" });
      }

      return c.json({ isValid: true, invalidReason: null });
    } catch (error) {
      return c.json({ isValid: false, invalidReason: `Verification failed: ${error}` });
    }
  } catch (error) {
    return c.json({ isValid: false, invalidReason: `Server error: ${error}` });
  }
});

app.post("/settle", async (c) => {
  try {
    const body = await c.req.json();
    const { x402Version, paymentHeader, paymentRequirements } = body;

    if (x402Version !== 1) {
      return c.json({
        success: false,
        error: "Unsupported x402 version",
        txHash: null,
        networkId: null
      });
    }

    let paymentPayload;
    try {
      const decoded = Buffer.from(paymentHeader, "base64").toString("utf-8");
      paymentPayload = JSON.parse(decoded);
    } catch {
      return c.json({ 
        success: false, 
        error: "Invalid payment header format",
        txHash: null,
        networkId: null
      });
    }

    const { signature, authorization, account } = paymentPayload.payload;
    const sig = signature as Hex;
    
    const r = `0x${sig.slice(2, 66)}` as Hex;
    const s = `0x${sig.slice(66, 130)}` as Hex;
    const v = parseInt(sig.slice(130, 132), 16);

    const totalPaid = BigInt(authorization.value);
    const executedTxs: Hash[] = [];
    
    let amountToWrap: bigint;
    let fee: bigint;
    
    if (totalPaid <= calculateTotalWithFee(100000000n)) {
      fee = MIN_FEE;
      amountToWrap = totalPaid - fee;
    } else {
      amountToWrap = (totalPaid * 1000n) / 1001n;
      fee = totalPaid - amountToWrap;
    }

    try {
      const transferTxHash = await walletClient.writeContract({
        account: facilitatorAccount,
        chain: undefined,
        address: SUPER_TOKEN_CONFIG.underlyingToken.address,
        abi: EIP3009_ABI,
        functionName: "transferWithAuthorization",
        args: [
          account as Address,
          facilitatorAddress,
          totalPaid,
          BigInt(authorization.validAfter),
          BigInt(authorization.validBefore),
          authorization.nonce as Hex,
          v,
          r,
          s,
        ],
      });
      executedTxs.push(transferTxHash);
      await publicClient.waitForTransactionReceipt({ hash: transferTxHash });

      const approvalHash = await ensureAllowance(
        publicClient,
        walletClient,
        facilitatorAddress,
        SUPER_TOKEN_CONFIG.superToken.address,
        SUPER_TOKEN_CONFIG.underlyingToken.address,
        amountToWrap,
      );
      if (approvalHash) {
        executedTxs.push(approvalHash);
        await publicClient.waitForTransactionReceipt({ hash: approvalHash });
      }

      const decimalDiff = SUPER_TOKEN_CONFIG.superToken.decimals - SUPER_TOKEN_CONFIG.underlyingToken.decimals;
      const superTokenAmount = amountToWrap * (10n ** BigInt(decimalDiff));

      const wrapTxHash = await walletClient.writeContract({
        account: facilitatorAccount,
        chain: undefined,
        address: SUPER_TOKEN_CONFIG.superToken.address,
        abi: SUPER_TOKEN_ABI,
        functionName: "upgradeTo",
        args: [account as Address, superTokenAmount, EMPTY_BYTES],
      });
      executedTxs.push(wrapTxHash);
      await publicClient.waitForTransactionReceipt({ hash: wrapTxHash });

      // Check if stream should be created (from payment requirements extra field)
      let streamTxHash: Hash | null = null;
      if (paymentRequirements?.extra?.stream) {
        const { recipient, flowRate } = paymentRequirements.extra.stream;
        
        // Check if facilitator has ACL permissions
        const { hasPermissions } = await checkFlowPermissions(
          publicClient as any,
          account as Address,
          facilitatorAddress
        );

        if (hasPermissions && recipient && flowRate) {
          try {
            streamTxHash = await createFlow(
              walletClient,
              account as Address,
              recipient as Address,
              BigInt(flowRate),
            );
            executedTxs.push(streamTxHash);
            await publicClient.waitForTransactionReceipt({ hash: streamTxHash });
          } catch (streamError) {
            console.warn("Stream creation failed:", streamError);
          }
        }
      }

      return c.json({
        success: true,
        error: null,
        txHash: executedTxs[executedTxs.length - 1],
        networkId: "base",
        transactions: executedTxs,
        fee: fee.toString(),
        wrapped: amountToWrap.toString(),
        streamCreated: streamTxHash !== null,
        streamTxHash: streamTxHash,
      });
    } catch (error) {
      return c.json({
        success: false,
        error: `Settlement failed: ${error}`,
        txHash: executedTxs.length > 0 ? executedTxs[executedTxs.length - 1] : null,
        networkId: "base",
      });
    }
  } catch (error) {
    return c.json({
      success: false,
      error: `Server error: ${error}`,
      txHash: null,
      networkId: null,
    });
  }
});

// Export handler for Vercel serverless functions
export default app;

// Only start server if not on Vercel (local development)
if (!process.env.VERCEL) {
  console.log(`
🚀 x402-Compliant Superfluid Facilitator
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Facilitator: ${facilitatorAddress}
🔗 Network: Base Mainnet
💰 Scheme: exact (EIP-3009)
🎁 Auto-Wrap & Stream: USDC → USDCx → Stream
💵 Fee: max(0.1 USDC, 0.1% of amount)
🎯 Recipient: Specified per request
🌐 Port: ${port}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

  serve({
    fetch: app.fetch,
    port,
  });
}

