export default function HowItWorks() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-4xl font-bold mb-4 text-black text-center">
          We need a new way to transfer value on the internet...
        </h2>
        <p className="text-xl text-gray-700 mb-16 text-center">
          The old way of doing payments is barely working for a human world, let alone an agentic future.
          x402 + Superfluid does in moments what existing systems can't do at all.
        </p>

        <div className="space-y-16">
          {/* Old Way */}
          <div>
            <h3 className="text-2xl font-semibold mb-8 text-black">The old way</h3>
            <div className="space-y-6">
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-700">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-lg mb-2 text-black">Create account with new API provider</h4>
                  <p className="text-gray-700">Time consuming setup</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-700">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-lg mb-2 text-black">Add payment method to API provider</h4>
                  <p className="text-gray-700">KYC required, delaying access and requiring approval</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-700">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-lg mb-2 text-black">Buy credits or subscription</h4>
                  <p className="text-gray-700">Prepaid commitment → overpay or run out of funds</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-700">
                  4
                </div>
                <div>
                  <h4 className="font-semibold text-lg mb-2 text-black">Manage API key</h4>
                  <p className="text-gray-700">Security risk → must store and rotate keys</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-700">
                  5
                </div>
                <div>
                  <h4 className="font-semibold text-lg mb-2 text-black">Make payment</h4>
                  <p className="text-gray-700">Slow transactions, chargebacks, fees</p>
                </div>
              </div>
            </div>
          </div>

          {/* With x402 + Superfluid */}
          <div>
            <h3 className="text-2xl font-semibold mb-8 text-black">With x402 + Superfluid</h3>
            <div className="space-y-6">
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 bg-black rounded-full flex items-center justify-center font-bold text-white">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-lg mb-2 text-black">Client sends HTTP request and receives 402: Payment Required</h4>
                  <p className="text-gray-700">Server checks for active Superfluid stream. If none exists, returns 402 with payment requirements</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 bg-black rounded-full flex items-center justify-center font-bold text-white">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-lg mb-2 text-black">Client grants ACL permissions (one-time, on-chain)</h4>
                  <p className="text-gray-700">User grants facilitator permission to create streams on their behalf. This enables signature-only stream creation going forward</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 bg-black rounded-full flex items-center justify-center font-bold text-white">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-lg mb-2 text-black">Client signs EIP-3009 authorization (signature-only, no gas)</h4>
                  <p className="text-gray-700">User signs payment authorization. Facilitator handles wrapping USDC→USDCx and creating stream. No gas fees for user</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 bg-black rounded-full flex items-center justify-center font-bold text-white">
                  4
                </div>
                <div>
                  <h4 className="font-semibold text-lg mb-2 text-black">Facilitator processes payment and creates stream</h4>
                  <p className="text-gray-700">Facilitator wraps USDC to USDCx, checks ACL permissions, and creates continuous payment stream. API access granted instantly</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 bg-black rounded-full flex items-center justify-center font-bold text-white">
                  5
                </div>
                <div>
                  <h4 className="font-semibold text-lg mb-2 text-black">Continuous payment stream enables ongoing access</h4>
                  <p className="text-gray-700">Money flows in real-time as services are consumed. No API keys, no repeated transactions, no subscriptions</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

