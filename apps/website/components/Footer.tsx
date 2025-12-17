import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-lg font-semibold mb-4">x402 + Superfluid</h3>
            <p className="text-gray-600 text-sm">
              An open extension enabling streaming payments for internet-native APIs.
              Built on the x402 standard and powered by Superfluid real-time finance.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-4">Resources</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/demo" className="text-gray-600 hover:text-black transition-colors">
                  Demo
                </Link>
              </li>
              <li>
                <Link href="#docs" className="text-gray-600 hover:text-black transition-colors">
                  Documentation
                </Link>
              </li>
              <li>
                <Link href="#ecosystem" className="text-gray-600 hover:text-black transition-colors">
                  Ecosystem
                </Link>
              </li>
              <li>
                <Link href="https://www.x402.org" className="text-gray-600 hover:text-black transition-colors" target="_blank" rel="noopener noreferrer">
                  x402.org
                </Link>
              </li>
              <li>
                <Link href="https://www.superfluid.org" className="text-gray-600 hover:text-black transition-colors" target="_blank" rel="noopener noreferrer">
                  Superfluid
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-4">Community</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="#writing" className="text-gray-600 hover:text-black transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="#whitepaper" className="text-gray-600 hover:text-black transition-colors">
                  Whitepaper
                </Link>
              </li>
              <li>
                <Link href="#contact" className="text-gray-600 hover:text-black transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-200 text-sm text-gray-600">
          <p>
            While x402 is an open and neutral standard, this extension showcases integration with Superfluid.
          </p>
        </div>
      </div>
    </footer>
  );
}

