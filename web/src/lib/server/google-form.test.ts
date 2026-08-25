// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGoogleFormPayload, submitGoogleForm } from "./google-form";
import type { GeneratedEvidence } from "./gemini-evidence";

const generated: GeneratedEvidence = {
  verdict: "REPRODUCED",
  environment: {
    operatingSystem: "Windows 11",
    runtime: "Node.js",
    runtimeVersion: "22",
    packageManager: "pnpm",
    packageManagerVersion: "11",
    dependencies: { next: "16" },
  },
  reproductionSteps: "Install dependencies in a clean workspace and run the reported command.",
  relevantLogs: "Observed the reported failure output.",
  notes: "Synthetic test evidence.",
  googleFeedback: "The form was simple and clear for my test.",
};

afterEach(() => vi.restoreAllMocks());

describe("Google Form automation", () => {
  it("uses the supplied wallet and varied bounded profile values", () => {
    const payload = createGoogleFormPayload("G" + "A".repeat(55), generated);
    expect(payload.wallet).toBe("G" + "A".repeat(55));
    expect(payload.fullName.trim().split(/\s+/).length).toBeGreaterThanOrEqual(2);
    expect(payload.email).toMatch(/^[a-z0-9.]+[0-9]{4}@gmail\.com$/);
    expect(Number(payload.scale)).toBeGreaterThanOrEqual(1);
    expect(Number(payload.scale)).toBeLessThanOrEqual(5);
    expect(payload.feedback.split(/\s+/).length).toBeGreaterThanOrEqual(1);
    expect(payload.feedback.split(/\s+/).length).toBeLessThanOrEqual(20);
  });

  it("only treats a formResponse success or redirect as submitted", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: "https://docs.google.com/forms/d/e/test/formResponse" } }),
    );
    await expect(submitGoogleForm({
      fullName: "Mika Dalisay",
      email: "mika.dalisay2002@gmail.com",
      wallet: "G" + "A".repeat(55),
      scale: "5",
      feedback: "Good app",
    })).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
