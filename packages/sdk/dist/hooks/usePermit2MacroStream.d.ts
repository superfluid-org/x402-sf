import { type Address } from "viem";
import type { SuperTokenConfig, Balances } from "../types.js";
export type Permit2MacroStatus = "disconnected" | "wrong-network" | "loading" | "needs-config" | "needs-approval" | "approving" | "ready" | "subscribing" | "active" | "error";
export interface ClearMacroFacilitatorInfo {
    forwarder: Address;
    provider: string;
    macro?: Address;
    permit2RelayPath: string;
}
export interface UsePermit2MacroStreamOptions {
    facilitatorUrl: string;
    recipient: Address;
    /** Monthly amount in super-token wei (18 decimals). Defaults to 1 token/month. */
    monthlyAmount?: string;
    config?: SuperTokenConfig;
}
export interface UsePermit2MacroStreamReturn {
    status: Permit2MacroStatus;
    /** One-time ERC-20 approval of Permit2 for the underlying token (gas). */
    approve: () => Promise<void>;
    subscribe: () => Promise<void>;
    error: string | null;
    streamUrl: string | null;
    txHash: string | null;
    description: string | null;
    info: ClearMacroFacilitatorInfo | null;
    balances: Balances;
}
/**
 * One-signature stream creation via Permit2 + ClearMacro. The user signs a single Permit2
 * witness message; the facilitator pulls USDC, upgrades it to USDCx, and opens the stream
 * in one transaction (gasless for the user). No ACL grant, no approval, no pre-existing USDCx.
 *
 * Reads the macro/provider/relay path from the facilitator's `/info`.
 */
export declare function usePermit2MacroStream(options: UsePermit2MacroStreamOptions): UsePermit2MacroStreamReturn;
//# sourceMappingURL=usePermit2MacroStream.d.ts.map