import { config as loadEnv } from "dotenv";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { getAddress, isAddress, recoverAddress, type Address, type Hex } from "viem";
import { createBasePublicClient, createFacilitatorWalletClient } from "./superfluid.js";
import { SUPER_TOKEN_CONFIG } from "./config.js";
import { CLEAR_MACRO_FORWARDER_ADDRESS, CLEAR_MACRO_FORWARDER_ABI } from "./clearMacro.js";

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

// Read a bytes32 view function on the ClearMacroForwarder.
//
// viem's client-method `readContract` parameter type is computed from a deep, recursive
// conditional-type chain. Under tighter type-inference budgets (notably Vercel's build) TS
// bails out of that inference and widens the param to a `CallParameters` union member that
// wrongly requires the EIP-7702 `authorizationList` field — failing the build with
// "Property 'authorizationList' is missing". It compiles fine locally because TS completes
// the inference there. These are plain `view` reads with statically-known, correct ABI
// args, so we cast past the unstable param inference; the `Promise<Hex>` return keeps the
// call sites type-safe.
function readForwarderBytes32(
  functionName: "getDigest" | "getPermit2WitnessStructHash",
  args: readonly (Address | Hex)[],
): Promise<Hex> {
  return publicClient.readContract({
    address: CLEAR_MACRO_FORWARDER_ADDRESS,
    abi: CLEAR_MACRO_FORWARDER_ABI,
    functionName,
    args,
  } as never) as Promise<Hex>;
}

// Clear Macro relay: the provider string whose ACL role the facilitator must hold on the
// forwarder. Superfluid grants keccak256(CLEARMACRO_PROVIDER) → this facilitator address.
const clearMacroProvider = process.env.CLEARMACRO_PROVIDER ?? "x402.superfluid.eth";
// Optional allowlist: when set, only this macro is relayed (avoids paying gas for arbitrary macros).
const createFlowMacroAddress = process.env.CREATE_FLOW_MACRO_ADDRESS
  ? getAddress(process.env.CREATE_FLOW_MACRO_ADDRESS)
  : null;

const app = new Hono();

app.use(
  "*",
  cors({
    // Reflect explicitly-allowed origins, plus ANY localhost/127.0.0.1 origin (any port) for
    // dev — so it works regardless of which port the Next dev server lands on.
    origin: (origin) => {
      if (!origin) return allowedOrigins[0];
      if (allowedOrigins.includes(origin)) return origin;
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
      return allowedOrigins[0];
    },
    allowHeaders: ["Content-Type", "X-Payment", "Access-Control-Expose-Headers"],
    exposeHeaders: ["X-Payment-Response"], // x402 requires this header to be exposed
    allowMethods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  }),
);

app.get("/info", (c) => {
  return c.json({
    operator: facilitatorAddress,
    network: SUPER_TOKEN_CONFIG.chain.networkName,
    chainId: SUPER_TOKEN_CONFIG.chain.id,
    superToken: SUPER_TOKEN_CONFIG.superToken.address,
    underlyingToken: SUPER_TOKEN_CONFIG.underlyingToken.address,
    clearMacro: {
      forwarder: CLEAR_MACRO_FORWARDER_ADDRESS,
      provider: clearMacroProvider,
      relayPath: "/clearmacro/relay",
      permit2RelayPath: "/clearmacro/permit2-relay",
      ...(createFlowMacroAddress ? { macro: createFlowMacroAddress } : {}),
    },
  });
});

// Relay a single-signature Clear Macro execution (e.g. CreateFlowMacro): the user signs
// once, the facilitator submits runMacro and pays gas. Requires the facilitator to hold
// the provider ACL role keccak256(clearMacroProvider) on the forwarder, else runMacro
// reverts ProviderNotAuthorized.
const clearMacroRelaySchema = z.object({
  chainId: z.number().int(),
  macroAddress: z.string().refine(isAddress, "Invalid macroAddress"),
  signerAddress: z.string().refine(isAddress, "Invalid signerAddress"),
  payload: z.string().regex(/^0x[0-9a-fA-F]*$/, "Invalid payload"),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/, "Invalid signature"),
});

app.post("/clearmacro/relay", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = clearMacroRelaySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }
  const { chainId, macroAddress, signerAddress, payload, signature } = parsed.data;

  if (chainId !== SUPER_TOKEN_CONFIG.chain.id) {
    return c.json({ error: `Unsupported chain ${chainId} (expected ${SUPER_TOKEN_CONFIG.chain.id})` }, 400);
  }

  const macro = getAddress(macroAddress);
  if (createFlowMacroAddress && macro !== createFlowMacroAddress) {
    return c.json({ error: "Macro not allowed" }, 403);
  }
  const signer = getAddress(signerAddress);
  const payloadHex = payload as Hex;
  const signatureHex = signature as Hex;

  // Pre-flight: recover the signer from the forwarder's on-chain digest so we never spend
  // gas relaying a runMacro the forwarder would revert with InvalidSignature.
  try {
    const digest = await readForwarderBytes32("getDigest", [macro, payloadHex]);
    const recovered = await recoverAddress({ hash: digest, signature: signatureHex });
    if (recovered.toLowerCase() !== signer.toLowerCase()) {
      return c.json({ error: "Signature does not match signer for this payload" }, 400);
    }
  } catch (error) {
    return c.json({ error: "Could not verify payload/signature", details: `${error}` }, 400);
  }

  try {
    const txHash = await walletClient.writeContract({
      account: facilitatorAccount,
      chain: undefined,
      address: CLEAR_MACRO_FORWARDER_ADDRESS,
      abi: CLEAR_MACRO_FORWARDER_ABI,
      functionName: "runMacro",
      args: [macro, payloadHex, signer, signatureHex],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    return c.json({ txHash, status: receipt.status });
  } catch (error) {
    console.error("❌ [/clearmacro/relay] runMacro failed", { error: `${error}` });
    return c.json({ error: "Relay failed", details: `${error}` }, 500);
  }
});

