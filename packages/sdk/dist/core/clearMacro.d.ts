import { type Address, type Hex, type PublicClient } from "viem";
import type { SuperTokenConfig } from "../types.js";
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
/** Parse an EIP-712 `encodeType` string into viem `types` + the primary type name. */
export declare function parseEip712Types(typeDefinition: string): {
    types: Record<string, {
        name: string;
        type: string;
    }[]>;
    primaryType: string;
};
/**
 * Build and sign a ClearMacro stream-creation execution. Does NOT submit it —
 * pass the result to `submitClearMacroExecution` (or hand it to a relayer).
 */
export declare function buildClearMacroStreamExecution(params: BuildClearMacroStreamParams): Promise<ClearMacroExecution>;
/** Submit a signed execution via `runMacro` (the submitter pays gas). */
export declare function submitClearMacroExecution(walletClient: {
    writeContract: (args: Record<string, unknown>) => Promise<Hex>;
}, execution: ClearMacroExecution, chain?: unknown): Promise<Hex>;
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
export declare function createStreamViaClearMacro(params: CreateStreamViaClearMacroParams): Promise<{
    execution: ClearMacroExecution;
    txHash: Hex;
}>;
/**
 * A `relay` that POSTs the signed execution to a facilitator's `/clearmacro/relay`
 * endpoint, which submits `runMacro` and pays gas (gasless for the user). Pair with
 * `providerName` matching the facilitator's provider role.
 *
 *   createStreamViaClearMacro({ ..., providerName: "x402-sf",
 *     relay: facilitatorRelay(`${facilitatorUrl}/clearmacro/relay`) })
 */
export declare function facilitatorRelay(relayUrl: string, fetchImpl?: typeof fetch): (execution: ClearMacroExecution) => Promise<Hex>;
//# sourceMappingURL=clearMacro.d.ts.map