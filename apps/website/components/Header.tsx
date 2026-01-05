import Link from 'next/link';

export default function Header() {
  return (
    <header className="border-b border-gray-200 sticky top-0 bg-white z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-semibold text-black hover:opacity-80 transition-opacity">
              x402-superfluid
            </Link>
          </div>
          <div className="hidden md:flex space-x-8 items-center">
            <Link href="/demo" className="text-black hover:opacity-70 transition-opacity text-sm font-medium">
              Demo
            </Link>
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
        </div>
      </nav>
    </header>
  );
}

