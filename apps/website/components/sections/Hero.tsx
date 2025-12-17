import Link from 'next/link';

export default function Hero() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
      <div className="text-center mb-16">
        <h1 className="text-5xl lg:text-6xl font-bold mb-6 text-black">
          Payment Required
        </h1>
        <p className="text-xl lg:text-2xl text-gray-700 max-w-3xl mx-auto mb-12">
          x402 + Superfluid: Streaming payments for internet-native APIs. Enable real-time,
          continuous payment flows that move at the speed of the internet.
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-semibold mb-6 text-center text-black">
          Accept streaming payments with a single line of code
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

console.log(response.data.imageUrl); // Access granted!`}</code>
          </pre>
        </div>
        <p className="text-center text-gray-600 mt-6 text-base leading-relaxed">
          That's it! The x402-axios middleware automatically handles 402 responses, payment signing, and retries.
          Your API just checks for streams and returns 402 if needed—the middleware does the rest.
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

