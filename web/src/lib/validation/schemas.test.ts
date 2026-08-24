import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { createTaskSchema, createSubmissionSchema } from "./schemas";

const wallet = Keypair.random().publicKey();
const validDeadline = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000).toISOString();

describe("server boundary schemas", () => {
  it("accepts a complete task configuration", () => {
    const result = createTaskSchema.parse({
      githubIssueUrl: "https://github.com/stellar/js-stellar-sdk/issues/123",
      objective: "Verify that the build failure occurs on the named runtime.",
      targetEnvironment: "Node.js 22",
      reproductionNotes: "",
      threshold: 2,
      deadline: validDeadline(),
      rewardXlm: "15.5",
      maintainerWallet: wallet,
    });
    expect(result.threshold).toBe(2);
  });

  it("rejects a threshold outside the MVP range", () => {
    const result = createTaskSchema.safeParse({
      githubIssueUrl: "https://github.com/stellar/js-stellar-sdk/issues/123",
      objective: "Verify that the build failure occurs on the named runtime.",
      targetEnvironment: "Node.js 22",
      reproductionNotes: "",
      threshold: 6,
      deadline: validDeadline(),
      rewardXlm: "15",
      maintainerWallet: wallet,
    });
    expect(result.success).toBe(false);
  });

  it("rejects deadlines beyond the contract storage window", () => {
    const result = createTaskSchema.safeParse({
      githubIssueUrl: "https://github.com/stellar/js-stellar-sdk/issues/123",
      objective: "Verify that the build failure occurs on the named runtime.",
      targetEnvironment: "Node.js 22",
      reproductionNotes: "",
      threshold: 2,
      deadline: new Date(Date.now() + 91 * 24 * 60 * 60 * 1_000).toISOString(),
      rewardXlm: "15",
      maintainerWallet: wallet,
    });
    expect(result.success).toBe(false);
  });

  it("requires at least one reward stroop per contributor", () => {
    const result = createTaskSchema.safeParse({
      githubIssueUrl: "https://github.com/stellar/js-stellar-sdk/issues/123",
      objective: "Verify that the build failure occurs on the named runtime.",
      targetEnvironment: "Node.js 22",
      reproductionNotes: "",
      threshold: 2,
      deadline: validDeadline(),
      rewardXlm: "0.0000001",
      maintainerWallet: wallet,
    });
    expect(result.success).toBe(false);
  });

  it("rejects evidence with incomplete normalized environment fields", () => {
    const result = createSubmissionSchema.safeParse({
      wallet,
      verdict: "REPRODUCED",
      environment: {
        operatingSystem: "Linux",
        runtime: "",
        runtimeVersion: "22",
        packageManager: "pnpm",
        packageManagerVersion: "9",
        dependencies: { next: "16" },
      },
      reproductionSteps: "Run a sufficiently detailed sequence of commands.",
      relevantLogs: "Relevant build failure log",
      notes: "Observed consistently.",
    });
    expect(result.success).toBe(false);
  });
});
