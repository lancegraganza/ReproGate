"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GitHubIssue, ReproTask } from "@/types/domain";
import { useWallet } from "@/features/wallet/wallet-provider";
import { authorizeWalletMutation } from "@/lib/stellar/wallet-authorization";

async function responseJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Request failed.");
  return body;
}

export function CreateTaskForm() {
  const router = useRouter();
  const wallet = useWallet();
  const [issueUrl, setIssueUrl] = useState("");
  const [issue, setIssue] = useState<GitHubIssue>();
  const [importing, setImporting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  async function importIssue() {
    setImporting(true); setError(undefined); setIssue(undefined);
    try {
      const result = await responseJson<{ issue: GitHubIssue }>(
        await fetch(`/api/github/issues?url=${encodeURIComponent(issueUrl)}`),
      );
      setIssue(result.issue);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setImporting(false); }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(undefined);
    if (!wallet.address) { setError("Connect the maintainer wallet before creating a task."); return; }
    const data = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      setError("Authorize this draft in your wallet. The challenge is not submitted and cannot spend XLM.");
      const authorization = await authorizeWalletMutation(
        wallet.address,
        "CREATE_TASK",
        wallet.signTransaction,
      );
      const result = await responseJson<{ task: ReproTask }>(await fetch("/api/tasks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubIssueUrl: issueUrl,
          objective: data.get("objective"), targetEnvironment: data.get("targetEnvironment"),
          reproductionNotes: data.get("reproductionNotes"), threshold: data.get("threshold"),
          deadline: data.get("deadline"), rewardXlm: data.get("rewardXlm"),
          maintainerWallet: wallet.address,
          authorization,
        }),
      }));
      router.push(`/app/tasks/${result.task.id}`); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSubmitting(false); }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <section className="panel stack">
        <div><p className="eyebrow">Step 1 · Public issue</p><h2>Import from GitHub</h2><p className="muted">Public issue metadata is fetched server-side. No GitHub login is required.</p></div>
        <div className="grid-2">
          <label>GitHub issue URL<input type="url" value={issueUrl} onChange={(event) => setIssueUrl(event.target.value)} placeholder="https://github.com/owner/repo/issues/123" required /></label>
          <div className="form-actions"><button type="button" className="button button-secondary" disabled={importing || !issueUrl} onClick={() => void importIssue()}>{importing ? "Importing…" : "Preview issue"}</button></div>
        </div>
        {issue ? <div className="notice notice-success"><strong>{issue.owner}/{issue.repo} #{issue.number}</strong><br />{issue.title}</div> : null}
      </section>

      <section className="panel stack">
        <div><p className="eyebrow">Step 2 · Reproduction brief</p><h2>Define what contributors must verify</h2></div>
        <label>Reproduction objective<textarea name="objective" minLength={20} placeholder="Determine whether the production build crashes only on Node.js 22, and capture the first failing stack frame." required /></label>
        <div className="grid-2">
          <label>Target environment<input name="targetEnvironment" placeholder="Node.js 22 · pnpm 9 · Windows/Linux" required /></label>
          <label>Required confirmations<select name="threshold" defaultValue="2"><option value="2">2 confirmations</option><option value="3">3 confirmations</option><option value="4">4 confirmations</option><option value="5">5 confirmations</option></select></label>
        </div>
        <label>Optional notes<textarea name="reproductionNotes" placeholder="Constraints, known-good versions, commands to try, or evidence expectations." /></label>
      </section>

      <section className="panel stack">
        <div><p className="eyebrow">Step 3 · Reward</p><h2>Set the funded Testnet bounty</h2><p className="muted">The task remains a draft until the XLM vault lock and registry transaction both confirm.</p></div>
        <div className="grid-2">
          <label>Reward (XLM)<input name="rewardXlm" inputMode="decimal" defaultValue="15" required /></label>
          <label>Deadline<input name="deadline" type="datetime-local" required /><span className="field-hint">Between five minutes and 90 days from now.</span></label>
        </div>
        <p className="mono field-hint">Maintainer: {wallet.address ?? "connect wallet"}</p>
      </section>

      {error ? <p className="notice notice-error">{error}</p> : null}
      <div className="form-actions"><button className="button button-primary" disabled={!wallet.address || !issue || submitting}>{submitting ? "Creating draft…" : "Create draft and continue to funding"}</button></div>
    </form>
  );
}
