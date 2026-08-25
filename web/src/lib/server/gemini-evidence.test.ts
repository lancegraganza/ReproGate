// @vitest-environment node
import { describe, expect, it } from "vitest";
import { randomizeEvidence, type GeneratedEvidence } from "./gemini-evidence";

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
