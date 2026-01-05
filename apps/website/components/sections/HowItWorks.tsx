export default function HowItWorks() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-4xl font-serif mb-4 text-black text-center">
          We need a new way to transfer value on the internet...
        </h2>
        <p className="text-xl text-gray-700 mb-16 text-center">
          The old way of doing payments is barely working for a human world, let alone an agentic future.
          x402 + Superfluid does in moments what existing systems can't do at all.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Old Way */}
          <div className="p-8">
            <h3 className="text-2xl font-semibold mb-8 text-gray-500 uppercase tracking-wide">The old way</h3>
            <div className="space-y-5">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center font-bold text-gray-800 text-sm">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-base mb-1 text-gray-900">Create account with new API provider</h4>
                  <p className="text-gray-600 text-sm">Time consuming setup</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center font-bold text-gray-800 text-sm">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-base mb-1 text-gray-900">Add payment method to API provider</h4>
                  <p className="text-gray-600 text-sm">KYC required, delaying access and requiring approval</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center font-bold text-gray-800 text-sm">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-base mb-1 text-gray-900">Buy credits or subscription</h4>
                  <p className="text-gray-600 text-sm">Prepaid commitment → overpay or run out of funds</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center font-bold text-gray-800 text-sm">
                  4
                </div>
                <div>
                  <h4 className="font-semibold text-base mb-1 text-gray-900">Manage API key</h4>
                  <p className="text-gray-600 text-sm">Security risk → must store and rotate keys</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center font-bold text-gray-800 text-sm">
                  5
                </div>
                <div>
                  <h4 className="font-semibold text-base mb-1 text-gray-900">Make payment</h4>
                  <p className="text-gray-600 text-sm">Slow transactions, chargebacks, fees</p>
                </div>
              </div>
            </div>
          </div>

          {/* With x402 + Superfluid */}
          <div className="p-8">
            <h3 className="text-2xl font-semibold mb-8 text-green-700 uppercase tracking-wide">With x402 + Superfluid</h3>
            <div className="space-y-5">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-green-700 rounded flex items-center justify-center font-bold text-white text-sm">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-base mb-1 text-black">Client sends HTTP request and receives 402: Payment Required</h4>
                  <p className="text-gray-600 text-sm">Server checks for active Superfluid stream. If none exists, returns 402 with payment requirements</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-green-700 rounded flex items-center justify-center font-bold text-white text-sm">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-base mb-1 text-black">Client grants ACL permissions (one-time, on-chain)</h4>
                  <p className="text-gray-600 text-sm">User grants facilitator permission to create streams on their behalf. This enables signature-only stream creation going forward</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-green-700 rounded flex items-center justify-center font-bold text-white text-sm">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-base mb-1 text-black">Client signs EIP-3009 authorization (signature-only, no gas)</h4>
                  <p className="text-gray-600 text-sm">User signs payment authorization. Facilitator handles wrapping USDC→USDCx and creating stream. No gas fees for user</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-green-700 rounded flex items-center justify-center font-bold text-white text-sm">
                  4
                </div>
                <div>
                  <h4 className="font-semibold text-base mb-1 text-black">Facilitator processes payment and creates stream</h4>
                  <p className="text-gray-600 text-sm">Facilitator wraps USDC to USDCx, checks ACL permissions, and creates continuous payment stream. API access granted instantly</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-green-700 rounded flex items-center justify-center font-bold text-white text-sm">
                  5
                </div>
                <div>
                  <h4 className="font-semibold text-base mb-1 text-black">Continuous payment stream enables ongoing access</h4>
                  <p className="text-gray-600 text-sm">Money flows in real-time as services are consumed. No API keys, no repeated transactions, no subscriptions</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

