import { hashTypedData, type Address, type Hex, type PublicClient } from "viem";

import type { SuperTokenConfig } from "../types.js";
import { DEFAULT_MONTHLY_AMOUNT } from "../constants.js";
import { calculateFlowRate } from "../utils.js";
import { clearMacroForwarderAbi, createFlowMacroAbi } from "../clearMacroAbis.js";

/**
 * Single-signature stream creation via Superfluid's ClearMacroForwarderV1.
 *
 * The user signs ONE EIP-712 message; the forwarder runs CreateFlowMacro in the
 * user's context and opens a Superfluid stream from the user to the recipient —
 * no ACL grant, no on-chain transaction required from the user (when a relayer
 * submits). This is the "clear signing" path.
 *
 * Correctness is enforced against the chain: the typed data is derived from the
 * forwarder's own `getTypeDefinition` + `eip712Domain`, and the locally computed
 * hash is checked against the on-chain `getDigest` before the user is asked to
 * sign — so a layout mismatch fails loudly instead of producing a bad signature.
 */

/** A fully-built, signed ClearMacro execution ready to submit via `runMacro`. */
export interface ClearMacroExecution {
  chainId: number;
  forwarder: Address;
  macro: Address;
  signer: Address;
  encodedPayload: Hex;
  signature: Hex;
  digest: Hex;
  /** Human-readable action description (what the wallet showed when clear-signing). */
  description: string;
}

export interface BuildClearMacroStreamParams {
  publicClient: PublicClient;
  /** Wallet client used to sign the typed data (the streaming user). */
  walletClient: {
    signTypedData: (args: Record<string, unknown>) => Promise<Hex>;
  };
  account: Address;
  config: SuperTokenConfig;
  recipient: Address;
  /** Monthly amount in super-token wei (18 decimals). Defaults to 1 token/month. */
  monthlyAmount?: bigint;
  /** Overrides `config.clearMacro.createFlowMacro`. */
  macroAddress?: Address;
  /** Overrides `config.clearMacro.forwarder`. */
  forwarderAddress?: Address;
  /**
   * Relay provider identifier (e.g. "x402-sf"). When set, both Security.provider and
   * Security.domain default to it — required for relayed (facilitator) submission, whose
   * msg.sender must hold the keccak256(providerName) ACL role on the forwarder. Omit for
   * self-submit (defaults to SELF_PROVIDER + empty domain).
   */
  providerName?: string;
  /** Overrides Security.domain. Defaults to providerName, else "" (self-submit). */
  securityDomain?: string;
  /** Overrides Security.provider. Defaults to providerName, else the forwarder's SELF_PROVIDER. */
  provider?: string;
  /** Authorization validity window in seconds from now. Defaults to 3600. */
  validitySeconds?: number;
  /** Nonce key (uint192). Defaults to 0. */
  nonceKey?: bigint;
  /** Unix seconds "now"; defaults to Date.now()/1000. Inject for deterministic tests. */
  nowSeconds?: number;
}

function resolveAddresses(params: BuildClearMacroStreamParams): {
  forwarder: Address;
  macro: Address;
} {
  const forwarder = params.forwarderAddress ?? params.config.clearMacro?.forwarder;
  const macro = params.macroAddress ?? params.config.clearMacro?.createFlowMacro;
  if (!forwarder) {
    throw new Error("ClearMacro: no forwarder address (config.clearMacro.forwarder)");
  }
  if (!macro) {
    throw new Error(
      "ClearMacro: no CreateFlowMacro address. Deploy contracts/src/CreateFlowMacro.sol and set " +
        "config.clearMacro.createFlowMacro (or pass macroAddress).",
    );
  }
  return { forwarder, macro };
}

/** Parse an EIP-712 `encodeType` string into viem `types` + the primary type name. */
export function parseEip712Types(typeDefinition: string): {
  types: Record<string, { name: string; type: string }[]>;
  primaryType: string;
} {
  const types: Record<string, { name: string; type: string }[]> = {};
  let primaryType = "";
  // EIP-712 struct names are PascalCase; anchor on an uppercase initial so field tokens
  // are never mistaken for a struct (matches the Superfluid dashboard's parser).
  const structRe = /([A-Z]\w*)\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = structRe.exec(typeDefinition)) !== null) {
    const name = match[1];
    const body = match[2];
    if (name === "EIP712Domain") continue; // viem supplies the domain separately
    const fields =
      body.trim().length === 0
        ? []
        : body.split(",").map((token) => {
            const [type, fieldName] = token.trim().split(/\s+/);
            return { name: fieldName, type };
          });
    types[name] = fields;
    if (!primaryType) primaryType = name; // EIP-712 lists the primary type first
  }
  if (!primaryType) throw new Error(`ClearMacro: could not parse type definition: ${typeDefinition}`);
  return { types, primaryType };
}

