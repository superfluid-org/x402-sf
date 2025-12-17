"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { base } from "wagmi/chains";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";

// Create config outside component to prevent re-initialization
let wagmiConfig: ReturnType<typeof getDefaultConfig> | undefined;

function getWagmiConfig() {
  if (!wagmiConfig) {
    wagmiConfig = getDefaultConfig({
      appName: "x402 + Superfluid",
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID",
      chains: [base],
      ssr: true,
    });
  }
  return wagmiConfig;
}

// Create QueryClient outside component to prevent re-initialization
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const config = React.useMemo(() => getWagmiConfig(), []);
  
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

