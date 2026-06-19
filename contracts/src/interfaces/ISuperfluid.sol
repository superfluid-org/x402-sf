// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ISuperfluid (minimal)
/// @notice Minimal subset of the Superfluid host interface needed by user-defined
///         macros. Field layout of `Operation` must match the canonical Superfluid
///         `ISuperfluid.Operation` so the host (and ClearMacroForwarderV1) can decode
///         the operations a macro returns.
interface ISuperfluid {
    /// @notice A single batch operation executed by the host in the caller's context.
    struct Operation {
        uint32 operationType;
        address target;
        bytes data;
    }

    /// @notice Resolve an agreement class (e.g. the CFA) by its canonical type id.
    function getAgreementClass(bytes32 agreementType) external view returns (address);
}
