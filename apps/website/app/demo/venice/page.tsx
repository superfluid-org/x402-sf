"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAccount, useWalletClient } from "wagmi";
import { formatUnits } from "viem";
import ReactMarkdown from "react-markdown";
import { usePermit2MacroStream, MIN_USDC_BALANCE } from "x402-sf";
import { SUPER_TOKEN_CONFIG, RECIPIENT_ADDRESS } from "../../config/supertoken";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./venice.css";

const FACILITATOR_URL = process.env.NEXT_PUBLIC_FACILITATOR_URL;

interface Message {
  role: "user" | "assistant";
  content: string;
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

  const {
    status: subscriptionStatus,
    subscribe,
    error: subscriptionError,
    balances,
    streamUrl,
  } = usePermit2MacroStream({
    facilitatorUrl: FACILITATOR_URL || "",
    recipient: RECIPIENT_ADDRESS,
    config: SUPER_TOKEN_CONFIG,
  });

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

  const isOnBase = chainId === SUPER_TOKEN_CONFIG.chain.id;

  // Clear auth when wallet changes
  useEffect(() => {
    setAuthPayload(null);
  }, [address]);

  // Auto-scroll chat container only
  useEffect(() => {
    const el = chatMessagesRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isGeneratingChat]);

  // Sync subscription error to local error
  useEffect(() => {
    if (subscriptionError) setError(subscriptionError);
  }, [subscriptionError]);

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

  // Derive subscription state booleans for UI
  const isActive = subscriptionStatus === "active";
  const isChecking = subscriptionStatus === "loading";
  const isSubscribing = subscriptionStatus === "subscribing" || subscriptionStatus === "approving";
  const needsPermissions = subscriptionStatus === "needs-approval" || subscriptionStatus === "ready";

  const hasEnoughUsdc = balances.usdc !== null && balances.usdc >= MIN_USDC_BALANCE;
  const balancesLoaded = balances.usdc !== null && balances.usdcx !== null;

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
            {remainingRequests !== null && isActive && (
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
                {(!isConnected || !isActive) && (
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
                      ) : isChecking ? (
                        <>
                          <h3>Checking Subscription...</h3>
                          <div className="loading-spinner" style={{ margin: "0 auto" }} />
                        </>
                      ) : isSubscribing ? (
                        <>
                          <h3>Setting Up Subscription...</h3>
                          <p>Please approve the transactions in your wallet</p>
                          <div className="loading-spinner" style={{ margin: "0 auto" }} />
                        </>
                      ) : (
                        <>
                          <h3>Subscribe to Access</h3>
                          {!balancesLoaded ? (
                            <>
                              <p>Loading your balance...</p>
                              <div className="loading-spinner" style={{ margin: "0 auto" }} />
                            </>
                          ) : hasEnoughUsdc ? (
                            <>
                              <p>
                                One signature starts a 1 USDCx/month stream to the Superfluid DAO.<br />
                                Permit2 pulls your USDC and wraps it — no separate approval, no gas for the stream.
                              </p>
                              <button
                                type="button"
                                className="subscribe-btn"
                                onClick={subscribe}
                                disabled={!walletClient}
                              >
                                {needsPermissions ? "Grant permission to Permit2 and start stream" : "Start Stream"}
                              </button>
                            </>
                          ) : (
                            <>
                              <p>
                                You need some <strong>USDC</strong> on Base to subscribe.<br />
                                Your balance: {formatUnits(balances.usdc ?? BigInt(0), 6)} USDC
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
                      )}
                    </div>
                  </div>
                )}

                {/* Active Chat */}
                {isConnected && isActive && (
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
                          <div className="chat-bubble markdown-content">
                            {msg.role === "assistant" ? (
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            ) : (
                              msg.content
                            )}
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
                <div className={`subscription-status ${isActive ? "active" : "inactive"}`}>
                  {isActive ? (
                    <>
                      <span style={{ fontSize: 16 }}>&#10003;</span>
                      Active
                    </>
                  ) : isChecking ? (
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
                {isActive && (
                  <a
                    href={streamUrl || `https://app.superfluid.org/token/${SUPER_TOKEN_CONFIG.superfluidDashboardNetwork}/${SUPER_TOKEN_CONFIG.superToken.address}`}
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
                    {streamUrl ? "View Your Stream" : "View Stream Dashboard"}
                  </a>
                )}
              </div>

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
