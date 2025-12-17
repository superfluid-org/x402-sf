import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Hero from '@/components/sections/Hero';
import Stats from '@/components/sections/Stats';
import WhatIsX402 from '@/components/sections/WhatIsX402';
import Features from '@/components/sections/Features';
import HowItWorks from '@/components/sections/HowItWorks';
import IntegrationExample from '@/components/sections/IntegrationExample';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-grow">
        <Hero />
        <Stats />
        <WhatIsX402 />
        <Features />
        <HowItWorks />
        <IntegrationExample />
      </main>
      <Footer />
    </div>
  );
}
