/**
 * Convert a monthly amount (in wei, 18 decimals) to a per-second flow rate.
 */
export declare function calculateFlowRate(monthlyAmount: bigint): bigint;
/**
 * Convert a per-second flow rate back to a monthly amount string (human-readable).
 */
export declare function formatFlowRateToMonthly(flowRate: bigint, decimals?: number): string;
/**
 * Normalize a transaction hash from walletClient.writeContract, handling
 * edge cases with non-standard hex formatting.
 */
export declare function normalizeTxHash(hash: unknown): `0x${string}`;
//# sourceMappingURL=utils.d.ts.map