import type { TransactionStatus } from "@/types/domain";

export interface MappedTransactionError {
  status: Extract<TransactionStatus, "REJECTED" | "FAILED" | "EXPIRED">;
  message: string;
  contractErrorCode?: number;
  contractErrorName?: string;
  isAlreadyLocked?: boolean;
  isAlreadyRegistered?: boolean;
}

const VAULT_ERRORS: Record<number, { name: string; message: string }> = {
  1: { name: "AlreadyConfigured", message: "The reward vault contract is already configured." },
  2: { name: "NotConfigured", message: "The reward vault contract is not configured." },
  3: { name: "InvalidAmount", message: "The reward amount must be greater than zero." },
  4: { name: "InvalidDeadline", message: "The task deadline must be in the future." },
  5: { name: "RewardExists", message: "This reward is already locked in the vault." },
  6: { name: "RewardNotFound", message: "Reward was not found in the vault." },
  7: { name: "RewardNotFunded", message: "Reward has not been funded in the vault." },
  8: { name: "InvalidContributors", message: "Invalid number of contributors for reward distribution." },
  9: { name: "DuplicateContributor", message: "Duplicate contributor addresses are not allowed." },
  10: { name: "AlreadyPaid", message: "A contributor has already been paid for this task." },
  11: { name: "DeadlinePassed", message: "The task deadline has passed." },
  12: { name: "DeadlineNotReached", message: "The task deadline has not been reached yet." },
  13: { name: "DeadlineTooFar", message: "Task deadline cannot exceed 90 days." },
  14: { name: "AlreadyRegistered", message: "Reward is already registered in the registry." },
  15: { name: "NotRegistered", message: "Reward has not been registered in the registry yet." },
};

const REGISTRY_ERRORS: Record<number, { name: string; message: string }> = {
  1: { name: "AlreadyConfigured", message: "The task registry contract is already configured." },
  2: { name: "NotConfigured", message: "The task registry contract is not configured." },
  3: { name: "InvalidThreshold", message: "Reproduction threshold must be between 2 and 5." },
  4: { name: "InvalidDeadline", message: "The task deadline must be in the future." },
  5: { name: "InvalidReward", message: "The reward amount is invalid or below threshold requirements." },
  6: { name: "TaskExists", message: "This task is already registered in the registry." },
  7: { name: "TaskNotFound", message: "Task was not found in the registry." },
  8: { name: "FundingMismatch", message: "Task funding details do not match the locked reward in the vault." },
  9: { name: "InvalidState", message: "Task is not in the expected state for this operation." },
  10: { name: "DeadlinePassed", message: "The task deadline has passed." },
  11: { name: "DeadlineNotReached", message: "The task deadline has not been reached yet." },
  12: { name: "InvalidContributors", message: "Invalid number of contributors for finalization." },
  13: { name: "DuplicateContributor", message: "Duplicate contributor addresses are not allowed." },
  14: { name: "InvalidResultHash", message: "The verification result hash is invalid." },
  15: { name: "VaultFailure", message: "The vault contract call failed during registry operation." },
  16: { name: "DeadlineTooFar", message: "Task deadline cannot exceed 90 days." },
};

export function mapTransactionError(error: unknown): MappedTransactionError {
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
  if (normalized.includes("network") || normalized.includes("passphrase")) {
    return { status: "FAILED", message: "Switch the wallet to Stellar Testnet and try again." };
  }

  // Parse Soroban contract error codes: Error(Contract, #5) or Error(Contract, 5)
  const contractErrorMatch = message.match(/Error\(Contract,\s*#?(\d+)\)/i);
  if (contractErrorMatch) {
    const code = parseInt(contractErrorMatch[1], 10);
    const isVaultFn =
      normalized.includes("lock") ||
      normalized.includes("refund_unregistered") ||
      normalized.includes("is_paid") ||
      normalized.includes("distribute") ||
      normalized.includes("reward-vault");
    const isRegistryFn =
      normalized.includes("register_task") ||
      normalized.includes("finalize") ||
      normalized.includes("expire") ||
      normalized.includes("set_vault") ||
      normalized.includes("repro-task-registry");

    let mapped: { name: string; message: string } | undefined;
    if (isVaultFn) {
      mapped = VAULT_ERRORS[code];
    } else if (isRegistryFn) {
      mapped = REGISTRY_ERRORS[code];
    } else {
      mapped = VAULT_ERRORS[code] ?? REGISTRY_ERRORS[code];
    }

    const errorName = mapped?.name;
    const errorMsg = mapped?.message ?? `Soroban contract error #${code}.`;
    const isAlreadyLocked = (isVaultFn || !isRegistryFn) && code === 5;
    const isAlreadyRegistered = isRegistryFn && code === 6;

    return {
      status: "FAILED",
      message: errorMsg,
      contractErrorCode: code,
      contractErrorName: errorName,
      isAlreadyLocked,
      isAlreadyRegistered,
    };
  }

  if (normalized.includes("hosterror: error(auth")) {
    return { status: "FAILED", message: "Authorization failed for this wallet signature." };
  }

  return { status: "FAILED", message: message || "The transaction failed." };
}

