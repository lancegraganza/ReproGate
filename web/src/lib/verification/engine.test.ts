import { describe, expect, it } from "vitest";
import type { ReproductionVerdict, Submission } from "@/types/domain";
import { environmentKey } from "./environment";
import { verifySubmissions } from "./engine";

const deadline = "2030-01-02T00:00:00.000Z";
const environments = {
  node22: { operatingSystem: "linux", runtime: "node.js", runtimeVersion: "22", packageManager: "pnpm", packageManagerVersion: "9", dependencies: { next: "16" } },
  node20: { operatingSystem: "linux", runtime: "node.js", runtimeVersion: "20", packageManager: "pnpm", packageManagerVersion: "9", dependencies: { next: "16" } },
};

function submission(id: string, wallet: string, verdict: ReproductionVerdict, environment = environments.node22, overrides: Partial<Submission> = {}): Submission {
  return { id, taskId: "task", wallet, verdict, environment, reproductionSteps: `steps ${id}`, relevantLogs: `logs ${id}`, notes: "notes", evidenceHash: `hash-${id}`, normalizedEnvironmentKey: environmentKey(environment), eligible: true, createdAt: "2030-01-01T00:00:00.000Z", ...overrides };
}

describe("independent confirmation engine", () => {
  it("does not verify one reproduction", () => expect(verifySubmissions([submission("1", "G1", "REPRODUCED")], 2, deadline).classification).toBe("INSUFFICIENT_EVIDENCE"));
  it("verifies a reproduced result at threshold", () => { const result = verifySubmissions([submission("1", "G1", "REPRODUCED"), submission("2", "G2", "REPRODUCED")], 2, deadline); expect(result.classification).toBe("REPRODUCED"); expect(result.thresholdReached).toBe(true); expect(result.acceptedWallets).toEqual(["G1", "G2"]); });
  it("verifies a not-reproduced result", () => expect(verifySubmissions([submission("1", "G1", "NOT_REPRODUCED"), submission("2", "G2", "NOT_REPRODUCED")], 2, deadline).classification).toBe("NOT_REPRODUCED"));
  it("detects environment-specific behavior", () => { const result = verifySubmissions([submission("1", "G1", "REPRODUCED"), submission("2", "G2", "REPRODUCED"), submission("3", "G3", "NOT_REPRODUCED", environments.node20), submission("4", "G4", "NOT_REPRODUCED", environments.node20)], 2, deadline); expect(result.classification).toBe("ENVIRONMENT_SPECIFIC"); expect(result.acceptedWallets).toEqual(["G1", "G2"]); });
  it("does not count a duplicate wallet twice", () => expect(verifySubmissions([submission("1", "G1", "REPRODUCED"), submission("2", "G1", "REPRODUCED")], 2, deadline).thresholdReached).toBe(false));
  it("does not count duplicate evidence marked ineligible", () => expect(verifySubmissions([submission("1", "G1", "REPRODUCED"), submission("2", "G2", "REPRODUCED", environments.node22, { eligible: false })], 2, deadline).thresholdReached).toBe(false));
  it("classifies split evidence as conflicting", () => expect(verifySubmissions([submission("1", "G1", "REPRODUCED"), submission("2", "G2", "NOT_REPRODUCED", environments.node20)], 2, deadline).classification).toBe("CONFLICTING"));
  it("excludes submissions after the deadline", () => expect(verifySubmissions([submission("1", "G1", "REPRODUCED"), submission("2", "G2", "REPRODUCED", environments.node22, { createdAt: "2030-01-03T00:00:00.000Z" })], 2, deadline).thresholdReached).toBe(false));
  it("excludes invalid environment data", () => expect(verifySubmissions([submission("1", "G1", "REPRODUCED", { ...environments.node22, runtime: "" }), submission("2", "G2", "REPRODUCED")], 2, deadline).thresholdReached).toBe(false));
});

