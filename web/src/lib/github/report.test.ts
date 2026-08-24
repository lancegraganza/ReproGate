import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReproTask } from "@/types/domain";
import { buildGitHubReport, postGitHubReport } from "./report";

vi.mock("server-only", () => ({}));

const task: ReproTask = {
  id: "80f6aa7a-9539-4772-a777-b32341874265",
  taskHash: "a".repeat(64),
  githubIssue: {
    owner: "stellar",
    repo: "js-stellar-sdk",
    number: 1000,
    title: "Test issue",
    body: "Test issue body",
    labels: [],
    url: "https://github.com/stellar/js-stellar-sdk/issues/1000",
  },
  objective: "Independently reproduce the reported behavior.",
  targetEnvironment: "Node.js 22",
  reproductionNotes: "",
  threshold: 2,
  deadline: "2026-09-01T00:00:00.000Z",
  deadlinePassed: false,
  rewardStroops: "20000000",
  maintainerWallet: "GCMSETCD3MHRB3WGMBFM7PUG4DBLLV4JG4LUVBK6X7LIZYUQEECN6OCF",
  status: "VERIFIED",
  verification: {
    classification: "REPRODUCED",
    explanation: "Two independent environments reproduced the issue.",
    thresholdReached: true,
    groups: [],
    acceptedWallets: ["GACFITSVOWGLHISQ3N3ZWN3IKP7BDA2KGHRWGP6QYRRLRLC443557YQJ"],
    acceptedSubmissionIds: ["submission-1"],
    resultHash: "b".repeat(64),
  },
  createdAt: "2026-08-24T00:00:00.000Z",
  updatedAt: "2026-08-24T00:00:00.000Z",
  submissionCount: 2,
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GitHub report publication", () => {
  it("embeds a stable idempotency marker", () => {
    expect(buildGitHubReport(task, "https://reprogate.example")).toContain(
      `<!-- reprogate:${task.id}:${task.verification?.resultHash} -->`,
    );
  });

  it("reuses an existing marked comment instead of posting a duplicate", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify([{
        body: buildGitHubReport(task, "https://reprogate.example"),
        html_url: "https://github.com/stellar/js-stellar-sdk/issues/1000#issuecomment-1",
      }]), { status: 200 }),
    );
    await expect(postGitHubReport(task, "https://reprogate.example")).resolves.toContain(
      "issuecomment-1",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).not.toMatchObject({ method: "POST" });
  });
});
