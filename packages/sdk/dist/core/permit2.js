import { maxUint256 } from "viem";
import { PERMIT2_ADDRESS } from "../clearMacroAbis.js";
const erc20Permit2Abi = [
    {
        name: "allowance",
        type: "function",
        stateMutability: "view",
        inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
        ],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "approve",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
    },
];
/**
 * Read the owner's ERC-20 allowance to the canonical Permit2 contract for `token`.
 * Permit2 can only pull `token` once this allowance covers the amount — it's the
 * one-time on-chain step a user does before Permit2 signatures work.
 */
export async function checkPermit2Allowance(publicClient, owner, token) {
    return (await publicClient.readContract({
        address: token,
        abi: erc20Permit2Abi,
        functionName: "allowance",
        args: [owner, PERMIT2_ADDRESS],
    }));
}
/**
 * Approve the Permit2 contract to spend `token` (defaults to max — the standard
 * one-time Permit2 approval, after which gasless Permit2 signatures work).
 */
export async function approvePermit2(walletClient, params) {
    return walletClient.writeContract({
        account: params.account,
        chain: params.chain,
        address: params.token,
        abi: erc20Permit2Abi,
        functionName: "approve",
        args: [PERMIT2_ADDRESS, params.amount ?? maxUint256],
    });
}
//# sourceMappingURL=permit2.js.map