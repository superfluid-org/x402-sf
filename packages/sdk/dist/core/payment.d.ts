import type { Address } from "viem";
interface ExecuteX402PaymentParams {
    facilitatorUrl: string;
    walletClient: any;
    account: Address;
    recipient: Address;
    monthlyAmount?: string;
}
/**
 * Execute an x402 payment via the facilitator.
 * This wraps x402-axios to handle the 402 payment flow automatically.
 */
export declare function executeX402Payment({ facilitatorUrl, walletClient, account, recipient, monthlyAmount, }: ExecuteX402PaymentParams): Promise<any>;
export {};
//# sourceMappingURL=payment.d.ts.map