/** Recursively build the typed-data message, resolving leaf values by field name. */
function buildMessage(
  typeName: string,
  types: Record<string, { name: string; type: string }[]>,
  leaves: Record<string, unknown>,
): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const field of types[typeName]) {
    if (types[field.type]) {
      obj[field.name] = buildMessage(field.type, types, leaves);
    } else {
      if (!(field.name in leaves)) {
        throw new Error(`ClearMacro: missing value for typed-data field "${field.name}"`);
      }
      obj[field.name] = leaves[field.name];
    }
  }
  return obj;
}

/**
 * Build and sign a ClearMacro stream-creation execution. Does NOT submit it —
 * pass the result to `submitClearMacroExecution` (or hand it to a relayer).
 */
export async function buildClearMacroStreamExecution(
  params: BuildClearMacroStreamParams,
): Promise<ClearMacroExecution> {
  const { publicClient, walletClient, account, config, recipient } = params;
  const { forwarder, macro } = resolveAddresses(params);

  const superToken = config.superToken.address;
  const monthlyAmount = params.monthlyAmount ?? DEFAULT_MONTHLY_AMOUNT;
  const flowRate = calculateFlowRate(monthlyAmount);
  if (flowRate <= 0n) throw new Error("ClearMacro: monthlyAmount too small (flow rate rounds to 0)");

  // 1. Encode the macro action (and read the on-chain human-readable description).
  const [actionParams, description] = (await publicClient.readContract({
    address: macro,
    abi: createFlowMacroAbi,
    functionName: "encodeAction",
    args: [superToken, recipient, flowRate],
  })) as [Hex, string, Hex];

  // 2. Build the security envelope.
  const nonce = (await publicClient.readContract({
    address: forwarder,
    abi: clearMacroForwarderAbi,
    functionName: "getNonce",
    args: [account, params.nonceKey ?? 0n],
  })) as bigint;

  const provider =
    params.provider ??
    params.providerName ??
    ((await publicClient.readContract({
      address: forwarder,
      abi: clearMacroForwarderAbi,
      functionName: "SELF_PROVIDER",
    })) as string);

  const nowSeconds = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  const validBefore = BigInt(nowSeconds + (params.validitySeconds ?? 3600));
  const security = {
    domain: params.securityDomain ?? params.providerName ?? "",
    macroContract: macro,
    provider,
    validAfter: 0n,
    validBefore,
    nonce,
  };

  // 3. Encode the Payload via the forwarder's on-chain helper (canonical path).
  const encodedPayload = (await publicClient.readContract({
    address: forwarder,
    abi: clearMacroForwarderAbi,
    functionName: "encodeParams",
    args: [actionParams, security],
  })) as Hex;

  // 4. Read the canonical digest, type definition, domain, and primary type name.
  const [digest, typeDefinition, domainResult, primaryType] = await Promise.all([
    publicClient.readContract({
      address: forwarder,
      abi: clearMacroForwarderAbi,
      functionName: "getDigest",
      args: [macro, encodedPayload],
    }) as Promise<Hex>,
    publicClient.readContract({
      address: forwarder,
      abi: clearMacroForwarderAbi,
      functionName: "getTypeDefinition",
      args: [macro, encodedPayload],
    }) as Promise<string>,
    publicClient.readContract({
      address: forwarder,
      abi: clearMacroForwarderAbi,
      functionName: "eip712Domain",
    }) as Promise<readonly [Hex, string, string, bigint, Address, Hex, readonly bigint[]]>,
    publicClient.readContract({
      address: macro,
      abi: createFlowMacroAbi,
      functionName: "getPrimaryTypeName",
      args: [encodedPayload],
    }) as Promise<string>,
  ]);

  const domain = {
    name: domainResult[1],
    version: domainResult[2],
    chainId: Number(domainResult[3]),
    verifyingContract: domainResult[4],
  };

  // 5. Derive the typed data from the chain and build the message.
  const { types } = parseEip712Types(typeDefinition);
  if (!types[primaryType]) {
    throw new Error(
      `ClearMacro: primary type "${primaryType}" not present in type definition: ${typeDefinition}`,
    );
  }
  const leaves: Record<string, unknown> = {
    description,
    // Some deployed macro typedefs name the super-token field `token`, others `superToken`
    // (e.g. Superfluid's DashboardClearMacro uses `token`). Provide both so the message
    // builder resolves whichever the on-chain type definition declares.
    superToken,
    token: superToken,
    receiver: recipient,
    flowRate,
    domain: security.domain,
    macroContract: security.macroContract,
    provider: security.provider,
    validAfter: security.validAfter,
    validBefore: security.validBefore,
    nonce: security.nonce,
  };
  const message = buildMessage(primaryType, types, leaves);

  // 6. Verify our typed data hashes to the on-chain digest BEFORE signing.
  const localDigest = hashTypedData({ domain, types, primaryType, message });
  if (localDigest.toLowerCase() !== digest.toLowerCase()) {
    throw new Error(
      "ClearMacro: derived typed-data hash does not match the forwarder's getDigest. " +
        `local=${localDigest} onchain=${digest}. The EIP-712 layout from getTypeDefinition ` +
        "could not be reconstructed — refusing to sign a payload that won't verify.",
    );
  }

  // 7. Clear-sign.
  const signature = await walletClient.signTypedData({
    account,
    domain,
    types,
    primaryType,
    message,
  });

  return {
    chainId: domain.chainId,
    forwarder,
    macro,
    signer: account,
    encodedPayload,
    signature,
    digest,
    description,
  };
}

