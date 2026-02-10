// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {SuperfluidFacilitator} from "../src/SuperfluidFacilitator.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// ═══════════════════════════════════════════════════
// Minimal USDCx mock for fork testing
// ═══════════════════════════════════════════════════

/// @dev The real Superfluid Super Token proxy on Base uses a complex
///      ERC1820/Host/Governance proxy pattern that doesn't resolve
///      correctly in Forge's fork mode (getHost(), balanceOf() return
///      empty data). This mock preserves real USDC EIP-3009 interactions
///      while simulating the wrapping from USDC → USDCx.
contract ForkMockUSDCx {
    address constant USDC_ADDR = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    uint256 constant SCALE = 1e12;

    mapping(address => uint256) private _balances;

    /// @dev Simulates Super Token wrapping: pulls real USDC via the
    ///      existing approval and credits 18-decimal super balance.
    function upgradeTo(address to, uint256 amount, bytes calldata) external {
        uint256 underlying = amount / SCALE;
        require(underlying > 0, "ForkMockUSDCx: amount too small");
        IERC20(USDC_ADDR).transferFrom(msg.sender, address(this), underlying);
        _balances[to] += amount;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _balances[msg.sender] -= amount;
        _balances[to] += amount;
        return true;
    }

    function approve(address, uint256) external pure returns (bool) {
        return true;
    }

    function allowance(address, address) external pure returns (uint256) {
        return type(uint256).max;
    }

    function totalSupply() external pure returns (uint256) {
        return 0;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        _balances[from] -= amount;
        _balances[to] += amount;
        return true;
    }
}

// ═══════════════════════════════════════════════════
// Fork tests
// ═══════════════════════════════════════════════════

