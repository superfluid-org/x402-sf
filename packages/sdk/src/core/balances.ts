import { erc20Abi, type Address, type PublicClient } from "viem";
import type { Balances, SuperTokenConfig } from "../types.js";

/**
 * Fetch USDC and USDCx balances for an account.
 */
export async function fetchBalances(
  publicClient: PublicClient,
  account: Address,
  config: SuperTokenConfig,
): Promise<Balances> {
  try {
    const [usdc, usdcx] = await Promise.all([
      publicClient.readContract({
        address: config.underlyingToken.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account],
      }),
      publicClient.readContract({
        address: config.superToken.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account],
      }),
    ]);
    return { usdc, usdcx };
  } catch (error) {
    console.error("Failed to fetch balances:", error);
    return { usdc: null, usdcx: null };
  }
}

/**
 * Check USDCx allowance from owner to spender.
 */
export async function checkAllowance(
  publicClient: PublicClient,
  owner: Address,
  spender: Address,
  config: SuperTokenConfig,
): Promise<bigint> {
  return publicClient.readContract({
    address: config.superToken.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender],
  });
}