// Relay a Permit2-bundled Clear Macro execution: one user signature pulls the underlying
// token, upgrades it to the Super Token, and runs the macro (creates the stream). The
// facilitator submits runPermit2AndMacro and pays gas. Same provider-role requirement.
const addrSchema = z.string().refine(isAddress, "Invalid address");
const uintStrSchema = z.string().regex(/^[0-9]+$/, "Invalid uint");
const clearMacroPermit2Schema = z.object({
  chainId: z.number().int(),
  macroAddress: addrSchema,
  payload: z.string().regex(/^0x[0-9a-fA-F]*$/, "Invalid payload"),
  permit2Context: z.object({
    permit: z.object({
      permitted: z.object({ token: addrSchema, amount: uintStrSchema }),
      nonce: uintStrSchema,
      deadline: uintStrSchema,
    }),
    owner: addrSchema,
    witness: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid witness"),
    witnessTypeString: z.string().min(1),
    signature: z.string().regex(/^0x[0-9a-fA-F]+$/, "Invalid signature"),
    spender: addrSchema,
    upgradeSuperToken: addrSchema,
  }),
});

app.post("/clearmacro/permit2-relay", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = clearMacroPermit2Schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }
  const { chainId, macroAddress, payload, permit2Context: ctx } = parsed.data;

  if (chainId !== SUPER_TOKEN_CONFIG.chain.id) {
    return c.json({ error: `Unsupported chain ${chainId} (expected ${SUPER_TOKEN_CONFIG.chain.id})` }, 400);
  }
  const macro = getAddress(macroAddress);
  if (createFlowMacroAddress && macro !== createFlowMacroAddress) {
    return c.json({ error: "Macro not allowed" }, 403);
  }
  if (getAddress(ctx.spender) !== CLEAR_MACRO_FORWARDER_ADDRESS) {
    return c.json({ error: "permit2Context.spender must be the ClearMacroForwarder" }, 400);
  }

  const payloadHex = payload as Hex;
  const upgradeSuperToken = getAddress(ctx.upgradeSuperToken);

  // Pre-check: the witness must match the on-chain struct hash, else runPermit2AndMacro reverts.
  try {
    const expectedWitness = await readForwarderBytes32("getPermit2WitnessStructHash", [
      macro,
      payloadHex,
      upgradeSuperToken,
    ]);
    if (ctx.witness.toLowerCase() !== expectedWitness.toLowerCase()) {
      return c.json({ error: "Witness does not match payload" }, 400);
    }
  } catch (error) {
    return c.json({ error: "Could not verify witness", details: `${error}` }, 400);
  }

  const permit2Context = {
    permit: {
      permitted: {
        token: getAddress(ctx.permit.permitted.token),
        amount: BigInt(ctx.permit.permitted.amount),
      },
      nonce: BigInt(ctx.permit.nonce),
      deadline: BigInt(ctx.permit.deadline),
    },
    owner: getAddress(ctx.owner),
    witness: ctx.witness as Hex,
    witnessTypeString: ctx.witnessTypeString,
    signature: ctx.signature as Hex,
    spender: CLEAR_MACRO_FORWARDER_ADDRESS,
    upgradeSuperToken,
  };

  try {
    const txHash = await walletClient.writeContract({
      account: facilitatorAccount,
      chain: undefined,
      address: CLEAR_MACRO_FORWARDER_ADDRESS,
      abi: CLEAR_MACRO_FORWARDER_ABI,
      functionName: "runPermit2AndMacro",
      args: [permit2Context, macro, payloadHex],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    return c.json({ txHash, status: receipt.status });
  } catch (error) {
    console.error("❌ [/clearmacro/permit2-relay] runPermit2AndMacro failed", { error: `${error}` });
    return c.json({ error: "Relay failed", details: `${error}` }, 500);
  }
});



// Export handler for Vercel serverless functions
export default app;

// Only start server if not on Vercel (local development)
if (!process.env.VERCEL) {
  console.log(`
Superfluid Clear Macro Facilitator
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Operator:   ${facilitatorAddress}
  Network:    ${SUPER_TOKEN_CONFIG.chain.name}
  Provider:   ${clearMacroProvider}
  Macro:      ${createFlowMacroAddress ?? "(any — no allowlist set)"}
  Forwarder:  ${CLEAR_MACRO_FORWARDER_ADDRESS}
  Port:       ${port}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

  serve({
    fetch: app.fetch,
    port,
  });
}

