export default function WhatIsX402() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-4xl font-bold mb-6 text-black">What's x402 + Superfluid?</h2>
        <div className="space-y-6 text-lg text-gray-700 leading-relaxed">
          <p>
            Payments on the internet are fundamentally flawed. Credit cards are high friction, hard to accept,
            have minimum payments that are far too high, and don't fit into the programmatic nature of the internet.
            It's time for an open, internet-native form of payments.
          </p>
          <p>
            <strong className="text-black">x402</strong> is an open, neutral standard for internet-native payments.
            Combined with <strong className="text-black">Superfluid</strong>, it enables real-time streaming payments
            that flow continuously, eliminating the need for repeated transactions or subscriptions. A payment rail that
            doesn't have high minimums plus a percentage fee. Payments that are amazing for humans and AI agents.
          </p>
          <p>
            With Superfluid integration, x402 enables <strong className="text-black">continuous payment streams</strong> -
            money flows in real-time as services are consumed. The facilitator pattern handles token wrapping and stream
            creation—users only sign EIP-3009 authorizations (no gas fees) after granting one-time ACL permissions.
            This creates a truly native payment experience for APIs and content delivery.
          </p>
        </div>

        <div className="mt-12 p-6 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-xl font-semibold mb-4 text-black">HTTP-native. It's built-in to the internet.</h3>
          <p className="text-gray-700">
            x402 is built-in to existing HTTP requests, with no additional communication required.
            Superfluid streams run continuously in the background, ensuring seamless payment flow while
            your API responds instantly to requests.
          </p>
        </div>
      </div>
    </section>
  );
}

