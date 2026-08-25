// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateEvidence, randomizeEvidence, type GeneratedEvidence } from "./gemini-evidence";

const generated: GeneratedEvidence = {
  verdict: "REPRODUCED",
  environment: {
    operatingSystem: "Android 13",
    runtime: "DeepSeek App",
    runtimeVersion: "2.2.2",
    packageManager: "mobile",
    packageManagerVersion: "2.2.2",
    dependencies: { model: "DeepSeek-LLM" },
  },
  reproductionSteps: "Open the app, send the reported prompt, and inspect the final rendered response.",
  relevantLogs: "Observed the closing output tag rendered at the end of the response.",
  notes: "Synthetic reproduction evidence for the automated Testnet simulation.",
  googleFeedback: "The process was clear and simple.",
};

describe("Gemini evidence randomization", () => {
  it("adds a realistic run-specific variation while preserving the generated context", () => {
    const first = randomizeEvidence(generated, "00000000-0000-4000-8000-000000000001");
    const second = randomizeEvidence(generated, "ffffffff-ffff-4fff-8fff-ffffffffffff");
    expect(first.verdict).toBe("REPRODUCED");
    expect(first.environment).toEqual(generated.environment);
    expect(first.reproductionSteps).not.toBe(second.reproductionSteps);
    expect(first.relevantLogs).toContain("synthetic-trace");
  });
});

describe("Gemini evidence generation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("requests and accepts the structured environment schema", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{
        content: {
          parts: [{ text: JSON.stringify({
            verdict: "REPRODUCED",
            environment: {
              operatingSystem: "Android 14",
              runtime: "DeepSeek App",
              runtimeVersion: "2.2.2",
              packageManager: "mobile",
              packageManagerVersion: "2.2.2",
              dependencies: { model: "DeepSeek-LLM" },
            },
            reproductionSteps: "Open the app, send the reported prompt, and inspect the final response marker.",
            relevantLogs: "Observed the closing output tag rendered at the end of the response.",
            notes: "The result was consistent after reopening the app.",
            googleFeedback: "The flow was clear and easy to follow.",
          }) }],
        },
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateEvidence({
      id: "task-id",
      taskHash: "task-hash",
      githubIssue: {
        owner: "example",
        repo: "project",
        number: 1,
        title: "Example issue",
        body: "The app renders an extra marker.",
        labels: [],
        url: "https://github.com/example/project/issues/1",
        author: "maintainer",
      },
      objective: "Reproduce the extra marker rendering issue.",
      targetEnvironment: "Android 14",
      reproductionNotes: "Use the mobile app and inspect the final response.",
      threshold: 2,
      deadline: "2099-01-01T00:00:00.000Z",
      deadlinePassed: false,
      rewardStroops: "1000000",
      maintainerWallet: "G" + "A".repeat(55),
      status: "OPEN",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      submissionCount: 0,
    }, "seed");

    expect(result.environment.dependencies).toEqual({ model: "DeepSeek-LLM" });
    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(requestBody.generationConfig.responseJsonSchema.properties.environment.type).toBe("object");
    expect(requestBody.generationConfig.responseJsonSchema.properties.environment.properties.dependencies.type).toBe("object");
  });
});
