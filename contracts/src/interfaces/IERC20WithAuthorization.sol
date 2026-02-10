// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title IERC20WithAuthorization
/// @notice Interface for ERC-20 tokens supporting EIP-3009 (Transfer With Authorization).
///         USDC on Base mainnet implements this interface natively.
interface IERC20WithAuthorization is IERC20 {
    /// @notice Execute a transfer with a signed authorization (EIP-3009).
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    /// @notice Execute a transfer with a signed authorization, requiring msg.sender == to.
    ///         Prevents front-running by ensuring only the intended payee can execute.
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    /// @notice Returns true if the nonce has been used for the given authorizer.
    function authorizationState(
        address authorizer,
        bytes32 nonce
    ) external view returns (bool);
}
