import { erc20Abi } from "viem";
/**
 * Fetch USDC and USDCx balances for an account.
 */
export async function fetchBalances(publicClient, account, config) {
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
    }
    catch (error) {
        console.error("Failed to fetch balances:", error);
        return { usdc: null, usdcx: null };
    }
}
/**
 * Check USDCx allowance from owner to spender.
 */
export async function checkAllowance(publicClient, owner, spender, config) {
    return publicClient.readContract({
        address: config.superToken.address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [owner, spender],
    });
}
//# sourceMappingURL=balances.js.map