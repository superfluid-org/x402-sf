import Link from 'next/link';

export default function CTA() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-24">
      <div className="border-2 border-black p-12 lg:p-16 bg-white text-center">
        <h2 className="text-3xl lg:text-4xl font-bold text-black mb-8">
          Building APIs, agents, or infra?
        </h2>
        <Link 
          href="#contact"
          className="inline-block px-10 py-4 border-2 border-black bg-black text-white font-semibold text-lg hover:bg-white hover:text-black transition-colors duration-200"
        >
          Let's talk →
        </Link>
      </div>
    </section>
  );
}

