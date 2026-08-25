import type { TaskStatus } from "@/types/domain";

const transitions: Record<TaskStatus, TaskStatus[]> = {
  DRAFT: ["FUNDING", "CANCELLED", "FAILED"],
  FUNDING: ["OPEN", "FAILED"],
  OPEN: ["VERIFYING", "EXPIRED", "CANCELLED", "FAILED"],
  VERIFYING: ["OPEN", "FINALIZING", "VERIFIED", "EXPIRED", "FAILED"],
  FINALIZING: ["VERIFIED", "VERIFYING", "EXPIRED", "FAILED"],
  VERIFIED: [],
  EXPIRED: [],
  CANCELLED: [],
  FAILED: ["FUNDING"],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return transitions[from].includes(to);
}

export function assertTaskTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid task transition: ${from} → ${to}`);
  }
}
