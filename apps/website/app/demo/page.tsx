"use client";

import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function VeniceLandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-20 px-4 bg-gradient-to-b from-gray-50 to-white">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="font-serif text-5xl md:text-6xl mb-6">
              Community-Run AI
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              A community-run AI demo powered by Superfluid payment streams and Venice APIs.
              Subscribe and your payment flows directly to the Superfluid DAO.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/demo/venice"
                className="px-8 py-4 bg-black text-white font-semibold border-2 border-black hover:bg-white hover:text-black transition-colors"
              >
                Launch App
              </Link>
              <a
                href="#how-it-works"
                className="px-8 py-4 border-2 border-black text-black font-semibold hover:bg-gray-50 transition-colors"
              >
                Learn More
              </a>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-12 px-4 border-y border-gray-200">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold">1 USDCx</div>
              <div className="text-gray-500 text-sm">per month</div>
            </div>
            <div>
              <div className="text-3xl font-bold">10</div>
              <div className="text-gray-500 text-sm">free daily requests</div>
            </div>
            <div>
              <div className="text-3xl font-bold">100%</div>
              <div className="text-gray-500 text-sm">on-chain</div>
            </div>
            <div>
              <div className="text-3xl font-bold">SUP</div>
              <div className="text-gray-500 text-sm">rewards coming</div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="font-serif text-4xl text-center mb-4">How It Works</h2>
            <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
              A sustainable model for community-owned AI infrastructure
            </p>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="p-6 border-2 border-black">
                <div className="w-12 h-12 bg-black text-white flex items-center justify-center text-xl font-bold mb-4">
                  1
                </div>
                <h3 className="text-xl font-semibold mb-2">Subscribe</h3>
                <p className="text-gray-600">
                  Connect your wallet and start a stream of <strong>1 USDCx/month</strong> + 1 USDCx deposit.
                  Your subscription payment streams directly to the Superfluid DAO via Superfluid.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-6 border-2 border-black">
                <div className="w-12 h-12 bg-black text-white flex items-center justify-center text-xl font-bold mb-4">
                  2
                </div>
                <h3 className="text-xl font-semibold mb-2">Access AI</h3>
                <p className="text-gray-600">
                  Chat with uncensored Venice AI models (10 requests/day).
                  All requests are authenticated via wallet signature.
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-6 border-2 border-black">
                <div className="w-12 h-12 bg-black text-white flex items-center justify-center text-xl font-bold mb-4">
                  3
                </div>
                <h3 className="text-xl font-semibold mb-2">Grow Together</h3>
                <p className="text-gray-600">
                  Subscription revenue buys and stakes DIEM tokens, increasing the community&apos;s
                  API capacity. More subscribers = more compute for everyone.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Community Model */}
        <section className="py-20 px-4 bg-gray-50">
          <div className="max-w-5xl mx-auto">
            <h2 className="font-serif text-4xl text-center mb-4">Community-Owned Compute</h2>
            <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
              Your subscription goes to the Superfluid DAO and helps build shared infrastructure
            </p>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white p-8 border-2 border-black">
                <h3 className="text-2xl font-semibold mb-4">DIEM Staking</h3>
                <p className="text-gray-600 mb-4">
                  Subscription revenue is used to purchase and stake DIEM tokens in the Venice protocol.
                  Staked DIEM provides daily API inference allocation proportional to stake size.
                </p>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="mt-1">&#10003;</span>
                    More subscribers = more DIEM staked
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1">&#10003;</span>
                    More DIEM = higher API capacity
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1">&#10003;</span>
                    Capacity shared fairly among subscribers
                  </li>
                </ul>
              </div>

              <div className="bg-white p-8 border-2 border-black">
                <h3 className="text-2xl font-semibold mb-4">Fair Access</h3>
                <p className="text-gray-600 mb-4">
                  Everyone pays the same subscription rate. Usage is rate-limited fairly based on
                  overall community capacity to prevent abuse while ensuring equitable access.
                </p>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="mt-1">&#10003;</span>
                    Flat subscription: 1 USDCx/month
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1">&#10003;</span>
                    Anti-spam rate limiting
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1">&#10003;</span>
                    Cancel anytime via Superfluid
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* SUP Rewards */}
        <section className="py-20 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-medium mb-6">
              Coming Soon
            </div>
            <h2 className="font-serif text-4xl mb-4">Earn SUP Rewards</h2>
            <p className="text-gray-600 mb-8">
              As part of the Superfluid marketing campaign, subscribers will be eligible for SUP token rewards
              in the next season. Subscribe now to be eligible when rewards go live.
            </p>
            <div className="p-6 border-2 border-black inline-block">
              <p className="text-lg font-medium">
                Early subscribers will be rewarded.
              </p>
            </div>
          </div>
        </section>

        {/* Available Models - commented out until models are confirmed
        <section className="py-20 px-4 bg-gray-50">
          <div className="max-w-5xl mx-auto">
            <h2 className="font-serif text-4xl text-center mb-4">Available Models</h2>
            <p className="text-gray-600 text-center mb-12">
              Access a wide range of AI models through Venice&apos;s uncensored API
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { name: "Llama 3.3 70B", type: "Chat", desc: "Meta's powerful open model" },
                { name: "DeepSeek V3.2", type: "Chat", desc: "Efficient reasoning model" },
                { name: "Mistral 3.1 24B", type: "Vision", desc: "Multimodal understanding" },
                { name: "Venice Uncensored", type: "Chat", desc: "No content restrictions" },
                { name: "Qwen 3 235B", type: "Reasoning", desc: "Advanced thinking model" },
                { name: "GLM 4.7", type: "Chat", desc: "Large context window" },
              ].map((model) => (
                <div key={model.name} className="bg-white p-4 border-2 border-black">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{model.name}</span>
                    <span className="text-xs px-2 py-1 bg-gray-100">{model.type}</span>
                  </div>
                  <p className="text-sm text-gray-500">{model.desc}</p>
                </div>
              ))}
            </div>

            <p className="text-center text-gray-500 mt-8">
              And many more... 20+ models available
            </p>
          </div>
        </section>
        */}

        {/* CTA Section */}
        <section className="py-20 px-4 bg-gray-50">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-serif text-4xl mb-4">Ready to Join?</h2>
            <p className="text-gray-600 mb-8">
              Start streaming 1 USDCx/month to the Superfluid DAO and get access to community-powered AI.
            </p>
            <Link
              href="/demo/venice"
              className="inline-block px-8 py-4 bg-black text-white font-semibold border-2 border-black hover:bg-white hover:text-black transition-colors"
            >
              Launch App
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
