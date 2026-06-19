import { type Address, type Hex, type PublicClient } from "viem";
import type { SuperTokenConfig } from "../types.js";
/**
 * Single-signature stream creation with Permit2 bundling, via
 * `ClearMacroForwarderV1WithPermit2.runPermit2AndMacro`.
 *
 * ONE Permit2 `PermitWitnessTransferFrom` signature does everything: pulls the underlying
 * token (e.g. USDC) from the user, upgrades it to the Super Token (USDCx), then runs the
 * macro (creates the stream) — all in one transaction, with no pre-existing USDCx, no
 * approval, and no ACL grant. The ClearMacro payload is bound into the Permit2 witness, so
 * the relayer cannot alter what runs.
 *
 * The witness type is `ClearMacro(address upgradeSuperToken,Action action,Security security)`.
 * We reconstruct it from the forwarder's `getPermit2WitnessTypeString` and verify our
 * witness message hashes to the on-chain `getPermit2WitnessStructHash` BEFORE signing.
 */
export interface Permit2MacroContext {
    permit: {
        permitted: {
            token: Address;
            amount: bigint;
        };
        nonce: bigint;
        deadline: bigint;
    };
    owner: Address;
    witness: Hex;
    witnessTypeString: string;
    signature: Hex;
    spender: Address;
    upgradeSuperToken: Address;
}
export interface Permit2MacroExecution {
    chainId: number;
    forwarder: Address;
    macro: Address;
    signer: Address;
    encodedPayload: Hex;
    permit2Context: Permit2MacroContext;
    /** Human-readable action description (what the wallet showed inside the witness). */
    description: string;
}
export interface BuildPermit2MacroStreamParams {
    publicClient: PublicClient;
    walletClient: {
        signTypedData: (args: Record<string, unknown>) => Promise<Hex>;
    };
    account: Address;
    config: SuperTokenConfig;
    recipient: Address;
    /** Monthly amount in super-token wei (18 decimals). Defaults to 1 token/month. */
    monthlyAmount?: bigint;
    /** Underlying amount (base units) to pull + upgrade. Defaults to monthlyAmount converted. */
    upgradeAmount?: bigint;
    macroAddress?: Address;
    forwarderAddress?: Address;
    providerName?: string;
    securityDomain?: string;
    provider?: string;
    /** Validity / Permit2 deadline window in seconds from now. Defaults to 3600. */
    validitySeconds?: number;
    nonceKey?: bigint;
    /** Permit2 nonce (unordered). Defaults to a random 256-bit value. */
    permit2Nonce?: bigint;
    nowSeconds?: number;
}
/** Build + sign a Permit2-bundled ClearMacro stream creation (does not submit). */
export declare function buildPermit2MacroStreamExecution(params: BuildPermit2MacroStreamParams): Promise<Permit2MacroExecution>;
/** Submit a signed Permit2 macro execution via `runPermit2AndMacro` (submitter pays gas). */
export declare function submitPermit2MacroExecution(walletClient: {
    writeContract: (args: Record<string, unknown>) => Promise<Hex>;
}, execution: Permit2MacroExecution, chain?: unknown): Promise<Hex>;
export interface CreateStreamViaPermit2MacroParams extends BuildPermit2MacroStreamParams {
    walletClient: BuildPermit2MacroStreamParams["walletClient"] & {
        writeContract: (args: Record<string, unknown>) => Promise<Hex>;
    };
    chain?: unknown;
    /** Optional relayer (e.g. the facilitator); omit to self-submit runPermit2AndMacro. */
    relay?: (execution: Permit2MacroExecution) => Promise<Hex>;
}
/** Build + sign + submit a Permit2-bundled stream creation in one call. */
export declare function createStreamViaPermit2Macro(params: CreateStreamViaPermit2MacroParams): Promise<{
    execution: Permit2MacroExecution;
    txHash: Hex;
}>;
/**
 * A `relay` that POSTs a signed Permit2 macro execution to a facilitator's
 * `/clearmacro/permit2-relay` endpoint (which submits `runPermit2AndMacro` and pays gas).
 */
export declare function facilitatorPermit2Relay(relayUrl: string, fetchImpl?: typeof fetch): (execution: Permit2MacroExecution) => Promise<Hex>;
//# sourceMappingURL=clearMacroPermit2.d.ts.map