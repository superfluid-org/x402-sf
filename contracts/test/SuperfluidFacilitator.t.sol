// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {SuperfluidFacilitator} from "../src/SuperfluidFacilitator.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// ═══════════════════════════════════════════════════
// Mock: USDC with EIP-3009 support
// ═══════════════════════════════════════════════════

contract MockUSDC {
    string public name = "USD Coin";
    string public symbol = "USDC";
    uint8 public decimals = 6;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => mapping(bytes32 => bool)) public authorizationState;

    uint256 public totalSupply;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "insufficient balance");
        if (allowance[from][msg.sender] != type(uint256).max) {
            require(allowance[from][msg.sender] >= amount, "insufficient allowance");
            allowance[from][msg.sender] -= amount;
        }
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }

    /// @dev Mock receiveWithAuthorization: validates msg.sender == to, checks nonce, transfers.
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 /* validAfter */,
        uint256 /* validBefore */,
        bytes32 nonce,
        uint8 /* v */,
        bytes32 /* r */,
        bytes32 /* s */
    ) external {
        require(msg.sender == to, "caller must be the payee");
        require(!authorizationState[from][nonce], "authorization already used");
        require(balanceOf[from] >= value, "insufficient balance");

        authorizationState[from][nonce] = true;
        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }

    /// @dev Mock transferWithAuthorization (included for interface completeness).
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 /* validAfter */,
        uint256 /* validBefore */,
        bytes32 nonce,
        uint8 /* v */,
        bytes32 /* r */,
        bytes32 /* s */
    ) external {
        require(!authorizationState[from][nonce], "authorization already used");
        require(balanceOf[from] >= value, "insufficient balance");

        authorizationState[from][nonce] = true;
        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }
}

// ═══════════════════════════════════════════════════
// Mock: USDCx Super Token
// ═══════════════════════════════════════════════════

