// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CreateFlowMacro} from "../src/CreateFlowMacro.sol";
import {ISuperfluid} from "../src/interfaces/ISuperfluid.sol";
import {IConstantFlowAgreementV1} from "../src/interfaces/IConstantFlowAgreementV1.sol";

// ═══════════════════════════════════════════════════
// Mocks
// ═══════════════════════════════════════════════════

contract MockToken {
    string public symbol = "USDCx";
}

/// @dev Mock host that resolves any agreement id to a fixed CFA address and a mock
///      CFA whose `getFlow` returns a settable flow rate (for postCheck tests).
contract MockHostAndCFA is ISuperfluid {
    int96 public storedFlowRate;

    function getAgreementClass(bytes32) external view returns (address) {
        return address(this);
    }

    function setFlow(int96 flowRate) external {
        storedFlowRate = flowRate;
    }

    function getFlow(address, address, address)
        external
        view
        returns (uint256, int96, uint256, uint256)
    {
        return (0, storedFlowRate, 0, 0);
    }
}

contract CreateFlowMacroTest is Test {
    CreateFlowMacro internal flowMacro;
    MockHostAndCFA internal host;
    MockToken internal token;

    address internal user = address(0xA11CE);
    address internal receiver = address(0xB0B);
    int96 internal constant FLOW_RATE = 400_000_000_000; // 1.0512 tokens/month at 18 decimals

    function setUp() public {
        flowMacro = new CreateFlowMacro();
        host = new MockHostAndCFA();
        token = new MockToken();
    }

    function _params() internal view returns (bytes memory) {
        return abi.encode(
            CreateFlowMacro.CreateFlowParams({
                superToken: address(token),
                receiver: receiver,
                flowRate: FLOW_RATE
            })
        );
    }

    function test_TypeMetadata() public view {
        assertEq(flowMacro.getPrimaryTypeName(""), "CreateStream");
        assertEq(
            flowMacro.getActionTypeDefinition(""),
            "Action(string description,address superToken,address receiver,int96 flowRate)"
        );
    }

    function test_BuildBatchOperations_CreatesSingleCFACreateFlowOp() public view {
        ISuperfluid.Operation[] memory ops = flowMacro.buildBatchOperations(host, _params(), user);

        assertEq(ops.length, 1, "expected exactly one operation");
        assertEq(uint256(ops[0].operationType), 201, "must be SUPERFLUID_CALL_AGREEMENT");
        assertEq(ops[0].target, address(host), "target must be the resolved CFA");

        // op.data = abi.encode(callData, userData)
        (bytes memory callData, bytes memory userData) = abi.decode(ops[0].data, (bytes, bytes));
        assertEq(userData.length, 0, "userData must be empty");

        bytes memory expected = abi.encodeCall(
            IConstantFlowAgreementV1.createFlow,
            (address(token), receiver, FLOW_RATE, new bytes(0))
        );
        assertEq(keccak256(callData), keccak256(expected), "callData must be createFlow(...)");
    }

    function test_StructHash_MatchesEncodeActionAndManualHash() public view {
        (bytes memory params, string memory description, bytes32 structHash) =
            flowMacro.encodeAction(address(token), receiver, FLOW_RATE);

        // encodeAction params must decode to the same struct hash via the IClearMacro path.
        assertEq(flowMacro.getActionStructHash(params), structHash, "struct hash mismatch via params");

        // Recompute the hash exactly as a verifier would.
        bytes32 typeHash = keccak256(
            bytes("Action(string description,address superToken,address receiver,int96 flowRate)")
        );
        bytes32 expected = keccak256(
            abi.encode(typeHash, keccak256(bytes(description)), address(token), receiver, FLOW_RATE)
        );
        assertEq(structHash, expected, "struct hash does not match manual EIP-712 encoding");
    }

    function test_Description_IsHumanReadable() public view {
        (, string memory description,) = flowMacro.encodeAction(address(token), receiver, FLOW_RATE);
        // Should read like: "Stream 1.0000 USDCx/month to 0x...".
        assertTrue(bytes(description).length > 0, "empty description");
        assertTrue(
            _contains(description, "Stream 1.0512 USDCx/month to 0x"),
            "description not formatted as expected"
        );
    }

    function test_EncodeAction_ParamsRoundTrip() public view {
        (bytes memory params,,) = flowMacro.encodeAction(address(token), receiver, FLOW_RATE);
        CreateFlowMacro.CreateFlowParams memory p =
            abi.decode(params, (CreateFlowMacro.CreateFlowParams));
        assertEq(p.superToken, address(token));
        assertEq(p.receiver, receiver);
        assertEq(p.flowRate, FLOW_RATE);
    }

    function test_PostCheck_RevertsWhenFlowMissing() public {
        host.setFlow(0);
        vm.expectRevert(bytes("CreateFlowMacro: flow not created"));
        flowMacro.postCheck(host, _params(), user);
    }

    function test_PostCheck_PassesWhenFlowMatches() public {
        host.setFlow(FLOW_RATE);
        flowMacro.postCheck(host, _params(), user); // must not revert
    }

    function test_RevertsOnNonPositiveFlowRate() public {
        bytes memory bad = abi.encode(
            CreateFlowMacro.CreateFlowParams({superToken: address(token), receiver: receiver, flowRate: 0})
        );
        vm.expectRevert(bytes("CreateFlowMacro: flowRate must be positive"));
        flowMacro.getActionStructHash(bad);
    }

    // ── helpers ──

    function _contains(string memory haystack, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);
        if (n.length == 0 || n.length > h.length) return false;
        for (uint256 i = 0; i <= h.length - n.length; ++i) {
            bool ok = true;
            for (uint256 j = 0; j < n.length; ++j) {
                if (h[i + j] != n[j]) {
                    ok = false;
                    break;
                }
            }
            if (ok) return true;
        }
        return false;
    }
}
