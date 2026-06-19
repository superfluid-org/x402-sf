import type { SuperTokenConfig } from "./types.js";

export const BASE_MAINNET_CONFIG: SuperTokenConfig = {
  chain: {
    id: 8453,
    name: "Base",
    networkName: "base",
    rpcUrl: "https://rpc-endpoints.superfluid.dev/base-mainnet",
    blockExplorerUrl: "https://basescan.org",
  },
  superToken: {
    symbol: "USDCx",
    address: "0xd04383398dd2426297da660f9cca3d439af9ce1b",
    decimals: 18,
  },
  underlyingToken: {
    symbol: "USDC",
    address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    decimals: 6,
    supportsEIP3009: true,
  },
  superfluid: {
    cfaV1Forwarder: "0xcfA132E353cB4E398080B9700609bb008eceB125",
    cfa: "0x19ba78B9cDB05A877718841c574325fdB53601bb",
    host: "0x4C073B3baB6d8826b8C5b229f3cfdC1eC6E47E74",
  },
  subgraphUrl: "https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1",
  superfluidDashboardNetwork: "base",
  clearMacro: {
    forwarder: "0xC1EaB73855155D4e021f7EB4f866996Bac2fe25e",
    createFlowMacro: "0xe703d8BAF38A7d8F72f4bC96A28f8ceC9BE2C707",
  },
};

export const BASE_SEPOLIA_CONFIG: SuperTokenConfig = {
  chain: {
    id: 84532,
    name: "Base Sepolia",
    networkName: "base-sepolia",
    rpcUrl: "https://rpc-endpoints.superfluid.dev/base-sepolia",
    blockExplorerUrl: "https://sepolia.basescan.org",
  },
  superToken: {
    symbol: "fUSDCx",
    address: "0x1650581f573ead727b92073b5ef8b4f5b94d1648",
    decimals: 18,
  },
  underlyingToken: {
    symbol: "fUSDC",
    address: "0x6b0dacea6a72e759243c99eaed840dee9564c194",
    decimals: 18,
    supportsEIP3009: false,
  },
  superfluid: {
    cfaV1Forwarder: "0xcfA132E353cB4E398080B9700609bb008eceB125",
    cfa: "0x6836F23d6171D74Ef62FcF776655aBcD2bcd62Ef",
    host: "0x109412E3C84f0539b43d39dB691B08c90f58dC7c",
  },
  subgraphUrl: "https://subgraph-endpoints.superfluid.dev/base-sepolia/protocol-v1",
  superfluidDashboardNetwork: "base-sepolia",
  clearMacro: {
    forwarder: "0xC1EaB73855155D4e021f7EB4f866996Bac2fe25e",
    // createFlowMacro: "0x..." // set after deploying contracts/src/CreateFlowMacro.sol to Base Sepolia
  },
};

export function getConfig(testnet: boolean): SuperTokenConfig {
  return testnet ? BASE_SEPOLIA_CONFIG : BASE_MAINNET_CONFIG;
}
