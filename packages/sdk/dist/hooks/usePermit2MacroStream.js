import { useState, useEffect, useCallback } from "react";
import { createPublicClient, http } from "viem";
import { base, baseSepolia } from "viem/chains";
import { useAccount, useWalletClient, useChainId } from "wagmi";
import { BASE_MAINNET_CONFIG } from "../config.js";
import { DEFAULT_MONTHLY_AMOUNT } from "../constants.js";
import { createStreamViaPermit2Macro, facilitatorPermit2Relay } from "../core/clearMacroPermit2.js";
import { createStreamViaClearMacro, facilitatorRelay } from "../core/clearMacro.js";
import { checkPermit2Allowance, approvePermit2 } from "../core/permit2.js";
import { fetchBalances } from "../core/balances.js";
import { checkStream, fetchStreamUrl } from "../core/stream.js";
function getChain(chainId) {
    if (chainId === 84532)
        return baseSepolia;
    return base;
}
/**
 * One-signature stream creation via Permit2 + ClearMacro. The user signs a single Permit2
 * witness message; the facilitator pulls USDC, upgrades it to USDCx, and opens the stream
 * in one transaction (gasless for the user). No ACL grant, no approval, no pre-existing USDCx.
 *
 * Reads the macro/provider/relay path from the facilitator's `/info`.
 */