contract MockUSDCx {
    string public name = "Super USD Coin";
    string public symbol = "USDCx";
    uint8 public decimals = 18;

    IERC20 public underlying;
    mapping(address => uint256) public balanceOf;

    // Track upgradeTo calls for assertions
    address public lastUpgradeTo;
    uint256 public lastUpgradeAmount;

    constructor(address _underlying) {
        underlying = IERC20(_underlying);
    }

    /// @dev Mock upgradeTo: pulls underlying from msg.sender, mints super tokens to `to`.
    function upgradeTo(address to, uint256 amount, bytes calldata /* userData */) external {
        underlying.transferFrom(msg.sender, address(this), amount);
        // In real Superfluid, 1 USDC (6 dec) = 1e12 USDCx (18 dec).
        // For testing we keep 1:1 in underlying units.
        balanceOf[to] += amount;
        lastUpgradeTo = to;
        lastUpgradeAmount = amount;
    }

    function upgrade(uint256 amount) external {
        underlying.transferFrom(msg.sender, address(this), amount);
        balanceOf[msg.sender] += amount;
    }

    function downgrade(uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        balanceOf[msg.sender] -= amount;
        underlying.transfer(msg.sender, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

// ═══════════════════════════════════════════════════
// Mock: CFA V1 Forwarder
// ═══════════════════════════════════════════════════

contract MockCFAForwarder {
    struct Flow {
        int96 flowRate;
    }

    // token => sender => receiver => flow
    mapping(address => mapping(address => mapping(address => Flow))) public flows;

    bool public shouldFail;
    string public failReason;

    // Track calls
    address public lastToken;
    address public lastSender;
    address public lastReceiver;
    int96 public lastFlowRate;

    function setFlowrateFrom(
        address token,
        address sender,
        address receiver,
        int96 flowrate
    ) external returns (bool) {
        if (shouldFail) {
            if (bytes(failReason).length > 0) {
                revert(failReason);
            }
            revert();
        }

        flows[token][sender][receiver] = Flow(flowrate);
        lastToken = token;
        lastSender = sender;
        lastReceiver = receiver;
        lastFlowRate = flowrate;
        return true;
    }

    function getFlowrate(
        address token,
        address sender,
        address receiver
    ) external view returns (int96) {
        return flows[token][sender][receiver].flowRate;
    }

    function grantPermissions(address /* token */, address /* flowOperator */) external {}
    function revokePermissions(address /* token */, address /* flowOperator */) external {}

    // Test helpers
    function setShouldFail(bool _shouldFail, string memory _reason) external {
        shouldFail = _shouldFail;
        failReason = _reason;
    }
}

// ═══════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════

contract SuperfluidFacilitatorTest is Test {
    SuperfluidFacilitator public facilitator;
    MockUSDC public usdc;
    MockUSDCx public usdcx;
    MockCFAForwarder public cfaForwarder;

    address owner = makeAddr("owner");
    address operator = makeAddr("operator");
    address treasury = makeAddr("treasury");
    address defaultRecipient = makeAddr("defaultRecipient");
    address user = makeAddr("user");
    address recipient = makeAddr("recipient");

    uint256 constant MIN_FEE = 100_000; // 0.1 USDC
    uint256 constant FEE_BASIS_POINTS = 10; // 0.1%

    // Re-declare events for expectEmit
    event PaymentProcessed(
        address indexed user,
        address indexed recipient,
        uint256 totalPaid,
        uint256 amountWrapped,
        uint256 fee,
        int96 flowRate,
        bool streamCreated
    );
    event FeeConfigUpdated(uint256 minFee, uint256 feeBasisPoints);

    // Default EIP-3009 params (mock doesn't validate signatures)
    uint256 validAfter = 0;
    uint256 validBefore = type(uint256).max;
    bytes32 nonce = bytes32(uint256(1));
    uint8 v = 27;
    bytes32 r = bytes32(uint256(2));
    bytes32 s = bytes32(uint256(3));

    function _defaultAuth() internal view returns (SuperfluidFacilitator.AuthParams memory) {
        return SuperfluidFacilitator.AuthParams(validAfter, validBefore, nonce, v, r, s);
    }

    function _authWithNonce(bytes32 n) internal view returns (SuperfluidFacilitator.AuthParams memory) {
        return SuperfluidFacilitator.AuthParams(validAfter, validBefore, n, v, r, s);
    }

    function setUp() public {
        usdc = new MockUSDC();
        usdcx = new MockUSDCx(address(usdc));
        cfaForwarder = new MockCFAForwarder();

        facilitator = new SuperfluidFacilitator(
            owner,
            operator,
            address(usdc),
            address(usdcx),
            address(cfaForwarder),
            treasury,
            defaultRecipient,
            MIN_FEE,
            FEE_BASIS_POINTS,
            1 // Mock uses 1:1 decimals, no scaling needed
        );
    }

    // ──────────────────────────────────────────────
    // Constructor
    // ──────────────────────────────────────────────

    function test_constructor_setsState() public view {
        assertTrue(facilitator.hasRole(facilitator.DEFAULT_ADMIN_ROLE(), owner));
        assertTrue(facilitator.hasRole(facilitator.OPERATOR_ROLE(), operator));
        assertEq(address(facilitator.usdc()), address(usdc));
        assertEq(address(facilitator.usdcx()), address(usdcx));
        assertEq(address(facilitator.cfaForwarder()), address(cfaForwarder));
        assertEq(facilitator.treasury(), treasury);
        assertEq(facilitator.defaultRecipient(), defaultRecipient);
        assertEq(facilitator.minFee(), MIN_FEE);
        assertEq(facilitator.feeBasisPoints(), FEE_BASIS_POINTS);
        assertEq(facilitator.paused(), false);
    }

    function test_constructor_approvesUsdcToUsdcx() public view {
        uint256 allowance = usdc.allowance(address(facilitator), address(usdcx));
        assertEq(allowance, type(uint256).max);
    }

    function test_constructor_revertsOnZeroOwner() public {
        vm.expectRevert(SuperfluidFacilitator.ZeroAddress.selector);
        new SuperfluidFacilitator(
            address(0), operator, address(usdc), address(usdcx),
            address(cfaForwarder), treasury, defaultRecipient, MIN_FEE, FEE_BASIS_POINTS, 1
        );
    }

    function test_constructor_revertsOnZeroOperator() public {
        vm.expectRevert(SuperfluidFacilitator.ZeroAddress.selector);
        new SuperfluidFacilitator(
            owner, address(0), address(usdc), address(usdcx),
            address(cfaForwarder), treasury, defaultRecipient, MIN_FEE, FEE_BASIS_POINTS, 1
        );
    }

    function test_constructor_revertsOnZeroUsdc() public {
        vm.expectRevert(SuperfluidFacilitator.ZeroAddress.selector);
        new SuperfluidFacilitator(
            owner, operator, address(0), address(usdcx),
            address(cfaForwarder), treasury, defaultRecipient, MIN_FEE, FEE_BASIS_POINTS, 1
        );
    }

    function test_constructor_revertsOnZeroUsdcx() public {
        vm.expectRevert(SuperfluidFacilitator.ZeroAddress.selector);
        new SuperfluidFacilitator(
            owner, operator, address(usdc), address(0),
            address(cfaForwarder), treasury, defaultRecipient, MIN_FEE, FEE_BASIS_POINTS, 1
        );
    }

    function test_constructor_revertsOnZeroCfaForwarder() public {
        vm.expectRevert(SuperfluidFacilitator.ZeroAddress.selector);
        new SuperfluidFacilitator(
            owner, operator, address(usdc), address(usdcx),
            address(0), treasury, defaultRecipient, MIN_FEE, FEE_BASIS_POINTS, 1
        );
    }

    function test_constructor_revertsOnZeroTreasury() public {
        vm.expectRevert(SuperfluidFacilitator.ZeroAddress.selector);
        new SuperfluidFacilitator(
            owner, operator, address(usdc), address(usdcx),
            address(cfaForwarder), address(0), defaultRecipient, MIN_FEE, FEE_BASIS_POINTS, 1
        );
    }

    function test_constructor_revertsOnHighFeeBasisPoints() public {
        vm.expectRevert(SuperfluidFacilitator.InvalidFeeConfig.selector);
        new SuperfluidFacilitator(
            owner, operator, address(usdc), address(usdcx),
            address(cfaForwarder), treasury, defaultRecipient, MIN_FEE, 1001, 1
        );
    }

    function test_constructor_allowsMaxFeeBasisPoints() public {
        SuperfluidFacilitator f = new SuperfluidFacilitator(
            owner, operator, address(usdc), address(usdcx),
            address(cfaForwarder), treasury, defaultRecipient, MIN_FEE, 1000, 1
        );
        assertEq(f.feeBasisPoints(), 1000);
    }

    function test_constructor_allowsZeroDefaultRecipient() public {
        SuperfluidFacilitator f = new SuperfluidFacilitator(
            owner, operator, address(usdc), address(usdcx),
            address(cfaForwarder), treasury, address(0), MIN_FEE, FEE_BASIS_POINTS, 1
        );
        assertEq(f.defaultRecipient(), address(0));
    }

    // ──────────────────────────────────────────────
    // Fee Calculation
    // ──────────────────────────────────────────────

    function test_calculateFeeBreakdown_belowMinFee() public view {
        // Payment <= minFee: entire amount is fee, nothing to wrap
        (uint256 wrap, uint256 fee) = facilitator.calculateFeeBreakdown(50_000);
        assertEq(wrap, 0);
        assertEq(fee, 50_000);
    }

    function test_calculateFeeBreakdown_exactMinFee() public view {
        (uint256 wrap, uint256 fee) = facilitator.calculateFeeBreakdown(MIN_FEE);
        assertEq(wrap, 0);
        assertEq(fee, MIN_FEE);
    }

    function test_calculateFeeBreakdown_flatFeeRegion() public view {
        // Just above minFee: flat fee applies
        uint256 totalValue = 1_000_000; // 1 USDC
        (uint256 wrap, uint256 fee) = facilitator.calculateFeeBreakdown(totalValue);
        assertEq(fee, MIN_FEE); // 0.1 USDC
        assertEq(wrap, totalValue - MIN_FEE); // 0.9 USDC
    }

    function test_calculateFeeBreakdown_percentageFeeRegion() public view {
        // Large amount: percentage fee > minFee
        uint256 totalValue = 200_000_000; // 200 USDC
        (uint256 wrap, uint256 fee) = facilitator.calculateFeeBreakdown(totalValue);

        // fee = 200_000_000 * 10 / 10_000 = 200_000
        uint256 expectedFee = totalValue * FEE_BASIS_POINTS / 10_000;
        uint256 expectedWrap = totalValue - expectedFee;

        assertEq(wrap, expectedWrap);
        assertEq(fee, expectedFee);
        // Fee should be > minFee in this region
        assertGt(fee, MIN_FEE);
    }

    function test_calculateFeeBreakdown_atThreshold() public view {
        // At the boundary where percentage fee equals minFee:
        // minFee * 10_000 / feeBasisPoints = 100_000 * 10_000 / 10 = 100_000_000
        uint256 threshold = 100_000_000;
        (uint256 wrap, uint256 fee) = facilitator.calculateFeeBreakdown(threshold);
        // fee = 100_000_000 * 10 / 10_000 = 100_000 == minFee
        assertEq(fee, MIN_FEE);
        assertEq(wrap, threshold - MIN_FEE);
    }

    function test_calculateFeeBreakdown_zeroBasisPoints() public {
        // Test flat fee mode (feeBasisPoints = 0)
        uint256 flatFee = 1_000_000; // 1 USDC flat fee

        vm.prank(owner);
        facilitator.setFeeConfig(flatFee, 0); // 0 basis points = flat fee only

        // Test with 2 USDC payment (should wrap 1 USDC, keep 1 USDC fee)
        uint256 totalValue = 2_000_000;
        (uint256 wrap, uint256 fee) = facilitator.calculateFeeBreakdown(totalValue);
        assertEq(fee, flatFee);
        assertEq(wrap, totalValue - flatFee);

        // Test with large payment (still flat fee, no percentage)
        uint256 largeValue = 1_000_000_000; // 1000 USDC
        (uint256 wrapLarge, uint256 feeLarge) = facilitator.calculateFeeBreakdown(largeValue);
        assertEq(feeLarge, flatFee); // Still just 1 USDC fee
        assertEq(wrapLarge, largeValue - flatFee);
    }

    function test_calculateTotalForWrap() public view {
        // Want to wrap 1 USDC (1_000_000), what total do I need?
        (uint256 total, uint256 fee) = facilitator.calculateTotalForWrap(1_000_000);
        // percentageFee = 1_000_000 * 10 / 10000 = 1000
        // 1000 < minFee (100_000), so fee = minFee
        assertEq(fee, MIN_FEE);
        assertEq(total, 1_000_000 + MIN_FEE);
    }

    function test_calculateTotalForWrap_largeAmount() public view {
        uint256 wrapAmount = 200_000_000; // 200 USDC
        (uint256 total, uint256 fee) = facilitator.calculateTotalForWrap(wrapAmount);
        // percentageFee = 200_000_000 * 10 / 10000 = 200_000
        // 200_000 > minFee (100_000), so fee = 200_000
        assertEq(fee, 200_000);
        assertEq(total, wrapAmount + 200_000);
    }

    // ──────────────────────────────────────────────
    // processPayment
    // ──────────────────────────────────────────────

    function _mintAndPrepare(address payer, uint256 amount) internal {
        usdc.mint(payer, amount);
    }

    function test_processPayment_basic() public {
        uint256 totalValue = 10_000_000; // 10 USDC
        _mintAndPrepare(user, totalValue);

        (uint256 expectedWrap, uint256 expectedFee) = facilitator.calculateFeeBreakdown(totalValue);

        vm.prank(operator);
        facilitator.processPayment(
            user, totalValue, _defaultAuth(),
            recipient, int96(380) // some flow rate
        );

        // USDC pulled from user
        assertEq(usdc.balanceOf(user), 0);
        // Fee stays in contract
        assertEq(usdc.balanceOf(address(facilitator)), expectedFee);
        // USDCx sent to user (via mock)
        assertEq(usdcx.balanceOf(user), expectedWrap);
        // Fees tracked
        assertEq(facilitator.userPaidFees(user), expectedFee);
        // Counters updated
        assertEq(facilitator.totalFeesAccumulated(), expectedFee);
        assertEq(facilitator.totalPaymentsProcessed(), 1);
        // Stream created
        assertEq(cfaForwarder.lastFlowRate(), int96(380));
        assertEq(cfaForwarder.lastSender(), user);
        assertEq(cfaForwarder.lastReceiver(), recipient);
    }

    function test_processPayment_usesDefaultRecipient() public {
        uint256 totalValue = 10_000_000;
        _mintAndPrepare(user, totalValue);

        vm.prank(operator);
        facilitator.processPayment(
            user, totalValue, _defaultAuth(),
            address(0), // use default
            int96(100)
        );

        assertEq(cfaForwarder.lastReceiver(), defaultRecipient);
    }

    function test_processPayment_noStream() public {
        uint256 totalValue = 10_000_000;
        _mintAndPrepare(user, totalValue);

        vm.prank(operator);
        facilitator.processPayment(
            user, totalValue, _defaultAuth(),
            recipient, int96(0) // flowRate = 0, skip stream
        );

        // No stream should have been created
        assertEq(cfaForwarder.lastFlowRate(), int96(0));
        assertEq(cfaForwarder.lastSender(), address(0)); // never called
    }

    function test_processPayment_emitsEvent() public {
        uint256 totalValue = 10_000_000;
        _mintAndPrepare(user, totalValue);

        (uint256 expectedWrap, uint256 expectedFee) = facilitator.calculateFeeBreakdown(totalValue);

        vm.expectEmit(true, true, false, true);
        emit PaymentProcessed(
            user, recipient, totalValue, expectedWrap, expectedFee, int96(100), true
        );

        vm.prank(operator);
        facilitator.processPayment(
            user, totalValue, _defaultAuth(),
            recipient, int96(100)
        );
    }

    function test_processPayment_revertsForNonOperator() public {
        uint256 totalValue = 10_000_000;
        _mintAndPrepare(user, totalValue);

        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                user,
                facilitator.OPERATOR_ROLE()
            )
        );
        vm.prank(user);
        facilitator.processPayment(
            user, totalValue, _defaultAuth(),
            recipient, int96(100)
        );
    }

    function test_processPayment_revertsWhenPaused() public {
        vm.prank(owner);
        facilitator.setPaused(true);

        uint256 totalValue = 10_000_000;
        _mintAndPrepare(user, totalValue);

        vm.expectRevert(SuperfluidFacilitator.ContractPaused.selector);
        vm.prank(operator);
        facilitator.processPayment(
            user, totalValue, _defaultAuth(),
            recipient, int96(100)
        );
    }

    function test_processPayment_revertsOnZeroFrom() public {
        vm.expectRevert(SuperfluidFacilitator.ZeroAddress.selector);
        vm.prank(operator);
        facilitator.processPayment(
            address(0), 10_000_000, _defaultAuth(),
            recipient, int96(100)
        );
    }

    function test_processPayment_revertsOnSenderIsReceiver() public {
        uint256 totalValue = 10_000_000;
        _mintAndPrepare(user, totalValue);

        vm.expectRevert(SuperfluidFacilitator.SenderIsReceiver.selector);
        vm.prank(operator);
        facilitator.processPayment(
            user, totalValue, _defaultAuth(),
            user, int96(100) // sender == recipient
        );
    }

    function test_processPayment_revertsOnSenderIsReceiver_evenWithZeroFlowRate() public {
        uint256 totalValue = 10_000_000;
        _mintAndPrepare(user, totalValue);

        vm.expectRevert(SuperfluidFacilitator.SenderIsReceiver.selector);
        vm.prank(operator);
        facilitator.processPayment(
            user, totalValue, _defaultAuth(),
            user, int96(0) // sender == recipient, even with flowRate=0
        );
    }

    function test_processPayment_revertsOnInsufficientPayment() public {
        // Send exactly minFee → wrap = 0 → revert
        _mintAndPrepare(user, MIN_FEE);

        vm.expectRevert(SuperfluidFacilitator.InsufficientPayment.selector);
        vm.prank(operator);
        facilitator.processPayment(
            user, MIN_FEE, _defaultAuth(),
            recipient, int96(100)
        );
    }

    function test_processPayment_revertsOnStreamFailure() public {
        uint256 totalValue = 10_000_000;
        _mintAndPrepare(user, totalValue);

        cfaForwarder.setShouldFail(true, "CFA: no permissions");

        vm.expectRevert(
            abi.encodeWithSelector(
                SuperfluidFacilitator.StreamCreationFailed.selector,
                "CFA: no permissions"
            )
        );
        vm.prank(operator);
        facilitator.processPayment(
            user, totalValue, _defaultAuth(),
            recipient, int96(100)
        );
    }

    function test_processPayment_revertsOnStreamFailure_unknownError() public {
        uint256 totalValue = 10_000_000;
        _mintAndPrepare(user, totalValue);

        cfaForwarder.setShouldFail(true, "");

        vm.expectRevert(
            abi.encodeWithSelector(
                SuperfluidFacilitator.StreamCreationFailed.selector,
                "Unknown error"
            )
        );
        vm.prank(operator);
        facilitator.processPayment(
            user, totalValue, _defaultAuth(),
            recipient, int96(100)
        );
    }

    function test_processPayment_multiplePayments_accumulateFees() public {
        uint256 totalValue = 10_000_000;
        (, uint256 fee1) = facilitator.calculateFeeBreakdown(totalValue);

        // First payment
        _mintAndPrepare(user, totalValue);
        vm.prank(operator);
        facilitator.processPayment(
            user, totalValue, _defaultAuth(),
            recipient, int96(0)
        );

        // Second payment (different nonce)
        _mintAndPrepare(user, totalValue);
        (, uint256 fee2) = facilitator.calculateFeeBreakdown(totalValue);
        vm.prank(operator);
        facilitator.processPayment(
            user, totalValue, _authWithNonce(bytes32(uint256(99))),
            recipient, int96(0)
        );

        assertEq(facilitator.userPaidFees(user), fee1 + fee2);
        assertEq(facilitator.totalFeesAccumulated(), fee1 + fee2);
        assertEq(facilitator.totalPaymentsProcessed(), 2);
    }

    // ──────────────────────────────────────────────
    // processPaymentWrapOnly
    // ──────────────────────────────────────────────

    function test_processPaymentWrapOnly() public {
        uint256 totalValue = 10_000_000;
        _mintAndPrepare(user, totalValue);

        (uint256 expectedWrap, uint256 expectedFee) = facilitator.calculateFeeBreakdown(totalValue);

        vm.prank(operator);
        facilitator.processPaymentWrapOnly(
            user, totalValue, _defaultAuth()
        );

        assertEq(usdc.balanceOf(user), 0);
        assertEq(usdc.balanceOf(address(facilitator)), expectedFee);
        assertEq(usdcx.balanceOf(user), expectedWrap);
        assertEq(facilitator.userPaidFees(user), expectedFee);
        // No stream
        assertEq(cfaForwarder.lastSender(), address(0));
    }

    function test_processPaymentWrapOnly_revertsForNonOperator() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                user,
                facilitator.OPERATOR_ROLE()
            )
        );
        vm.prank(user);
        facilitator.processPaymentWrapOnly(
            user, 10_000_000, _defaultAuth()
        );
    }

    function test_processPaymentWrapOnly_revertsOnZeroFrom() public {
        vm.expectRevert(SuperfluidFacilitator.ZeroAddress.selector);
        vm.prank(operator);
        facilitator.processPaymentWrapOnly(
            address(0), 10_000_000, _defaultAuth()
        );
    }

    // ──────────────────────────────────────────────
    // View helpers
    // ──────────────────────────────────────────────

    function test_getUserPaidFees() public {
        uint256 totalValue = 10_000_000;
        _mintAndPrepare(user, totalValue);

        vm.prank(operator);
        facilitator.processPayment(
            user, totalValue, _defaultAuth(),
            recipient, int96(0)
        );

        (, uint256 fee) = facilitator.calculateFeeBreakdown(totalValue);
        assertEq(facilitator.getUserPaidFees(user), fee);
    }

    function test_getAccumulatedFees() public {
        uint256 totalValue = 10_000_000;
        _mintAndPrepare(user, totalValue);

        vm.prank(operator);
        facilitator.processPayment(
            user, totalValue, _defaultAuth(),
            recipient, int96(0)
        );

        (, uint256 fee) = facilitator.calculateFeeBreakdown(totalValue);
        assertEq(facilitator.getAccumulatedFees(), fee);
    }

    function test_getExistingFlowRate() public {
        uint256 totalValue = 10_000_000;
        _mintAndPrepare(user, totalValue);

        vm.prank(operator);
        facilitator.processPayment(
            user, totalValue, _defaultAuth(),
            recipient, int96(380)
        );

        int96 rate = facilitator.getExistingFlowRate(user, recipient);
        assertEq(rate, int96(380));
    }

    // ──────────────────────────────────────────────
    // Admin functions
    // ──────────────────────────────────────────────

    function test_withdrawFees() public {
        uint256 totalValue = 10_000_000;
        _mintAndPrepare(user, totalValue);

        vm.prank(operator);
        facilitator.processPayment(
            user, totalValue, _defaultAuth(),
            recipient, int96(0)
        );

        (, uint256 fee) = facilitator.calculateFeeBreakdown(totalValue);
        uint256 balBefore = usdc.balanceOf(treasury);

        vm.prank(owner);
        facilitator.withdrawFees();

        assertEq(usdc.balanceOf(treasury), balBefore + fee);
        assertEq(usdc.balanceOf(address(facilitator)), 0);
    }

    function test_withdrawFees_revertsWhenEmpty() public {
        vm.expectRevert(SuperfluidFacilitator.NothingToWithdraw.selector);
        vm.prank(owner);
        facilitator.withdrawFees();
    }

    function test_withdrawFees_revertsForNonAdmin() public {
        vm.expectRevert();
        vm.prank(operator);
        facilitator.withdrawFees();
    }

    function test_withdrawFeesAmount() public {
        uint256 totalValue = 10_000_000;
        _mintAndPrepare(user, totalValue);

        vm.prank(operator);
        facilitator.processPayment(
            user, totalValue, _defaultAuth(),
            recipient, int96(0)
        );

        uint256 withdrawAmount = 50_000;
        vm.prank(owner);
        facilitator.withdrawFeesAmount(withdrawAmount);

        assertEq(usdc.balanceOf(treasury), withdrawAmount);
    }

    function test_withdrawFeesAmount_revertsOnZero() public {
        vm.expectRevert(SuperfluidFacilitator.NothingToWithdraw.selector);
        vm.prank(owner);
        facilitator.withdrawFeesAmount(0);
    }

    function test_rescueTokens() public {
        // Send some random tokens to contract
        MockUSDC randomToken = new MockUSDC();
        randomToken.mint(address(facilitator), 1_000_000);

        vm.prank(owner);
        facilitator.rescueTokens(address(randomToken), treasury, 1_000_000);

        assertEq(randomToken.balanceOf(treasury), 1_000_000);
        assertEq(randomToken.balanceOf(address(facilitator)), 0);
    }

    function test_rescueTokens_revertsOnZeroTo() public {
        vm.expectRevert(SuperfluidFacilitator.ZeroAddress.selector);
        vm.prank(owner);
        facilitator.rescueTokens(address(usdc), address(0), 1_000_000);
    }

    // ──────────────────────────────────────────────
    // AccessControl: role management
    // ──────────────────────────────────────────────

    function test_grantOperatorRole() public {
        address newOp = makeAddr("newOperator");
        bytes32 opRole = facilitator.OPERATOR_ROLE();

        vm.prank(owner);
        facilitator.grantRole(opRole, newOp);

        assertTrue(facilitator.hasRole(opRole, newOp));
    }

    function test_revokeOperatorRole() public {
        bytes32 opRole = facilitator.OPERATOR_ROLE();

        vm.prank(owner);
        facilitator.revokeRole(opRole, operator);

        assertFalse(facilitator.hasRole(opRole, operator));
    }

    function test_grantRole_revertsForNonAdmin() public {
        bytes32 opRole = facilitator.OPERATOR_ROLE();

        vm.expectRevert();
        vm.prank(operator);
        facilitator.grantRole(opRole, makeAddr("x"));
    }

    function test_setTreasury() public {
        address newTreasury = makeAddr("newTreasury");

        vm.prank(owner);
        facilitator.setTreasury(newTreasury);

        assertEq(facilitator.treasury(), newTreasury);
    }

    function test_setTreasury_revertsOnZero() public {
        vm.expectRevert(SuperfluidFacilitator.ZeroAddress.selector);
        vm.prank(owner);
        facilitator.setTreasury(address(0));
    }

    function test_setDefaultRecipient() public {
        address newRecipient = makeAddr("newRecipient");

        vm.prank(owner);
        facilitator.setDefaultRecipient(newRecipient);

        assertEq(facilitator.defaultRecipient(), newRecipient);
    }

    function test_setDefaultRecipient_allowsZero() public {
        vm.prank(owner);
        facilitator.setDefaultRecipient(address(0));
        assertEq(facilitator.defaultRecipient(), address(0));
    }

    function test_setFeeConfig() public {
        vm.expectEmit(false, false, false, true);
        emit FeeConfigUpdated(200_000, 50);

        vm.prank(owner);
        facilitator.setFeeConfig(200_000, 50);

        assertEq(facilitator.minFee(), 200_000);
        assertEq(facilitator.feeBasisPoints(), 50);
    }

    function test_setFeeConfig_revertsOnHighBasisPoints() public {
        vm.expectRevert(SuperfluidFacilitator.InvalidFeeConfig.selector);
        vm.prank(owner);
        facilitator.setFeeConfig(MIN_FEE, 1001);
    }

    function test_setPaused() public {
        vm.prank(owner);
        facilitator.setPaused(true);
        assertEq(facilitator.paused(), true);

        vm.prank(owner);
        facilitator.setPaused(false);
        assertEq(facilitator.paused(), false);
    }

    function test_setPaused_revertsForNonAdmin() public {
        vm.expectRevert();
        vm.prank(operator);
        facilitator.setPaused(true);
    }

    // ──────────────────────────────────────────────
    // Fuzz tests
    // ──────────────────────────────────────────────

    function testFuzz_calculateFeeBreakdown_feeNeverExceedsTotal(uint256 totalValue) public view {
        totalValue = bound(totalValue, 1, 1e18); // up to 1 trillion USDC

        (uint256 wrap, uint256 fee) = facilitator.calculateFeeBreakdown(totalValue);
        assertEq(wrap + fee, totalValue);
        assertLe(fee, totalValue);
    }

    function testFuzz_calculateFeeBreakdown_wrapPlusFeeEqualsTotal(uint256 totalValue) public view {
        totalValue = bound(totalValue, 0, 1e18);

        (uint256 wrap, uint256 fee) = facilitator.calculateFeeBreakdown(totalValue);
        assertEq(wrap + fee, totalValue);
    }
}
