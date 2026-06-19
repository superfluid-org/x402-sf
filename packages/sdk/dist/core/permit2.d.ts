import { type Address, type Hex, type PublicClient } from "viem";
/**
 * Read the owner's ERC-20 allowance to the canonical Permit2 contract for `token`.
 * Permit2 can only pull `token` once this allowance covers the amount — it's the
 * one-time on-chain step a user does before Permit2 signatures work.
 */
export declare function checkPermit2Allowance(publicClient: PublicClient, owner: Address, token: Address): Promise<bigint>;
/**
 * Approve the Permit2 contract to spend `token` (defaults to max — the standard
 * one-time Permit2 approval, after which gasless Permit2 signatures work).
 */
export declare function approvePermit2(walletClient: {
    writeContract: (args: Record<string, unknown>) => Promise<Hex>;
}, params: {
    token: Address;
    account: Address;
    amount?: bigint;
    chain?: unknown;
}): Promise<Hex>;
//# sourceMappingURL=permit2.d.ts.map