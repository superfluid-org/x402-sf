"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { withPaymentInterceptor } from "x402-axios";
import { useAccount, useWalletClient, useChainId } from "wagmi";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { SUPER_TOKEN_CONFIG } from "../config/supertoken";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./demo.css";

const FACILITATOR_URL = process.env.NEXT_PUBLIC_FACILITATOR_URL;
if (!FACILITATOR_URL) {
  throw new Error("Missing required environment variable: NEXT_PUBLIC_FACILITATOR_URL");
}
const RECIPIENT_ADDRESS = "0x4e1dfc95c49186c8D6fAf7a33064Cc74F6Af235D";
const CFA_FORWARDER_ADDRESS = SUPER_TOKEN_CONFIG.superfluid.cfaV1Forwarder;
const CFA_ADDRESS = SUPER_TOKEN_CONFIG.superfluid.cfa;

// CFA Forwarder ABI for granting permissions
const CFA_FORWARDER_ABI = [
  {
    name: "grantPermissions",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "flowOperator", type: "address" },
    ],
    outputs: [],
  },
] as const;

// CFA ABI for checking permissions
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
] as const;

type Status = "idle" | "loading" | "success" | "error";
type AclStatus = "checking" | "granted" | "not-granted" | "granting";

interface DemoState {
  status: Status;
  imageUrl: string | null;
  message: string | null;
  error: string | null;
  aclStatus: AclStatus;
}

