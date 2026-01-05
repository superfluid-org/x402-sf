export default function WhatIsX402() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-4xl font-serif mb-8 text-black">What's x402-superfluid?</h2>
        
        <div className="space-y-6 text-lg text-gray-700 leading-relaxed">
          <p>
            <strong className="text-black">x402</strong> is an open standard for internet-native payments. 
            But it only handles one-time transactions. Real relationships between service providers and users 
            aren't one-time—you want continuous access, cancelable anytime.
          </p>
          <p>
            <a 
              href="https://docs.superfluid.org/docs/concepts/superfluid" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-black hover:opacity-70 underline font-medium transition-opacity"
            >
              Superfluid payment streams
            </a> power exactly that. Combined with <strong className="text-black">x402</strong>, 
            <strong className="text-black"> x402-superfluid</strong> brings continuous subscription payments 
            to the internet natively—an end-to-end subscription infrastructure that brings equity between 
            creators and consumers, regardless of whether they are human or AI agents.
          </p>
        </div>

        <div className="mt-12 flex justify-center space-x-6">
          <a
            href="https://docs.superfluid.org/docs/concepts/superfluid"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
          >
            Learn About Money Streaming
          </a>
          <a
            href="https://github.com/superfluid-org/x402-sf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 border-2 border-black text-black font-semibold rounded-lg hover:bg-gray-50 transition-colors"
          >
            View on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}

