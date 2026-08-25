"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Submission } from "@/types/domain";
import { useWallet } from "@/features/wallet/wallet-provider";

export function MySubmissions() {
  const wallet = useWallet(); const [items, setItems] = useState<Submission[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState<string>();
  useEffect(() => { if (!wallet.address) return; let cancelled = false; void (async () => { await Promise.resolve(); if (cancelled) return; setLoading(true); setError(undefined); try { const response = await fetch(`/api/submissions?wallet=${encodeURIComponent(wallet.address!)}`); const body = await response.json() as { submissions?: Submission[]; error?: string }; if (!response.ok) throw new Error(body.error); if (!cancelled) setItems(body.submissions ?? []); } catch (reason) { if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason)); } finally { if (!cancelled) setLoading(false); } })(); return () => { cancelled = true; }; }, [wallet.address]);
  if (!wallet.address) return <div className="panel empty-state"><div><h2>Connect your student wallet</h2><p className="muted">Your independent submissions are indexed by public wallet address.</p></div></div>;
  if (loading) return <div className="panel empty-state"><div><h2>Loading evidence…</h2></div></div>;
  if (error) return <p className="notice notice-error">{error}</p>;
  if (!items.length) return <div className="panel empty-state"><div><h2>No submissions from this wallet</h2><p className="muted">Browse an open task and submit a structured reproduction result.</p><Link className="button button-primary" href="/app/tasks">Browse tasks</Link></div></div>;
  return <div className="task-list">{items.map((item) => <Link className="task-card" href={`/app/tasks/${item.taskId}`} key={item.id}><div><span className={`verdict ${item.verdict === "REPRODUCED" ? "reproduced" : "not-reproduced"}`}>{item.verdict.replaceAll("_", " ")}</span><h2>{item.environment.runtime} {item.environment.runtimeVersion} · {item.environment.operatingSystem}</h2><p className="mono field-hint">evidence {item.evidenceHash.slice(0, 18)}…</p>{item.transactionHash ? <p className="mono field-hint">Testnet tx {item.transactionHash.slice(0, 18)}…</p> : null}{item.suspiciousReason ? <p className="notice notice-warning">Excluded: {item.suspiciousReason}</p> : null}</div><div className="task-reward"><span className={`status-badge ${item.chainStatus === "PENDING" ? "status-funding" : item.chainStatus === "FAILED" ? "status-failed" : item.eligible ? "status-open" : "status-funding"}`}>{item.chainStatus === "PENDING" ? "Awaiting Testnet tx" : item.chainStatus === "FAILED" ? "Transaction failed" : item.eligible ? "Eligible" : "Flagged"}</span></div></Link>)}</div>;
}
