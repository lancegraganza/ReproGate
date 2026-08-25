// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";

vi.hoisted(() => {
  process.env.DATABASE_URL = "file::memory:";
});
vi.mock("server-only", () => ({}));

import { createTask } from "./repository";
import {
  clearAutomationFinalizationEnvelope,
  getLatestAutomationRun,
  listAutomationRuns,
  startAutomationRun,
  updateAutomationRun,
} from "./automation-runs";

describe("automation settlement checkpoints", () => {
  it("holds earlier forms without blocking the next evidence window", async () => {
    const task = await createTask(
      {
        githubIssueUrl: "https://github.com/stellar/js-stellar-sdk/issues/2000",
        objective: "Exercise the automated settlement queue.",
        targetEnvironment: "Node.js 22",
        reproductionNotes: "",
        threshold: 2,
        deadline: new Date(Date.now() + 60 * 60_000),
        rewardXlm: "2",
        maintainerWallet: Keypair.random().publicKey(),
      },
      {
        owner: "stellar",
        repo: "js-stellar-sdk",
        number: 2000,
        title: "Automation checkpoint test",
        body: "Test body",
        labels: [],
        url: "https://github.com/stellar/js-stellar-sdk/issues/2000",
      },
    );
    await startAutomationRun("window-a", task.id);
    await updateAutomationRun("window-a", {
      status: "AWAITING_FINALIZATION",
      formPayload: {
        fullName: "Mika Dalisay",
        email: "mika.dalisay2002@gmail.com",
        wallet: Keypair.random().publicKey(),
        scale: "5",
        feedback: "Easy to use",
      },
    });
    expect(await getLatestAutomationRun(task.id)).toBeUndefined();

    await startAutomationRun("window-b", task.id);
    await updateAutomationRun("window-b", {
      status: "FINALIZATION_PENDING",
      finalizationHash: "a".repeat(64),
      finalizationXdr: "signed-xdr",
    });
    expect((await getLatestAutomationRun(task.id))?.windowKey).toBe("window-b");
    expect(
      (await listAutomationRuns(task.id, ["AWAITING_FINALIZATION"]))
        .map((run) => run.windowKey),
    ).toEqual(["window-a"]);
    const confirmed = await clearAutomationFinalizationEnvelope("window-b");
    expect(confirmed.finalizationHash).toBe("a".repeat(64));
    expect(confirmed.finalizationXdr).toBeUndefined();
  });
});