export function usePermit2MacroStream(options) {
    const { facilitatorUrl, recipient, monthlyAmount: monthlyAmountStr, config = BASE_MAINNET_CONFIG, } = options;
    const monthlyAmount = monthlyAmountStr ? BigInt(monthlyAmountStr) : DEFAULT_MONTHLY_AMOUNT;
    // Underlying amount Permit2 must be allowed to pull (matches the SDK's default upgradeAmount).
    const decimalDiff = config.superToken.decimals - config.underlyingToken.decimals;
    const upgradeAmount = decimalDiff >= 0
        ? monthlyAmount / 10n ** BigInt(decimalDiff)
        : monthlyAmount * 10n ** BigInt(-decimalDiff);
    const { address, isConnected } = useAccount();
    const { data: walletClient } = useWalletClient();
    const chainId = useChainId();
    const [status, setStatus] = useState("disconnected");
    const [error, setError] = useState(null);
    const [streamUrl, setStreamUrl] = useState(null);
    const [txHash, setTxHash] = useState(null);
    const [description, setDescription] = useState(null);
    const [info, setInfo] = useState(null);
    const [balances, setBalances] = useState({ usdc: null, usdcx: null });
    const isOnCorrectNetwork = chainId === config.chain.id;
    const configuredMacro = config.clearMacro?.createFlowMacro;
    // Resolve the macro/provider/relay path from the facilitator.
    useEffect(() => {
        if (!facilitatorUrl)
            return;
        let cancelled = false;
        fetch(`${facilitatorUrl}/info`)
            .then((r) => r.json())
            .then((data) => {
            if (cancelled)
                return;
            const cm = data?.clearMacro;
            if (cm?.forwarder && cm?.permit2RelayPath) {
                setInfo({
                    forwarder: cm.forwarder,
                    provider: cm.provider,
                    macro: cm.macro ?? configuredMacro,
                    permit2RelayPath: cm.permit2RelayPath,
                    relayPath: cm.relayPath,
                });
            }
        })
            .catch((err) => console.error("Failed to fetch facilitator info:", err));
        return () => {
            cancelled = true;
        };
    }, [facilitatorUrl, configuredMacro]);
    useEffect(() => {
        if (!isConnected || !address) {
            setStatus("disconnected");
            return;
        }
        if (!isOnCorrectNetwork) {
            setStatus("wrong-network");
            return;
        }
        if (!info) {
            setStatus("loading");
            return;
        }
        if (!(info.macro ?? configuredMacro)) {
            setStatus("needs-config");
            return;
        }
        const busy = (s) => s === "active" || s === "subscribing" || s === "approving";
        let cancelled = false;
        setStatus((prev) => (busy(prev) ? prev : "loading"));
        (async () => {
            try {
                const publicClient = createPublicClient({ chain: getChain(config.chain.id), transport: http(config.chain.rpcUrl) });
                const [allowance, bal, existingFlow] = await Promise.all([
                    checkPermit2Allowance(publicClient, address, config.underlyingToken.address),
                    fetchBalances(publicClient, address, config),
                    checkStream(publicClient, address, recipient, config),
                ]);
                if (cancelled)
                    return;
                setBalances(bal);
                if (existingFlow > 0n) {
                    // Already streaming to this recipient — createFlow would revert CFA_FLOW_ALREADY_EXISTS.
                    fetchStreamUrl(address, recipient, config).then((u) => {
                        if (!cancelled)
                            setStreamUrl(u);
                    });
                    setStatus((prev) => (busy(prev) ? prev : "active"));
                }
                else if (bal.usdcx !== null && bal.usdcx >= monthlyAmount) {
                    // Already holds enough USDCx — no wrap and no Permit2 approval needed; the stream
                    // can be opened straight from their USDCx with a single gasless signature.
                    setStatus((prev) => (busy(prev) ? prev : "ready"));
                }
                else {
                    setStatus((prev) => (busy(prev) ? prev : allowance >= upgradeAmount ? "ready" : "needs-approval"));
                }
            }
            catch (err) {
                if (cancelled)
                    return;
                console.error("Permit2 allowance check failed:", err);
                setStatus((prev) => (busy(prev) ? prev : "ready"));
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isConnected, address, isOnCorrectNetwork, info, configuredMacro, config, upgradeAmount, monthlyAmount, recipient]);
    const approve = useCallback(async () => {
        if (!address || !walletClient) {
            setError("Wallet not connected");
            return;
        }
        setStatus("approving");
        setError(null);
        try {
            const chain = getChain(config.chain.id);
            const publicClient = createPublicClient({ chain, transport: http(config.chain.rpcUrl) });
            const hash = await approvePermit2(walletClient, {
                token: config.underlyingToken.address,
                account: address,
                chain,
            });
            await publicClient.waitForTransactionReceipt({ hash });
            setStatus("ready");
        }
        catch (err) {
            setError(err?.message || "Approval failed");
            setStatus("needs-approval");
        }
    }, [address, walletClient, config]);
    const subscribe = useCallback(async () => {
        if (!address || !walletClient || !info) {
            setError("Wallet not connected or facilitator not loaded");
            return;
        }
        const macro = (info.macro ?? configuredMacro);
        if (!macro) {
            setError("CreateFlowMacro address not configured");
            setStatus("needs-config");
            return;
        }
        setError(null);
        try {
            const chain = getChain(config.chain.id);
            const publicClient = createPublicClient({ chain, transport: http(config.chain.rpcUrl) });
            // If the user already holds enough USDCx, skip the pull + wrap entirely and open the
            // stream straight from their USDCx via the plain (non-Permit2) relay — no approval, no
            // gas, one signature. Falls back to the Permit2 wrap path when they don't (or when the
            // facilitator doesn't expose the plain relay endpoint).
            const bal = await fetchBalances(publicClient, address, config);
            setBalances(bal);
            const canStreamFromUsdcx = bal.usdcx !== null && bal.usdcx >= monthlyAmount && !!info.relayPath;
            let execution;
            let hash;
            if (canStreamFromUsdcx) {
                setStatus("subscribing");
                const res = await createStreamViaClearMacro({
                    publicClient,
                    walletClient: walletClient,
                    account: address,
                    config,
                    recipient,
                    monthlyAmount,
                    macroAddress: macro,
                    providerName: info.provider,
                    relay: facilitatorRelay(`${facilitatorUrl}${info.relayPath}`),
                });
                execution = res.execution;
                hash = res.txHash;
            }
            else {
                // One-time: make sure Permit2 is allowed to pull the underlying token (gas tx).
                const allowance = await checkPermit2Allowance(publicClient, address, config.underlyingToken.address);
                if (allowance < upgradeAmount) {
                    setStatus("approving");
                    const approveHash = await approvePermit2(walletClient, {
                        token: config.underlyingToken.address,
                        account: address,
                        chain,
                    });
                    await publicClient.waitForTransactionReceipt({ hash: approveHash });
                }
                setStatus("subscribing");
                const res = await createStreamViaPermit2Macro({
                    publicClient,
                    walletClient: walletClient,
                    account: address,
                    config,
                    recipient,
                    monthlyAmount,
                    macroAddress: macro,
                    providerName: info.provider,
                    relay: facilitatorPermit2Relay(`${facilitatorUrl}${info.permit2RelayPath}`),
                });
                execution = res.execution;
                hash = res.txHash;
            }
            setTxHash(hash);
            setDescription(execution.description);
            setStatus("active");
            fetchStreamUrl(address, recipient, config).then(setStreamUrl);
        }
        catch (err) {
            const msg = err?.message || "Failed to create stream";
            setError(msg);
            setStatus("error");
        }
    }, [address, walletClient, info, configuredMacro, config, recipient, monthlyAmount, upgradeAmount, facilitatorUrl]);
    return { status, approve, subscribe, error, streamUrl, txHash, description, info, balances };
}
//# sourceMappingURL=usePermit2MacroStream.js.map