/** Submit a signed execution via `runMacro` (the submitter pays gas). */
export async function submitClearMacroExecution(
  walletClient: {
    writeContract: (args: Record<string, unknown>) => Promise<Hex>;
  },
  execution: ClearMacroExecution,
  chain?: unknown,
): Promise<Hex> {
  return walletClient.writeContract({
    address: execution.forwarder,
    abi: clearMacroForwarderAbi,
    functionName: "runMacro",
    args: [execution.macro, execution.encodedPayload, execution.signer, execution.signature],
    account: execution.signer,
    chain,
  });
}

export interface CreateStreamViaClearMacroParams extends BuildClearMacroStreamParams {
  walletClient: BuildClearMacroStreamParams["walletClient"] & {
    writeContract: (args: Record<string, unknown>) => Promise<Hex>;
  };
  chain?: unknown;
  /**
   * Optional relayer for the gasless path: receives the signed execution and
   * returns the submit tx hash. When omitted, the signer self-submits `runMacro`.
   */
  relay?: (execution: ClearMacroExecution) => Promise<Hex>;
}

/** Build + sign + submit in one call. Returns the execution and the submit tx hash. */
export async function createStreamViaClearMacro(
  params: CreateStreamViaClearMacroParams,
): Promise<{ execution: ClearMacroExecution; txHash: Hex }> {
  const execution = await buildClearMacroStreamExecution(params);
  const txHash = params.relay
    ? await params.relay(execution)
    : await submitClearMacroExecution(params.walletClient, execution, params.chain);
  return { execution, txHash };
}

/**
 * A `relay` that POSTs the signed execution to a facilitator's `/clearmacro/relay`
 * endpoint, which submits `runMacro` and pays gas (gasless for the user). Pair with
 * `providerName` matching the facilitator's provider role.
 *
 *   createStreamViaClearMacro({ ..., providerName: "x402-sf",
 *     relay: facilitatorRelay(`${facilitatorUrl}/clearmacro/relay`) })
 */
export function facilitatorRelay(
  relayUrl: string,
  fetchImpl: typeof fetch = fetch,
): (execution: ClearMacroExecution) => Promise<Hex> {
  return async (execution) => {
    const response = await fetchImpl(relayUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chainId: execution.chainId,
        macroAddress: execution.macro,
        signerAddress: execution.signer,
        payload: execution.encodedPayload,
        signature: execution.signature,
      }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Facilitator relay failed (HTTP ${response.status}): ${text}`);
    }
    const data = (await response.json()) as { txHash?: Hex; error?: string };
    if (!data.txHash) throw new Error(data.error ?? "Facilitator relay returned no txHash");
    return data.txHash;
  };
}
