import { BASE_MAINNET_CONFIG, BASE_SEPOLIA_CONFIG } from "x402-sf";
export type { SuperTokenConfig } from "x402-sf";
export { BASE_MAINNET_CONFIG, BASE_SEPOLIA_CONFIG } from "x402-sf";

export const IS_TESTNET = process.env.NEXT_PUBLIC_TESTNET_MODE === "true";

export const SUPER_TOKEN_CONFIG = IS_TESTNET ? BASE_SEPOLIA_CONFIG : BASE_MAINNET_CONFIG;

// Stream recipient (DAO Treasury). Override per-deployment via NEXT_PUBLIC_RECIPIENT_ADDRESS.
// For the mainnet clear-signing launch, the new recipient address plugs in here (env) —
// no code change required.
export const RECIPIENT_ADDRESS = (process.env.NEXT_PUBLIC_RECIPIENT_ADDRESS ??
  "0xac808840f02c47C05507f48165d2222FF28EF4e1") as `0x${string}`;
