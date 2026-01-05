import Link from 'next/link';
import X402Logo from '@/components/X402Logo';
import SuperfluidLogo from '@/components/SuperfluidLogo';

export default function Hero() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
      <div className="mb-16">
        {/* Logos and Title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 lg:gap-4 mb-4">
            <X402Logo className="h-10 lg:h-12 w-auto text-black" />
            <span className="text-3xl lg:text-4xl font-bold text-gray-800">×</span>
            <SuperfluidLogo className="h-9 lg:h-11 w-auto text-black" />
          </div>
          <h1 className="text-4xl lg:text-5xl text-black mb-6 font-serif">
            Subscription Required
          </h1>
        </div>
        
        {/* Description */}
        <p className="text-lg lg:text-xl text-gray-800 max-w-2xl mb-12 leading-relaxed">
          <strong className="text-black">x402-superfluid</strong> is an open, neutral standard for internet-native subscriptions. It 
          extends <strong className="text-black">x402</strong> with continuous payment streams, enabling lasting trust in the agentic economy.
        </p>
      </div>

      {/* Code Section */}
      <div className="max-w-4xl">
        <div className="border-2 border-black p-8 bg-white">
          <h2 className="text-xl font-semibold mb-6 text-black flex items-center gap-2">
            <span>→</span> Access subscription-gated content with one line of code
          </h2>
          <div className="bg-gray-50 rounded-lg p-6 overflow-x-auto">
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
          <p className="text-gray-600 mt-6 text-sm leading-relaxed">
            That's it! The middleware handles 402 responses, payment signing, and retries automatically. No manual balance checking, permission granting, or payment handling needed.
          </p>
        </div>
      </div>
    </section>
  );
}

