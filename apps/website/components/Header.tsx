import Link from 'next/link';
import X402Logo from './X402Logo';
import SuperfluidLogo from './SuperfluidLogo';

export default function Header() {
  return (
    <header className="border-b border-gray-200 sticky top-0 bg-white z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex justify-center items-center h-16">
          {/* Left side navigation */}
          <div className="hidden md:flex space-x-8 items-center absolute left-0">
            <a 
              href="https://docs.superfluid.org/docs/concepts/superfluid" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-black hover:opacity-70 transition-opacity text-sm"
            >
              Superfluid Docs
            </a>
            <a 
              href="https://github.com/superfluid-org/x402-sf" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-black hover:opacity-70 transition-opacity text-sm"
            >
              GitHub
            </a>
          </div>

          {/* Centered logos */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-3 text-black hover:opacity-80 transition-opacity">
              <X402Logo className="h-5 w-auto" />
              <span className="text-lg font-semibold">×</span>
              <SuperfluidLogo className="h-6 w-auto" />
            </Link>
          </div>

          {/* Right side buttons */}
          <div className="hidden md:flex items-center gap-3 absolute right-0">
            <Link 
              href="/demo" 
              className="px-4 py-2 bg-white text-black border-2 border-black hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              Demo
            </Link>
            <a 
              href="https://docs.google.com/forms/d/e/1FAIpQLSfdxN7dGchn4CNQAF9bJDA4PMWH8D8q3lc_kI4ytddkZ2fsjQ/viewform" 
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors text-sm font-medium"
            >
              Contact
            </a>
          </div>
        </div>
      </nav>
    </header>
  );
}

