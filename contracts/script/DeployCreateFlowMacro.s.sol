// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {CreateFlowMacro} from "../src/CreateFlowMacro.sol";

/// @title DeployCreateFlowMacro
/// @notice Deploys the CreateFlowMacro clear-macro. It is generic over the Super Token
///         (token is passed in the signed params), so one deployment serves every token
///         on a chain. The same source deploys identically on Base mainnet and Base Sepolia.
///
/// Usage (with cast wallet):
///   forge script script/DeployCreateFlowMacro.s.sol:DeployCreateFlowMacro \
///     --rpc-url base \
///     --account ensdeployer \
///     --broadcast \
///     --verify \
///     -vvvv
contract DeployCreateFlowMacro is Script {
    function run() external returns (CreateFlowMacro deployed) {
        vm.startBroadcast();
        deployed = new CreateFlowMacro();
        vm.stopBroadcast();

        console2.log("CreateFlowMacro deployed at:", address(deployed));
    }
}
