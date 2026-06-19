// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IClearMacro} from "./interfaces/IClearMacro.sol";
import {ISuperfluid} from "./interfaces/ISuperfluid.sol";
import {IConstantFlowAgreementV1} from "./interfaces/IConstantFlowAgreementV1.sol";

/// @dev Minimal Super Token surface used only to render a human-readable symbol.
interface ISuperTokenSymbol {
    function symbol() external view returns (string memory);
}

/// @title CreateFlowMacro
/// @notice A Superfluid "clear macro" that opens a Constant Flow Agreement stream
///         FROM the signer TO a receiver, executed on the signer's behalf from a
///         single EIP-712 signature via ClearMacroForwarderV1.
///
///         There is no ACL grant and no on-chain transaction from the user: the
///         forwarder verifies the signature and runs `buildBatchOperations` through
///         the host in the user's context, so the created flow's sender is the user.
///
///         Generic over the Super Token (passed in params), so a single deployment
///         serves every token on a chain.
contract CreateFlowMacro is IClearMacro {
    /// @dev Superfluid batch-op type for a call-agreement; the host injects the
    ///      user's ctx. See Superfluid BatchOperation: CALL_AGREEMENT = 1 + 200.
    uint32 internal constant OPERATION_TYPE_SUPERFLUID_CALL_AGREEMENT = 201;

    /// @dev Canonical CFA v1 agreement type id.
    bytes32 internal constant CFA_ID =
        keccak256("org.superfluid-finance.agreements.ConstantFlowAgreement.v1");

    /// @dev Superfluid's nominal seconds-per-month (365/12 days); matches the SDK.
    uint256 internal constant SECONDS_PER_MONTH = 2_628_000;

    string internal constant PRIMARY_TYPE_NAME = "CreateStream";
    string internal constant ACTION_TYPE =
        "Action(string description,address superToken,address receiver,int96 flowRate)";
    bytes32 internal constant ACTION_TYPEHASH = keccak256(bytes(ACTION_TYPE));

    /// @notice Action arguments encoded in the macro `params`.
    struct CreateFlowParams {
        address superToken;
        address receiver;
        int96 flowRate; // wei per second (Super Token has 18 decimals)
    }

    // ──────────────────────────────────────────────
    // IClearMacro — EIP-712 metadata
    // ──────────────────────────────────────────────

    function getPrimaryTypeName(bytes memory) external pure returns (string memory) {
        return PRIMARY_TYPE_NAME;
    }

    function getActionTypeDefinition(bytes memory) external pure returns (string memory) {
        return ACTION_TYPE;
    }

    function getActionStructHash(bytes memory params) external view returns (bytes32) {
        (, bytes32 structHash) = _describeAndHash(_decode(params));
        return structHash;
    }

    // ──────────────────────────────────────────────
    // IClearMacro — execution
    // ──────────────────────────────────────────────

    function buildBatchOperations(ISuperfluid host, bytes memory params, address /* msgSender */)
        external
        view
        returns (ISuperfluid.Operation[] memory operations)
    {
        CreateFlowParams memory p = _decode(params);
        address cfa = host.getAgreementClass(CFA_ID);

        bytes memory callData = abi.encodeCall(
            IConstantFlowAgreementV1.createFlow,
            (p.superToken, p.receiver, p.flowRate, new bytes(0)) // ctx placeholder; host injects signer ctx
        );

        operations = new ISuperfluid.Operation[](1);
        operations[0] = ISuperfluid.Operation({
            operationType: OPERATION_TYPE_SUPERFLUID_CALL_AGREEMENT,
            target: cfa,
            data: abi.encode(callData, new bytes(0)) // (agreement callData, userData)
        });
    }

    function postCheck(ISuperfluid host, bytes memory params, address msgSender) external view {
        CreateFlowParams memory p = _decode(params);
        IConstantFlowAgreementV1 cfa = IConstantFlowAgreementV1(host.getAgreementClass(CFA_ID));
        (, int96 actual,,) = cfa.getFlow(p.superToken, msgSender, p.receiver);
        require(actual == p.flowRate, "CreateFlowMacro: flow not created");
    }

    // ──────────────────────────────────────────────
    // Off-chain helpers
    // ──────────────────────────────────────────────

    /// @notice Convenience for off-chain callers (the SDK): returns the encoded macro
    ///         `params`, the human-readable description shown when clear-signing, and
    ///         the EIP-712 action struct hash — so the dapp builds the exact typed data
    ///         the forwarder verifies without re-implementing the formatting.
    function encodeAction(address superToken, address receiver, int96 flowRate)
        external
        view
        returns (bytes memory params, string memory description, bytes32 structHash)
    {
        CreateFlowParams memory p = CreateFlowParams(superToken, receiver, flowRate);
        params = abi.encode(p);
        (description, structHash) = _describeAndHash(p);
    }

    // ──────────────────────────────────────────────
    // Internal
    // ──────────────────────────────────────────────

    function _decode(bytes memory params) internal pure returns (CreateFlowParams memory) {
        return abi.decode(params, (CreateFlowParams));
    }

    function _describeAndHash(CreateFlowParams memory p)
        internal
        view
        returns (string memory description, bytes32 structHash)
    {
        description = _describe(p);
        structHash = keccak256(
            abi.encode(
                ACTION_TYPEHASH,
                keccak256(bytes(description)),
                p.superToken,
                p.receiver,
                p.flowRate
            )
        );
    }

    function _describe(CreateFlowParams memory p) internal view returns (string memory) {
        require(p.flowRate > 0, "CreateFlowMacro: flowRate must be positive");
        uint256 monthly = uint256(uint96(p.flowRate)) * SECONDS_PER_MONTH;
        return string.concat(
            "Stream ",
            _formatAmount(monthly),
            " ",
            _symbolOf(p.superToken),
            "/month to ",
            _toHexString(p.receiver)
        );
    }

    function _symbolOf(address token) internal view returns (string memory) {
        try ISuperTokenSymbol(token).symbol() returns (string memory s) {
            return s;
        } catch {
            return "tokens";
        }
    }

    /// @dev Format an 18-decimal amount with 4 fixed decimal places, e.g. "12.5000".
    function _formatAmount(uint256 amount) internal pure returns (string memory) {
        uint256 intPart = amount / 1e18;
        uint256 frac = (amount % 1e18) / 1e14; // first 4 decimal places
        return string.concat(_toString(intPart), ".", _pad4(frac));
    }

    /// @dev Zero-pad a value in [0, 9999] to exactly 4 characters.
    function _pad4(uint256 v) internal pure returns (string memory) {
        bytes memory b = bytes(_toString(v));
        if (b.length >= 4) return string(b);
        bytes memory out = new bytes(4);
        uint256 pad = 4 - b.length;
        for (uint256 i = 0; i < 4; ++i) {
            out[i] = i < pad ? bytes1("0") : b[i - pad];
        }
        return string(out);
    }

    /// @dev uint256 → decimal string.
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            ++digits;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    /// @dev address → lowercase "0x"-prefixed 40-char hex string.
    function _toHexString(address addr) internal pure returns (string memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes20 data = bytes20(addr);
        bytes memory str = new bytes(42);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 20; ++i) {
            str[2 + i * 2] = hexChars[uint8(data[i] >> 4)];
            str[3 + i * 2] = hexChars[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }
}