/// @title Fork tests against real Base mainnet USDC with mocked USDCx.
/// @dev   Tests EIP-3009 signatures against the real USDC contract on Base.
///        USDCx is replaced with a minimal mock (see ForkMockUSDCx above)
///        because the Superfluid Super Token proxy doesn't work in Forge fork mode.
///
///        Run with: forge test --match-contract ForkTest --fork-url <BASE_RPC> -vvv
contract SuperfluidFacilitatorForkTest is Test {
    // ──────────────────────────────────────────────
    // Base mainnet addresses
    // ──────────────────────────────────────────────

    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant USDCx = 0xD04383398dD2426297da660F9CCA3d439AF9ce1b;
    address constant CFA_FORWARDER = 0xcfA132E353cB4E398080B9700609bb008eceB125;

    // ──────────────────────────────────────────────
    // EIP-712 constants for USDC on Base
    // ──────────────────────────────────────────────

    bytes32 constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    // ──────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────

    SuperfluidFacilitator public facilitator;

    address owner;
    address operator;
    uint256 operatorKey;
    address treasury;
    address defaultRecipient;

    uint256 userKey;
    address user;

    uint256 constant MIN_FEE = 100_000; // 0.1 USDC
    uint256 constant FEE_BASIS_POINTS = 10; // 0.1%

    function setUp() public {
        require(block.chainid == 8453, "Must run with --fork-url pointing to Base mainnet");

        owner = makeAddr("owner");
        (operator, operatorKey) = makeAddrAndKey("operator");
        treasury = makeAddr("treasury");
        defaultRecipient = makeAddr("defaultRecipient");
        (user, userKey) = makeAddrAndKey("user");

        // Deploy facilitator against real USDC address.
        // Constructor sets IERC20(USDC).approve(USDCx, type(uint256).max) which
        // is stored in USDC's state and remains valid after we etch mock USDCx.
        facilitator = new SuperfluidFacilitator(
            owner,
            operator,
            USDC,
            USDCx,
            CFA_FORWARDER,
            treasury,
            defaultRecipient,
            MIN_FEE,
            FEE_BASIS_POINTS,
            1e12
        );

        // Replace USDCx bytecode with our mock. The USDC approval set during
        // the constructor persists because it's in USDC's storage, not USDCx's.
        ForkMockUSDCx mockImpl = new ForkMockUSDCx();
        vm.etch(USDCx, address(mockImpl).code);

        // Fund user with real USDC using forge-std deal
        deal(USDC, user, 100_000_000); // 100 USDC

        // Give user some ETH for gas
        vm.deal(user, 1 ether);
    }

    // ──────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────

    /// @dev Build the EIP-712 domain separator for USDC on Base.
    ///      USDC uses name="USD Coin", version="2".
    function _usdcDomainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("USD Coin"),
                keccak256("2"),
                block.chainid,
                USDC
            )
        );
    }

    /// @dev Sign a transferWithAuthorization for the given params.
    function _signTransferAuth(
        uint256 signerKey,
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 structHash = keccak256(
            abi.encode(
                TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce
            )
        );

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", _usdcDomainSeparator(), structHash)
        );

        (v, r, s) = vm.sign(signerKey, digest);
    }

    // ──────────────────────────────────────────────
    // Tests: Deployment
    // ──────────────────────────────────────────────

    function test_fork_deployedCorrectly() public view {
        assertEq(address(facilitator.usdc()), USDC);
        assertEq(address(facilitator.usdcx()), USDCx);
        assertEq(address(facilitator.cfaForwarder()), CFA_FORWARDER);

        // Verify USDC approval was set (stored in USDC's state)
        uint256 usdcAllowance = IERC20(USDC).allowance(address(facilitator), USDCx);
        assertEq(usdcAllowance, type(uint256).max);
    }

    function test_fork_userHasUsdc() public view {
        assertEq(IERC20(USDC).balanceOf(user), 100_000_000);
    }

    // ──────────────────────────────────────────────
    // Tests: processPaymentWrapOnly (real USDC + mock USDCx)
    // ──────────────────────────────────────────────

    function test_fork_processPaymentWrapOnly() public {
        uint256 totalValue = 10_000_000; // 10 USDC
        bytes32 nonce = bytes32(uint256(42));

        (uint256 expectedWrap, uint256 expectedFee) = facilitator.calculateFeeBreakdown(totalValue);

        // Sign the receiveWithAuthorization (verified by real USDC contract)
        (uint8 v, bytes32 r, bytes32 s) = _signTransferAuth(
            userKey, user, address(facilitator), totalValue, 0, type(uint256).max, nonce
        );

        // Process as operator
        vm.prank(operator);
        facilitator.processPaymentWrapOnly(
            user, totalValue,
            SuperfluidFacilitator.AuthParams(0, type(uint256).max, nonce, v, r, s)
        );

        // Verify: USDC pulled from user via real EIP-3009
        assertEq(IERC20(USDC).balanceOf(user), 100_000_000 - totalValue);

        // Verify: fee held by contract (real USDC balance)
        assertEq(IERC20(USDC).balanceOf(address(facilitator)), expectedFee);

        // Verify: USDCx minted to user via mock (18 decimals)
        uint256 usdcxBalance = IERC20(USDCx).balanceOf(user);
        uint256 expectedUsdcxBalance = expectedWrap * 1e12;
        assertEq(usdcxBalance, expectedUsdcxBalance);

        // Verify: deposit tracked
        assertEq(facilitator.userPaidFees(user), expectedFee);
        assertEq(facilitator.totalFeesAccumulated(), expectedFee);
        assertEq(facilitator.totalPaymentsProcessed(), 1);

        console2.log("Payment processed successfully on fork:");
        console2.log("  Total paid:     ", totalValue);
        console2.log("  Amount wrapped: ", expectedWrap);
        console2.log("  Fee:            ", expectedFee);
        console2.log("  USDCx received: ", usdcxBalance);
    }

    function test_fork_processPaymentWrapOnly_multiple() public {
        // First payment
        bytes32 nonce1 = bytes32(uint256(1));
        uint256 amount1 = 5_000_000; // 5 USDC

        (uint8 v1, bytes32 r1, bytes32 s1) = _signTransferAuth(
            userKey, user, address(facilitator), amount1, 0, type(uint256).max, nonce1
        );

        vm.prank(operator);
        facilitator.processPaymentWrapOnly(
            user, amount1,
            SuperfluidFacilitator.AuthParams(0, type(uint256).max, nonce1, v1, r1, s1)
        );

        // Second payment
        bytes32 nonce2 = bytes32(uint256(2));
        uint256 amount2 = 3_000_000; // 3 USDC

        (uint8 v2, bytes32 r2, bytes32 s2) = _signTransferAuth(
            userKey, user, address(facilitator), amount2, 0, type(uint256).max, nonce2
        );

        vm.prank(operator);
        facilitator.processPaymentWrapOnly(
            user, amount2,
            SuperfluidFacilitator.AuthParams(0, type(uint256).max, nonce2, v2, r2, s2)
        );

        // Verify cumulative
        assertEq(facilitator.totalPaymentsProcessed(), 2);
        assertEq(IERC20(USDC).balanceOf(user), 100_000_000 - amount1 - amount2);

        (, uint256 fee1) = facilitator.calculateFeeBreakdown(amount1);
        (, uint256 fee2) = facilitator.calculateFeeBreakdown(amount2);
        assertEq(facilitator.userPaidFees(user), fee1 + fee2);

        // Verify cumulative USDCx balance
        (uint256 wrap1,) = facilitator.calculateFeeBreakdown(amount1);
        (uint256 wrap2,) = facilitator.calculateFeeBreakdown(amount2);
        assertEq(IERC20(USDCx).balanceOf(user), (wrap1 + wrap2) * 1e12);
    }

    function test_fork_processPaymentWrapOnly_revertOnReusedNonce() public {
        uint256 totalValue = 5_000_000;
        bytes32 nonce = bytes32(uint256(99));

        (uint8 v, bytes32 r, bytes32 s) = _signTransferAuth(
            userKey, user, address(facilitator), totalValue, 0, type(uint256).max, nonce
        );

        // First call succeeds
        vm.prank(operator);
        facilitator.processPaymentWrapOnly(
            user, totalValue,
            SuperfluidFacilitator.AuthParams(0, type(uint256).max, nonce, v, r, s)
        );

        // Second call with same nonce reverts (real USDC rejects reused nonce)
        vm.expectRevert();
        vm.prank(operator);
        facilitator.processPaymentWrapOnly(
            user, totalValue,
            SuperfluidFacilitator.AuthParams(0, type(uint256).max, nonce, v, r, s)
        );
    }

    function test_fork_processPaymentWrapOnly_revertOnInvalidSignature() public {
        uint256 totalValue = 5_000_000;
        bytes32 nonce = bytes32(uint256(77));

        // Sign with wrong key
        (, uint256 wrongKey) = makeAddrAndKey("wrong");
        (uint8 v, bytes32 r, bytes32 s) = _signTransferAuth(
            wrongKey, user, address(facilitator), totalValue, 0, type(uint256).max, nonce
        );

        // Should revert (real USDC rejects invalid sig)
        vm.expectRevert();
        vm.prank(operator);
        facilitator.processPaymentWrapOnly(
            user, totalValue,
            SuperfluidFacilitator.AuthParams(0, type(uint256).max, nonce, v, r, s)
        );
    }

    // ──────────────────────────────────────────────
    // Tests: processPayment with stream creation
    // ──────────────────────────────────────────────

    /// @dev Stream creation requires the full Superfluid protocol (Host, CFA, etc.)
    ///      which doesn't work with our mock USDCx. We mock the CFA forwarder's
    ///      setFlowrateFrom to verify the full processPayment code path works
    ///      end-to-end with real USDC EIP-3009 signatures.
    function test_fork_processPayment_withStream() public {
        uint256 totalValue = 10_000_000; // 10 USDC
        bytes32 nonce = bytes32(uint256(100));
        int96 flowRate = int96(int256(380517503805)); // ~1 USDC/month in 18-dec wei/sec

        // Mock CFA forwarder calls since the real Superfluid protocol
        // can't operate on our mock USDCx
        vm.mockCall(
            CFA_FORWARDER,
            abi.encodeWithSignature(
                "setFlowrateFrom(address,address,address,int96)",
                USDCx, user, defaultRecipient, flowRate
            ),
            abi.encode(true)
        );
        vm.mockCall(
            CFA_FORWARDER,
            abi.encodeWithSignature(
                "getFlowrate(address,address,address)",
                USDCx, user, defaultRecipient
            ),
            abi.encode(flowRate)
        );

        // Sign the authorization (verified by real USDC)
        (uint8 v, bytes32 r, bytes32 s) = _signTransferAuth(
            userKey, user, address(facilitator), totalValue, 0, type(uint256).max, nonce
        );

        (uint256 expectedWrap, uint256 expectedFee) = facilitator.calculateFeeBreakdown(totalValue);

        // Process payment with stream
        vm.prank(operator);
        facilitator.processPayment(
            user, totalValue,
            SuperfluidFacilitator.AuthParams(0, type(uint256).max, nonce, v, r, s),
            defaultRecipient, flowRate
        );

        // Verify: USDC pulled from user via real EIP-3009
        assertEq(IERC20(USDC).balanceOf(user), 100_000_000 - totalValue);

        // Verify: fee held by contract
        assertEq(IERC20(USDC).balanceOf(address(facilitator)), expectedFee);

        // Verify: USDCx minted to user via mock
        uint256 usdcxBalance = IERC20(USDCx).balanceOf(user);
        assertEq(usdcxBalance, expectedWrap * 1e12);

        // Verify: stream "created" (mocked)
        int96 actualFlowRate = facilitator.getExistingFlowRate(user, defaultRecipient);
        assertEq(actualFlowRate, flowRate);

        console2.log("Payment + stream processed on fork:");
        console2.log("  Wrap amount:    ", expectedWrap);
        console2.log("  Fee:            ", expectedFee);
        console2.log("  Flow rate:      ", uint256(int256(flowRate)));
        console2.log("  USDCx balance:  ", usdcxBalance);
    }

    function test_fork_processPayment_streamFailsWithoutACL() public {
        uint256 totalValue = 10_000_000;
        bytes32 nonce = bytes32(uint256(200));
        int96 flowRate = int96(int256(380517503805));

        // Do NOT mock CFA forwarder — stream creation should fail
        // (CFA forwarder can't operate on mock USDCx without full Superfluid protocol)

        (uint8 v, bytes32 r, bytes32 s) = _signTransferAuth(
            userKey, user, address(facilitator), totalValue, 0, type(uint256).max, nonce
        );

        // Should revert with StreamCreationFailed (CFA forwarder fails)
        vm.expectRevert();
        vm.prank(operator);
        facilitator.processPayment(
            user, totalValue,
            SuperfluidFacilitator.AuthParams(0, type(uint256).max, nonce, v, r, s),
            defaultRecipient, flowRate
        );

        // Verify atomic revert: nothing changed
        assertEq(IERC20(USDC).balanceOf(user), 100_000_000);
        assertEq(facilitator.totalPaymentsProcessed(), 0);
    }

    // ──────────────────────────────────────────────
    // Tests: Admin on fork
    // ──────────────────────────────────────────────

    function test_fork_withdrawFees() public {
        // Process a payment first
        uint256 totalValue = 10_000_000;
        bytes32 nonce = bytes32(uint256(300));

        (uint8 v, bytes32 r, bytes32 s) = _signTransferAuth(
            userKey, user, address(facilitator), totalValue, 0, type(uint256).max, nonce
        );

        vm.prank(operator);
        facilitator.processPaymentWrapOnly(
            user, totalValue,
            SuperfluidFacilitator.AuthParams(0, type(uint256).max, nonce, v, r, s)
        );

        (, uint256 fee) = facilitator.calculateFeeBreakdown(totalValue);
        assertEq(IERC20(USDC).balanceOf(address(facilitator)), fee);

        // Withdraw fees to treasury
        vm.prank(owner);
        facilitator.withdrawFees();

        assertEq(IERC20(USDC).balanceOf(address(facilitator)), 0);
        assertEq(IERC20(USDC).balanceOf(treasury), fee);
    }

    // ──────────────────────────────────────────────
    // Tests: Fee calculation against real amounts
    // ──────────────────────────────────────────────

    function test_fork_feeCalculation_1USDC() public view {
        // 1 USDC = 1_000_000
        (uint256 wrap, uint256 fee) = facilitator.calculateFeeBreakdown(1_000_000);
        // At 0.1% with 0.1 USDC min fee: 1 * 0.001 = 0.001 < 0.1, so fee = 0.1 USDC
        assertEq(fee, 100_000); // 0.1 USDC
        assertEq(wrap, 900_000); // 0.9 USDC

        console2.log("1 USDC: wrap=", wrap, "fee=", fee);
    }

    function test_fork_feeCalculation_monthlySubscription() public view {
        // Typical monthly: user wants to wrap exactly 1 USDC
        (uint256 total, uint256 fee) = facilitator.calculateTotalForWrap(1_000_000);
        assertEq(fee, 100_000); // min fee
        assertEq(total, 1_100_000); // 1.1 USDC total

        console2.log("1 USDC wrap: total=", total, "fee=", fee);
    }

    function test_fork_feeCalculation_largeDeposit() public view {
        // 1000 USDC deposit
        (uint256 wrap, uint256 fee) = facilitator.calculateFeeBreakdown(1_000_000_000);
        // 0.1% of 1000 = 1 USDC > 0.1 min, so percentage applies
        assertGt(fee, 100_000);
        assertEq(wrap + fee, 1_000_000_000);

        console2.log("1000 USDC: wrap=", wrap, "fee=", fee);
    }
}
