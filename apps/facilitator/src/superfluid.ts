import { createPublicClient, createWalletClient, http, type Chain, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import { SUPER_TOKEN_CONFIG, IS_TESTNET } from "./config.js";

// Annotate as a single `Chain` (not the `typeof base | typeof baseSepolia` union the
// ternary would otherwise infer). The union doubles viem's already-deep conditional-type
// instantiation for client actions; under tighter type-inference budgets (e.g. Vercel) TS
// bails out and widens `readContract` params to a union member that requires
// `authorizationList`, breaking the build. A single Chain keeps that inference stable.
const chain: Chain = IS_TESTNET ? baseSepolia : base;

export function createBasePublicClient(rpcUrl: string = SUPER_TOKEN_CONFIG.chain.rpcUrl) {
  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

export function createFacilitatorWalletClient(privateKey: Hex, rpcUrl: string = SUPER_TOKEN_CONFIG.chain.rpcUrl) {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });
}
