import { createPublicClient, createWalletClient, http, type Chain, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import { NETWORK_CONFIGS, type NetworkName } from "./config.js";

// viem chain per supported network.
const VIEM_CHAINS: Record<NetworkName, Chain> = {
  base,
  "base-sepolia": baseSepolia,
};

// Per-network RPC override envs; fall back to the network's default public RPC from config.
function rpcUrlFor(network: NetworkName): string {
  const envUrl =
    network === "base" ? process.env.BASE_RPC_URL : process.env.BASE_SEPOLIA_RPC_URL;
  return envUrl ?? NETWORK_CONFIGS[network].chain.rpcUrl;
}

// Build the public + wallet clients for one network, both bound to that network's chain and
// RPC. Intentionally NO explicit return-type annotation: viem's client types are deep,
// recursive conditional types, and pinning them to `PublicClient<…>` / `WalletClient<…>`
// forces TS to reconcile the inferred client against the annotation. Under tighter
// type-inference budgets (Vercel's build) that reconciliation fails — e.g.
// "account { address: undefined } is not assignable to undefined" or the `authorizationList`
// widening. Letting the type be inferred (as the original single-network factory did) keeps
// it stable. `chain` is annotated as a single `Chain` (not the base|baseSepolia union) so the
// inferred client's `chain` stays defined — x402's verify/settle need a chain-connected client.
export function createNetworkClients(network: NetworkName, privateKey: Hex) {
  const chain: Chain = VIEM_CHAINS[network];
  const rpcUrl = rpcUrlFor(network);
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });
  return { network, chain, rpcUrl, account, publicClient, walletClient };
}

// The inferred shape of the per-network clients (no hand-written viem generics — see above).
export type NetworkClients = ReturnType<typeof createNetworkClients>;
