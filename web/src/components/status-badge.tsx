import type { TaskStatus } from "@/types/domain";

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}>{status.replaceAll("_", " ")}</span>;
}

