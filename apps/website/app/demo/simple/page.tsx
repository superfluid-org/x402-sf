"use client";

import { useAccount, useChainId } from "wagmi";
import { usePermit2MacroStream } from "x402-sf";
import { SUPER_TOKEN_CONFIG, RECIPIENT_ADDRESS } from "../../config/supertoken";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./demo.css";

const FACILITATOR_URL = process.env.NEXT_PUBLIC_FACILITATOR_URL!;

export default function DemoPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const { status, subscribe, error, info, streamUrl } = usePermit2MacroStream({
    facilitatorUrl: FACILITATOR_URL,
    recipient: RECIPIENT_ADDRESS as `0x${string}`,
    config: SUPER_TOKEN_CONFIG,
  });

  const isOnBase = chainId === SUPER_TOKEN_CONFIG.chain.id;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-grow">
        <div className="demo-container">
          <div className="demo-card">
            <header className="demo-header">
              <h1 className="font-serif">x402 + Superfluid Simple Demo</h1>
              <p style={{ marginBottom: "1rem" }}>
                Experience seamless streaming payments. One Permit2 signature handles everything—
                pulling your USDC, wrapping it to USDCx, and opening the Superfluid stream.
              </p>

              {/* Warning Banner */}
              <div style={{
                padding: "1rem",
                backgroundColor: "#fef3c7",
                  border: "2px solid rgb(239, 192, 110)",
                borderRadius: "8px",
                marginBottom: "1rem",
                fontSize: "0.9rem"
              }}>
                <p style={{ margin: 0, color: "#92400e", fontWeight: 600 }}>
                  <strong>Prototype Warning:</strong> This is still a prototype. Its architecture will change and it may break anytime.
                </p>
              </div>

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
                    <strong>Grant ACL Permissions (one-time):</strong> Allow the facilitator to create payment streams on your behalf.{" "}
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
                    <strong>Payment & Wrapping:</strong> Your USDC is automatically wrapped to USDCx and a money stream is started to the receiver address
                  </li>
                  <li>
                    <strong>Continuous Access:</strong> You'll have access to the pay-gated content as long as your money stream remains active
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

                  {(status === "loading" ||
                    status === "needs-config" ||
                    status === "needs-approval" ||
                    status === "ready") && (
                    <div>
                      {status === "loading" && (
                        <div style={{ textAlign: "center", marginBottom: 24 }}>
                          <h2 style={{ marginBottom: 16 }}>Loading…</h2>
                          <p style={{ color: "#6b7280" }}>Checking your Permit2 allowance…</p>
                        </div>
                      )}

                      {status === "needs-approval" && (
                        <div style={{ textAlign: "center", marginBottom: 24 }}>
                          <h2 style={{ marginBottom: 16 }}>Start your stream</h2>
                          <p style={{ color: "#6b7280", marginBottom: 24 }}>
                            First time only: this approves the Permit2 contract to move your USDC, then
                            immediately opens your stream. After this, future subscriptions are a single gasless signature.
                          </p>
                          {error && (
                            <div style={{ marginBottom: 16, padding: 12, backgroundColor: "#fee2e2", color: "#991b1b", borderRadius: 8, fontSize: "0.875rem" }}>
                              {error}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={subscribe}
                            style={{ padding: "12px 24px", fontSize: "1rem", fontWeight: 600, backgroundColor: "black", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}
                          >
                            Approve Permit2 &amp; start stream
                          </button>
                        </div>
                      )}

                      {status === "needs-config" && (
                        <div style={{ textAlign: "center", marginBottom: 24 }}>
                          <h2 style={{ marginBottom: 16 }}>Not available yet</h2>
                          <p style={{ color: "#6b7280" }}>
                            The CreateFlowMacro contract isn&apos;t deployed or registered on this network yet.
                          </p>
                        </div>
                      )}

                      {status === "ready" && (
                        <div style={{ textAlign: "center" }}>
                          <h2 style={{ marginBottom: 16 }}>Subscribe with one signature</h2>
                          <p style={{ color: "#6b7280", marginBottom: 24 }}>
                            Sign a single message — if you don&apos;t already hold USDCx, the facilitator pulls your
                            USDC and wraps it for you, then opens your stream in one transaction. No gas.
                          </p>
                          {info && (
                            <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: 16 }}>
                              Forwarder: <code style={{ fontSize: "0.875rem", padding: "2px 6px", backgroundColor: "#f3f4f6", borderRadius: 4 }}>
                                {info.forwarder.slice(0, 6)}...{info.forwarder.slice(-4)}
                              </code>
                            </p>
                          )}
                          {error && (
                            <div style={{
                              marginBottom: 16,
                              padding: 12,
                              backgroundColor: "#fee2e2",
                              color: "#991b1b",
                              borderRadius: 8,
                              fontSize: "0.875rem"
                            }}>
                              {error}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={subscribe}
                            style={{
                              padding: "12px 24px",
                              fontSize: "1rem",
                              fontWeight: 600,
                              backgroundColor: "black",
                              color: "white",
                              border: "none",
                              borderRadius: 8,
                              cursor: "pointer",
                            }}
                          >
                            Sign &amp; Subscribe
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {status === "approving" && (
                    <div style={{ textAlign: "center" }}>
                      <h2 style={{ marginBottom: 16 }}>Approving…</h2>
                      <p style={{ color: "#6b7280" }}>
                        Confirm the one-time Permit2 approval in your wallet.
                      </p>
                    </div>
                  )}

                  {status === "subscribing" && (
                    <div style={{ textAlign: "center" }}>
                      <h2 style={{ marginBottom: 16 }}>Processing...</h2>
                      <p style={{ color: "#6b7280", marginBottom: 16 }}>
                        Please sign the Permit2 message in your wallet.
                      </p>
                      <div style={{
                        padding: 16,
                        backgroundColor: "#f3f4f6",
                        borderRadius: 8,
                        fontSize: "0.875rem",
                        color: "#374151"
                      }}>
                        <p style={{ margin: 0 }}>
                          That single signature lets the facilitator pull your USDC, wrap it to USDCx, and open the
                          stream — in one transaction. You won&apos;t pay gas.
                        </p>
                      </div>
                    </div>
                  )}

                  {status === "active" && (
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
                        href={streamUrl ?? `https://app.superfluid.org/token/${SUPER_TOKEN_CONFIG.superfluidDashboardNetwork}/${SUPER_TOKEN_CONFIG.superToken.address}`}
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
                        View Stream on Superfluid Dashboard
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

                  {status === "error" && (
                    <div>
                      <h2 style={{ marginBottom: 16 }}>Error</h2>
                      <div style={{
                        padding: 12,
                        backgroundColor: "#fee2e2",
                        color: "#991b1b",
                        borderRadius: 8,
                        fontSize: "0.875rem",
                        marginBottom: 16
                      }}>
                        {error}
                      </div>
                      <button
                        type="button"
                        onClick={() => window.location.reload()}
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
