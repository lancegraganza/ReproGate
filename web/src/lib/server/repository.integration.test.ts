// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";

vi.hoisted(() => {
  process.env.DATABASE_URL = "file::memory:";
});
vi.mock("server-only", () => ({}));

import { getDatabase } from "./database";
import {
  claimGitHubReport,
  attachSubmissionTransaction,
  confirmSubmissionTransaction,
  createSubmission,
  createTask,
  getTask,
  recordTaskTransaction,
  renewGitHubReportClaim,
} from "./repository";

let taskId: string;

beforeAll(async () => {
  const maintainer = Keypair.random().publicKey();
  const task = await createTask(
    {
      githubIssueUrl: "https://github.com/stellar/js-stellar-sdk/issues/1000",
      objective: "Independently reproduce the reported behavior with exact versions.",
      targetEnvironment: "Node.js 22",
      reproductionNotes: "",
      threshold: 2,
      deadline: new Date(Date.now() + 60 * 60_000),
      rewardXlm: "2",
      maintainerWallet: maintainer,
    },
    {
      owner: "stellar",
      repo: "js-stellar-sdk",
      number: 1000,
      title: "Test issue",
      body: "Test body",
      labels: [],
      url: "https://github.com/stellar/js-stellar-sdk/issues/1000",
    },
  );
  taskId = task.id;
  await recordTaskTransaction(taskId, "FUND", "1".repeat(64), "https://example.test/fund");
  await recordTaskTransaction(taskId, "REGISTER", "2".repeat(64), "https://example.test/register");
});

describe.sequential("repository concurrency safeguards", () => {
  it("allows only one concurrently inserted evidence fingerprint to remain eligible", async () => {
    const evidence = {
      verdict: "REPRODUCED" as const,
      environment: {
        operatingSystem: "Windows 11",
        runtime: "Node.js",
        runtimeVersion: "22.14.0",
        packageManager: "pnpm",
        packageManagerVersion: "11.21.0",
        dependencies: { next: "16.3.2" },
      },
      reproductionSteps: "Install exact versions in a clean workspace and execute the documented failure command.",
      relevantLogs: "The same SDK boundary failed with the reported error classification.",
      notes: "Independent clean-room reproduction evidence.",
    };
    await Promise.all([
      createSubmission(taskId, { ...evidence, wallet: Keypair.random().publicKey() }),
      createSubmission(taskId, { ...evidence, wallet: Keypair.random().publicKey() }),
    ]);
    const task = await getTask(taskId);
    expect(task?.submissions.filter((submission) => submission.eligible)).toHaveLength(1);
    expect(task?.submissions.filter((submission) => !submission.eligible)).toHaveLength(1);
  });

  it("reclaims a stale publication lease so marker lookup can recover a crash", async () => {
    const original = await claimGitHubReport(taskId);
    expect(original.claimed).toBe(true);
    await expect(claimGitHubReport(taskId)).rejects.toThrow("already in progress");
    await getDatabase().execute({
      sql: "UPDATE report_publications SET updated_at = ? WHERE task_id = ?",
      args: [new Date(Date.now() - 3 * 60_000).toISOString(), taskId],
    });
    const reclaimed = await claimGitHubReport(taskId);
    expect(reclaimed.claimed).toBe(true);
    if (original.claimed && reclaimed.claimed) {
      await expect(renewGitHubReportClaim(taskId, original.attemptId)).rejects.toThrow("lease was lost");
      await expect(renewGitHubReportClaim(taskId, reclaimed.attemptId)).resolves.toBeUndefined();
    }
  });

  it("keeps cron evidence pending until its Testnet transaction is attached and confirmed", async () => {
    const pending = await createSubmission(taskId, {
      wallet: Keypair.random().publicKey(),
      verdict: "REPRODUCED",
      environment: {
        operatingSystem: "Android 13",
        runtime: "DeepSeek App",
        runtimeVersion: "2.2.2",
        packageManager: "mobile",
        packageManagerVersion: "2.2.2",
        dependencies: { model: "DeepSeek-LLM" },
      },
      reproductionSteps: "Open a clean conversation, disable web search, send a short prompt, and inspect the final rendered response.",
      relevantLogs: "Observed the closing output tag rendered at the end of the response.",
      notes: "Pending cron simulation evidence.",
      minimalReproductionUrl: "",
      commitHash: "",
    }, { chainStatus: "PENDING" });
    expect(pending.submission.chainStatus).toBe("PENDING");
    expect(pending.submission.eligible).toBe(false);
    const hash = "3".repeat(64);
    await attachSubmissionTransaction(pending.submission.id, taskId, hash, `https://stellar.expert/explorer/testnet/tx/${hash}`);
    const confirmed = await confirmSubmissionTransaction(
      pending.submission.id,
      taskId,
      hash,
      `https://stellar.expert/explorer/testnet/tx/${hash}`,
    );
    expect(confirmed.submission.chainStatus).toBe("CONFIRMED");
    expect(confirmed.submission.transactionHash).toBe(hash);
  });
});
