import { describe, expect, it } from "vitest";
import { evidenceHash, findSuspiciousSimilarity } from "./evidence";

const environment = { operatingSystem: "windows", runtime: "node.js", runtimeVersion: "22", packageManager: "pnpm", packageManagerVersion: "9", dependencies: { next: "16" } };

describe("evidence similarity", () => {
  it("hashes normalized evidence deterministically", () => expect(evidenceHash({ environment, reproductionSteps: " Run   build ", relevantLogs: "ERR\r\nline" })).toBe(evidenceHash({ environment, reproductionSteps: "run build", relevantLogs: "err\nline" })));
  it("flags an identical evidence hash", () => expect(findSuspiciousSimilarity({ evidenceHash: "a", reproductionSteps: "steps", relevantLogs: "logs", normalizedEnvironmentKey: "env" }, [{ evidenceHash: "a", reproductionSteps: "other", relevantLogs: "other", normalizedEnvironmentKey: "other" }])).toBe("Identical evidence hash"));
  it("flags duplicate minimal reproduction URLs", () => expect(findSuspiciousSimilarity({ evidenceHash: "a", reproductionSteps: "a", relevantLogs: "a", minimalReproductionUrl: "https://example.com/repro", normalizedEnvironmentKey: "a" }, [{ evidenceHash: "b", reproductionSteps: "b", relevantLogs: "b", minimalReproductionUrl: "https://example.com/repro", normalizedEnvironmentKey: "b" }])).toBe("Duplicate minimal reproduction URL"));
});

