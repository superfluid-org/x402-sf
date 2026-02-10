// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ISuperToken
/// @notice Minimal interface for Superfluid Super Tokens.
interface ISuperToken {
    /// @notice Upgrade underlying ERC-20 tokens to Super Tokens and send to a recipient.
    /// @param to       Recipient of the minted Super Tokens
    /// @param amount   Amount of underlying tokens to wrap (in underlying token decimals)
    /// @param userData Arbitrary user data for ERC-777 hooks (can be empty)
    function upgradeTo(
        address to,
        uint256 amount,
        bytes calldata userData
    ) external;

    /// @notice Upgrade underlying ERC-20 tokens to Super Tokens (sent to msg.sender).
    /// @param amount Amount of underlying tokens to wrap
    function upgrade(uint256 amount) external;

    /// @notice Downgrade Super Tokens back to underlying ERC-20 tokens.
    /// @param amount Amount to downgrade (in Super Token decimals -- 18)
    function downgrade(uint256 amount) external;

    /// @notice Get the balance of an account.
    function balanceOf(address account) external view returns (uint256);

    /// @notice Transfer Super Tokens.
    function transfer(address to, uint256 amount) external returns (bool);
}
