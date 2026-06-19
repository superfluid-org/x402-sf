import { encodeFunctionData, encodeAbiParameters, } from "viem";
import { cfaAbi, cfaAgreementAbi, hostAbi } from "../abis.js";
import { normalizeTxHash } from "../utils.js";
import { FULL_PERMISSIONS, DEFAULT_FEE_ALLOWANCE } from "../constants.js";
/**
 * Check ACL permissions for an operator on a sender's behalf.
 */
export async function checkPermissions(publicClient, sender, operator, config) {
    try {
        const result = (await publicClient.readContract({
            address: config.superfluid.cfa,
            abi: cfaAbi,
            functionName: "getFlowOperatorData",
            args: [config.superToken.address, sender, operator],
        }));
        const [, permissions, flowrateAllowance] = result;
        return {
            hasPermissions: permissions === FULL_PERMISSIONS,
            permissions,
            flowrateAllowance,
        };
    }
    catch (error) {
        console.error("Failed to check permissions:", error);
        return { hasPermissions: false, permissions: 0, flowrateAllowance: 0n };
    }
}
/**
 * Grant ACL permissions via Host.batchCall:
 * 1. ERC20_APPROVE: approve operator to spend USDCx (for fee)
 * 2. SUPERFLUID_CALL_AGREEMENT: grant ACL to operator (EOA)
 * 3. (optional) SUPERFLUID_CALL_AGREEMENT: grant ACL to facilitator contract (if different from operator)
 */
export async function grantPermissions({ walletClient, publicClient, sender, operatorAddress, facilitatorAddress, config, flowrateAllowance, feeAllowance = DEFAULT_FEE_ALLOWANCE, chain, }) {
    if (!walletClient.account) {
        throw new Error("No account available in wallet client");
    }
    // Operation 1: ERC20_APPROVE (type 1) — approve operator to spend USDCx for fee
    const approveData = encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [operatorAddress, feeAllowance]);
    // Operation 2: SUPERFLUID_CALL_AGREEMENT (type 201) — grant ACL to operator
    const cfaCallData = encodeFunctionData({
        abi: cfaAgreementAbi,
        functionName: "updateFlowOperatorPermissions",
        args: [
            config.superToken.address,
            operatorAddress,
            FULL_PERMISSIONS,
            flowrateAllowance,
            "0x",
        ],
    });
    const aclData = encodeAbiParameters([{ type: "bytes" }, { type: "bytes" }], [cfaCallData, "0x"]);
    const operations = [
        { operationType: 1, target: config.superToken.address, data: approveData },
        { operationType: 201, target: config.superfluid.cfa, data: aclData },
    ];
    // In contract mode, also grant ACL to the contract (for USDC wrap+stream path)
    if (operatorAddress !== facilitatorAddress) {
        const cfaCallDataContract = encodeFunctionData({
            abi: cfaAgreementAbi,
            functionName: "updateFlowOperatorPermissions",
            args: [
                config.superToken.address,
                facilitatorAddress,
                FULL_PERMISSIONS,
                flowrateAllowance,
                "0x",
            ],
        });
        const aclDataContract = encodeAbiParameters([{ type: "bytes" }, { type: "bytes" }], [cfaCallDataContract, "0x"]);
        operations.push({
            operationType: 201,
            target: config.superfluid.cfa,
            data: aclDataContract,
        });
    }
    const hash = await walletClient.writeContract({
        account: walletClient.account,
        chain,
        address: config.superfluid.host,
        abi: hostAbi,
        functionName: "batchCall",
        args: [operations],
    });
    const txHash = normalizeTxHash(hash);
    await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120000 });
    // Wait for state to propagate
    await new Promise((resolve) => setTimeout(resolve, 2000));
}
/**
 * Approve USDCx allowance to operator (for fee collection), without ACL grant.
 */
export async function approveUsdcx({ walletClient, publicClient, operatorAddress, config, feeAllowance = DEFAULT_FEE_ALLOWANCE, chain, }) {
    if (!walletClient.account) {
        throw new Error("No account available in wallet client");
    }
    const hash = await walletClient.writeContract({
        account: walletClient.account,
        chain,
        address: config.superToken.address,
        abi: [
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
        ],
        functionName: "approve",
        args: [operatorAddress, feeAllowance],
    });
    const txHash = normalizeTxHash(hash);
    await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120000 });
}
//# sourceMappingURL=permissions.js.map