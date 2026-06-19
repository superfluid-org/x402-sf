import type { Address } from "viem";

export interface ChainConfig {
  id: number;
  name: string;
  networkName: string;
  rpcUrl: string;
  blockExplorerUrl: string;
}

export interface TokenConfig {
  symbol: string;
  address: Address;
  decimals: number;
}

export interface UnderlyingTokenConfig extends TokenConfig {
  supportsEIP3009: boolean;
}

export interface SuperfluidConfig {
  cfaV1Forwarder: Address;
  cfa: Address;
  host: Address;
}

export interface ClearMacroConfig {
  /** ClearMacroForwarderV1WithPermit2 — same address on Base mainnet + Sepolia. */
  forwarder: Address;
  /**
   * CreateFlowMacro deployment (contracts/src/CreateFlowMacro.sol). Set per-chain
   * after deploying — undefined until then, and can be overridden per call.
   */
  createFlowMacro?: Address;
}

export interface SuperTokenConfig {
  chain: ChainConfig;
  superToken: TokenConfig;
  underlyingToken: UnderlyingTokenConfig;
  superfluid: SuperfluidConfig;
  subgraphUrl: string;
  superfluidDashboardNetwork: string;
  /** Single-signature stream creation via Superfluid's ClearMacro forwarder. */
  clearMacro?: ClearMacroConfig;
}

export interface FacilitatorInfo {
  facilitator: Address;
  operator: Address;
  // Chain the facilitator serves, advertised by its /info endpoint. Optional for
  // backwards-compat with older facilitators that don't report it (guard is skipped then).
  chainId?: number;
  network?: string;
}

export interface Balances {
  usdc: bigint | null;
  usdcx: bigint | null;
}

export type X402StreamStatus =
  | "disconnected"
  | "wrong-network"
  | "loading"
  | "needs-permissions"
  | "ready"
  | "subscribing"
  | "active"
  | "error";

export interface UseX402StreamOptions {
  facilitatorUrl: string;
  recipient: Address;
  monthlyAmount?: string; // in wei (18 decimals), defaults to 1 USDCx
  config?: SuperTokenConfig;
}

export interface UseX402StreamReturn {
  status: X402StreamStatus;
  subscribe: () => Promise<void>;
  error: string | null;
  balances: Balances;
  streamUrl: string | null;
  facilitatorInfo: FacilitatorInfo | null;
  flowRate: bigint;
}
