"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { withPaymentInterceptor } from "x402-axios";
import { useAccount, useWalletClient } from "wagmi";
import { createPublicClient, http, formatUnits, encodeFunctionData, encodeAbiParameters } from "viem";
import { base } from "viem/chains";
import { SUPER_TOKEN_CONFIG } from "../../config/supertoken";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./venice.css";

const FACILITATOR_URL = process.env.NEXT_PUBLIC_FACILITATOR_URL;
const RECIPIENT_ADDRESS = "0xac808840f02c47C05507f48165d2222FF28EF4e1"; // DAO Treasury
const CFA_FORWARDER_ADDRESS = SUPER_TOKEN_CONFIG.superfluid.cfaV1Forwarder;
const CFA_ADDRESS = SUPER_TOKEN_CONFIG.superfluid.cfa;
const HOST_ADDRESS = SUPER_TOKEN_CONFIG.superfluid.host;

// 1 USDCx per month flow rate (18 decimals)
// Superfluid uses (365/12) days per month = 2628000 seconds
const MONTHLY_AMOUNT = BigInt("1000000000000000000"); // 1e18
const SECONDS_PER_MONTH = BigInt(2628000); // (365/12) * 24 * 60 * 60
const SUBSCRIPTION_FLOW_RATE = MONTHLY_AMOUNT / SECONDS_PER_MONTH;

// Use a generous ACL allowance (10x monthly rate) to avoid edge cases
// where the server's flow rate differs slightly or allowance is consumed
const ACL_FLOWRATE_ALLOWANCE = SUBSCRIPTION_FLOW_RATE * BigInt(10);

// ABIs
const CFA_FORWARDER_ABI = [
  {
    name: "updateFlowOperatorPermissions",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "flowOperator", type: "address" },
      { name: "permissions", type: "uint8" },  // bitmask: 1=create, 2=update, 4=delete, 7=all
      { name: "flowrateAllowance", type: "int96" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const CFA_ABI = [
  {
    name: "getFlowOperatorData",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "token", type: "address" },
      { name: "sender", type: "address" },
      { name: "flowOperator", type: "address" },
    ],
    outputs: [
      { name: "flowOperatorId", type: "bytes32" },
      { name: "permissions", type: "uint8" },
      { name: "flowrateAllowance", type: "int96" },
    ],
  },
  {
    name: "getFlow",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "token", type: "address" },
      { name: "sender", type: "address" },
      { name: "receiver", type: "address" },
    ],
    outputs: [
      { name: "timestamp", type: "uint256" },
      { name: "flowRate", type: "int96" },
      { name: "deposit", type: "uint256" },
      { name: "owedDeposit", type: "uint256" },
    ],
  },
] as const;

// Superfluid Host ABI (batchCall only)
const HOST_ABI = [
  {
    name: "batchCall",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "operations",
        type: "tuple[]",
        components: [
          { name: "operationType", type: "uint32" },
          { name: "target", type: "address" },
          { name: "data", type: "bytes" },
        ],
      },
    ],
    outputs: [],
  },
] as const;

// CFA agreement ABI (for encoding batchCall operations)
const CFA_AGREEMENT_ABI = [
  {
    name: "updateFlowOperatorPermissions",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "flowOperator", type: "address" },
      { name: "permissions", type: "uint8" },
      { name: "flowRateAllowance", type: "int96" },
      { name: "ctx", type: "bytes" },
    ],
    outputs: [{ name: "newCtx", type: "bytes" }],
  },
] as const;

// USDCx approve allowance for fee collection (10 USDCx covers many subscriptions)
const USDCX_FEE_ALLOWANCE = BigInt("10000000000000000000"); // 10 USDCx

type SubscriptionStatus = "checking" | "active" | "inactive" | "subscribing";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface DiemStats {
  totalBought: string;
  totalStaked: string;
  capacity: string;
}

interface AuthPayload {
  userAddress: string;
  timestamp: number;
  signature: string;
}

// Signature is valid for 1 hour
const SIGNATURE_VALIDITY_MS = 60 * 60 * 1000;

function createAuthMessage(address: string, timestamp: number): string {
  return `Venice AI Access\n\nAddress: ${address}\nTimestamp: ${timestamp}\n\nSign this message to verify your wallet ownership.`;
}

