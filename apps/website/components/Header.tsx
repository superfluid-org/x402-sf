import Link from 'next/link';

export default function Header() {
  return (
    <header className="border-b border-gray-200 sticky top-0 bg-white z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-semibold text-black hover:opacity-80 transition-opacity">
              x402
            </Link>
          </div>
          <div className="hidden md:flex space-x-8 items-center">
            <Link href="/demo" className="text-black hover:opacity-70 transition-opacity text-sm font-medium">
              Demo
            </Link>
            <Link href="#ecosystem" className="text-black hover:opacity-70 transition-opacity text-sm">
              Ecosystem
            </Link>
            <Link href="#writing" className="text-black hover:opacity-70 transition-opacity text-sm">
              Writing
            </Link>
            <Link href="#whitepaper" className="text-black hover:opacity-70 transition-opacity text-sm">
              Whitepaper
            </Link>
            <Link href="#docs" className="text-black hover:opacity-70 transition-opacity text-sm">
              Docs
            </Link>
            <Link href="#contact" className="text-black hover:opacity-70 transition-opacity text-sm">
              Contact
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}

