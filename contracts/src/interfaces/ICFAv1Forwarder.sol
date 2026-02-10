// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ICFAv1Forwarder
/// @notice Interface for the Superfluid CFA V1 Forwarder contract.
///         Deployed at 0xcfA132E353cB4E398080B9700609bb008eceB125 on all networks.
interface ICFAv1Forwarder {
    /// @notice Set flow rate from a sender to a receiver.
    ///         When sender != msg.sender, msg.sender must have ACL operator permissions.
    function setFlowrateFrom(
        address token,
        address sender,
        address receiver,
        int96 flowrate
    ) external returns (bool);

    /// @notice Get the current flow rate between a sender and receiver.
    function getFlowrate(
        address token,
        address sender,
        address receiver
    ) external view returns (int96);

    /// @notice Grant full flow operator permissions to an operator.
    function grantPermissions(
        address token,
        address flowOperator
    ) external;

    /// @notice Revoke flow operator permissions.
    function revokePermissions(
        address token,
        address flowOperator
    ) external;
}
