import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Serve demo app static files from public/demo-app
  async rewrites() {
    return [
      {
        source: "/demo-app/:path*",
        destination: "/demo-app/:path*",
      },
    ];
  },
  turbopack: {},
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

export default nextConfig;
