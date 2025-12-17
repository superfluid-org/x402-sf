export default function IntegrationExample() {
  return (
    <section className="bg-gray-50 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold mb-4 text-black text-center">
            Integration Example
          </h2>
          <p className="text-xl text-gray-700 mb-12 text-center">
            Get started with x402 + Superfluid in minutes. Here's how to enable streaming payments for your API.
          </p>

          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-semibold mb-4 text-black">1. Install dependencies</h3>
              <div className="bg-white border border-gray-200 rounded-lg p-6 overflow-x-auto">
                <pre className="text-sm text-gray-800 font-mono leading-relaxed">
                  <code>{`npm install @x402/superfluid-middleware
# or
pnpm add @x402/superfluid-middleware`}</code>
                </pre>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4 text-black">2. Server: Check for active stream or return 402</h3>
              <div className="bg-white border border-gray-200 rounded-lg p-6 overflow-x-auto">
                <pre className="text-sm text-gray-800 font-mono leading-relaxed">
                  <code>{`import { getFlowRate } from '@super-x402/superfluid';

app.get("/resource", async (req, res) => {
  const account = req.query.account;
  const recipient = req.query.recipient;
  
  // Check if user has active Superfluid stream
  const flowRate = await getFlowRate(account, recipient);
  
  if (flowRate > 0) {
    // Stream exists - grant access
    return res.json({ 
      status: "ok", 
      flowRate: flowRate.toString(),
      imageUrl: "https://..." 
    });
  }
  
  // No stream - return 402 with payment requirements
  return res.status(402).json({
    accepts: [{
      scheme: "exact",
      network: "base",
      maxAmountRequired: "1100000", // 1.1 USDC (1 USDC + 0.1 fee)
      asset: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC
      payTo: facilitatorAddress,
      description: "Wrap 1 USDC & start stream",
      extra: {
        facilitator: facilitatorAddress,
        superToken: "0xd043...", // USDCx
        wrapAmount: "1000000", // 1 USDC
        fee: "100000", // 0.1 USDC
      }
    }]
  });
});`}</code>
                </pre>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4 text-black">3. Client: Use x402-axios middleware</h3>
              <div className="bg-white border border-gray-200 rounded-lg p-6 overflow-x-auto">
                <pre className="text-sm text-gray-800 font-mono leading-relaxed">
                  <code>{`import { withPaymentInterceptor } from 'x402-axios';
import axios from 'axios';

// Create x402-enabled client - middleware handles everything!
const x402Client = withPaymentInterceptor(
  axios.create({ baseURL: 'https://api.example.com' }),
  walletClient // viem WalletClient
);

// Make request - that's it! x402-axios automatically:
// 1. Sends request
// 2. If 402 received, prompts for payment signature
// 3. Retries request with X-PAYMENT header
// 4. Returns response

const response = await x402Client.get('/resource', {
  params: {
    account: userAddress,
    recipient: apiProviderAddress,
  }
});

// Access granted! Facilitator handled:
// - Payment processing (EIP-3009)
// - USDC → USDCx wrapping
// - Stream creation (if ACL permissions granted)

console.log(response.data.imageUrl);`}</code>
                </pre>
              </div>
              <p className="text-gray-600 mt-4 text-sm">
                💡 <strong>That's it!</strong> The middleware handles 402 responses, payment signing, and retries automatically.
                No manual balance checking, permission granting, or payment handling needed.
              </p>
            </div>

            <div className="bg-white border-2 border-black rounded-lg p-8 text-center mt-8">
              <h3 className="text-2xl font-semibold mb-4 text-black">Ready to get started?</h3>
              <p className="text-gray-700 mb-6">
                Try the interactive demo to see ACL permissions and signature-only payments in action.
              </p>
              <div className="flex gap-4 justify-center">
                <a
                  href="/demo"
                  className="px-6 py-3 bg-black text-white font-semibold rounded hover:bg-gray-800 transition-colors"
                >
                  Try Demo
                </a>
                <a
                  href="https://github.com"
                  className="px-6 py-3 border-2 border-black text-black font-semibold rounded hover:bg-gray-100 transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on GitHub
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

