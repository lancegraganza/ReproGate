import type { TransactionStatus } from "@/types/domain";

export function mapTransactionError(error: unknown): {
  status: Extract<TransactionStatus, "REJECTED" | "FAILED" | "EXPIRED">;
  message: string;
} {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (
    normalized.includes("reject") ||
    normalized.includes("declined") ||
    normalized.includes("cancelled by user")
  ) {
    return { status: "REJECTED", message: "Signature request was rejected. Nothing was sent." };
  }
  if (normalized.includes("expired") || normalized.includes("timeout")) {
    return { status: "EXPIRED", message: "The transaction expired before confirmation. Try again." };
  }
  if (normalized.includes("insufficient") || normalized.includes("underfunded")) {
    return { status: "FAILED", message: "The wallet has insufficient spendable XLM." };
  }
  if (normalized.includes("network")) {
    return { status: "FAILED", message: "Switch the wallet to Stellar Testnet and try again." };
  }
  return { status: "FAILED", message: message || "The transaction failed." };
}

