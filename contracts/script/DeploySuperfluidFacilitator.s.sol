// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {SuperfluidFacilitator} from "../src/SuperfluidFacilitator.sol";

/// @title DeploySuperfluidFacilitator
/// @notice Deploy script for Base mainnet.
///
/// Usage (with cast wallet):
///   forge script script/DeploySuperfluidFacilitator.s.sol:DeploySuperfluidFacilitator \
///     --rpc-url base \
///     --account ensdeployer \
///     --broadcast \
///     --verify \
///     -vvvv
///
/// Required environment variables:
///   OWNER_ADDRESS       - Contract owner (cold wallet / multisig)
///   OPERATOR_ADDRESS    - Server hot wallet
///   TREASURY_ADDRESS    - Fee withdrawal destination
///   DEFAULT_RECIPIENT   - Default stream recipient (e.g. DAO)
contract DeploySuperfluidFacilitator is Script {
    // ──────────────────────────────────────────────
    // Base mainnet addresses
    // ──────────────────────────────────────────────

    /// @dev USDC on Base (EIP-3009 compatible)
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    /// @dev USDCx Super Token on Base
    address constant USDCx = 0xD04383398dD2426297da660F9CCA3d439AF9ce1b;

    /// @dev Superfluid CFA V1 Forwarder (same on all chains)
    address constant CFA_FORWARDER = 0xcfA132E353cB4E398080B9700609bb008eceB125;

    // ──────────────────────────────────────────────
    // Default fee config
    // ──────────────────────────────────────────────

    /// @dev 1 USDC flat fee (6 decimals)
    uint256 constant MIN_FEE = 1_000_000;

    /// @dev 0% fee (flat fee only, no percentage)
    uint256 constant FEE_BASIS_POINTS = 0;

    /// @dev USDC (6 dec) → USDCx (18 dec) scaling factor
    uint256 constant DECIMAL_SCALE_FACTOR = 1e12;

    function run() external {
        // When using --account flag, no private key env var needed
        address ownerAddress = vm.envAddress("OWNER_ADDRESS");
        address operatorAddress = vm.envAddress("OPERATOR_ADDRESS");
        address treasuryAddress = vm.envAddress("TREASURY_ADDRESS");
        address defaultRecipient = vm.envOr("DEFAULT_RECIPIENT", address(0));

        console2.log("Deploying SuperfluidFacilitator...");
        console2.log("  Owner:            ", ownerAddress);
        console2.log("  Operator:         ", operatorAddress);
        console2.log("  Treasury:         ", treasuryAddress);
        console2.log("  Default Recipient:", defaultRecipient);
        console2.log("  USDC:             ", USDC);
        console2.log("  USDCx:            ", USDCx);
        console2.log("  CFA Forwarder:    ", CFA_FORWARDER);
        console2.log("  Min Fee:          ", MIN_FEE);
        console2.log("  Fee Basis Points: ", FEE_BASIS_POINTS);

        vm.startBroadcast();

        SuperfluidFacilitator facilitator = new SuperfluidFacilitator(
            ownerAddress,
            operatorAddress,
            USDC,
            USDCx,
            CFA_FORWARDER,
            treasuryAddress,
            defaultRecipient,
            MIN_FEE,
            FEE_BASIS_POINTS,
            DECIMAL_SCALE_FACTOR
        );

        vm.stopBroadcast();

        console2.log("SuperfluidFacilitator deployed at:", address(facilitator));
    }
}
