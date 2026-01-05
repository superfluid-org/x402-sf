import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Hero from '@/components/sections/Hero';
import WhatIsX402 from '@/components/sections/WhatIsX402';
import Features from '@/components/sections/Features';
import HowItWorks from '@/components/sections/HowItWorks';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-grow">
        <Hero />
        <WhatIsX402 />
        <Features />
        <HowItWorks />
      </main>
      <Footer />
    </div>
  );
}
