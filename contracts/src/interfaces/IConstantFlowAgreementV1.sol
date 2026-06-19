// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IConstantFlowAgreementV1 (minimal)
/// @notice Minimal CFA v1 surface used by CreateFlowMacro. The Super Token is typed
///         as `address` (it ABI-encodes identically to `ISuperToken`), keeping the
///         function selectors identical to the canonical agreement.
interface IConstantFlowAgreementV1 {
    /// @notice Create a flow. When invoked via the host in a user's context (ctx),
    ///         the flow sender is that user — not `msg.sender`.
    function createFlow(
        address token,
        address receiver,
        int96 flowRate,
        bytes calldata ctx
    ) external returns (bytes memory newCtx);

    /// @notice Read flow data between a sender and receiver.
    function getFlow(
        address token,
        address sender,
        address receiver
    ) external view returns (uint256 timestamp, int96 flowRate, uint256 deposit, uint256 owedDeposit);
}
