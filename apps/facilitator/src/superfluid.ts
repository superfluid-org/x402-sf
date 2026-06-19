import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import { SUPER_TOKEN_CONFIG, IS_TESTNET } from "./config.js";

const chain = IS_TESTNET ? baseSepolia : base;

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
