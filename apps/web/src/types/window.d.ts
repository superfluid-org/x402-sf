interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on(event: "accountsChanged", listener: (accounts: string[]) => void): void;
  on(event: "chainChanged", listener: (chainId: string) => void): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
  removeListener(event: "accountsChanged", listener: (accounts: string[]) => void): void;
  removeListener(event: "chainChanged", listener: (chainId: string) => void): void;
  removeListener(event: string, listener: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export {};
