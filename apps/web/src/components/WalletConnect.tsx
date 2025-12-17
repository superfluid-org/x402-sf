import { useWallet } from "../contexts/WalletContext";

export const WalletConnect = () => {
  const { address, connect, disconnect, isConnecting, error } = useWallet();

  if (address) {
    const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return (
      <div className="card">
        <p>Connected wallet</p>
        <div className="status-pill success">{shortAddress}</div>
        <div style={{ marginTop: 12 }}>
          <button type="button" onClick={disconnect}>
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <p>Connect your Base Sepolia wallet to wrap funds into a Super Token.</p>
      <button type="button" onClick={connect} disabled={isConnecting}>
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </button>
      {error && <div className="status-pill error" style={{ marginTop: 12 }}>{error}</div>}
    </div>
  );
};
