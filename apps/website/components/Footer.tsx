import Link from 'next/link';
import X402Logo from './X402Logo';
import SuperfluidLogo from './SuperfluidLogo';

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <X402Logo className="h-5 w-auto text-black" />
              <span className="text-lg font-semibold text-gray-800">×</span>
              <SuperfluidLogo className="h-6 w-auto text-black" />
            </div>
            <p className="text-gray-600 text-sm">
              An end-to-end internet-native subscription infrastructure. x402-superfluid extends 
              the x402 standard with continuous payment streams, enabling lasting trust in the agentic economy.
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
                <a 
                  href="https://github.com/superfluid-org/x402-sf" 
                  className="text-gray-600 hover:text-black transition-colors" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a 
                  href="https://docs.superfluid.org/docs/concepts/superfluid" 
                  className="text-gray-600 hover:text-black transition-colors" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  Superfluid Docs
                </a>
              </li>
              <li>
                <a 
                  href="https://www.x402.org" 
                  className="text-gray-600 hover:text-black transition-colors" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  x402.org
                </a>
              </li>
              <li>
                <a 
                  href="https://www.superfluid.org" 
                  className="text-gray-600 hover:text-black transition-colors" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  Superfluid
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}

