import type { TaskStatus } from "@/types/domain";

export type ChainTransactionKind = "FUND" | "REGISTER" | "FINALIZE" | "REFUND";

export interface EventReconciliationPlan {
  status: TaskStatus;
  transactionColumn: "vault_funding_tx" | "registry_tx" | "finalization_tx";
  transactionKind: ChainTransactionKind;
  allowedFrom: TaskStatus[];
}

const plans: Record<string, EventReconciliationPlan> = {
  reward_funded: {
    status: "FUNDING",
    transactionColumn: "vault_funding_tx",
    transactionKind: "FUND",
    allowedFrom: ["DRAFT", "FAILED"],
  },
  task_registered: {
    status: "OPEN",
    transactionColumn: "registry_tx",
    transactionKind: "REGISTER",
    allowedFrom: ["DRAFT", "FUNDING"],
  },
  task_funded: {
    status: "OPEN",
    transactionColumn: "registry_tx",
    transactionKind: "REGISTER",
    allowedFrom: ["DRAFT", "FUNDING"],
  },
  task_verified: {
    status: "VERIFIED",
    transactionColumn: "finalization_tx",
    transactionKind: "FINALIZE",
    allowedFrom: ["OPEN", "VERIFYING", "FINALIZING"],
  },
  task_completed: {
    status: "VERIFIED",
    transactionColumn: "finalization_tx",
    transactionKind: "FINALIZE",
    allowedFrom: ["OPEN", "VERIFYING", "FINALIZING"],
  },
  reward_completed: {
    status: "VERIFIED",
    transactionColumn: "finalization_tx",
    transactionKind: "FINALIZE",
    allowedFrom: ["OPEN", "VERIFYING", "FINALIZING"],
  },
  task_expired: {
    status: "EXPIRED",
    transactionColumn: "finalization_tx",
    transactionKind: "REFUND",
    allowedFrom: ["OPEN", "VERIFYING", "FINALIZING"],
  },
  reward_refunded: {
    status: "EXPIRED",
    transactionColumn: "finalization_tx",
    transactionKind: "REFUND",
    allowedFrom: ["OPEN", "VERIFYING", "FINALIZING"],
  },
};

export function planForContractEvent(eventType: string): EventReconciliationPlan | undefined {
  return plans[eventType];
}
