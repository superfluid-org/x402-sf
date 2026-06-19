import { useState, useEffect, useRef, useCallback } from "react";
import { createPublicClient, http } from "viem";
import { base, baseSepolia } from "viem/chains";
import { useAccount, useWalletClient, useChainId } from "wagmi";
import { BASE_MAINNET_CONFIG } from "../config.js";
import { DEFAULT_MONTHLY_AMOUNT, DEFAULT_ACL_MULTIPLIER, MIN_USDCX_BALANCE, } from "../constants.js";
import { calculateFlowRate } from "../utils.js";
import { fetchFacilitatorInfo } from "../core/facilitator.js";
import { fetchBalances, checkAllowance } from "../core/balances.js";
import { checkPermissions, grantPermissions, approveUsdcx } from "../core/permissions.js";
import { checkStream, fetchStreamUrl } from "../core/stream.js";
import { executeX402Payment } from "../core/payment.js";
function getChain(chainId) {
    if (chainId === 84532)
        return baseSepolia;
    return base;
}
/**
 * Guard: returns an error message if the facilitator serves a different chain than
 * the configured network, or null if they match (or the facilitator doesn't report a chain).
 */
function facilitatorChainMismatch(facilitatorInfo, config) {
    if (facilitatorInfo.chainId === undefined)
        return null;
    if (facilitatorInfo.chainId === config.chain.id)
        return null;
    const facilitatorNetwork = facilitatorInfo.network ? ` (${facilitatorInfo.network})` : "";
    return `Facilitator/config chain mismatch: the facilitator serves chain ${facilitatorInfo.chainId}${facilitatorNetwork}, but config targets chain ${config.chain.id} (${config.chain.name}). Use a facilitator deployed for ${config.chain.name}, or pass the matching config.`;
}
export function useX402Stream(options) {
    const { facilitatorUrl, recipient, monthlyAmount: monthlyAmountStr, config = BASE_MAINNET_CONFIG, } = options;
    const monthlyAmount = monthlyAmountStr ? BigInt(monthlyAmountStr) : DEFAULT_MONTHLY_AMOUNT;
    const flowRate = calculateFlowRate(monthlyAmount);
    const aclFlowrateAllowance = flowRate * DEFAULT_ACL_MULTIPLIER;
    // The hook's monthlyAmount is denominated in super-token units (18 decimals).
    // The facilitator's /resource endpoint expects it in the underlying token's base
    // units (e.g. 6 decimals for USDC), so convert by the decimal difference.
    const underlyingDecimalDiff = config.superToken.decimals - config.underlyingToken.decimals;
    const monthlyAmountUnderlying = underlyingDecimalDiff >= 0
        ? monthlyAmount / 10n ** BigInt(underlyingDecimalDiff)
        : monthlyAmount * 10n ** BigInt(-underlyingDecimalDiff);
    const { address, isConnected } = useAccount();
    const { data: walletClient } = useWalletClient();
    const chainId = useChainId();
    const [status, setStatus] = useState("disconnected");
    const [error, setError] = useState(null);
    const [balances, setBalances] = useState({ usdc: null, usdcx: null });
    const [streamUrl, setStreamUrl] = useState(null);
    const [facilitatorInfo, setFacilitatorInfo] = useState(null);
    const [currentFlowRate, setCurrentFlowRate] = useState(0n);
    // Internal state
    const [aclGranted, setAclGranted] = useState(false);
    const [hasUsdcxAllowance, setHasUsdcxAllowance] = useState(false);
    const isSubscribingRef = useRef(false);
    const isOnCorrectNetwork = chainId === config.chain.id;
    // Fetch facilitator info on mount
    useEffect(() => {
        if (!facilitatorUrl)
            return;
        fetchFacilitatorInfo(facilitatorUrl)
            .then(setFacilitatorInfo)
            .catch((err) => console.error("Failed to fetch facilitator info:", err));
    }, [facilitatorUrl]);
    // Check subscription status when wallet/network/facilitator changes
    useEffect(() => {
        if (!isConnected || !address) {
            setStatus("disconnected");
            return;
        }
        if (!isOnCorrectNetwork) {
            setStatus("wrong-network");
            return;
        }
        if (!facilitatorInfo) {
            setStatus("loading");
            return;
        }
        const mismatch = facilitatorChainMismatch(facilitatorInfo, config);
        if (mismatch) {
            setStatus("error");
            setError(mismatch);
            return;
        }
        if (isSubscribingRef.current)
            return;
        const check = async () => {
            setStatus("loading");
            const chain = getChain(config.chain.id);
            const publicClient = createPublicClient({ chain, transport: http() });
            // Fetch all data in parallel
            const [bal, permResult, streamFlowRate, allowance] = await Promise.all([
                fetchBalances(publicClient, address, config),
                checkPermissions(publicClient, address, facilitatorInfo.operator, config),
                checkStream(publicClient, address, recipient, config),
                checkAllowance(publicClient, address, facilitatorInfo.operator, config),
            ]);
            setBalances(bal);
            setAclGranted(permResult.hasPermissions && permResult.flowrateAllowance >= flowRate);
            setCurrentFlowRate(streamFlowRate);
            setHasUsdcxAllowance(allowance >= BigInt("1000000000000000000"));
            if (streamFlowRate > 0n) {
                setStatus("active");
                // Fetch stream URL
                fetchStreamUrl(address, recipient, config).then(setStreamUrl);
            }
            else if (!permResult.hasPermissions || permResult.flowrateAllowance < flowRate) {
                setStatus("needs-permissions");
            }
            else {
                setStatus("ready");
            }
        };
        check().catch((err) => {
            console.error("Status check failed:", err);
            setStatus("error");
            setError(err?.message || "Failed to check subscription status");
        });
    }, [
        isConnected,
        address,
        isOnCorrectNetwork,
        facilitatorInfo,
        config.chain.id,
        config.superToken.address,
        recipient,
        flowRate,
    ]);
    const subscribe = useCallback(async () => {
        if (!address || !walletClient || !facilitatorInfo) {
            setError("Wallet not connected or facilitator not loaded");
            return;
        }
        const mismatch = facilitatorChainMismatch(facilitatorInfo, config);
        if (mismatch) {
            setError(mismatch);
            setStatus("error");
            return;
        }
        isSubscribingRef.current = true;
        setStatus("subscribing");
        setError(null);
        try {
            const chain = getChain(config.chain.id);
            const publicClient = createPublicClient({ chain, transport: http() });
            const hasUsdcx = balances.usdcx !== null && balances.usdcx >= MIN_USDCX_BALANCE;
            // Step 1: Grant permissions if needed (batched: ACL + USDCx approve)
            if (!aclGranted) {
                await grantPermissions({
                    walletClient,
                    publicClient,
                    sender: address,
                    operatorAddress: facilitatorInfo.operator,
                    facilitatorAddress: facilitatorInfo.facilitator,
                    config,
                    flowrateAllowance: aclFlowrateAllowance,
                    chain,
                });
                setAclGranted(true);
            }
            else if (hasUsdcx && !hasUsdcxAllowance) {
                // ACL granted but no USDCx allowance → just approve
                await approveUsdcx({
                    walletClient,
                    publicClient,
                    operatorAddress: facilitatorInfo.operator,
                    config,
                    chain,
                });
                setHasUsdcxAllowance(true);
            }
            // Step 2: Execute x402 payment
            await executeX402Payment({
                facilitatorUrl,
                walletClient: walletClient,
                account: address,
                recipient,
                monthlyAmount: monthlyAmountUnderlying.toString(),
            });
            setStatus("active");
            // Fetch stream URL
            fetchStreamUrl(address, recipient, config).then(setStreamUrl);
        }
        catch (err) {
            console.error("Subscribe failed:", err);
            const msg = err?.response?.data?.error || err?.message || "Failed to subscribe";
            if (msg.includes("StreamCreationFailed") || msg.includes("0x064b4a4a")) {
                setError("Stream creation failed. Your funds were not charged. Please ensure ACL permissions are granted and try again.");
            }
            else {
                setError(msg);
            }
            setStatus("error");
        }
        finally {
            isSubscribingRef.current = false;
        }
    }, [
        address,
        walletClient,
        facilitatorInfo,
        config,
        aclGranted,
        hasUsdcxAllowance,
        balances.usdcx,
        aclFlowrateAllowance,
        facilitatorUrl,
        recipient,
        monthlyAmountUnderlying,
    ]);
    return {
        status,
        subscribe,
        error,
        balances,
        streamUrl,
        facilitatorInfo,
        flowRate: currentFlowRate,
    };
}
//# sourceMappingURL=useX402Stream.js.map