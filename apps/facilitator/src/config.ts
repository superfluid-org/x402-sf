export const IS_TESTNET = process.env.TESTNET_MODE === "true";

const BASE_MAINNET_CONFIG = {
  chain: {
    id: 8453,
    name: "Base",
    networkName: "base" as const,
    rpcUrl: "https://rpc-endpoints.superfluid.dev/base-mainnet",
    blockExplorerUrl: "https://basescan.org",
  },
  superToken: {
    symbol: "USDCx",
    address: "0xd04383398dd2426297da660f9cca3d439af9ce1b" as const,
    decimals: 18,
  },
  underlyingToken: {
    symbol: "USDC",
    address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" as const,
    decimals: 6,
    supportsEIP3009: true,
  },
  superfluid: {
    cfaV1Forwarder: "0xcfA132E353cB4E398080B9700609bb008eceB125" as const,
    cfa: "0x19ba78B9cDB05A877718841c574325fdB53601bb" as const,
    host: "0x4C073B3baB6d8826b8C5b229f3cfdC1eC6E47E74" as const,
  },
  subgraphUrl: "https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1",
  superfluidDashboardNetwork: "base",
  // Plain x402 "exact" scheme: a one-time EIP-3009 USDC payment straight to the merchant's
  // payTo (no wrap, no stream). Uses the real USDC (EIP-3009-capable) — same address as
  // underlyingToken here, but kept separate since the two paths can diverge per network.
  x402: {
    network: "base" as const,
    asset: {
      address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" as const,
      decimals: 6,
      eip712: { name: "USD Coin", version: "2" }, // USDC EIP-712 domain on Base mainnet
    },
  },
} as const;

const BASE_SEPOLIA_CONFIG = {
  chain: {
    id: 84532,
    name: "Base Sepolia",
    networkName: "base-sepolia" as const,
    rpcUrl: "https://rpc-endpoints.superfluid.dev/base-sepolia",
    blockExplorerUrl: "https://sepolia.basescan.org",
  },
  superToken: {
    symbol: "fUSDCx",
    address: "0x1650581f573ead727b92073b5ef8b4f5b94d1648" as const,
    decimals: 18,
  },
  underlyingToken: {
    symbol: "fUSDC",
    address: "0x6b0dacea6a72e759243c99eaed840dee9564c194" as const,
    decimals: 18,
    supportsEIP3009: false,
  },
  superfluid: {
    cfaV1Forwarder: "0xcfA132E353cB4E398080B9700609bb008eceB125" as const,
    cfa: "0x6836F23d6171D74Ef62FcF776655aBcD2bcd62Ef" as const,
    host: "0x109412E3C84f0539b43d39dB691B08c90f58dC7c" as const,
  },
  subgraphUrl: "https://subgraph-endpoints.superfluid.dev/base-sepolia/protocol-v1",
  superfluidDashboardNetwork: "base-sepolia",
  // Plain x402 "exact" scheme on Base Sepolia. NOTE: the Superfluid fUSDC above does NOT
  // support EIP-3009, so the exact scheme uses Circle's testnet USDC instead (free faucet:
  // https://faucet.circle.com). This is what the standard x402 ecosystem uses on Base Sepolia.
  x402: {
    network: "base-sepolia" as const,
    asset: {
      address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const,
      decimals: 6,
      eip712: { name: "USDC", version: "2" }, // USDC EIP-712 domain on Base Sepolia
    },
  },
} as const;

// Registry of every network this facilitator can serve, keyed by its x402 network name.
// A single instance is multi-network: each request is routed to the matching config +
// clients (see superfluid.ts / index.ts). Key strings MUST match the x402 package's
// `Network` identifiers ("base", "base-sepolia") since verify/settle route on them.
export const NETWORK_CONFIGS = {
  base: BASE_MAINNET_CONFIG,
  "base-sepolia": BASE_SEPOLIA_CONFIG,
} as const;

export type NetworkName = keyof typeof NETWORK_CONFIGS;

export const ALL_NETWORKS = Object.keys(NETWORK_CONFIGS) as NetworkName[];

export function isNetworkName(value: string): value is NetworkName {
  return value in NETWORK_CONFIGS;
}

// Back-compat single-network selection (kept for the startup default / non-multi callers).
export const SUPER_TOKEN_CONFIG = IS_TESTNET ? BASE_SEPOLIA_CONFIG : BASE_MAINNET_CONFIG;

export type SuperTokenConfig = typeof BASE_MAINNET_CONFIG;