export default function VeniceChatPage() {
  const { address, isConnected, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();

  // Subscription state
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>("inactive");
  const [aclGranted, setAclGranted] = useState(false);
  const [facilitatorAddress, setFacilitatorAddress] = useState<string | null>(null);
  const [operatorAddress, setOperatorAddress] = useState<string | null>(null);
  const [streamFlowRate, setStreamFlowRate] = useState<bigint>(BigInt(0));

  // Balance state
  const [usdcBalance, setUsdcBalance] = useState<bigint | null>(null);
  const [usdcxBalance, setUsdcxBalance] = useState<bigint | null>(null);
  const [hasUsdcxAllowance, setHasUsdcxAllowance] = useState(false);
  const [subscribingWithUsdcx, setSubscribingWithUsdcx] = useState(false);

  // Auth state - cached signature for API requests
  const [authPayload, setAuthPayload] = useState<AuthPayload | null>(null);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [remainingRequests, setRemainingRequests] = useState<number | null>(null);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isGeneratingChat, setIsGeneratingChat] = useState(false);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  // DIEM stats (mock for now - would need Venice API integration)
  const [diemStats] = useState<DiemStats>({
    totalBought: "0",
    totalStaked: "0",
    capacity: "Basic",
  });

  const isOnBase = chainId === SUPER_TOKEN_CONFIG.chain.id;

  // Clear auth when wallet changes
  useEffect(() => {
    setAuthPayload(null);
  }, [address]);

  // Fetch facilitator address
  useEffect(() => {
    const fetchFacilitatorAddress = async () => {
      if (!FACILITATOR_URL) {
        console.warn("FACILITATOR_URL not configured");
        setSubscriptionStatus("inactive");
        return;
      }
      try {
        const response = await axios.get(`${FACILITATOR_URL}/info`);
        setFacilitatorAddress(response.data.facilitator);
        // In contract mode, operator is the EOA that calls setFlowrateFrom/transferFrom.
        // ACL and USDCx approve must target the operator, not the contract.
        setOperatorAddress(response.data.operator || response.data.facilitator);
      } catch (error) {
        console.error("Failed to fetch facilitator info:", error);
        setSubscriptionStatus("inactive");
      }
    };
    fetchFacilitatorAddress();
  }, []);

  // Check subscription status
  useEffect(() => {
    if (!address || !isOnBase) {
      setSubscriptionStatus("inactive");
      return;
    }

    if (!facilitatorAddress || !operatorAddress) {
      if (FACILITATOR_URL) {
        setSubscriptionStatus("checking");
      }
      return;
    }

    const checkSubscription = async () => {
      setSubscriptionStatus("checking");
      const publicClient = createPublicClient({
        chain: base,
        transport: http(),
      });

      const balanceOfAbi = [{
        name: "balanceOf",
        type: "function" as const,
        stateMutability: "view" as const,
        inputs: [{ name: "account", type: "address" as const }],
        outputs: [{ name: "balance", type: "uint256" as const }],
      }] as const;

      // Always fetch balances first — even if later checks fail
      try {
        const [usdcBal, usdcxBal] = await Promise.all([
          publicClient.readContract({
            address: SUPER_TOKEN_CONFIG.underlyingToken.address as `0x${string}`,
            abi: balanceOfAbi,
            functionName: "balanceOf",
            args: [address],
          }) as Promise<bigint>,
          publicClient.readContract({
            address: SUPER_TOKEN_CONFIG.superToken.address as `0x${string}`,
            abi: balanceOfAbi,
            functionName: "balanceOf",
            args: [address],
          }) as Promise<bigint>,
        ]);
        setUsdcBalance(usdcBal);
        setUsdcxBalance(usdcxBal);
      } catch (balErr) {
        console.error("Failed to fetch balances:", balErr);
      }

      try {
        // Check ACL against operator (EOA) — the one that calls setFlowrateFrom
        const aclResult = (await publicClient.readContract({
          address: CFA_ADDRESS,
          abi: CFA_ABI,
          functionName: "getFlowOperatorData",
          args: [
            SUPER_TOKEN_CONFIG.superToken.address,
            address,
            operatorAddress as `0x${string}`,
          ],
        })) as [string, number, bigint];

        const [, permissions, flowrateAllowance] = aclResult;
        const hasPermissions = permissions === 7 && flowrateAllowance >= SUBSCRIPTION_FLOW_RATE;
        setAclGranted(hasPermissions);

        const flowResult = (await publicClient.readContract({
          address: CFA_ADDRESS,
          abi: CFA_ABI,
          functionName: "getFlow",
          args: [
            SUPER_TOKEN_CONFIG.superToken.address,
            address,
            RECIPIENT_ADDRESS as `0x${string}`,
          ],
        })) as [bigint, bigint, bigint, bigint];

        const [, flowRate] = flowResult;
        setStreamFlowRate(flowRate);

        // Check USDCx allowance to operator (EOA) for fee collection via transferFrom
        const allowanceAbi = [{
          name: "allowance",
          type: "function" as const,
          stateMutability: "view" as const,
          inputs: [
            { name: "owner", type: "address" as const },
            { name: "spender", type: "address" as const },
          ],
          outputs: [{ name: "", type: "uint256" as const }],
        }] as const;

        const usdcxAllowance = await publicClient.readContract({
          address: SUPER_TOKEN_CONFIG.superToken.address as `0x${string}`,
          abi: allowanceAbi,
          functionName: "allowance",
          args: [address, operatorAddress as `0x${string}`],
        }) as bigint;

        // Need at least 1 USDCx allowance for fee
        setHasUsdcxAllowance(usdcxAllowance >= BigInt("1000000000000000000"));

        if (flowRate > BigInt(0)) {
          setSubscriptionStatus("active");
        } else {
          setSubscriptionStatus("inactive");
        }
      } catch (error) {
        console.error("Failed to check subscription:", error);
        setSubscriptionStatus("inactive");
      }
    };

    checkSubscription();
  }, [address, isOnBase, facilitatorAddress, operatorAddress]);

  // Auto-scroll chat container only (not the whole page)
  useEffect(() => {
    const el = chatMessagesRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isGeneratingChat]);

  const grantAclPermissions = async () => {
    if (!address || !walletClient || !facilitatorAddress || !operatorAddress) return;

    setError(null);
    setSubscriptionStatus("subscribing");

    try {
      const publicClient = createPublicClient({
        chain: base,
        transport: http(),
      });

      if (!walletClient.account) {
        throw new Error("No account available in wallet client");
      }

      // Batch ACL grant + USDCx approve in a single Host.batchCall tx
      // Operation 1: ERC20_APPROVE (type 1) — approve operator (EOA) to spend USDCx for fee
      const approveData = encodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }],
        [operatorAddress as `0x${string}`, USDCX_FEE_ALLOWANCE],
      );

      // Operation 2: SUPERFLUID_CALL_AGREEMENT (type 201) — grant ACL to operator (EOA)
      const cfaCallData = encodeFunctionData({
        abi: CFA_AGREEMENT_ABI,
        functionName: "updateFlowOperatorPermissions",
        args: [
          SUPER_TOKEN_CONFIG.superToken.address,
          operatorAddress as `0x${string}`,
          7, // permissions: create + update + delete
          ACL_FLOWRATE_ALLOWANCE,
          "0x", // ctx (managed by Host)
        ],
      });
      const aclData = encodeAbiParameters(
        [{ type: "bytes" }, { type: "bytes" }],
        [cfaCallData, "0x"], // callData, userData
      );

      // Build operations array
      const operations: Array<{ operationType: number; target: `0x${string}`; data: `0x${string}` }> = [
        { operationType: 1, target: SUPER_TOKEN_CONFIG.superToken.address, data: approveData },
        { operationType: 201, target: CFA_ADDRESS, data: aclData },
      ];

      // In contract mode, also grant ACL to the contract (for USDC wrap+stream path)
      if (operatorAddress !== facilitatorAddress) {
        const cfaCallDataContract = encodeFunctionData({
          abi: CFA_AGREEMENT_ABI,
          functionName: "updateFlowOperatorPermissions",
          args: [
            SUPER_TOKEN_CONFIG.superToken.address,
            facilitatorAddress as `0x${string}`,
            7,
            ACL_FLOWRATE_ALLOWANCE,
            "0x",
          ],
        });
        const aclDataContract = encodeAbiParameters(
          [{ type: "bytes" }, { type: "bytes" }],
          [cfaCallDataContract, "0x"],
        );
        operations.push({ operationType: 201, target: CFA_ADDRESS, data: aclDataContract });
      }

      const hash = await walletClient.writeContract({
        account: walletClient.account,
        chain: base,
        address: HOST_ADDRESS,
        abi: HOST_ABI,
        functionName: "batchCall",
        args: [operations],
      });

      let txHash: `0x${string}`;
      if (typeof hash === "string") {
        const cleanHash = hash.trim().startsWith("0x") ? hash.trim() : `0x${hash.trim()}`;
        const hexPart = cleanHash.slice(2);
        txHash = `0x${hexPart.length % 2 === 0 ? hexPart : `0${hexPart}`}` as `0x${string}`;
      } else {
        txHash = `0x${String(hash).padStart(64, "0")}` as `0x${string}`;
      }

      await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 120_000,
      });

      await new Promise(resolve => setTimeout(resolve, 2000));
      setAclGranted(true);

      await startSubscription();
    } catch (error: any) {
      console.error("Failed to grant permissions:", error);
      setError(`Failed to grant permissions: ${error?.message || error}`);
      setSubscriptionStatus("inactive");
    }
  };

  const startSubscription = async () => {
    if (!address || !walletClient) return;

    setError(null);
    setSubscriptionStatus("subscribing");

    try {
      const x402Client = withPaymentInterceptor(
        axios.create({ baseURL: FACILITATOR_URL }),
        walletClient as any
      );

      await x402Client.get("/resource", {
        params: {
          account: address,
          recipient: RECIPIENT_ADDRESS,
          monthlyAmount: "1000000",
        },
      });

      setSubscriptionStatus("active");
    } catch (error: any) {
      console.error("Subscription failed:", error);
      const msg = error?.response?.data?.error || error?.message || "Failed to start subscription";
      if (msg.includes("StreamCreationFailed") || msg.includes("0x064b4a4a")) {
        setError("Stream creation failed. Your funds were not charged. Please ensure ACL permissions are granted and try again.");
      } else {
        setError(msg);
      }
      setSubscriptionStatus("inactive");
    }
  };

  const approveUsdcxOnly = async () => {
    if (!address || !walletClient || !operatorAddress) return;

    setError(null);
    setSubscriptionStatus("subscribing");

    try {
      const publicClient = createPublicClient({ chain: base, transport: http() });
      if (!walletClient.account) throw new Error("No account available in wallet client");

      const approveAbi = [{
        name: "approve",
        type: "function" as const,
        stateMutability: "nonpayable" as const,
        inputs: [
          { name: "spender", type: "address" as const },
          { name: "amount", type: "uint256" as const },
        ],
        outputs: [{ name: "", type: "bool" as const }],
      }] as const;

      const hash = await walletClient.writeContract({
        account: walletClient.account,
        chain: base,
        address: SUPER_TOKEN_CONFIG.superToken.address as `0x${string}`,
        abi: approveAbi,
        functionName: "approve",
        args: [operatorAddress as `0x${string}`, USDCX_FEE_ALLOWANCE],
      });

      let txHash: `0x${string}`;
      if (typeof hash === "string") {
        const cleanHash = hash.trim().startsWith("0x") ? hash.trim() : `0x${hash.trim()}`;
        const hexPart = cleanHash.slice(2);
        txHash = `0x${hexPart.length % 2 === 0 ? hexPart : `0${hexPart}`}` as `0x${string}`;
      } else {
        txHash = `0x${String(hash).padStart(64, "0")}` as `0x${string}`;
      }

      await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 });
      setHasUsdcxAllowance(true);

      await startSubscription();
    } catch (error: any) {
      console.error("Failed to approve USDCx:", error);
      setError(`Failed to approve USDCx: ${error?.message || error}`);
      setSubscriptionStatus("inactive");
    }
  };

  const handleSubscribe = async () => {
    const hasUsdcx = usdcxBalance !== null && usdcxBalance >= BigInt("1000000000000000000");
    setSubscribingWithUsdcx(hasUsdcx);

    if (!aclGranted) {
      // No ACL → batched grant (ACL + USDCx approve in one tx)
      await grantAclPermissions();
    } else if (hasUsdcx && !hasUsdcxAllowance) {
      // ACL granted but no USDCx allowance → just approve
      await approveUsdcxOnly();
    } else {
      // All permissions in place → start subscription
      await startSubscription();
    }
  };

  const getAuthPayload = async (): Promise<AuthPayload | null> => {
    if (!address || !walletClient) return null;

    if (authPayload && Date.now() - authPayload.timestamp < SIGNATURE_VALIDITY_MS) {
      return authPayload;
    }

    const timestamp = Date.now();
    const message = createAuthMessage(address, timestamp);

    try {
      const signature = await walletClient.signMessage({
        message,
        account: walletClient.account!,
      });

      const newAuth: AuthPayload = {
        userAddress: address,
        timestamp,
        signature,
      };

      setAuthPayload(newAuth);
      return newAuth;
    } catch (error: any) {
      console.error("Failed to sign message:", error);
      if (error?.code === 4001 || error?.message?.includes("rejected")) {
        setError("Signature rejected. Please sign to verify your wallet.");
      } else {
        setError("Failed to sign authentication message");
      }
      return null;
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isGeneratingChat || subscriptionStatus !== "active") return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsGeneratingChat(true);
    setError(null);

    try {
      const auth = await getAuthPayload();
      if (!auth) {
        setIsGeneratingChat(false);
        return;
      }

      const response = await axios.post("/api/venice/chat", {
        messages: [...messages, { role: "user", content: userMessage }],
        model: "llama-3.3-70b",
        auth,
      });

      const assistantMessage = response.data.choices?.[0]?.message?.content || "No response";
      setMessages(prev => [...prev, { role: "assistant", content: assistantMessage }]);

      // Track remaining requests
      if (response.data._rateLimit) {
        setRemainingRequests(response.data._rateLimit.remaining);
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      if (error?.response?.status === 401) {
        setAuthPayload(null);
      }
      if (error?.response?.status === 429) {
        setRemainingRequests(0);
      }

      const isCreditsExhausted = error?.response?.data?.veniceCreditsExhausted || error?.response?.status === 503;
      const isRateLimited = error?.response?.status === 429;
      const errorMsg = isCreditsExhausted
        ? "Venice AI is temporarily out of credits. Please try again later."
        : (error?.response?.data?.error || "Failed to get response");

      setError(errorMsg);

      let chatBubble = "Sorry, I encountered an error. Please try again.";
      if (isCreditsExhausted) {
        chatBubble = "I'm temporarily unavailable — our AI credits have run out. Please try again later!";
      } else if (isRateLimited) {
        chatBubble = "You've reached your daily limit of 10 requests. Come back tomorrow!";
      }

      setMessages(prev => [...prev, { role: "assistant", content: chatBubble }]);
    } finally {
      setIsGeneratingChat(false);
    }
  };

  const formatFlowRate = (flowRate: bigint) => {
    if (flowRate === BigInt(0)) return "0";
    const monthly = flowRate * BigInt(2628000); // Superfluid's (365/12) days
    const formatted = formatUnits(monthly, 18);
    // Round to 2 decimal places to avoid 0.999999...
    const rounded = Math.round(parseFloat(formatted) * 100) / 100;
    return rounded.toString();
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow">
        <div className="venice-container">
          <div className="venice-hero">
            <h1 className="font-serif">Venice AI Chat</h1>
            <p>
              A community-run AI demo. Your subscription streams to the Superfluid DAO.
            </p>
            {remainingRequests !== null && subscriptionStatus === "active" && (
              <p style={{ fontSize: 14, color: remainingRequests === 0 ? "#dc2626" : "#64748b", marginTop: 8 }}>
                {remainingRequests} / 10 requests remaining today
              </p>
            )}
          </div>

          <div className="venice-grid">
            <div className="venice-main">
              <div className="venice-card" style={{ position: "relative" }}>
                {error && (
                  <div className="error-banner">
                    {error}
                  </div>
                )}

                {/* Gated Content Overlay */}
                {(!isConnected || subscriptionStatus !== "active") && (
                  <div className="gated-overlay">
                    <div className="chat-container gated-content">
                      <div className="chat-messages">
                        <div className="chat-message assistant">
                          <div className="chat-avatar">V</div>
                          <div className="chat-bubble">
                            Hello! I'm Venice AI. Subscribe to start chatting...
                          </div>
                        </div>
                      </div>
                      <div className="chat-input-container">
                        <input className="chat-input" placeholder="Type a message..." disabled />
                        <button className="chat-send-btn" disabled>Send</button>
                      </div>
                    </div>

                    <div className="gated-message">
                      {!isConnected ? (
                        <>
                          <h3>Connect Wallet</h3>
                          <p>Connect your wallet to subscribe and access Venice AI</p>
                          <div style={{ display: "flex", justifyContent: "center" }}>
                            <appkit-button />
                          </div>
                        </>
                      ) : !isOnBase ? (
                        <>
                          <h3>Switch Network</h3>
                          <p>Please switch to {SUPER_TOKEN_CONFIG.chain.name} to continue</p>
                          <div style={{ display: "flex", justifyContent: "center" }}>
                            <appkit-button />
                          </div>
                        </>
                      ) : subscriptionStatus === "checking" ? (
                        <>
                          <h3>Checking Subscription...</h3>
                          <div className="loading-spinner" style={{ margin: "0 auto" }} />
                        </>
                      ) : subscriptionStatus === "subscribing" ? (
                        <>
                          <h3>Setting Up Subscription...</h3>
                          <p>{subscribingWithUsdcx && aclGranted
                            ? "Starting your stream, this may take a moment"
                            : "Please approve the transactions in your wallet"
                          }</p>
                          <div className="loading-spinner" style={{ margin: "0 auto" }} />
                        </>
                      ) : (() => {
                        // Check if user has enough balance to subscribe
                        // Need either 1 USDCx (1e18) or 2 USDC (2e6 = 1 USDC wrap + 1 USDC fee)
                        const MIN_USDCX = BigInt("1000000000000000000"); // 1 USDCx (18 decimals)
                        const MIN_USDC = BigInt("2000000"); // 2 USDC (6 decimals)
                        const hasEnoughUsdcx = usdcxBalance !== null && usdcxBalance >= MIN_USDCX;
                        const hasEnoughUsdc = usdcBalance !== null && usdcBalance >= MIN_USDC;
                        const balancesLoaded = usdcBalance !== null && usdcxBalance !== null;

                        return (
                          <>
                            <h3>Subscribe to Access</h3>
                            {!balancesLoaded ? (
                              <>
                                <p>Loading your balance...</p>
                                <div className="loading-spinner" style={{ margin: "0 auto" }} />
                              </>
                            ) : hasEnoughUsdcx ? (
                              <>
                                <p>
                                  You have <strong>{Number(formatUnits(usdcxBalance ?? BigInt(0), 18)).toFixed(2)} USDCx</strong>.<br />
                                  1 USDCx fee + start a 1 USDCx/month stream to the Superfluid DAO.
                                </p>
                                <button
                                  type="button"
                                  className="subscribe-btn"
                                  onClick={handleSubscribe}
                                  disabled={!walletClient}
                                >
                                  {!aclGranted ? "Grant Permissions & Start Stream" : !hasUsdcxAllowance ? "Approve Fee & Start Stream" : "Start Stream"}
                                </button>
                              </>
                            ) : hasEnoughUsdc ? (
                              <>
                                <p>
                                  <strong>2 USDC</strong> — 1 USDC fee + wrap 1 USDC to USDCx.<br />
                                  A 1 USDCx/month stream will start to the Superfluid DAO.
                                </p>
                                <button
                                  type="button"
                                  className="subscribe-btn"
                                  onClick={handleSubscribe}
                                  disabled={!walletClient}
                                >
                                  {!aclGranted ? "Grant Permissions & Subscribe" : "Subscribe Now"}
                                </button>
                              </>
                            ) : (
                              <>
                                <p>
                                  You need at least <strong>2 USDC</strong> on Base to subscribe.<br />
                                  Your balance: {formatUnits(usdcBalance ?? BigInt(0), 6)} USDC, {Number(formatUnits(usdcxBalance ?? BigInt(0), 18)).toFixed(2)} USDCx
                                </p>
                                <a
                                  href={`https://app.uniswap.org/swap?outputCurrency=${SUPER_TOKEN_CONFIG.underlyingToken.address}&chain=base`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="subscribe-btn"
                                  style={{ display: "inline-block", textAlign: "center", textDecoration: "none" }}
                                >
                                  Get USDC on Uniswap
                                </a>
                              </>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Active Chat */}
                {isConnected && subscriptionStatus === "active" && (
                  <div className="chat-container">
                    <div className="chat-messages" ref={chatMessagesRef}>
                      {messages.length === 0 && (
                        <div className="chat-message assistant">
                          <div className="chat-avatar">V</div>
                          <div className="chat-bubble">
                            Hello! I'm Venice AI, your uncensored AI assistant. How can I help you today?
                          </div>
                        </div>
                      )}
                      {messages.map((msg, idx) => (
                        <div key={idx} className={`chat-message ${msg.role}`}>
                          <div className="chat-avatar">
                            {msg.role === "user" ? "U" : "V"}
                          </div>
                          <div className="chat-bubble">
                            {msg.content}
                          </div>
                        </div>
                      ))}
                      {isGeneratingChat && (
                        <div className="chat-message assistant">
                          <div className="chat-avatar">V</div>
                          <div className="chat-bubble">
                            <div className="typing-indicator">
                              <span /><span /><span />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="chat-input-container">
                      <input
                        className="chat-input"
                        placeholder="Type a message..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChatMessage()}
                        disabled={isGeneratingChat}
                      />
                      <button
                        type="button"
                        className="chat-send-btn"
                        onClick={sendChatMessage}
                        disabled={isGeneratingChat || !chatInput.trim()}
                      >
                        {isGeneratingChat ? (
                          <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                        ) : (
                          "Send"
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="venice-sidebar">
              <div className="venice-card subscription-card">
                <h3>Subscription</h3>
                <div className="subscription-price">
                  1 USDCx <span>/ month</span>
                </div>
                <div className="subscription-deposit">
                  + 1 USDC setup fee
                </div>
                <div className={`subscription-status ${subscriptionStatus === "active" ? "active" : "inactive"}`}>
                  {subscriptionStatus === "active" ? (
                    <>
                      <span style={{ fontSize: 16 }}>&#10003;</span>
                      Active
                    </>
                  ) : subscriptionStatus === "checking" ? (
                    <>
                      <div className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: "rgba(255,255,255,0.3)", borderTopColor: "white" }} />
                      Checking...
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 16 }}>&#10007;</span>
                      Not Active
                    </>
                  )}
                </div>
                {subscriptionStatus === "active" && (
                  <a
                    href="https://app.superfluid.org/token/base/0xd04383398dd2426297da660f9cca3d439af9ce1b"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-block",
                      marginTop: 12,
                      padding: "8px 16px",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#10b981",
                      border: "1px solid #10b981",
                      borderRadius: 6,
                      textDecoration: "none",
                      textAlign: "center",
                    }}
                  >
                    View Stream Dashboard →
                  </a>
                )}
              </div>

              {/* DIEM Staking card - hidden until we have real data
              <div className="venice-card staking-card">
                <h3>DIEM Staking</h3>
                <div className="staking-stat">
                  <span className="staking-stat-label">Total Bought</span>
                  <span className="staking-stat-value">{diemStats.totalBought} DIEM</span>
                </div>
                <div className="staking-stat">
                  <span className="staking-stat-label">Total Staked</span>
                  <span className="staking-stat-value">{diemStats.totalStaked} DIEM</span>
                </div>
                <div className="staking-stat">
                  <span className="staking-stat-label">Capacity Tier</span>
                  <span className="staking-stat-value">{diemStats.capacity}</span>
                </div>
                <p style={{ marginTop: 12, fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
                  Buying and staking DIEM increases the overall compute capacity available to all subscribers.
                </p>
              </div>
              */}

              <div className="venice-card sup-psa">
                <h4>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  SUP Rewards Coming!
                </h4>
                <p>
                  SUP token rewards will be available in the next season as part of the Superfluid marketing campaign.
                  Subscribe now to be eligible!
                </p>
              </div>

            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
