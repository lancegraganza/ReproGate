import { createHash } from "node:crypto";
import type { StructuredEnvironment } from "@/types/domain";
import { environmentKey } from "./environment";

export function normalizeEvidenceText(value: string): string {
  return value.trim().toLowerCase().replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ");
}

export function evidenceHash(input: {
  environment: StructuredEnvironment;
  reproductionSteps: string;
  relevantLogs: string;
  minimalReproductionUrl?: string;
}): string {
  const canonical = JSON.stringify({
    environment: environmentKey(input.environment),
    reproductionSteps: normalizeEvidenceText(input.reproductionSteps),
    relevantLogs: normalizeEvidenceText(input.relevantLogs),
    minimalReproductionUrl: input.minimalReproductionUrl?.trim().toLowerCase() ?? "",
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export function findSuspiciousSimilarity(
  candidate: {
    evidenceHash: string;
    reproductionSteps: string;
    relevantLogs: string;
    minimalReproductionUrl?: string;
    normalizedEnvironmentKey: string;
  },
  existing: Array<{
    evidenceHash: string;
    reproductionSteps: string;
    relevantLogs: string;
    minimalReproductionUrl?: string;
    normalizedEnvironmentKey: string;
  }>,
): string | undefined {
  for (const submission of existing) {
    if (submission.evidenceHash === candidate.evidenceHash) return "Identical evidence hash";
    if (
      normalizeEvidenceText(submission.reproductionSteps) ===
        normalizeEvidenceText(candidate.reproductionSteps) &&
      normalizeEvidenceText(submission.relevantLogs) === normalizeEvidenceText(candidate.relevantLogs)
    ) {
      return "Identical normalized steps and logs";
    }
    if (
      candidate.minimalReproductionUrl &&
      submission.minimalReproductionUrl?.toLowerCase() ===
        candidate.minimalReproductionUrl.toLowerCase()
    ) {
      return "Duplicate minimal reproduction URL";
    }
    if (
      candidate.normalizedEnvironmentKey === submission.normalizedEnvironmentKey &&
      normalizeEvidenceText(submission.reproductionSteps) ===
        normalizeEvidenceText(candidate.reproductionSteps)
    ) {
      return "Suspiciously identical environment and steps";
    }
  }
  return undefined;
}

