// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createGoogleFormPayload,
  GoogleFormSubmissionError,
  submitGoogleForm,
} from "./google-form";
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
    expect(payload.email).toMatch(/^[a-z0-9._]+@gmail\.com$/);
    expect(["4", "5"]).toContain(payload.scale);
    expect(payload.feedback.split(/\s+/).length).toBeGreaterThanOrEqual(1);
    expect(payload.feedback.split(/\s+/).length).toBeLessThanOrEqual(20);
  });

  it("generates varied email structures, mostly short feedback, and high ratings", () => {
    const samples = Array.from({ length: 1_000 }, () =>
      createGoogleFormPayload("G" + "A".repeat(55), generated));
    const localParts = samples.map((sample) => sample.email.split("@")[0]!);
    const feedbackLengths = samples.map(
      (sample) => sample.feedback.trim().split(/\s+/).length,
    );
    const ratings = samples.map((sample) => sample.scale);

    expect(new Set(localParts).size).toBeGreaterThan(600);
    expect(localParts.some((value) => value.includes("."))).toBe(true);
    expect(localParts.some((value) => value.includes("_"))).toBe(true);
    expect(localParts.some((value) => !value.includes(".") && !value.includes("_"))).toBe(true);
    expect(localParts.some((value) => /\d/.test(value))).toBe(true);
    expect(localParts.some((value) => !/\d/.test(value))).toBe(true);
    expect(feedbackLengths.every((length) => length >= 1 && length <= 20)).toBe(true);
    expect(feedbackLengths.filter((length) => length <= 6).length).toBeGreaterThan(650);
    expect(new Set(samples.map((sample) => sample.feedback)).size).toBeGreaterThan(25);
    expect(ratings.every((rating) => rating === "4" || rating === "5")).toBe(true);
    expect(ratings.filter((rating) => rating === "5").length).toBeGreaterThan(
      ratings.filter((rating) => rating === "4").length,
    );
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

  it("distinguishes a definite HTTP rejection from an uncertain network outcome", async () => {
    const payload = {
      fullName: "Mika Dalisay",
      email: "mika.dalisay2002@gmail.com",
      wallet: "G" + "A".repeat(55),
      scale: "5",
      feedback: "Good app",
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 500 }),
    );
    const rejected = await submitGoogleForm(payload).catch((error) => error);
    expect(rejected).toBeInstanceOf(GoogleFormSubmissionError);
    expect((rejected as GoogleFormSubmissionError).ambiguous).toBe(false);

    fetchMock.mockRejectedValueOnce(new Error("timeout"));
    const uncertain = await submitGoogleForm(payload).catch((error) => error);
    expect(uncertain).toBeInstanceOf(GoogleFormSubmissionError);
    expect((uncertain as GoogleFormSubmissionError).ambiguous).toBe(true);
  });
});
