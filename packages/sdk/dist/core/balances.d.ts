import { type Address, type PublicClient } from "viem";
import type { Balances, SuperTokenConfig } from "../types.js";
/**
 * Fetch USDC and USDCx balances for an account.
 */
export declare function fetchBalances(publicClient: PublicClient, account: Address, config: SuperTokenConfig): Promise<Balances>;
/**
 * Check USDCx allowance from owner to spender.
 */
export declare function checkAllowance(publicClient: PublicClient, owner: Address, spender: Address, config: SuperTokenConfig): Promise<bigint>;
//# sourceMappingURL=balances.d.ts.map