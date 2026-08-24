import { githubIssueUrlSchema } from "@/lib/validation/schemas";

export interface ParsedGitHubIssueUrl {
  owner: string;
  repo: string;
  number: number;
}

export function parseGitHubIssueUrl(value: string): ParsedGitHubIssueUrl {
  const validated = githubIssueUrlSchema.parse(value);
  const url = new URL(validated);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 4 || parts[2] !== "issues" || !/^\d+$/.test(parts[3])) {
    throw new Error("Use a GitHub issue URL like https://github.com/owner/repo/issues/123.");
  }
  return { owner: parts[0], repo: parts[1], number: Number(parts[3]) };
}
