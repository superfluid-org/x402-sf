import { type Address, type PublicClient } from "viem";
import type { SuperTokenConfig } from "../types.js";
export interface PermissionStatus {
    hasPermissions: boolean;
    permissions: number;
    flowrateAllowance: bigint;
}
/**
 * Check ACL permissions for an operator on a sender's behalf.
 */
export declare function checkPermissions(publicClient: PublicClient, sender: Address, operator: Address, config: SuperTokenConfig): Promise<PermissionStatus>;
interface GrantPermissionsParams {
    walletClient: any;
    publicClient: PublicClient;
    sender: Address;
    operatorAddress: Address;
    facilitatorAddress: Address;
    config: SuperTokenConfig;
    flowrateAllowance: bigint;
    feeAllowance?: bigint;
    chain: any;
}
/**
 * Grant ACL permissions via Host.batchCall:
 * 1. ERC20_APPROVE: approve operator to spend USDCx (for fee)
 * 2. SUPERFLUID_CALL_AGREEMENT: grant ACL to operator (EOA)
 * 3. (optional) SUPERFLUID_CALL_AGREEMENT: grant ACL to facilitator contract (if different from operator)
 */
export declare function grantPermissions({ walletClient, publicClient, sender, operatorAddress, facilitatorAddress, config, flowrateAllowance, feeAllowance, chain, }: GrantPermissionsParams): Promise<void>;
interface ApproveUsdcxParams {
    walletClient: any;
    publicClient: PublicClient;
    operatorAddress: Address;
    config: SuperTokenConfig;
    feeAllowance?: bigint;
    chain: any;
}
/**
 * Approve USDCx allowance to operator (for fee collection), without ACL grant.
 */
export declare function approveUsdcx({ walletClient, publicClient, operatorAddress, config, feeAllowance, chain, }: ApproveUsdcxParams): Promise<void>;
export {};
//# sourceMappingURL=permissions.d.ts.map