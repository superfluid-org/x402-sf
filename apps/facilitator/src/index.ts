import { config as loadEnv } from "dotenv";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { getAddress, isAddress, publicActions, recoverAddress, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { verify, settle } from "x402/facilitator";
import { VerifyRequestSchema, SettleRequestSchema, type ConnectedClient, type Signer } from "x402/types";
import { createNetworkClients, type NetworkClients } from "./superfluid.js";
import { NETWORK_CONFIGS, ALL_NETWORKS, isNetworkName, type NetworkName } from "./config.js";
import { CLEAR_MACRO_FORWARDER_ADDRESS, CLEAR_MACRO_FORWARDER_ABI } from "./clearMacro.js";

loadEnv();

// Required environment variables
const privateKeyEnv = process.env.FACILITATOR_PRIVATE_KEY;
if (!privateKeyEnv) {
  console.error("❌ Missing required environment variable: FACILITATOR_PRIVATE_KEY");
  process.exit(1);
}

// Optional environment variables with defaults
const port = Number(process.env.PORT || 4020);
const allowedOrigins = process.env.ALLOWED_ORIGIN
  ? process.env.ALLOWED_ORIGIN.split(",")
  : ["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"];

const facilitatorPrivateKey = (privateKeyEnv.startsWith("0x") ? privateKeyEnv : `0x${privateKeyEnv}`) as Hex;

// Which networks this instance serves. Default: all known networks (multi-network). Override
// with ENABLED_NETWORKS (comma-separated x402 network names, e.g. "base,base-sepolia") to run
// a single-network instance. RPC per network comes from BASE_RPC_URL / BASE_SEPOLIA_RPC_URL
// (each falls back to the network's default public RPC).
const enabledNetworks: NetworkName[] = (() => {
  const raw = process.env.ENABLED_NETWORKS;
  if (!raw) return ALL_NETWORKS;
  const names = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const invalid = names.filter((n) => !isNetworkName(n));
  if (invalid.length) {
    console.error(
      `❌ ENABLED_NETWORKS has unknown network(s): ${invalid.join(", ")}. Known: ${ALL_NETWORKS.join(", ")}`,
    );
    process.exit(1);
  }
  return names as NetworkName[];
})();

// Per-network runtime context: chain-bound clients + a settle-capable signer.
interface NetworkContext {
  config: (typeof NETWORK_CONFIGS)[NetworkName];
  clients: NetworkClients;
  // x402's settle needs a Signer (wallet client + public actions, so it can submit the
  // transferWithAuthorization and read the receipt). Cast past viem's deep client-type
  // inference — the same instability that forces the `as never` reads below.
  settleSigner: Signer;
}

const networks = new Map<NetworkName, NetworkContext>();
const networkByChainId = new Map<number, NetworkName>();
for (const net of enabledNetworks) {
  const clients = createNetworkClients(net, facilitatorPrivateKey);
  networks.set(net, {
    config: NETWORK_CONFIGS[net],
    clients,
    settleSigner: clients.walletClient.extend(publicActions) as unknown as Signer,
  });
  networkByChainId.set(NETWORK_CONFIGS[net].chain.id, net);
}

// Same operator EOA on every chain (shared key).
const facilitatorAddress = privateKeyToAccount(facilitatorPrivateKey).address;
// The network whose fields populate the back-compat top-level /info shape.
const primaryNetwork: NetworkName = networks.has("base") ? "base" : enabledNetworks[0];

// Read a bytes32 view function on the ClearMacroForwarder for a given network's client.
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
  publicClient: NetworkClients["publicClient"],
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
  const primary = networks.get(primaryNetwork)!;
  return c.json({
    operator: facilitatorAddress,
    // Back-compat single-network fields (reflect the primary network). Multi-network
    // clients should read the `networks` array below instead.
    network: primary.config.chain.networkName,
    chainId: primary.config.chain.id,
    superToken: primary.config.superToken.address,
    underlyingToken: primary.config.underlyingToken.address,
    // Plain x402 "exact" scheme: one-time EIP-3009 USDC payment to the merchant, no stream.
    x402: {
      scheme: "exact",
      network: primary.config.x402.network,
      asset: primary.config.x402.asset.address,
      supportedPath: "/supported",
      verifyPath: "/verify",
      settlePath: "/settle",
    },
    clearMacro: {
      forwarder: CLEAR_MACRO_FORWARDER_ADDRESS,
      provider: clearMacroProvider,
      relayPath: "/clearmacro/relay",
      permit2RelayPath: "/clearmacro/permit2-relay",
      ...(createFlowMacroAddress ? { macro: createFlowMacroAddress } : {}),
    },
    // Every network this instance serves. verify/settle route on `network`; clearmacro on `chainId`.
    networks: enabledNetworks.map((net) => {
      const ctx = networks.get(net)!;
      return {
        network: ctx.config.chain.networkName,
        chainId: ctx.config.chain.id,
        superToken: ctx.config.superToken.address,
        underlyingToken: ctx.config.underlyingToken.address,
        x402Asset: ctx.config.x402.asset.address,
      };
    }),
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

  const net = networkByChainId.get(chainId);
  if (!net) {
    return c.json(
      { error: `Unsupported chain ${chainId} (supported: ${[...networkByChainId.keys()].join(", ")})` },
      400,
    );
  }
  const { publicClient, walletClient, account } = networks.get(net)!.clients;

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
    const digest = await readForwarderBytes32(publicClient, "getDigest", [macro, payloadHex]);
    const recovered = await recoverAddress({ hash: digest, signature: signatureHex });
    if (recovered.toLowerCase() !== signer.toLowerCase()) {
      return c.json({ error: "Signature does not match signer for this payload" }, 400);
    }
  } catch (error) {
    return c.json({ error: "Could not verify payload/signature", details: `${error}` }, 400);
  }

  try {
    const txHash = await walletClient.writeContract({
      account,
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

  const net = networkByChainId.get(chainId);
  if (!net) {
    return c.json(
      { error: `Unsupported chain ${chainId} (supported: ${[...networkByChainId.keys()].join(", ")})` },
      400,
    );
  }
  const { publicClient, walletClient, account } = networks.get(net)!.clients;
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
    const expectedWitness = await readForwarderBytes32(publicClient, "getPermit2WitnessStructHash", [
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
      account,
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



// ── Plain x402 "exact" scheme ────────────────────────────────────────────────
// A standard, spec-compliant x402 facilitator: no streams, no wrapping. The payer
// signs an EIP-3009 `transferWithAuthorization` that pays the resource server's
// `payTo` in full; the facilitator only verifies the signature and (on settle)
// submits the tx on-chain, paying gas. Any x402 client (x402-axios / x402-fetch)
// can drive this. Delegates scheme logic to the official `x402` package, which
// supports both `base` and `base-sepolia`.

// Resolve the network context for an "exact"-scheme request, or return an error string.
// The network is taken from paymentRequirements.network (per the x402 spec) and must be one
// this instance serves — that's how a single facilitator handles multiple chains.
function resolveExact(
  paymentRequirements: { scheme: string; network: string },
): { ctx: NetworkContext } | { error: string } {
  if (paymentRequirements.scheme !== "exact") {
    return { error: `Unsupported scheme "${paymentRequirements.scheme}" (only "exact")` };
  }
  if (!isNetworkName(paymentRequirements.network) || !networks.has(paymentRequirements.network)) {
    return {
      error: `Unsupported network "${paymentRequirements.network}" (supported: ${enabledNetworks.join(", ")})`,
    };
  }
  return { ctx: networks.get(paymentRequirements.network)! };
}

// Advertise which (scheme, network) pairs this facilitator settles — one kind per network.
app.get("/supported", (c) => {
  return c.json({
    kinds: enabledNetworks.map((network) => ({
      x402Version: 1,
      scheme: "exact",
      network,
    })),
  });
});

// Verify a signed payment payload against its requirements — no on-chain write, no gas.
// The resource server calls this before serving content to confirm the payment is valid.
app.post("/verify", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = VerifyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }
  const { paymentPayload, paymentRequirements } = parsed.data;

  const resolved = resolveExact(paymentRequirements);
  if ("error" in resolved) {
    return c.json({ isValid: false, invalidReason: resolved.error }, 400);
  }

  try {
    // Cast past viem's deep client-type inference (same instability handled for settle/reads).
    const client = resolved.ctx.clients.publicClient as unknown as ConnectedClient;
    const result = await verify(client, paymentPayload, paymentRequirements);
    return c.json(result);
  } catch (error) {
    console.error("❌ [/verify] verify failed", { error: `${error}` });
    return c.json({ isValid: false, invalidReason: `Verification error: ${error}` }, 500);
  }
});

// Settle a payment: submit the EIP-3009 transferWithAuthorization on-chain (facilitator
// pays gas) and return the tx hash. Full amount goes payer → payTo; no fee is taken.
app.post("/settle", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = SettleRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }
  const { paymentPayload, paymentRequirements } = parsed.data;

  const resolved = resolveExact(paymentRequirements);
  if ("error" in resolved) {
    return c.json({ success: false, errorReason: resolved.error }, 400);
  }

  try {
    const result = await settle(resolved.ctx.settleSigner, paymentPayload, paymentRequirements);
    return c.json(result);
  } catch (error) {
    console.error("❌ [/settle] settle failed", { error: `${error}` });
    return c.json({ success: false, errorReason: `Settlement error: ${error}` }, 500);
  }
});

// Export handler for Vercel serverless functions
export default app;

// Only start server if not on Vercel (local development)
if (!process.env.VERCEL) {
  const networkLines = enabledNetworks
    .map((n) => `${NETWORK_CONFIGS[n].chain.name} (${NETWORK_CONFIGS[n].chain.id})`)
    .join(", ");
  console.log(`
Superfluid x402 Facilitator (multi-network)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Operator:   ${facilitatorAddress}
  Networks:   ${networkLines}
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

