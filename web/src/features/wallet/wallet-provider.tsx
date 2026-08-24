"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Horizon } from "@stellar/stellar-sdk";
import { stellarConfig } from "@/lib/stellar/config";

type WalletState = "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "ERROR";
type BalanceState = "DISCONNECTED" | "LOADING" | "LOADED" | "ERROR";

interface WalletContextValue {
  address?: string;
  state: WalletState;
  balanceState: BalanceState;
  balance?: string;
  networkWarning?: string;
  error?: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  refreshBalance(): Promise<void>;
  signTransaction(xdr: string): Promise<string>;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

async function walletKit() {
  const [{ StellarWalletsKit }, { defaultModules }, { Networks: WalletNetworks }] = await Promise.all([
    import("@creit-tech/stellar-wallets-kit/sdk"),
    import("@creit-tech/stellar-wallets-kit/modules/utils"),
    import("@creit-tech/stellar-wallets-kit/types"),
  ]);
  StellarWalletsKit.init({ modules: defaultModules() });
  StellarWalletsKit.setNetwork(
    stellarConfig.network === "testnet" ? WalletNetworks.TESTNET : WalletNetworks.STANDALONE,
  );
  return StellarWalletsKit;
}

async function verifyWalletNetwork(): Promise<string | undefined> {
  const kit = await walletKit();
  try {
    const network = await kit.getNetwork();
    if (network.networkPassphrase !== stellarConfig.networkPassphrase) {
      throw new Error("Wrong network. Switch your wallet to Stellar Testnet.");
    }
    return undefined;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("does not support")) {
      return "This wallet cannot report its active network. ReproGate will still request a Testnet signature.";
    }
    throw error;
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string>();
  const [state, setState] = useState<WalletState>("DISCONNECTED");
  const [balanceState, setBalanceState] = useState<BalanceState>("DISCONNECTED");
  const [balance, setBalance] = useState<string>();
  const [networkWarning, setNetworkWarning] = useState<string>();
  const [error, setError] = useState<string>();

  const refreshBalanceFor = useCallback(async (walletAddress: string) => {
    setBalanceState("LOADING");
    try {
      const server = new Horizon.Server(stellarConfig.horizonUrl);
      const account = await server.loadAccount(walletAddress);
      const native = account.balances.find((item) => item.asset_type === "native");
      setBalance(native?.balance ?? "0");
      setBalanceState("LOADED");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message.toLowerCase() : "";
      if (message.includes("not found") || message.includes("404")) {
        setBalance("0");
        setBalanceState("LOADED");
      } else {
        setBalanceState("ERROR");
      }
    }
  }, []);

  const connect = useCallback(async () => {
    setState("CONNECTING");
    setError(undefined);
    try {
      const kit = await walletKit();
      const result = await kit.authModal();
      const warning = await verifyWalletNetwork();
      setAddress(result.address);
      setNetworkWarning(warning);
      setState("CONNECTED");
      window.localStorage.setItem("reprogate:wallet-connected", "1");
      await refreshBalanceFor(result.address);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      setError(
        message.toLowerCase().includes("not installed")
          ? "No supported Stellar wallet was found. Install Freighter or choose another wallet."
          : message,
      );
      setState("ERROR");
    }
  }, [refreshBalanceFor]);

  const disconnect = useCallback(async () => {
    try {
      const kit = await walletKit();
      await kit.disconnect();
    } finally {
      setAddress(undefined);
      setBalance(undefined);
      setNetworkWarning(undefined);
      setError(undefined);
      setState("DISCONNECTED");
      setBalanceState("DISCONNECTED");
      window.localStorage.removeItem("reprogate:wallet-connected");
    }
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!address) {
      setBalanceState("DISCONNECTED");
      return;
    }
    await refreshBalanceFor(address);
  }, [address, refreshBalanceFor]);

  const signTransaction = useCallback(
    async (xdr: string) => {
      if (!address) throw new Error("Connect a wallet before signing.");
      await verifyWalletNetwork();
      const kit = await walletKit();
      const signed = await kit.signTransaction(xdr, {
        address,
        networkPassphrase: stellarConfig.networkPassphrase,
      });
      if (!signed.signedTxXdr) throw new Error("Wallet did not return a signed transaction.");
      return signed.signedTxXdr;
    },
    [address],
  );

  useEffect(() => {
    if (window.localStorage.getItem("reprogate:wallet-connected") !== "1") return;
    let cancelled = false;
    void (async () => {
      try {
        const kit = await walletKit();
        const result = await kit.getAddress();
        const warning = await verifyWalletNetwork();
        if (!cancelled && result.address) {
          setAddress(result.address);
          setNetworkWarning(warning);
          setState("CONNECTED");
          await refreshBalanceFor(result.address);
        }
      } catch {
        window.localStorage.removeItem("reprogate:wallet-connected");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshBalanceFor]);

  const value = useMemo<WalletContextValue>(
    () => ({
      address,
      state,
      balanceState,
      balance,
      networkWarning,
      error,
      connect,
      disconnect,
      refreshBalance,
      signTransaction,
    }),
    [
      address,
      balance,
      balanceState,
      connect,
      disconnect,
      error,
      networkWarning,
      refreshBalance,
      signTransaction,
      state,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used inside WalletProvider.");
  return value;
}
