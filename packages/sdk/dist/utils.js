import { formatUnits } from "viem";
import { SECONDS_PER_MONTH } from "./constants.js";
/**
 * Convert a monthly amount (in wei, 18 decimals) to a per-second flow rate.
 */
export function calculateFlowRate(monthlyAmount) {
    return monthlyAmount / SECONDS_PER_MONTH;
}
/**
 * Convert a per-second flow rate back to a monthly amount string (human-readable).
 */
export function formatFlowRateToMonthly(flowRate, decimals = 18) {
    if (flowRate === 0n)
        return "0";
    const monthly = flowRate * SECONDS_PER_MONTH;
    const formatted = formatUnits(monthly, decimals);
    const rounded = Math.round(parseFloat(formatted) * 100) / 100;
    return rounded.toString();
}
/**
 * Normalize a transaction hash from walletClient.writeContract, handling
 * edge cases with non-standard hex formatting.
 */
export function normalizeTxHash(hash) {
    if (typeof hash === "string") {
        const cleanHash = hash.trim().startsWith("0x") ? hash.trim() : `0x${hash.trim()}`;
        const hexPart = cleanHash.slice(2);
        return `0x${hexPart.length % 2 === 0 ? hexPart : `0${hexPart}`}`;
    }
    return `0x${String(hash).padStart(64, "0")}`;
}
//# sourceMappingURL=utils.js.map