"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Hex, createWalletClient, custom, type WalletClient } from "viem";
import { base } from "viem/chains";

const BASE_CHAIN_ID_HEX = "0x2105"; // 8453

interface WalletContextState {
  address: Hex | null;
  walletClient: WalletClient | null;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  chainId: number | null;
}

const WalletContext = createContext<WalletContextState | undefined>(undefined);

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  const [address, setAddress] = useState<Hex | null>(null);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setAddress(null);
    setWalletClient(null);
    setChainId(null);
  };

  const ensureBaseNetwork = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      throw new Error("No injected wallet available. Please install Coinbase Wallet or MetaMask.");
    }

    const currentChainId = (await window.ethereum.request({ method: "eth_chainId" })) as string;
    if (currentChainId !== BASE_CHAIN_ID_HEX) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: BASE_CHAIN_ID_HEX }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: BASE_CHAIN_ID_HEX,
                chainName: "Base",
                nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://mainnet.base.org"],
                blockExplorerUrls: ["https://basescan.org"],
              },
            ],
          });
        } else {
          throw switchError;
        }
      }
    }
  };

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("No injected wallet available. Please install Coinbase Wallet or MetaMask.");
      }

      await ensureBaseNetwork();

      const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts returned from wallet");
      }

      const account = accounts[0] as Hex;
      const client = createWalletClient({
        account,
        chain: base,
        transport: custom(window.ethereum),
      });

      setWalletClient(client);
      setAddress(account);
      setChainId(base.id);
    } catch (err: any) {
      setError(err?.message ?? "Failed to connect wallet");
      resetState();
      console.error("Wallet connection failed", err);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    resetState();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) {
      return;
    }

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        resetState();
      } else if (accounts[0] !== address) {
        const account = accounts[0] as Hex;
        const client = createWalletClient({
          account,
          chain: base,
          transport: custom(window.ethereum!),
        });
        setWalletClient(client);
        setAddress(account);
      }
    };

    const handleChainChanged = (hexChainId: string) => {
      const numericChainId = Number(hexChainId);
      setChainId(numericChainId);
      if (numericChainId !== base.id) {
        resetState();
      }
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    (async () => {
      try {
        const accounts = (await window.ethereum!.request({ method: "eth_accounts" })) as string[];
        if (accounts.length > 0) {
          await ensureBaseNetwork();
          const account = accounts[0] as Hex;
          setAddress(account);
          setChainId(base.id);
          const client = createWalletClient({
            account,
            chain: base,
            transport: custom(window.ethereum!),
          });
          setWalletClient(client);
        }
      } catch (err) {
        console.warn("Failed to rehydrate wallet state", err);
      }
    })();

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [address]);

  const value: WalletContextState = {
    address,
    walletClient,
    isConnecting,
    error,
    connect,
    disconnect,
    chainId,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};

