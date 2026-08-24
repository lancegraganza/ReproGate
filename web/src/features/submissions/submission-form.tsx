"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/features/wallet/wallet-provider";
import { authorizeWalletMutation } from "@/lib/stellar/wallet-authorization";

export function SubmissionForm({ taskId }: { taskId: string }) {
  const wallet = useWallet(); const router = useRouter();
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>(); const [success, setSuccess] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(undefined); setSuccess(false);
    if (!wallet.address) { setMessage("Connect the student wallet before submitting evidence."); return; }
    const form = event.currentTarget; const data = new FormData(form);
    const dependencies = String(data.get("dependencies") ?? "").split("\n").filter(Boolean).reduce<Record<string,string>>((result, line) => { const [name, ...version] = line.split("@"); if (name.trim() && version.length) result[name.trim()] = version.join("@").trim(); return result; }, {});
    setBusy(true);
    try {
      setMessage("Authorize this evidence in your wallet. The challenge is not submitted and cannot spend XLM.");
      const authorization = await authorizeWalletMutation(
        wallet.address,
        "SUBMIT_EVIDENCE",
        wallet.signTransaction,
        taskId,
      );
      const response = await fetch(`/api/tasks/${taskId}/submissions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        wallet: wallet.address, verdict: data.get("verdict"),
        environment: { operatingSystem: data.get("operatingSystem"), runtime: data.get("runtime"), runtimeVersion: data.get("runtimeVersion"), packageManager: data.get("packageManager"), packageManagerVersion: data.get("packageManagerVersion"), dependencies },
        reproductionSteps: data.get("reproductionSteps"), relevantLogs: data.get("relevantLogs"), notes: data.get("notes"), minimalReproductionUrl: data.get("minimalReproductionUrl"), commitHash: data.get("commitHash"), authorization,
      }) });
      const body = (await response.json()) as { error?: string; submission?: { eligible: boolean; suspiciousReason?: string } };
      if (!response.ok) throw new Error(body.error ?? "Evidence submission failed.");
      setSuccess(true); setMessage(body.submission?.eligible ? "Evidence accepted as an independent submission." : `Evidence stored but excluded: ${body.submission?.suspiciousReason}`);
      form.reset(); router.refresh();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }

  if (!open) return <button className="button button-primary" disabled={!wallet.address} onClick={() => setOpen(true)}>{wallet.address ? "Submit reproduction evidence" : "Connect wallet to submit"}</button>;
  return <form className="panel stack" onSubmit={submit}>
    <div><p className="eyebrow">Independent evidence</p><h2>Submit your reproduction result</h2><p className="muted">Use exact versions and commands. Do not include secrets or private repository data.</p></div>
    <div className="grid-2"><label>Verdict<select name="verdict" defaultValue="REPRODUCED"><option value="REPRODUCED">Reproduced</option><option value="NOT_REPRODUCED">Not reproduced</option></select></label><label>Operating system<input name="operatingSystem" placeholder="Windows 11" required /></label></div>
    <div className="grid-2"><label>Runtime<input name="runtime" placeholder="Node.js" required /></label><label>Runtime version<input name="runtimeVersion" placeholder="22.4.0" required /></label></div>
    <div className="grid-2"><label>Package manager<input name="packageManager" placeholder="pnpm" required /></label><label>Package manager version<input name="packageManagerVersion" placeholder="9.12.0" required /></label></div>
    <label>Relevant dependencies<textarea name="dependencies" placeholder={"next@16.3.2\nreact@19.2.0"} required /><span className="field-hint">One name@version entry per line.</span></label>
    <label>Reproduction steps<textarea name="reproductionSteps" minLength={30} placeholder="1. Clone the public repository…\n2. Install with…\n3. Run…" required /></label>
    <label>Relevant logs<textarea className="mono" name="relevantLogs" minLength={10} placeholder="Paste only the relevant output and stack frames." required /></label>
    <label>Notes<textarea name="notes" minLength={5} placeholder="What you expected, what happened, and any limitations." required /></label>
    <div className="grid-2"><label>Minimal reproduction URL (optional)<input name="minimalReproductionUrl" type="url" /></label><label>Commit hash (optional)<input className="mono" name="commitHash" /></label></div>
    {message ? <p className={`notice ${success ? "notice-success" : "notice-error"}`}>{message}</p> : null}
    <div className="form-actions"><button type="button" className="button button-quiet" onClick={() => setOpen(false)}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? "Comparing evidence…" : "Submit independent evidence"}</button></div>
  </form>;
}
