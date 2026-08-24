"use client";

import { useState } from "react";
import { useWallet } from "@/features/wallet/wallet-provider";
import { authorizeWalletMutation } from "@/lib/stellar/wallet-authorization";

export function ReportPanel({ taskId, maintainerWallet, existingUrl }: { taskId: string; maintainerWallet: string; existingUrl?: string }) {
  const wallet = useWallet();
  const [report, setReport] = useState<string>(); const [message, setMessage] = useState<string>(); const [busy, setBusy] = useState(false);
  async function load() { setBusy(true); setMessage(undefined); try { const response = await fetch(`/api/tasks/${taskId}/report`); const body = await response.json() as { report?: string; error?: string }; if (!response.ok) throw new Error(body.error); setReport(body.report); } catch (reason) { setMessage(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); } }
  async function post() { setBusy(true); setMessage(undefined); try { if (wallet.address !== maintainerWallet) throw new Error("Connect the maintainer wallet to post this report."); const authorization = await authorizeWalletMutation(wallet.address, "POST_REPORT", wallet.signTransaction, taskId); const response = await fetch(`/api/tasks/${taskId}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ authorization }) }); const body = await response.json() as { url?: string; error?: string }; if (!response.ok) throw new Error(body.error); setMessage(`Posted to GitHub: ${body.url}`); } catch (reason) { setMessage(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); } }
  const canPost = wallet.address === maintainerWallet;
  return <section className="panel stack"><div><p className="eyebrow">GitHub final report</p><h2>Share the verified result</h2></div>{existingUrl ? <a className="issue-link" href={existingUrl} target="_blank" rel="noreferrer">View posted GitHub comment ↗</a> : null}<div className="form-actions"><button className="button button-quiet" disabled={busy} onClick={() => void load()}>Preview report</button>{!existingUrl ? <button className="button button-primary" disabled={busy || !canPost} onClick={() => void post()}>{canPost ? "Post to GitHub" : "Connect maintainer wallet"}</button> : null}</div>{report ? <pre className="code-block report-preview">{report}</pre> : null}{message ? <p className="notice notice-info">{message}</p> : null}</section>;
}
