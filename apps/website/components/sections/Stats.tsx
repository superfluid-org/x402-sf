export default function Stats() {
  const stats = [
    { label: "Active Streams", value: "12.5K", description: "Real-time payment streams" },
    { label: "Total Volume", value: "$8.42M", description: "Streamed payments" },
    { label: "API Endpoints", value: "2.1K", description: "Protected endpoints" },
    { label: "Developers", value: "1.8K", description: "Building with x402+Superfluid" },
  ];

  return (
    <section className="bg-gray-50 py-16 border-t border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-black mb-2 leading-tight">
                {stat.value}
              </div>
              <div className="text-sm font-semibold text-gray-700 mb-1">
                {stat.label}
              </div>
              <div className="text-xs text-gray-500">
                {stat.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

