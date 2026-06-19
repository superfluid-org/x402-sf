// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ISuperfluid} from "./ISuperfluid.sol";

/// @title IClearMacro
/// @notice Interface a "clear macro" must implement to be executed by
///         ClearMacroForwarderV1 (Superfluid). Mirrors the canonical Superfluid
///         ethereum-contracts interfaces/utils/IClearMacro.sol.
///
///         The forwarder verifies a single EIP-712 signature from the user, then
///         calls `buildBatchOperations` and executes the returned operations through
///         the host in the user's context — so a stream created here has the *user*
///         as the flow sender, with no ACL grant or on-chain tx from the user.
///
///         The `getPrimaryTypeName` / `getActionTypeDefinition` / `getActionStructHash`
///         triplet lets the macro declare its own human-readable EIP-712 type, which
///         is what makes the signature "clear" (the wallet shows meaningful fields
///         instead of a blind hash).
interface IClearMacro {
    /// @notice EIP-712 primary type name for the signed message (e.g. "CreateStream").
    function getPrimaryTypeName(bytes memory params) external view returns (string memory);

    /// @notice EIP-712 type definition for the macro action, e.g. "Action(...)".
    function getActionTypeDefinition(bytes memory params) external view returns (string memory);

    /// @notice EIP-712 struct hash of the macro action for the given params.
    function getActionStructHash(bytes memory params) external view returns (bytes32);

    /// @notice Build the batch operations executed by the host in the signer's context.
    function buildBatchOperations(ISuperfluid host, bytes memory params, address msgSender)
        external
        view
        returns (ISuperfluid.Operation[] memory operations);

    /// @notice Optional post-execution validation hook (reverts to roll the action back).
    function postCheck(ISuperfluid host, bytes memory params, address msgSender) external view;
}
