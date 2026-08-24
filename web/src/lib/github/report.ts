import "server-only";

import type { ReproTask } from "@/types/domain";
import { formatXlm } from "@/lib/stellar/amounts";

export function buildGitHubReport(task: ReproTask, appUrl: string): string {
  if (!task.verification) throw new Error("Task has no verification result.");
  const result = task.verification;
  const groups = result.groups
    .map(
      (group) =>
        `- **${group.verdict}** — ${group.environment.runtime} ${group.environment.runtimeVersion} on ${group.environment.operatingSystem}: ${group.count} independent confirmation(s)`,
    )
    .join("\n");
  const transaction = task.finalizationTx
    ? `https://stellar.expert/explorer/testnet/tx/${task.finalizationTx}`
    : "Pending";
  return `## ReproGate Verification

**Status:** ${result.classification.replaceAll("_", " ")}  
**Independent confirmations:** ${result.acceptedWallets.length}  
**Reward distributed:** ${formatXlm(task.rewardStroops)} XLM (Testnet)

${result.explanation}

### Compared environments

${groups || "No qualifying groups."}

### Evidence

- [ReproGate task](${appUrl.replace(/\/$/, "")}/app/tasks/${task.id})
- [Stellar finalization](${transaction})
- Result hash: \`${result.resultHash}\`

_ReproGate did not execute repository or contributor code. Contributors reproduced the issue independently and submitted structured evidence._

<!-- reprogate:${task.id}:${result.resultHash} -->`;
}

export async function postGitHubReport(
  task: ReproTask,
  appUrl: string,
  renewClaim?: () => Promise<void>,
): Promise<string | undefined> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return undefined;
  const commentsUrl = `https://api.github.com/repos/${encodeURIComponent(task.githubIssue.owner)}/${encodeURIComponent(task.githubIssue.repo)}/issues/${task.githubIssue.number}/comments`;
  const marker = `<!-- reprogate:${task.id}:${task.verification?.resultHash} -->`;
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "ReproGate",
  };

  await renewClaim?.();

  for (let page = 1; page <= 10; page += 1) {
    const existingResponse = await fetch(`${commentsUrl}?per_page=100&page=${page}`, { headers });
    if (!existingResponse.ok) {
      throw new Error(`GitHub report lookup failed (${existingResponse.status}).`);
    }
    const comments = (await existingResponse.json()) as Array<{ body?: string; html_url: string }>;
    const existing = comments.find((comment) => comment.body?.includes(marker));
    if (existing) return existing.html_url;
    if (comments.length < 100) break;
  }

  await renewClaim?.();
  const response = await fetch(
    commentsUrl,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: buildGitHubReport(task, appUrl) }),
    },
  );
  if (!response.ok) {
    console.error("GitHub report posting failed", { status: response.status, taskId: task.id });
    throw new Error(`GitHub report posting failed (${response.status}).`);
  }
  const body = (await response.json()) as { html_url: string };
  return body.html_url;
}