export default function DemoPage() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();

  const [demoState, setDemoState] = useState<DemoState>({
    status: "idle",
    imageUrl: null,
    message: null,
    error: null,
    aclStatus: "checking",
  });

  const [facilitatorAddress, setFacilitatorAddress] = useState<string | null>(null);
  const isGrantingRef = useRef(false);
  const hasAutoTriggeredRef = useRef(false);

  const isOnBase = chainId === SUPER_TOKEN_CONFIG.chain.id;

  // Fetch facilitator address
  useEffect(() => {
    const fetchFacilitatorAddress = async () => {
      try {
        const response = await axios.get(`${FACILITATOR_URL}/info`);
        setFacilitatorAddress(response.data.facilitator);
      } catch (error) {
        console.error("Failed to fetch facilitator info:", error);
      }
    };
    fetchFacilitatorAddress();
  }, []);

  // Check ACL permissions on mount or when wallet/network changes
  useEffect(() => {
    // Don't check if we're currently granting permissions
    if (isGrantingRef.current) {
      return;
    }

    if (!address || !isOnBase || !facilitatorAddress) {
      setDemoState(prev => {
        if (prev.aclStatus === "granting") return prev;
        return { ...prev, aclStatus: "checking" };
      });
      return;
    }

    const checkPermissions = async () => {
      try {
        const publicClient = createPublicClient({
          chain: base,
          transport: http(),
        });

        const aclResult = (await publicClient.readContract({
          address: CFA_ADDRESS,
          abi: CFA_ABI,
          functionName: "getFlowOperatorData",
          args: [
            SUPER_TOKEN_CONFIG.superToken.address,
            address,
            facilitatorAddress as `0x${string}`,
          ],
        })) as [string, number, bigint];

        const [, permissions] = aclResult;
        const hasPermissions = permissions === 7;

        setDemoState(prev => {
          // Don't override if we're currently granting
          if (prev.aclStatus === "granting") return prev;
          return {
            ...prev,
            aclStatus: hasPermissions ? "granted" : "not-granted",
          };
        });
      } catch (error) {
        console.error("Failed to check permissions:", error);
        setDemoState(prev => {
          if (prev.aclStatus === "granting") return prev;
          return { ...prev, aclStatus: "not-granted" };
        });
      }
    };

    checkPermissions();
  }, [address, isOnBase, facilitatorAddress]);

  const grantAclPermissions = async () => {
    if (!address || !walletClient || !facilitatorAddress) {
      setDemoState(prev => ({ ...prev, error: "Please connect your wallet first." }));
      return;
    }

    isGrantingRef.current = true;
    setDemoState(prev => ({ ...prev, aclStatus: "granting", error: null }));

    try {
      if (!walletClient.account) {
        throw new Error("No account available in wallet client");
      }

      const publicClient = createPublicClient({
        chain: base,
        transport: http(),
      });

      // Use walletClient directly to write contract
      const hash = await walletClient.writeContract({
        account: walletClient.account,
        chain: base,
        address: CFA_FORWARDER_ADDRESS,
        abi: CFA_FORWARDER_ABI,
        functionName: "grantPermissions",
        args: [
          SUPER_TOKEN_CONFIG.superToken.address,
          facilitatorAddress as `0x${string}`,
        ],
      });

      console.log("Transaction sent, hash:", hash);

      let txHash: `0x${string}`;
      if (typeof hash === "string") {
        const cleanHash = hash.trim().startsWith("0x") ? hash.trim() : `0x${hash.trim()}`;
        const hexPart = cleanHash.slice(2);
        txHash = `0x${hexPart.length % 2 === 0 ? hexPart : `0${hexPart}`}` as `0x${string}`;
      } else {
        txHash = `0x${String(hash).padStart(64, "0")}` as `0x${string}`;
      }
      
      console.log("Formatted transaction hash:", txHash);
      
      // Wait for transaction to be mined with timeout
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash: txHash,
        timeout: 120_000, // 2 minutes timeout
      });

      console.log("Transaction confirmed:", receipt.status);

      if (receipt.status === "reverted") {
        throw new Error("Transaction was reverted");
      }

      // Wait a bit for the state to update on-chain
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Re-check permissions to confirm
      let retries = 3;
      let hasPermissions = false;

      while (retries > 0 && !hasPermissions) {
        try {
          const aclResult = (await publicClient.readContract({
            address: CFA_ADDRESS,
            abi: CFA_ABI,
            functionName: "getFlowOperatorData",
            args: [
              SUPER_TOKEN_CONFIG.superToken.address,
              address,
              facilitatorAddress as `0x${string}`,
            ],
          })) as [string, number, bigint];

          const [, permissions] = aclResult;
          hasPermissions = permissions === 7;

          if (!hasPermissions && retries > 1) {
            // Wait a bit more before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          console.error("Error checking permissions:", error);
        }
        retries--;
      }

      console.log("Permissions check result:", hasPermissions);

      // Update state - this will automatically show "Access Content" button
      isGrantingRef.current = false;
      setDemoState(prev => ({
        ...prev,
        aclStatus: hasPermissions ? "granted" : "not-granted",
        error: hasPermissions ? null : "Permissions granted but verification failed. Please refresh.",
      }));

      if (hasPermissions) {
        console.log("ACL permissions successfully granted!");
      }
    } catch (error: any) {
      console.error("Failed to grant permissions:", error);
      isGrantingRef.current = false;
      setDemoState(prev => ({
        ...prev,
        aclStatus: "not-granted",
        error: `Failed to grant permissions: ${error?.message || error}`,
      }));
    }
  };

  const accessContent = async () => {
    if (!address || !walletClient) {
      setDemoState(prev => ({
        ...prev,
        status: "error",
        imageUrl: null,
        message: null,
        error: "Please connect your wallet first.",
      }));
      return;
    }

    setDemoState(prev => ({
      ...prev,
      status: "loading",
      imageUrl: null,
      message: null,
      error: null,
    }));

    try {
      // Create x402-enabled client - middleware handles everything automatically
      const x402Client = withPaymentInterceptor(
        axios.create({ baseURL: FACILITATOR_URL }),
        walletClient as any
      );

      // Make request - x402-axios automatically:
      // 1. Sends request
      // 2. If 402 received, prompts for payment signature
      // 3. Retries request with X-PAYMENT header
      // 4. Returns response
      const response = await x402Client.get("/resource", {
        params: {
          account: address,
          recipient: RECIPIENT_ADDRESS,
        },
      });

      if (response.data?.imageUrl) {
        setDemoState(prev => ({
          ...prev,
          status: "success",
          imageUrl: response.data.imageUrl,
          message: response.data.message || "Access granted!",
          error: null,
        }));
      } else {
        setDemoState(prev => ({
          ...prev,
          status: "success",
          imageUrl: null,
          message: response.data?.message || "Access granted!",
          error: null,
        }));
      }
    } catch (error: any) {
      console.error("Request failed", error);
      setDemoState(prev => ({
        ...prev,
        status: "error",
        imageUrl: null,
        message: null,
        error: error?.response?.data?.error || error?.message || "Failed to access content",
      }));
    }
  };

  // Auto-access content when ACL permissions are granted
  useEffect(() => {
    if (
      demoState.aclStatus === "granted" &&
      demoState.status === "idle" &&
      walletClient &&
      address &&
      !isGrantingRef.current &&
      !hasAutoTriggeredRef.current
    ) {
      // Mark as triggered to prevent multiple calls
      hasAutoTriggeredRef.current = true;
      // Small delay to ensure UI has updated
      const timer = setTimeout(() => {
        accessContent();
      }, 500);
      return () => clearTimeout(timer);
    }
    
    // Reset the ref when status changes away from idle
    if (demoState.status !== "idle") {
      hasAutoTriggeredRef.current = false;
    }
  }, [demoState.aclStatus, demoState.status, walletClient, address]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-grow">
        <div className="demo-container">
          <div className="demo-card">
            <header className="demo-header">
              <h1>x402 + Superfluid Demo</h1>
              <p style={{ marginBottom: "1rem" }}>
                Experience seamless streaming payments. The x402-axios middleware handles everything automatically—
                payment signing, retries, and stream creation.
              </p>
              <div style={{ 
                padding: "1rem", 
                backgroundColor: "#f9fafb", 
                borderLeft: "4px solid black", 
                borderRadius: "4px",
                fontSize: "0.9rem"
              }}>
                <p style={{ marginBottom: "0.75rem" }}>
                  <strong>How this demo works:</strong>
                </p>
                <ol style={{ marginLeft: "1.25rem", lineHeight: "1.6" }}>
                  <li style={{ marginBottom: "0.5rem" }}>
                    <strong>Grant ACL Permissions (one-time):</strong> Allow the facilitator to create streams on your behalf.{" "}
                    <a 
                      href="https://docs.superfluid.org/docs/sdk/money-streaming/acl-user-data" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: "black", textDecoration: "underline" }}
                    >
                      Learn more about ACL permissions
                    </a>
                    {" "}<span style={{ fontSize: "0.85rem", color: "#6b7280" }}>(note: this step won't be necessary in the future)</span>
                  </li>
                  <li style={{ marginBottom: "0.5rem" }}>
                    <strong>Payment & Wrapping:</strong> Your USDC is automatically wrapped to USDCx and a stream is started to the receiver address
                  </li>
                  <li>
                    <strong>Continuous Access:</strong> You'll have access to the pay-gated content as long as your stream remains active
                  </li>
                </ol>
              </div>
            </header>

            <section className="demo-card">
              {!isConnected ? (
                <div style={{ textAlign: "center" }}>
                  <p style={{ color: "#6b7280", marginBottom: 20 }}>
                    Connect your {SUPER_TOKEN_CONFIG.chain.name} wallet to try out the demo
                  </p>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <appkit-button />
                  </div>
                </div>
              ) : !isOnBase ? (
                <div style={{ textAlign: "center" }}>
                  <h2 style={{ marginBottom: 16 }}>Switch Network</h2>
                  <p style={{ color: "#6b7280", marginBottom: 20 }}>
                    Please switch to {SUPER_TOKEN_CONFIG.chain.name} to continue
                  </p>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <appkit-button />
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #e5e7eb" }}>
                    <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: 8 }}>
                      Connected: <code style={{ fontSize: "0.875rem", padding: "2px 6px", backgroundColor: "#f3f4f6", borderRadius: 4 }}>
                        {address?.slice(0, 6)}...{address?.slice(-4)}
                      </code>
                    </p>
                    <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                      Recipient: <code style={{ fontSize: "0.875rem", padding: "2px 6px", backgroundColor: "#f3f4f6", borderRadius: 4 }}>
                        {RECIPIENT_ADDRESS.slice(0, 6)}...{RECIPIENT_ADDRESS.slice(-4)}
                      </code>
                    </p>
                  </div>

                  {demoState.status === "idle" && (
                    <div>
                      {/* ACL Permissions Step */}
                      {demoState.aclStatus === "checking" && (
                        <div style={{ textAlign: "center", marginBottom: 24 }}>
                          <h2 style={{ marginBottom: 16 }}>Checking Permissions...</h2>
                          <p style={{ color: "#6b7280" }}>Verifying ACL permissions...</p>
                        </div>
                      )}

                      {demoState.aclStatus === "not-granted" && (
                        <div style={{ textAlign: "center", marginBottom: 24 }}>
                          <h2 style={{ marginBottom: 16 }}>Grant ACL Permissions</h2>
                          <p style={{ color: "#6b7280", marginBottom: 16 }}>
                            Grant one-time permission for the facilitator to create streams on your behalf.
                            This enables signature-only stream creation (no gas fees for future payments).
                          </p>
                          {facilitatorAddress && (
                            <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: 16 }}>
                              Facilitator: <code style={{ fontSize: "0.875rem", padding: "2px 6px", backgroundColor: "#f3f4f6", borderRadius: 4 }}>
                                {facilitatorAddress.slice(0, 6)}...{facilitatorAddress.slice(-4)}
                              </code>
                            </p>
                          )}
                          {demoState.error && (
                            <div style={{ 
                              marginBottom: 16, 
                              padding: 12, 
                              backgroundColor: "#fee2e2", 
                              color: "#991b1b", 
                              borderRadius: 8,
                              fontSize: "0.875rem"
                            }}>
                              ❌ {demoState.error}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={grantAclPermissions}
                            disabled={!walletClient}
                            style={{
                              padding: "12px 24px",
                              fontSize: "1rem",
                              fontWeight: 600,
                              backgroundColor: !walletClient ? "#9ca3af" : "black",
                              color: "white",
                              border: "none",
                              borderRadius: 8,
                              cursor: !walletClient ? "not-allowed" : "pointer",
                            }}
                          >
                            Grant Permissions
                          </button>
                        </div>
                      )}

                      {demoState.aclStatus === "granting" && (
                        <div style={{ textAlign: "center", marginBottom: 24 }}>
                          <h2 style={{ marginBottom: 16 }}>Granting Permissions...</h2>
                          <p style={{ color: "#6b7280", marginBottom: 8 }}>Please approve the transaction in your wallet.</p>
                          <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                            Waiting for transaction confirmation...
                          </p>
                        </div>
                      )}

                      {demoState.aclStatus === "granted" && (
                        <div style={{ textAlign: "center" }}>
                          <div style={{ 
                            padding: 16, 
                            backgroundColor: "#d1fae5", 
                            borderRadius: 8, 
                            marginBottom: 24 
                          }}>
                            <p style={{ color: "#065f46", fontWeight: 600, margin: 0 }}>
                              ✅ ACL Permissions Granted
                            </p>
                          </div>
                          <h2 style={{ marginBottom: 16 }}>Access Gated Content</h2>
                          <p style={{ color: "#6b7280", marginBottom: 24 }}>
                            Click below to access protected content. The x402-axios middleware will automatically handle
                            payment signing if needed.
                          </p>
                          <button
                            type="button"
                            onClick={accessContent}
                            disabled={!walletClient}
                            style={{
                              padding: "12px 24px",
                              fontSize: "1rem",
                              fontWeight: 600,
                              backgroundColor: !walletClient ? "#9ca3af" : "black",
                              color: "white",
                              border: "none",
                              borderRadius: 8,
                              cursor: !walletClient ? "not-allowed" : "pointer",
                            }}
                          >
                            Access Content
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {demoState.status === "loading" && (
                    <div style={{ textAlign: "center" }}>
                      <h2 style={{ marginBottom: 16 }}>Processing...</h2>
                      <p style={{ color: "#6b7280", marginBottom: 16 }}>
                        The middleware is handling payment signing. Please approve the transaction in your wallet.
                      </p>
                      <div style={{ 
                        padding: 16, 
                        backgroundColor: "#f3f4f6", 
                        borderRadius: 8,
                        fontSize: "0.875rem",
                        color: "#374151"
                      }}>
                        <p style={{ margin: 0 }}>
                          If this is your first time, you'll be prompted to sign a payment authorization.
                          The facilitator will handle wrapping USDC to USDCx and creating the stream.
                        </p>
                      </div>
                    </div>
                  )}

                  {demoState.status === "success" && demoState.imageUrl && (
                    <div style={{ 
                      padding: 24, 
                      backgroundColor: "#f9fafb", 
                      borderRadius: 12,
                      border: "1px solid #e5e7eb"
                    }}>
                      <h2 style={{ marginBottom: 16, fontSize: "1.5rem", fontWeight: 600 }}>
                        Stream Active – Access Granted
                      </h2>
                      
                      <p style={{ color: "#374151", marginBottom: 16, lineHeight: "1.6" }}>
                        You are now streaming <strong>USDCx</strong> and have access to this pay-gated page. 
                        Your stream is active and you can monitor it in real-time on the Superfluid Dashboard.
                      </p>

                      <a 
                        href="https://app.superfluid.org/token/base/0xd04383398dd2426297da660f9cca3d439af9ce1b"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-block",
                          padding: "10px 20px",
                          backgroundColor: "black",
                          color: "white",
                          textDecoration: "none",
                          borderRadius: 8,
                          fontWeight: 600,
                          fontSize: "0.9375rem",
                          marginBottom: 24
                        }}
                      >
                        View Stream on Superfluid Dashboard →
                      </a>

                      <div style={{ 
                        marginTop: 24, 
                        padding: 20, 
                        backgroundColor: "white", 
                        borderRadius: 8,
                        border: "1px solid #e5e7eb"
                      }}>
                        <h3 style={{ marginBottom: 12, fontSize: "1.125rem", fontWeight: 600 }}>
                          Real-World Use Cases
                        </h3>
                        <ul style={{ 
                          margin: 0, 
                          paddingLeft: "1.5rem", 
                          color: "#4b5563",
                          lineHeight: "1.8"
                        }}>
                          <li><strong>Pay-gated channels:</strong> Access exclusive content, communities, or chat channels</li>
                          <li><strong>SaaS subscriptions:</strong> Stream payments for software services instead of monthly billing</li>
                          <li><strong>DCA (Dollar Cost Averaging):</strong> Continuous investment streams into tokens or assets</li>
                          <li><strong>On-demand media:</strong> Stream payments while consuming content (music, video, articles)</li>
                        </ul>
                      </div>

                      <p style={{ 
                        marginTop: 20, 
                        color: "#6b7280", 
                        fontSize: "0.875rem",
                        fontStyle: "italic"
                      }}>
                        Your access continues as long as your stream remains active. Stop or cancel the stream anytime from the dashboard.
                      </p>
                    </div>
                  )}

                  {demoState.status === "success" && !demoState.imageUrl && (
                    <div style={{ textAlign: "center" }}>
                      <h2 style={{ marginBottom: 16 }}>✅ Success!</h2>
                      {demoState.message && (
                        <p style={{ color: "#059669", fontWeight: 600, marginBottom: 20 }}>
                          {demoState.message}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => setDemoState(prev => ({ ...prev, status: "idle", imageUrl: null, message: null, error: null }))}
                        style={{
                          padding: "10px 20px",
                          fontSize: "0.9375rem",
                          backgroundColor: "black",
                          color: "white",
                          border: "none",
                          borderRadius: 8,
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Try Again
                      </button>
                    </div>
                  )}

                  {demoState.status === "error" && (
                    <div>
                      <h2 style={{ marginBottom: 16 }}>❌ Error</h2>
                      <div style={{ 
                        padding: 12, 
                        backgroundColor: "#fee2e2", 
                        color: "#991b1b", 
                        borderRadius: 8,
                        fontSize: "0.875rem",
                        marginBottom: 16
                      }}>
                        {demoState.error}
                      </div>
                      <button
                        type="button"
                        onClick={() => setDemoState(prev => ({ ...prev, status: "idle", imageUrl: null, message: null, error: null }))}
                        style={{
                          padding: "10px 20px",
                          fontSize: "0.9375rem",
                          backgroundColor: "black",
                          color: "white",
                          border: "none",
                          borderRadius: 8,
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Try Again
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
