export default function Features() {
  const features = [
    {
      title: "Zero protocol fees",
      description: "x402 is free for the customer and the merchant—just pay nominal payment network fees",
    },
    {
      title: "Zero gas for users",
      description: "Users only sign EIP-712 based signatures for authorization. Facilitator handles wrapping and stream creation",
    },
    {
      title: "Zero wait",
      description: "Money streams at the speed of the internet with real-time continuous payments that you can cancel anytime",
    },
    {
      title: "Zero friction",
      description: "No accounts or personal information needed. One-time ACL permission grant enables signature-only payments",
    },
    {
      title: "Zero centralization",
      description: "Anyone on the internet can build on or extend x402 with Superfluid. Open facilitator pattern",
    },
    {
      title: "Real-time streaming",
      description: "Continuous payment flows that update in real-time, perfect for pay-per-use APIs",
    },
  ];

  return (
    <section className="bg-gray-50 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-serif mb-4 text-black">
            It's how the internet should be: open, free, and effortless
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="text-xl font-semibold mb-3 text-black">{feature.title}</h3>
              <p className="text-gray-700">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

