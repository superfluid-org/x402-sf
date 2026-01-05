import Link from 'next/link';

export default function Hero() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
      <div className="text-center mb-16">
        <h1 className="text-5xl lg:text-6xl font-bold mb-6 text-black">
          Subscription Required
        </h1>
        <p className="text-xl lg:text-2xl text-gray-700 max-w-4xl mx-auto mb-12 leading-relaxed">
          <strong className="text-black">x402-superfluid</strong> is the extension and companion to <strong className="text-black">x402</strong>, 
          enabling easy subscription-gated content.
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-semibold mb-6 text-center text-black">
          Access subscription-gated content with one line of code
        </h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 overflow-x-auto">
          <pre className="text-sm text-gray-800 font-mono leading-relaxed">
            <code>{`// Client: Just use x402-axios middleware
import { withPaymentInterceptor } from 'x402-axios';

const x402Client = withPaymentInterceptor(
  axios.create({ baseURL: 'https://api.example.com' }),
  walletClient
);

// Make request - middleware handles everything automatically!
const response = await x402Client.get('/resource', {
  params: { account: userAddress, recipient: recipientAddress }
});

console.log(response.data); // Access granted with active stream!`}</code>
          </pre>
        </div>
        <p className="text-center text-gray-600 mt-6 text-base leading-relaxed">
        That's it! The middleware handles 402 responses, payment signing, and retries automatically. No manual balance checking, permission granting, or payment handling needed.
        </p>
        <div className="text-center mt-8">
          <Link
            href="/demo"
            className="inline-block px-8 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
          >
            Try Demo
          </Link>
        </div>
      </div>
    </section>
  );
}

