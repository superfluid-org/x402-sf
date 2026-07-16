import {
  createPublicClient,
  createWalletClient,
  http,
  type Account,
  type Chain,
  type Hex,
  type PublicClient,
  type Transport,
  type WalletClient,
} from "viem";
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

export interface NetworkClients {
  network: NetworkName;
  chain: Chain;
  rpcUrl: string;
  account: Account;
  // Concrete `Chain` generic (not the bare-type default of `Chain | undefined`) so the
  // client's `chain` is defined — x402's verify/settle require a chain-connected client.
  publicClient: PublicClient<Transport, Chain>;
  walletClient: WalletClient<Transport, Chain, Account>;
}

// Build the public + wallet clients for one network, both bound to that network's chain
// and RPC. Annotate `chain` as a single `Chain` (not the `typeof base | typeof baseSepolia`
// union the lookup would otherwise infer): the union doubles viem's already-deep
// conditional-type instantiation and, under tighter type-inference budgets (e.g. Vercel),
// TS bails out and widens `readContract`/write params to a member requiring
// `authorizationList`, breaking the build. A single Chain keeps that inference stable.
export function createNetworkClients(network: NetworkName, privateKey: Hex): NetworkClients {
  const chain: Chain = VIEM_CHAINS[network];
  const rpcUrl = rpcUrlFor(network);
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });
  return { network, chain, rpcUrl, account, publicClient, walletClient };
}
