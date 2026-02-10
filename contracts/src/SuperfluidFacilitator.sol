// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20WithAuthorization} from "./interfaces/IERC20WithAuthorization.sol";
import {ISuperToken} from "./interfaces/ISuperToken.sol";
import {ICFAv1Forwarder} from "./interfaces/ICFAv1Forwarder.sol";

/// @title SuperfluidFacilitator
/// @notice Smart contract facilitator for the x402 + Superfluid payment flow.
///         Accepts USDC via EIP-3009, wraps to USDCx, sends to users, and creates
///         Superfluid streams. Replaces the EOA-based facilitator for custody safety.
///
/// @dev    Uses transferWithAuthorization to match the EIP-712 type hash
///         signed by x402-axios clients (TransferWithAuthorization).
///
///         Security model (AccessControl):
///         - DEFAULT_ADMIN_ROLE (cold wallet / multisig): admin functions, treasury withdrawal
///         - OPERATOR_ROLE (server hot wallet): can only call processPayment with valid signatures
///         - Contract holds accumulated fees; only admin can withdraw to treasury
contract SuperfluidFacilitator is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ──────────────────────────────────────────────
    // Types
    // ──────────────────────────────────────────────

    /// @notice EIP-3009 authorization parameters (packed to reduce stack depth).
    struct AuthParams {
        uint256 validAfter;
        uint256 validBefore;
        bytes32 nonce;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    // ──────────────────────────────────────────────
    // Roles
    // ──────────────────────────────────────────────

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // ──────────────────────────────────────────────
    // Errors
    // ──────────────────────────────────────────────

    error ZeroAddress();
    error InvalidFeeConfig();
    error SenderIsReceiver();
    error InsufficientPayment();
    error StreamCreationFailed(string reason);
    error NothingToWithdraw();
    error ContractPaused();

    // ──────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────

    event PaymentProcessed(
        address indexed user,
        address indexed recipient,
        uint256 totalPaid,
        uint256 amountWrapped,
        uint256 fee,
        int96 flowRate,
        bool streamCreated
    );

    event TreasuryUpdated(address indexed previous, address indexed updated);
    event DefaultRecipientUpdated(address indexed previous, address indexed updated);
    event FeeConfigUpdated(uint256 minFee, uint256 feeBasisPoints);
    event FeesWithdrawn(address indexed treasury, uint256 amount);
    event TokensRescued(address indexed token, address indexed to, uint256 amount);
    event PauseStatusChanged(bool paused);

    // ──────────────────────────────────────────────
    // Immutables
    // ──────────────────────────────────────────────

    IERC20WithAuthorization public immutable usdc;
    ISuperToken public immutable usdcx;
    ICFAv1Forwarder public immutable cfaForwarder;

    /// @notice Scaling factor: underlying decimals → Super Token 18 decimals.
    ///         For USDC (6 dec) → USDCx (18 dec), this is 1e12.
    uint256 public immutable decimalScaleFactor;

    // ──────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────

    /// @notice Address where accumulated fees are withdrawn to.
    address public treasury;

    /// @notice Default stream recipient (e.g. DAO address).
    address public defaultRecipient;

    /// @notice Minimum fee in USDC (6 decimals). Default: 100000 = 0.1 USDC.
    uint256 public minFee;

    /// @notice Fee in basis points (1 bp = 0.01%). Default: 10 = 0.1%.
    uint256 public feeBasisPoints;

    /// @notice Emergency pause flag.
    bool public paused;

    /// @notice Cumulative fees paid per user (in USDC, 6 decimals).
    mapping(address => uint256) public userPaidFees;

    /// @notice Running total of fees collected.
    uint256 public totalFeesAccumulated;

    /// @notice Running total of payments processed.
    uint256 public totalPaymentsProcessed;

    // ──────────────────────────────────────────────
    // Modifiers
    // ──────────────────────────────────────────────

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    // ──────────────────────────────────────────────
    // Constructor
    // ──────────────────────────────────────────────

    /// @param _owner              Owner address (cold wallet / multisig)
    /// @param _operator           Operator address (server hot wallet)
    /// @param _usdc               USDC token address (must support EIP-3009)
    /// @param _usdcx              USDCx Super Token address
    /// @param _cfaForwarder       CFA V1 Forwarder address
    /// @param _treasury           Treasury address for fee withdrawals
    /// @param _defaultRecipient   Default stream recipient
    /// @param _minFee             Minimum fee in USDC (6 decimals)
    /// @param _feeBasisPoints     Fee in basis points (10 = 0.1%)
    /// @param _decimalScaleFactor Scaling factor from underlying to 18 decimals (e.g. 1e12 for USDC)
    constructor(
        address _owner,
        address _operator,
        address _usdc,
        address _usdcx,
        address _cfaForwarder,
        address _treasury,
        address _defaultRecipient,
        uint256 _minFee,
        uint256 _feeBasisPoints,
        uint256 _decimalScaleFactor
    ) {
        if (_owner == address(0)) revert ZeroAddress();
        if (_operator == address(0)) revert ZeroAddress();
        if (_usdc == address(0)) revert ZeroAddress();
        if (_usdcx == address(0)) revert ZeroAddress();
        if (_cfaForwarder == address(0)) revert ZeroAddress();
        if (_treasury == address(0)) revert ZeroAddress();
        if (_feeBasisPoints > 1000) revert InvalidFeeConfig(); // max 10%
        if (_decimalScaleFactor == 0) revert InvalidFeeConfig();

        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _grantRole(OPERATOR_ROLE, _operator);
        usdc = IERC20WithAuthorization(_usdc);
        usdcx = ISuperToken(_usdcx);
        cfaForwarder = ICFAv1Forwarder(_cfaForwarder);
        decimalScaleFactor = _decimalScaleFactor;
        treasury = _treasury;
        defaultRecipient = _defaultRecipient;
        minFee = _minFee;
        feeBasisPoints = _feeBasisPoints;

        // One-time unlimited approval for USDCx to pull USDC during wrapping.
        // Safe: only the USDCx contract can use this, and only when we call upgradeTo.
        IERC20(_usdc).approve(_usdcx, type(uint256).max);
    }

    // ──────────────────────────────────────────────
    // Core: processPayment
    // ──────────────────────────────────────────────

    /// @notice Pull USDC via EIP-3009, wrap to USDCx, send to user, optionally create stream.
    /// @param from      User address (payer who signed the authorization)
    /// @param value     Total USDC authorized (including fee)
    /// @param auth      EIP-3009 authorization parameters
    /// @param recipient Stream recipient (address(0) = use defaultRecipient)
    /// @param flowRate  Flow rate in USDCx wei/second. 0 = skip stream creation.
    function processPayment(
        address from,
        uint256 value,
        AuthParams calldata auth,
        address recipient,
        int96 flowRate
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused nonReentrant {
        if (from == address(0)) revert ZeroAddress();

        address resolvedRecipient = recipient == address(0) ? defaultRecipient : recipient;
        if (from == resolvedRecipient) revert SenderIsReceiver();

        // Pull USDC, wrap to USDCx, track fees
        (uint256 amountToWrap, uint256 fee) = _pullAndWrap(from, value, auth);

        // Create stream if requested
        bool streamCreated;
        if (flowRate > 0 && resolvedRecipient != address(0)) {
            streamCreated = _createStream(from, resolvedRecipient, flowRate);
        }

        emit PaymentProcessed(from, resolvedRecipient, value, amountToWrap, fee, flowRate, streamCreated);
    }

    /// @notice Pull USDC via EIP-3009, deduct fee, wrap remainder to USDCx, and
    ///         send USDCx back to the sender. No stream is created.
    function processPaymentWrapOnly(
        address from,
        uint256 value,
        AuthParams calldata auth
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused nonReentrant {
        if (from == address(0)) revert ZeroAddress();

        (uint256 amountToWrap, uint256 fee) = _pullAndWrap(from, value, auth);

        emit PaymentProcessed(from, address(0), value, amountToWrap, fee, 0, false);
    }

    // ──────────────────────────────────────────────
    // Internal helpers
    // ──────────────────────────────────────────────

    /// @dev Pull USDC via transferWithAuthorization, wrap to USDCx, track fees.
    function _pullAndWrap(
        address from,
        uint256 value,
        AuthParams calldata auth
    ) internal returns (uint256 amountToWrap, uint256 fee) {
        (amountToWrap, fee) = calculateFeeBreakdown(value);
        if (amountToWrap == 0) revert InsufficientPayment();

        // Pull USDC via transferWithAuthorization (matches x402-axios signature type)
        usdc.transferWithAuthorization(
            from,
            address(this),
            value,
            auth.validAfter,
            auth.validBefore,
            auth.nonce,
            auth.v,
            auth.r,
            auth.s
        );

        // Wrap USDC → USDCx and send directly to user
        usdcx.upgradeTo(from, amountToWrap * decimalScaleFactor, "");

        // Track deposit and fees
        userPaidFees[from] += fee;
        totalFeesAccumulated += fee;
        totalPaymentsProcessed += 1;
    }

    /// @dev Create a Superfluid stream via the CFA Forwarder.
    function _createStream(
        address sender,
        address receiver,
        int96 flowRate
    ) internal returns (bool) {
        try cfaForwarder.setFlowrateFrom(
            address(usdcx),
            sender,
            receiver,
            flowRate
        ) returns (bool success) {
            return success;
        } catch Error(string memory reason) {
            revert StreamCreationFailed(reason);
        } catch {
            revert StreamCreationFailed("Unknown error");
        }
    }

    // ──────────────────────────────────────────────
    // View helpers
    // ──────────────────────────────────────────────

    /// @notice Calculate fee breakdown for a given total payment.
    /// @return amountToWrap USDC to wrap to USDCx
    /// @return fee          Fee retained by contract
    function calculateFeeBreakdown(uint256 totalValue)
        public
        view
        returns (uint256 amountToWrap, uint256 fee)
    {
        if (totalValue <= minFee) {
            return (0, totalValue);
        }

        if (feeBasisPoints == 0) {
            return (totalValue - minFee, minFee);
        }

        fee = totalValue * feeBasisPoints / 10_000;
        if (fee < minFee) {
            fee = minFee;
        }
        amountToWrap = totalValue - fee;
    }

    /// @notice Calculate total required for a desired wrap amount.
    function calculateTotalForWrap(uint256 wrapAmount)
        external
        view
        returns (uint256 totalRequired, uint256 fee)
    {
        uint256 percentageFee = (wrapAmount * feeBasisPoints) / 10000;
        fee = percentageFee > minFee ? percentageFee : minFee;
        totalRequired = wrapAmount + fee;
    }

    /// @notice Get total fees paid by a user.
    function getUserPaidFees(address user) external view returns (uint256) {
        return userPaidFees[user];
    }

    /// @notice Get USDC balance held by this contract (accumulated fees).
    function getAccumulatedFees() external view returns (uint256) {
        return IERC20(address(usdc)).balanceOf(address(this));
    }

    /// @notice Check existing flow rate from a user to a recipient.
    function getExistingFlowRate(address user, address recipient)
        external
        view
        returns (int96)
    {
        return cfaForwarder.getFlowrate(address(usdcx), user, recipient);
    }

    // ──────────────────────────────────────────────
    // Admin
    // ──────────────────────────────────────────────

    /// @notice Withdraw all accumulated USDC fees to treasury.
    function withdrawFees() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 balance = IERC20(address(usdc)).balanceOf(address(this));
        if (balance == 0) revert NothingToWithdraw();
        IERC20(address(usdc)).safeTransfer(treasury, balance);
        emit FeesWithdrawn(treasury, balance);
    }

    /// @notice Withdraw a specific amount of fees to treasury.
    function withdrawFeesAmount(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (amount == 0) revert NothingToWithdraw();
        IERC20(address(usdc)).safeTransfer(treasury, amount);
        emit FeesWithdrawn(treasury, amount);
    }

    /// @notice Rescue any ERC-20 tokens accidentally sent to this contract.
    function rescueTokens(address token, address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
        emit TokensRescued(token, to, amount);
    }

    function setTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newTreasury == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    function setDefaultRecipient(address newRecipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit DefaultRecipientUpdated(defaultRecipient, newRecipient);
        defaultRecipient = newRecipient;
    }

    function setFeeConfig(uint256 _minFee, uint256 _feeBasisPoints) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_feeBasisPoints > 1000) revert InvalidFeeConfig();
        minFee = _minFee;
        feeBasisPoints = _feeBasisPoints;
        emit FeeConfigUpdated(_minFee, _feeBasisPoints);
    }

    function setPaused(bool _paused) external onlyRole(DEFAULT_ADMIN_ROLE) {
        paused = _paused;
        emit PauseStatusChanged(_paused);
    }
}
