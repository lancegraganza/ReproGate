import { Networks } from "@stellar/stellar-sdk";

export type SupportedNetwork = "testnet" | "local";

function selectedNetwork(): SupportedNetwork {
  const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet";
  if (network === "mainnet" || network === "public") {
    throw new Error("Mainnet is disabled for ReproGate.");
  }
  return network === "local" ? "local" : "testnet";
}

const network = selectedNetwork();

export const stellarConfig = {
  network,
  networkPassphrase:
    network === "local" ? "Standalone Network ; February 2017" : Networks.TESTNET,
  horizonUrl:
    process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL ??
    (network === "local" ? "http://localhost:8000" : "https://horizon-testnet.stellar.org"),
  rpcUrl:
    process.env.NEXT_PUBLIC_STELLAR_RPC_URL ??
    (network === "local"
      ? "http://localhost:8000/soroban/rpc"
      : "https://soroban-testnet.stellar.org"),
  explorerUrl:
    network === "local" ? undefined : "https://stellar.expert/explorer/testnet",
  registryContractId: process.env.NEXT_PUBLIC_REPRO_REGISTRY_CONTRACT_ID,
  vaultContractId: process.env.NEXT_PUBLIC_REWARD_VAULT_CONTRACT_ID,
} as const;

export function explorerTransactionUrl(hash: string): string {
  return stellarConfig.explorerUrl
    ? `${stellarConfig.explorerUrl}/tx/${hash}`
    : `#transaction-${hash}`;
}

export function requireContractIds(): { registry: string; vault: string } {
  if (!stellarConfig.registryContractId || !stellarConfig.vaultContractId) {
    throw new Error("ReproGate contracts are not configured for this environment.");
  }
  return {
    registry: stellarConfig.registryContractId,
    vault: stellarConfig.vaultContractId,
  };
}

