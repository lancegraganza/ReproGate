"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReproTask, TransactionStatus } from "@/types/domain";
import { useWallet } from "@/features/wallet/wallet-provider";
import { expireTaskReward, finalizeTaskReward, lockTaskReward, registerFundedTask } from "@/lib/stellar/contract-actions";
import { mapTransactionError } from "@/lib/stellar/transaction-state";

export function TaskChainActions({ task }: { task: ReproTask }) {
  const wallet = useWallet(); const router = useRouter();
  const [status, setStatus] = useState<TransactionStatus>("IDLE");
  const [message, setMessage] = useState<string>();
  const isMaintainer = wallet.address === task.maintainerWallet;

  async function record(kind: "FUND" | "REGISTER" | "FINALIZE" | "REFUND", hash: string) {
    const response = await fetch(`/api/tasks/${task.id}/transactions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, hash }) });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(body.error ?? "Could not reconcile confirmed transaction.");
    router.refresh();
  }
  const onStatus = (next: TransactionStatus) => setStatus(next);
  async function run(action: () => Promise<void>) {
    setMessage(undefined);
    try { await action(); setMessage("Confirmed on Stellar and reconciled with ReproGate."); }
    catch (reason) { const mapped = mapTransactionError(reason); setStatus(mapped.status); setMessage(mapped.message); }
  }
  if (!["DRAFT", "FUNDING", "VERIFYING", "OPEN"].includes(task.status)) return null;
  if (!wallet.address) return <p className="notice notice-info">Connect the relevant wallet to continue this task’s on-chain lifecycle.</p>;
  if (!isMaintainer && !["OPEN", "VERIFYING"].includes(task.status)) return null;
  const busy = !["IDLE", "CONFIRMED", "FAILED", "REJECTED", "EXPIRED"].includes(status);

  let label = ""; let action: (() => Promise<void>) | undefined;
  if (task.status === "DRAFT" && isMaintainer) { label = "Lock reward in XLM vault"; action = async () => { const hash = await lockTaskReward(task, { address: wallet.address!, signTransaction: wallet.signTransaction, onStatus }); await record("FUND", hash); }; }
  else if (task.status === "FUNDING" && isMaintainer) { label = "Register funded task"; action = async () => { const hash = await registerFundedTask(task, { address: wallet.address!, signTransaction: wallet.signTransaction, onStatus }); await record("REGISTER", hash); }; }
  else if (task.status === "VERIFYING" && isMaintainer && task.verification?.thresholdReached) { label = "Finalize result and distribute reward"; action = async () => { const hash = await finalizeTaskReward({ taskHash: task.taskHash, resultHash: task.verification!.resultHash, contributors: task.verification!.acceptedWallets }, { address: wallet.address!, signTransaction: wallet.signTransaction, onStatus }); await record("FINALIZE", hash); }; }
  else if (["OPEN", "VERIFYING"].includes(task.status) && task.deadlinePassed) { label = "Expire task and refund maintainer"; action = async () => { const hash = await expireTaskReward(task.taskHash, { address: wallet.address!, signTransaction: wallet.signTransaction, onStatus }); await record("REFUND", hash); }; }
  if (!action) return null;
  return <div className="stack"><button className="button button-primary" disabled={busy} onClick={() => void run(action!)}>{busy ? status.replaceAll("_", " ").toLowerCase() : label}</button>{message ? <p className={`notice ${status === "CONFIRMED" ? "notice-success" : "notice-error"}`}>{message}</p> : null}</div>;
}
