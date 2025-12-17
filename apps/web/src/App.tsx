import { useState, useEffect } from "react";
import axios from "axios";
import { withPaymentInterceptor } from "x402-axios";
import { Hex, formatUnits, erc20Abi, createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { useWallet } from "./contexts/WalletContext";
import { SUPER_TOKEN_CONFIG } from "@super-x402/config";

const FACILITATOR_URL = import.meta.env.VITE_FACILITATOR_URL || "http://localhost:4020";
const UNISWAP_USDC_LINK = "https://app.uniswap.org/explore/tokens/base/0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const CFA_FORWARDER_ADDRESS = SUPER_TOKEN_CONFIG.superfluid.cfaV1Forwarder;
const CFA_ADDRESS = SUPER_TOKEN_CONFIG.superfluid.cfa;
const WRAP_AMOUNT = 1000000n; // 1 USDC (6 decimals)
const FEE_AMOUNT = 100000n; // 0.1 USDC (6 decimals) - 10 cents
const TOTAL_REQUIRED = WRAP_AMOUNT + FEE_AMOUNT; // 1.1 USDC

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

type Step = "connect-wallet" | "info" | "check-balance" | "check-permissions" | "request-payment" | "complete";

interface StepState {
  current: Step;
  balance: bigint | null;
  hasBalance: boolean;
  hasPermissions: boolean;
  checkingBalance: boolean;
  checkingPermissions: boolean;
  grantingPermissions: boolean;
  requestingPayment: boolean;
  memeImageUrl: string | null;
  error: string | null;
}

export default function App() {
  const { address, walletClient, chainId, connect, disconnect, isConnecting, error: walletError } = useWallet();

  const [stepState, setStepState] = useState<StepState>({
    current: "connect-wallet",
    balance: null,
    hasBalance: false,
    hasPermissions: false,
    checkingBalance: false,
    checkingPermissions: false,
    grantingPermissions: false,
    requestingPayment: false,
    memeImageUrl: null,
    error: null,
  });

  const [recipientAddress] = useState<string>("0x4e1dfc95c49186c8D6fAf7a33064Cc74F6Af235D");
  const [facilitatorAddress, setFacilitatorAddress] = useState<string | null>(null);

  const isOnBase = chainId === SUPER_TOKEN_CONFIG.chain.id;
  const tokenSymbols = {
    underlying: SUPER_TOKEN_CONFIG.underlyingToken.symbol,
    superToken: SUPER_TOKEN_CONFIG.superToken.symbol,
  };

  const formatAmount = (value: bigint, decimals: number) =>
    formatUnits(value, decimals);

  // Fetch facilitator address on mount
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

  // Auto-advance from connect-wallet to info when wallet is connected and on correct network
  useEffect(() => {
    if (address && isOnBase && stepState.current === "connect-wallet") {
      setStepState(prev => ({ ...prev, current: "info" }));
    } else if ((!address || !isOnBase) && stepState.current !== "connect-wallet") {
      setStepState(prev => ({ ...prev, current: "connect-wallet" }));
    }
  }, [address, isOnBase, stepState.current]);

  // Check if user already has stream access on mount
  useEffect(() => {
    if (!address || !isOnBase || !facilitatorAddress || !walletClient) {
      return;
    }

    const checkExistingAccess = async () => {
      try {
        const x402Client = withPaymentInterceptor(
          axios.create({ baseURL: FACILITATOR_URL }),
          walletClient as any
        );
        
        const response = await x402Client.get(`/resource?account=${address}&recipient=${recipientAddress}`);
        
        // If we get a 200 response, user has stream access
        if (response.data?.status === "ok" && response.data?.imageUrl) {
          setStepState(prev => ({
            ...prev,
            memeImageUrl: response.data.imageUrl,
            current: "complete",
            hasBalance: true, // Assume they have balance if they have a stream
            hasPermissions: true, // Assume they have permissions if they have a stream
          }));
        }
      } catch (error: any) {
        // If we get a 402, user doesn't have stream yet - that's fine, continue with flow
        if (error?.response?.status !== 402) {
          console.error("Failed to check existing access:", error);
        }
      }
    };

    checkExistingAccess();
  }, [address, isOnBase, facilitatorAddress, recipientAddress, walletClient]);

  // Step 2: Check USDC balance
  useEffect(() => {
    if (!address || !isOnBase || stepState.current !== "check-balance") {
      return;
    }

    const checkUSDCBalance = async () => {
      setStepState(prev => ({ ...prev, checkingBalance: true, error: null }));
      try {
        const publicClient = createPublicClient({
          chain: base,
          transport: http(),
        });

        const balance = await publicClient.readContract({
          address: SUPER_TOKEN_CONFIG.underlyingToken.address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address],
        });

        const hasBalance = balance >= TOTAL_REQUIRED;
        setStepState(prev => ({
          ...prev,
          balance,
          hasBalance,
          checkingBalance: false,
          current: hasBalance ? "check-permissions" : "check-balance",
        }));
      } catch (error) {
        console.error("Failed to check USDC balance:", error);
        setStepState(prev => ({
          ...prev,
          checkingBalance: false,
          error: "Failed to check balance",
        }));
      }
    };

    checkUSDCBalance();
  }, [address, isOnBase, stepState.current]);

  // Step 3: Check ACL permissions
  useEffect(() => {
    if (!address || !isOnBase || !facilitatorAddress || stepState.current !== "check-permissions") {
      return;
    }

    const checkPermissions = async () => {
      setStepState(prev => ({ ...prev, checkingPermissions: true, error: null }));
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

        setStepState(prev => ({
          ...prev,
          hasPermissions,
          checkingPermissions: false,
          current: hasPermissions ? "request-payment" : "check-permissions",
        }));
      } catch (error) {
        console.error("Failed to check permissions:", error);
        setStepState(prev => ({
          ...prev,
          checkingPermissions: false,
          error: "Failed to check permissions",
        }));
      }
    };

    checkPermissions();
  }, [address, isOnBase, facilitatorAddress, stepState.current]);

  const grantAclPermissions = async () => {
    if (!address || !walletClient || !facilitatorAddress) {
      setStepState(prev => ({ ...prev, error: "Connect wallet first." }));
      return;
    }

    setStepState(prev => ({ ...prev, grantingPermissions: true, error: null }));

    try {
      const txHash = await walletClient.writeContract({
        account: walletClient.account!,
        chain: base,
        address: CFA_FORWARDER_ADDRESS,
        abi: CFA_FORWARDER_ABI,
        functionName: "grantPermissions",
        args: [
          SUPER_TOKEN_CONFIG.superToken.address,
          facilitatorAddress as `0x${string}`,
        ],
      });

      const publicClient = createPublicClient({
        chain: base,
        transport: http(),
      });
      
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      setStepState(prev => ({
        ...prev,
        hasPermissions: true,
        grantingPermissions: false,
        current: "request-payment",
      }));
    } catch (error: any) {
      console.error("Failed to grant flow permissions:", error);
      setStepState(prev => ({
        ...prev,
        grantingPermissions: false,
        error: `Failed to grant permissions: ${error?.message || error}`,
      }));
    }
  };

  const requestPayment = async () => {
    if (!address || !walletClient) {
      setStepState(prev => ({ ...prev, error: "Connect wallet first." }));
      return;
    }

    setStepState(prev => ({ ...prev, requestingPayment: true, error: null }));

    try {
      const x402Client = withPaymentInterceptor(
        axios.create({ baseURL: FACILITATOR_URL }),
        walletClient as any
      );
      
      const response = await x402Client.get(`/resource?account=${address}&recipient=${recipientAddress}`);

      // Extract image URL if available
      if (response.data?.imageUrl) {
        setStepState(prev => ({
          ...prev,
          memeImageUrl: response.data.imageUrl,
          requestingPayment: false,
          current: "complete",
        }));
      } else {
        setStepState(prev => ({
          ...prev,
          requestingPayment: false,
          current: "complete",
        }));
      }
    } catch (error: any) {
      console.error("Payment request failed", error);
      setStepState(prev => ({
        ...prev,
        requestingPayment: false,
        error: error?.response?.data?.error || error?.message || "Failed to process payment",
      }));
    }
  };

  const proceedToNextStep = () => {
    if (stepState.current === "info") {
      setStepState(prev => ({ ...prev, current: "check-balance" }));
    }
  };


  const renderStepContent = () => {
    // Step 0: Connect Wallet
    if (stepState.current === "connect-wallet") {
      if (address) {
        const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
        return (
          <div style={{ textAlign: "center" }}>
            <h2 style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              ✅ <span>Step 1: Wallet Connected</span>
            </h2>
            <div style={{ 
              padding: 16, 
              backgroundColor: "#d1fae5", 
              borderRadius: 8, 
              marginBottom: 16 
            }}>
              <div style={{ fontWeight: 600, color: "#065f46", marginBottom: 8 }}>
                {shortAddress}
              </div>
              {!isOnBase && (
                <div style={{ fontSize: "0.875rem", color: "#dc2626", marginTop: 8 }}>
                  ⚠️ Please switch to {SUPER_TOKEN_CONFIG.chain.name}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={disconnect}
              style={{
                padding: "8px 16px",
                fontSize: "0.875rem",
                backgroundColor: "#6b7280",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Disconnect
            </button>
          </div>
        );
      }

      return (
        <div style={{ textAlign: "center" }}>
          <h2 style={{ marginBottom: 16 }}>Step 1: Connect Wallet</h2>
          <p style={{ color: "#6b7280", marginBottom: 20 }}>
            Connect your {SUPER_TOKEN_CONFIG.chain.name} wallet to get started
          </p>
          <button
            type="button"
            onClick={connect}
            disabled={isConnecting}
            style={{
              padding: "12px 24px",
              fontSize: "1rem",
              fontWeight: 600,
              backgroundColor: isConnecting ? "#9ca3af" : "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: isConnecting ? "not-allowed" : "pointer",
            }}
          >
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
          {walletError && (
            <div style={{ 
              marginTop: 16, 
              padding: 12, 
              backgroundColor: "#fee2e2", 
              color: "#991b1b", 
              borderRadius: 8,
              fontSize: "0.875rem"
            }}>
              ❌ {walletError}
            </div>
          )}
        </div>
      );
    }

    if (!address || !isOnBase) {
      return null;
    }

    // Step 2: Info
    if (stepState.current === "info") {
      return (
        <div style={{ textAlign: "center" }}>
          <h2 style={{ marginBottom: 16 }}>Get Started</h2>
          <div style={{ 
            padding: 20, 
            backgroundColor: "#f3f4f6", 
            borderRadius: 12, 
            marginBottom: 20,
            textAlign: "left" 
          }}>
            <h3 style={{ fontSize: "1rem", marginBottom: 12, fontWeight: 600 }}>What you'll do:</h3>
            <ul style={{ margin: 0, paddingLeft: 20, color: "#374151" }}>
              <li style={{ marginBottom: 8 }}>
                Wrap <strong>{formatAmount(WRAP_AMOUNT, SUPER_TOKEN_CONFIG.underlyingToken.decimals)} {tokenSymbols.underlying}</strong> + <strong>{formatAmount(FEE_AMOUNT, SUPER_TOKEN_CONFIG.underlyingToken.decimals)} {tokenSymbols.underlying}</strong> gas fee
              </li>
              <li style={{ marginBottom: 8 }}>
                Start a Superfluid stream to the recipient
              </li>
              <li>
                Grant ACL permissions for signature-only stream creation
              </li>
            </ul>
          </div>
          <button
            type="button"
            onClick={proceedToNextStep}
            style={{
              padding: "12px 24px",
              fontSize: "1rem",
              fontWeight: 600,
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Continue
          </button>
        </div>
      );
    }

    // Step 3: Check Balance
    if (stepState.current === "check-balance") {
      return (
        <div>
          <h2 style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            {stepState.hasBalance ? "✅" : stepState.checkingBalance ? "⏳" : "⭕"}
            <span>Step 3: Check {tokenSymbols.underlying} Balance</span>
          </h2>
          {stepState.checkingBalance ? (
            <p style={{ color: "#6b7280" }}>Checking balance...</p>
          ) : stepState.balance !== null ? (
            <div>
              <div style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16 }}>
                {formatAmount(stepState.balance, SUPER_TOKEN_CONFIG.underlyingToken.decimals)} {tokenSymbols.underlying}
              </div>
              {!stepState.hasBalance ? (
                <div>
                  <p style={{ color: "#dc2626", marginBottom: 12 }}>
                    You need at least {formatAmount(TOTAL_REQUIRED, SUPER_TOKEN_CONFIG.underlyingToken.decimals)} {tokenSymbols.underlying} to continue.
                  </p>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <a 
                      href={UNISWAP_USDC_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-block",
                        padding: "10px 20px",
                        backgroundColor: "#ff007a",
                        color: "white",
                        textDecoration: "none",
                        borderRadius: 8,
                        fontWeight: 600,
                      }}
                    >
                      Get {tokenSymbols.underlying} on Uniswap
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setStepState(prev => ({ ...prev, balance: null, checkingBalance: true }));
                      }}
                      style={{
                        padding: "10px 20px",
                        fontSize: "0.9375rem",
                        backgroundColor: "#6b7280",
                        color: "white",
                        border: "none",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      Refresh Balance
                    </button>
                  </div>
                </div>
              ) : (
                <p style={{ color: "#059669", fontWeight: 600 }}>✅ Sufficient balance!</p>
              )}
            </div>
          ) : (
            <p style={{ color: "#6b7280" }}>Unable to check balance</p>
          )}
        </div>
      );
    }

    // Step 4: Check Permissions
    if (stepState.current === "check-permissions") {
      return (
        <div>
          <h2 style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            {stepState.hasPermissions ? "✅" : stepState.checkingPermissions ? "⏳" : "⭕"}
            <span>Step 4: ACL Permissions</span>
          </h2>
          {stepState.checkingPermissions ? (
            <p style={{ color: "#6b7280" }}>Checking permissions...</p>
          ) : stepState.hasPermissions ? (
            <div>
              <p style={{ color: "#059669", fontWeight: 600, marginBottom: 16 }}>✅ Permissions already granted!</p>
              <button
                type="button"
                onClick={() => setStepState(prev => ({ ...prev, current: "request-payment" }))}
                style={{
                  padding: "10px 20px",
                  fontSize: "0.9375rem",
                  backgroundColor: "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Continue
              </button>
            </div>
          ) : (
            <div>
              <p style={{ color: "#6b7280", marginBottom: 16 }}>
                Grant one-time permission for signature-only stream creation (no gas for you!)
              </p>
              <button
                type="button"
                onClick={grantAclPermissions}
                disabled={stepState.grantingPermissions || !stepState.hasBalance}
                style={{
                  padding: "10px 20px",
                  fontSize: "0.9375rem",
                  backgroundColor: stepState.grantingPermissions ? "#9ca3af" : "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: stepState.grantingPermissions ? "not-allowed" : "pointer",
                  fontWeight: 600,
                }}
              >
                {stepState.grantingPermissions ? "Granting..." : "Grant Permissions"}
              </button>
            </div>
          )}
        </div>
      );
    }

    // Step 5: Request Payment
    if (stepState.current === "request-payment") {
      return (
        <div>
          <h2 style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            {stepState.memeImageUrl ? "✅" : stepState.requestingPayment ? "⏳" : "⭕"}
            <span>Step 5: Request Payment</span>
          </h2>
          {stepState.requestingPayment ? (
            <div>
              <p style={{ color: "#6b7280", marginBottom: 16 }}>Please sign the payment authorization in your wallet...</p>
              <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                You'll be signing an EIP-3009 authorization for {formatAmount(TOTAL_REQUIRED, SUPER_TOKEN_CONFIG.underlyingToken.decimals)} {tokenSymbols.underlying}
              </p>
            </div>
          ) : stepState.memeImageUrl ? (
            <div>
              <p style={{ color: "#059669", fontWeight: 600, marginBottom: 16 }}>✅ Payment successful!</p>
            </div>
          ) : (
            <div>
              <p style={{ color: "#6b7280", marginBottom: 16 }}>
                Click below to sign the payment authorization. This will wrap your {tokenSymbols.underlying} and create a stream.
              </p>
              <button
                type="button"
                onClick={requestPayment}
                disabled={!stepState.hasPermissions || !stepState.hasBalance}
                style={{
                  padding: "10px 20px",
                  fontSize: "0.9375rem",
                  backgroundColor: "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Sign & Pay
              </button>
            </div>
          )}
        </div>
      );
    }

    // Step 5: Complete
    if (stepState.current === "complete" && stepState.memeImageUrl) {
      return (
        <div>
          <h2 style={{ marginBottom: 16 }}>🎉 Success!</h2>
          <p style={{ color: "#059669", fontWeight: 600, marginBottom: 20 }}>
            ✅ Payment processed and stream created!
          </p>
          <div style={{ marginTop: 20 }}>
            <img 
              src={stepState.memeImageUrl} 
              alt="Protected meme content" 
              style={{ 
                maxWidth: "100%", 
                borderRadius: 12, 
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)" 
              }} 
            />
            <p style={{ marginTop: 12, fontSize: "0.875rem", color: "#6b7280", textAlign: "center" }}>
              ✅ Access granted via x402 + Superfluid streaming
            </p>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="app-shell">
      <header className="card">
        <h1>Superfluid x402 Wrapper</h1>
        <p>
          Access gated content by wrapping <strong>{tokenSymbols.underlying}</strong> into <strong>{tokenSymbols.superToken}</strong>.
        </p>
        <div className="status-pill">Network: {SUPER_TOKEN_CONFIG.chain.name}</div>
        <div className="status-pill">✨ x402 Spec-Compliant</div>
      </header>

      <section className="card">
        {address && isOnBase && facilitatorAddress && (
          <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #e5e7eb" }}>
            <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>
              Stream recipient: <code style={{ fontSize: "0.875rem", padding: "2px 6px", backgroundColor: "#f3f4f6", borderRadius: 4 }}>{recipientAddress}</code>
            </p>
          </div>
        )}

        {renderStepContent()}

        {stepState.error && (
          <div style={{ 
            marginTop: 20, 
            padding: 12, 
            backgroundColor: "#fee2e2", 
            color: "#991b1b", 
            borderRadius: 8,
            fontSize: "0.875rem"
          }}>
            ❌ {stepState.error}
          </div>
        )}
      </section>

      <footer>
        <p>
          <strong>100% x402-compliant</strong> using official{" "}
          <a href="https://www.npmjs.com/package/x402-axios" target="_blank" rel="noopener noreferrer">
            x402-axios
          </a>{" "}
          package.
        </p>
        <p style={{ fontSize: "0.875rem", marginTop: 8 }}>
          Facilitator uses <strong>"exact"</strong> scheme (EIP-3009) + auto-wraps USDC → USDCx
        </p>
      </footer>
    </div>
  );
}
