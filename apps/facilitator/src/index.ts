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
  FACILITATOR_CONTRACT_ABI,
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
  : ["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"];

const facilitatorPrivateKey = (privateKeyEnv.startsWith("0x") ? privateKeyEnv : `0x${privateKeyEnv}`) as Hex;

const publicClient = createBasePublicClient(rpcUrl);
const walletClient = createFacilitatorWalletClient(facilitatorPrivateKey, rpcUrl);
const facilitatorAccount = walletClient.account;
const facilitatorAddress = facilitatorAccount.address;

// Optional: deployed SuperfluidFacilitator contract address
// When set, payments are processed via a single atomic contract call
// instead of multiple EOA transactions.
const contractAddress = process.env.FACILITATOR_CONTRACT_ADDRESS
  ? getAddress(process.env.FACILITATOR_CONTRACT_ADDRESS)
  : null;

// Address that receives EIP-3009 payments (contract if deployed, EOA otherwise)
const payToAddress = contractAddress ?? facilitatorAddress;

// Fee calculation: flat 1 USDC fee (matches contract config)
const FLAT_FEE = 1_000_000n; // 1 USDC (6 decimals)

function calculateFee(_wrapAmount: bigint): bigint {
  return FLAT_FEE;
}

function calculateTotalWithFee(wrapAmount: bigint): bigint {
  return wrapAmount + FLAT_FEE;
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
    facilitator: payToAddress,
    ...(contractAddress ? { operator: facilitatorAddress, contractMode: true } : {}),
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
        mode: contractAddress ? "contract" : "eoa",
      });

      // Calculate fee breakdown (mirrors contract logic - flat 1 USDC fee)
      const fee = FLAT_FEE;
      const amountToWrap = totalPaid - fee;

      let primaryTxHash: Hash;
      let streamTxHash: Hash | null = null;
      let streamCreated = false;

      if (contractAddress) {
        // ── Contract mode: single atomic transaction ──
        const authParams = {
          validAfter: BigInt(authorization.validAfter),
          validBefore: BigInt(authorization.validBefore),
          nonce: authorization.nonce as Hex,
          v,
          r,
          s,
        };

        // Determine stream parameters
        let streamRecipient: Address = "0x0000000000000000000000000000000000000000";
        let streamFlowRate = 0n;

        const recipientParam = c.req.query("recipient");
        if (recipientParam && isAddress(recipientParam)) {
          const recipientAddr = getAddress(recipientParam);
          const { hasPermissions } = await checkFlowPermissions(
            publicClient as any,
            paymentAccount as Address,
            contractAddress,
          );

          if (hasPermissions) {
            streamRecipient = recipientAddr;
            const monthlyAmountParam = c.req.query("monthlyAmount");
            const monthlyAmountUSDC = monthlyAmountParam ? BigInt(monthlyAmountParam) : 1000000n;
            const decimalDiff = SUPER_TOKEN_CONFIG.superToken.decimals - SUPER_TOKEN_CONFIG.underlyingToken.decimals;
            const monthlyAmountSuper = monthlyAmountUSDC * (10n ** BigInt(decimalDiff));
            streamFlowRate = calculateFlowRate(monthlyAmountSuper);
          } else {
            console.log("ℹ️ [/resource] No ACL permissions for stream", {
              from: paymentAccount,
              operator: contractAddress,
            });
          }
        }

        if (streamFlowRate > 0n) {
          primaryTxHash = await walletClient.writeContract({
            account: facilitatorAccount,
            chain: undefined,
            address: contractAddress,
            abi: FACILITATOR_CONTRACT_ABI,
            functionName: "processPayment",
            args: [paymentAccount as Address, totalPaid, authParams, streamRecipient, streamFlowRate],
          });
          streamCreated = true;
          streamTxHash = primaryTxHash;
        } else {
          primaryTxHash = await walletClient.writeContract({
            account: facilitatorAccount,
            chain: undefined,
            address: contractAddress,
            abi: FACILITATOR_CONTRACT_ABI,
            functionName: "processPaymentWrapOnly",
            args: [paymentAccount as Address, totalPaid, authParams],
          });
        }
        executedTxs.push(primaryTxHash);
        await publicClient.waitForTransactionReceipt({ hash: primaryTxHash });

        console.log("✅ [/resource] Contract processPayment", {
          from: paymentAccount,
          totalPaidUSDC: formatUnits(totalPaid, 6),
          wrappedUSDC: formatUnits(amountToWrap, 6),
          feeUSDC: formatUnits(fee, 6),
          streamCreated,
          txHash: primaryTxHash,
        });
      } else {
        // ── Legacy EOA mode: multi-tx flow ──
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

        // 2. Approve
        const approvalHash = await ensureAllowance(publicClient, walletClient, facilitatorAddress, SUPER_TOKEN_CONFIG.superToken.address, SUPER_TOKEN_CONFIG.underlyingToken.address, amountToWrap);
        if (approvalHash) {
          executedTxs.push(approvalHash);
          await publicClient.waitForTransactionReceipt({ hash: approvalHash });
        }

        // 3. Wrap
        const decimalDiff = SUPER_TOKEN_CONFIG.superToken.decimals - SUPER_TOKEN_CONFIG.underlyingToken.decimals;
        const superTokenAmount = amountToWrap * (10n ** BigInt(decimalDiff));

        try {
          primaryTxHash = await walletClient.writeContract({
            account: facilitatorAccount,
            chain: undefined,
            address: SUPER_TOKEN_CONFIG.superToken.address,
            abi: SUPER_TOKEN_ABI,
            functionName: "upgradeTo",
            args: [paymentAccount as Address, superTokenAmount, EMPTY_BYTES],
          });
          executedTxs.push(primaryTxHash);
          await publicClient.waitForTransactionReceipt({ hash: primaryTxHash });
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

          primaryTxHash = await walletClient.writeContract({
            account: facilitatorAccount,
            chain: undefined,
            address: SUPER_TOKEN_CONFIG.superToken.address,
            abi: SUPER_TOKEN_ABI,
            functionName: "transfer",
            args: [paymentAccount as Address, superTokenAmount],
          });
          executedTxs.push(primaryTxHash);
          await publicClient.waitForTransactionReceipt({ hash: primaryTxHash });
        }

        // 4. Create stream if recipient provided
        const recipientParam = c.req.query("recipient");
        if (recipientParam && isAddress(recipientParam)) {
          const recipientAddr = getAddress(recipientParam);
          const { hasPermissions } = await checkFlowPermissions(
            publicClient as any,
            paymentAccount as Address,
            facilitatorAddress,
          );

          if (hasPermissions) {
            try {
              const monthlyAmountParam = c.req.query("monthlyAmount");
              const monthlyAmountUSDC = monthlyAmountParam ? BigInt(monthlyAmountParam) : 1000000n;
              const decimalDiff2 = SUPER_TOKEN_CONFIG.superToken.decimals - SUPER_TOKEN_CONFIG.underlyingToken.decimals;
              const monthlyAmountSuper = monthlyAmountUSDC * (10n ** BigInt(decimalDiff2));
              const streamFlowRate = calculateFlowRate(monthlyAmountSuper);

              streamTxHash = await createFlow(walletClient, paymentAccount as Address, recipientAddr, streamFlowRate);
              executedTxs.push(streamTxHash);
              await publicClient.waitForTransactionReceipt({ hash: streamTxHash });
              streamCreated = true;
            } catch (streamError) {
              console.warn("⚠️ [/resource] Stream creation failed", { error: `${streamError}` });
            }
          }
        }
      }

      // Set X-PAYMENT-RESPONSE header
      const paymentResponse = {
        success: true,
        txHash: primaryTxHash!,
        transactions: executedTxs,
        fee: fee.toString(),
        wrapped: amountToWrap.toString(),
        streamCreated,
        streamTxHash,
      };
      c.header("X-PAYMENT-RESPONSE", Buffer.from(JSON.stringify(paymentResponse)).toString("base64"));

      const updatedBalances = await getWrapPreflight(publicClient, paymentAccount as Address);
      const wrappedFormatted = formatUnits(amountToWrap, 6);
      const feeFormatted = formatUnits(fee, 6);

      const responseBody = {
        status: "ok",
        account: paymentAccount,
        superTokenBalance: updatedBalances.superTokenBalance.toString(),
        message: streamCreated
          ? `Access granted! Wrapped ${wrappedFormatted} USDC to USDCx and created stream (fee: ${feeFormatted} USDC)`
          : `Access granted! Wrapped ${wrappedFormatted} USDC to USDCx (fee: ${feeFormatted} USDC)`,
        transactions: executedTxs,
        fee: fee.toString(),
        wrapped: amountToWrap.toString(),
        streamCreated,
        streamTxHash,
        imageUrl: "https://i.imgur.com/k2tPAGC.jpeg",
      };

      console.log("✅ [/resource] Payment completed", {
        account: paymentAccount,
        wrappedUSDC: wrappedFormatted,
        feeUSDC: feeFormatted,
        streamCreated,
        mode: contractAddress ? "contract" : "eoa",
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

  // Parse monthly amount early (needed for USDCx balance check and 402 response)
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

  const decimalDiff = SUPER_TOKEN_CONFIG.superToken.decimals - SUPER_TOKEN_CONFIG.underlyingToken.decimals;
  const monthlyAmountSuper = monthlyAmountUSDC * (10n ** BigInt(decimalDiff));
  const streamFlowRate = calculateFlowRate(monthlyAmountSuper);

  // Check if user already has enough USDCx to start streaming without wrapping
  const operatorAddress = contractAddress ?? facilitatorAddress;
  try {
    const { superTokenBalance } = await getWrapPreflight(publicClient, accountChecksum);
    if (superTokenBalance >= monthlyAmountSuper) {
      // User has enough USDCx — check if they granted ACL permissions
      const { hasPermissions } = await checkFlowPermissions(
        publicClient as any,
        accountChecksum,
        operatorAddress,
      );

      if (hasPermissions) {
        // Check USDCx allowance for fee collection
        const feeAmountSuper = FLAT_FEE * (10n ** BigInt(decimalDiff)); // 1 USDCx (18 decimals)
        const usdcxAllowance = await (publicClient.readContract({
          address: SUPER_TOKEN_CONFIG.superToken.address,
          abi: SUPER_TOKEN_ABI,
          functionName: "allowance",
          args: [accountChecksum, facilitatorAddress],
          authorizationList: undefined,
        } as any) as Promise<bigint>);

        if (usdcxAllowance < feeAmountSuper) {
          console.log("ℹ️ [/resource] Insufficient USDCx allowance for fee, falling back to 402", {
            account: accountChecksum,
            allowance: usdcxAllowance.toString(),
            required: feeAmountSuper.toString(),
          });
          // Fall through to 402
        } else {
          console.log("ℹ️ [/resource] User has sufficient USDCx + allowance, collecting fee and creating stream", {
            account: accountChecksum,
            recipient: recipientAddress,
            superTokenBalance: superTokenBalance.toString(),
            fee: formatUnits(feeAmountSuper, 18),
          });

          try {
            const executedTxs: Hash[] = [];

            // Pull 1 USDCx fee via transferFrom
            const feeTxHash = await walletClient.writeContract({
              account: facilitatorAccount,
              chain: undefined,
              address: SUPER_TOKEN_CONFIG.superToken.address,
              abi: SUPER_TOKEN_ABI,
              functionName: "transferFrom",
              args: [accountChecksum, facilitatorAddress, feeAmountSuper],
            });
            executedTxs.push(feeTxHash);
            await publicClient.waitForTransactionReceipt({ hash: feeTxHash });

            // Create stream
            const streamTxHash = await createFlow(
              walletClient,
              accountChecksum,
              recipientAddress,
              streamFlowRate,
            );
            executedTxs.push(streamTxHash);
            await publicClient.waitForTransactionReceipt({ hash: streamTxHash });

            console.log("✅ [/resource] Fee collected + stream created from existing USDCx", {
              account: accountChecksum,
              recipient: recipientAddress,
              flowRate: streamFlowRate.toString(),
              fee: formatUnits(feeAmountSuper, 18),
              feeTxHash,
              streamTxHash,
            });

            return c.json({
              status: "ok",
              account: accountChecksum,
              flowRate: streamFlowRate.toString(),
              recipient: recipientAddress,
              message: `Access granted! 1 USDCx fee collected and stream created`,
              streamCreated: true,
              streamTxHash,
              transactions: executedTxs,
              fee: feeAmountSuper.toString(),
              imageUrl: "https://i.imgur.com/k2tPAGC.jpeg",
            });
          } catch (streamError) {
            console.warn("⚠️ [/resource] Auto-stream creation failed, falling back to 402", {
              error: `${streamError}`,
            });
            // Fall through to 402 response
          }
        }
      }
    }
  } catch (err) {
    console.warn("⚠️ [/resource] USDCx balance check failed, falling back to 402", { error: `${err}` });
  }

  const host = c.req.header("host") ?? `localhost:${port}`;
  const protocol = c.req.header("x-forwarded-proto") ?? "http";
  const resourceUrl = `${protocol}://${host}${c.req.path}`;

  const desiredWrapAmount = monthlyAmountUSDC;
  const fee = calculateFee(desiredWrapAmount);
  const totalRequired = desiredWrapAmount + fee;

  const extra: Record<string, any> = {
    name: "USD Coin",
    version: "2",
    autoWrap: true,
    superToken: SUPER_TOKEN_CONFIG.superToken.address,
    wrapAmount: desiredWrapAmount.toString(),
    fee: fee.toString(),
    facilitator: payToAddress,
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
          payTo: payToAddress,
          resource: resourceUrl,
          description: `${formatUnits(fee, 6)} USDC fee + wrap ${formatUnits(desiredWrapAmount, 6)} USDC to USDCx & start stream to ${recipientAddress}`,
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
      to: payToAddress,
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

    // Calculate fee breakdown (flat 1 USDC fee)
    const fee = FLAT_FEE;
    const amountToWrap = totalPaid - fee;

    try {
      let primaryTxHash: Hash;
      let streamTxHash: Hash | null = null;
      let streamCreated = false;

      if (contractAddress) {
        // ── Contract mode: single atomic transaction ──
        const authParams = {
          validAfter: BigInt(authorization.validAfter),
          validBefore: BigInt(authorization.validBefore),
          nonce: authorization.nonce as Hex,
          v,
          r,
          s,
        };

        let streamRecipient: Address = "0x0000000000000000000000000000000000000000";
        let streamFlowRate = 0n;

        if (paymentRequirements?.extra?.stream) {
          const { recipient, flowRate } = paymentRequirements.extra.stream;
          if (recipient && flowRate) {
            const { hasPermissions } = await checkFlowPermissions(
              publicClient as any,
              account as Address,
              contractAddress,
            );
            if (hasPermissions) {
              streamRecipient = recipient as Address;
              streamFlowRate = BigInt(flowRate);
            }
          }
        }

        if (streamFlowRate > 0n) {
          primaryTxHash = await walletClient.writeContract({
            account: facilitatorAccount,
            chain: undefined,
            address: contractAddress,
            abi: FACILITATOR_CONTRACT_ABI,
            functionName: "processPayment",
            args: [account as Address, totalPaid, authParams, streamRecipient, streamFlowRate],
          });
          streamCreated = true;
          streamTxHash = primaryTxHash;
        } else {
          primaryTxHash = await walletClient.writeContract({
            account: facilitatorAccount,
            chain: undefined,
            address: contractAddress,
            abi: FACILITATOR_CONTRACT_ABI,
            functionName: "processPaymentWrapOnly",
            args: [account as Address, totalPaid, authParams],
          });
        }
        executedTxs.push(primaryTxHash);
        await publicClient.waitForTransactionReceipt({ hash: primaryTxHash });
      } else {
        // ── Legacy EOA mode ──
        const transferTxHash = await walletClient.writeContract({
          account: facilitatorAccount,
          chain: undefined,
          address: SUPER_TOKEN_CONFIG.underlyingToken.address,
          abi: EIP3009_ABI,
          functionName: "transferWithAuthorization",
          args: [account as Address, facilitatorAddress, totalPaid, BigInt(authorization.validAfter), BigInt(authorization.validBefore), authorization.nonce as Hex, v, r, s],
        });
        executedTxs.push(transferTxHash);
        await publicClient.waitForTransactionReceipt({ hash: transferTxHash });

        const approvalHash = await ensureAllowance(publicClient, walletClient, facilitatorAddress, SUPER_TOKEN_CONFIG.superToken.address, SUPER_TOKEN_CONFIG.underlyingToken.address, amountToWrap);
        if (approvalHash) {
          executedTxs.push(approvalHash);
          await publicClient.waitForTransactionReceipt({ hash: approvalHash });
        }

        const decimalDiff = SUPER_TOKEN_CONFIG.superToken.decimals - SUPER_TOKEN_CONFIG.underlyingToken.decimals;
        const superTokenAmount = amountToWrap * (10n ** BigInt(decimalDiff));

        primaryTxHash = await walletClient.writeContract({
          account: facilitatorAccount,
          chain: undefined,
          address: SUPER_TOKEN_CONFIG.superToken.address,
          abi: SUPER_TOKEN_ABI,
          functionName: "upgradeTo",
          args: [account as Address, superTokenAmount, EMPTY_BYTES],
        });
        executedTxs.push(primaryTxHash);
        await publicClient.waitForTransactionReceipt({ hash: primaryTxHash });

        if (paymentRequirements?.extra?.stream) {
          const { recipient, flowRate } = paymentRequirements.extra.stream;
          const { hasPermissions } = await checkFlowPermissions(publicClient as any, account as Address, facilitatorAddress);
          if (hasPermissions && recipient && flowRate) {
            try {
              streamTxHash = await createFlow(walletClient, account as Address, recipient as Address, BigInt(flowRate));
              executedTxs.push(streamTxHash);
              await publicClient.waitForTransactionReceipt({ hash: streamTxHash });
              streamCreated = true;
            } catch (streamError) {
              console.warn("Stream creation failed:", streamError);
            }
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
        streamCreated,
        streamTxHash,
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
x402-Compliant Superfluid Facilitator
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Mode:       ${contractAddress ? "Contract" : "EOA (legacy)"}
  PayTo:      ${payToAddress}
  Operator:   ${facilitatorAddress}${contractAddress ? `\n  Contract:   ${contractAddress}` : ""}
  Network:    Base Mainnet
  Scheme:     exact (EIP-3009)
  Fee:        max(0.1 USDC, 0.1% of amount)
  Port:       ${port}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

  serve({
    fetch: app.fetch,
    port,
  });
}

