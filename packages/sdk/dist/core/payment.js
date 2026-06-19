import axios from "axios";
import { withPaymentInterceptor } from "x402-axios";
/**
 * Execute an x402 payment via the facilitator.
 * This wraps x402-axios to handle the 402 payment flow automatically.
 */
export async function executeX402Payment({ facilitatorUrl, walletClient, account, recipient, monthlyAmount = "1000000", }) {
    const x402Client = withPaymentInterceptor(axios.create({ baseURL: facilitatorUrl }), walletClient);
    const response = await x402Client.get("/resource", {
        params: {
            account,
            recipient,
            monthlyAmount,
        },
    });
    return response.data;
}
//# sourceMappingURL=payment.js.map