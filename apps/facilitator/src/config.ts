export const SUPER_TOKEN_CONFIG = {
  chain: {
    id: 8453,
    name: "Base",
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
    // CFA V1 Forwarder on Base mainnet
    cfaV1Forwarder: "0xcfA132E353cB4E398080B9700609bb008eceB125" as const,
    // CFA contract on Base mainnet
    cfa: "0x19ba78B9cDB05A877718841c574325fdB53601bb" as const,
  },
} as const;

export type SuperTokenConfig = typeof SUPER_TOKEN_CONFIG;

