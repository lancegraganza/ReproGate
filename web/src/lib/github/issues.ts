import "server-only";

import type { GitHubIssue } from "@/types/domain";
import { parseGitHubIssueUrl } from "./url";

export async function importGitHubIssue(value: string): Promise<GitHubIssue> {
  const parsed = parseGitHubIssueUrl(value);
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "ReproGate",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/issues/${parsed.number}`,
    { headers, cache: "no-store" },
  );
  if (response.status === 404) throw new Error("GitHub issue was not found or is not public.");
  if (response.status === 403 || response.status === 429) {
    throw new Error("GitHub rate limit reached. Configure GITHUB_TOKEN or retry later.");
  }
  if (!response.ok) throw new Error(`GitHub issue import failed (${response.status}).`);

  const issue = (await response.json()) as {
    title: string;
    body: string | null;
    html_url: string;
    labels: Array<string | { name?: string }>;
    user?: { login?: string };
    pull_request?: unknown;
  };
  if (issue.pull_request) throw new Error("Pull request URLs are not supported; import an issue.");
  return {
    ...parsed,
    title: issue.title,
    body: issue.body ?? "",
    labels: issue.labels
      .map((label) => (typeof label === "string" ? label : label.name ?? ""))
      .filter(Boolean),
    url: issue.html_url,
    author: issue.user?.login,
  };
}
