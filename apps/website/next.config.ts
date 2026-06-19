import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

// Force a single physical copy of the web3 stack. In a pnpm monorepo the workspace SDK
// (x402-sf) can resolve a different `wagmi`/`viem` instance than the app, which breaks the
// shared React context ("useConfig must be used within WagmiProvider"). Aliasing pins them
// to the app's copy for both the webpack and turbopack bundlers.
const singletons: Record<string, string> = {
  wagmi: path.resolve(dir, "node_modules/wagmi"),
  viem: path.resolve(dir, "node_modules/viem"),
  "@tanstack/react-query": path.resolve(dir, "node_modules/@tanstack/react-query"),
};

const nextConfig: NextConfig = {
  // Transpile the workspace SDK so its imports resolve in the app's context.
  transpilePackages: ["x402-sf"],
  // Serve demo app static files from public/demo-app
  async rewrites() {
    return [
      {
        source: "/demo-app/:path*",
        destination: "/demo-app/:path*",
      },
    ];
  },
  turbopack: {
    resolveAlias: singletons,
  },
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      ...singletons,
    };
    return config;
  },
};

export default nextConfig;
