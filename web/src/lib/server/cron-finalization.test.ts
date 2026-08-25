// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";

vi.mock("server-only", () => ({}));

import { finalizeTaskForAutomation } from "./cron-finalization";
import type { ReproTask } from "@/types/domain";

function finalizableTask(maintainerWallet: string): ReproTask {
  return {
    id: "task-id",
    taskHash: "ab".repeat(32),
    githubIssue: {
      owner: "example",
      repo: "project",
      number: 1,
      title: "Issue",
      body: "Body",
      labels: [],
      url: "https://github.com/example/project/issues/1",
    },
    objective: "Reproduce the issue.",
    targetEnvironment: "Node.js 22",
    reproductionNotes: "",
    threshold: 2,
    deadline: "2099-01-01T00:00:00.000Z",
    deadlinePassed: false,
    rewardStroops: "150000000",
    maintainerWallet,
    status: "FINALIZING",
    verification: {
      classification: "REPRODUCED",
      explanation: "Two independent contributors reproduced the issue.",
      thresholdReached: true,
      groups: [],
      acceptedWallets: [
        Keypair.random().publicKey(),
        Keypair.random().publicKey(),
      ],
      acceptedSubmissionIds: ["submission-a", "submission-b"],
      resultHash: "cd".repeat(32),
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    submissionCount: 2,
  };
}

afterEach(() => vi.unstubAllEnvs());

describe("automated Soroban finalization signer", () => {
  it("requires a server-only maintainer secret", async () => {
    vi.stubEnv("CRON_MAINTAINER_SECRET", "");
    await expect(
      finalizeTaskForAutomation(finalizableTask(Keypair.random().publicKey())),
    ).rejects.toThrow("CRON_MAINTAINER_SECRET is required");
  });

  it("rejects a signer that does not own the target task", async () => {
    vi.stubEnv("CRON_MAINTAINER_SECRET", Keypair.random().secret());
    await expect(
      finalizeTaskForAutomation(finalizableTask(Keypair.random().publicKey())),
    ).rejects.toThrow("does not match the target task maintainer wallet");
  });
});
