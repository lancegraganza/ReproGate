import { createHash } from "node:crypto";
import type {
  Submission,
  VerificationClassification,
  VerificationGroup,
  VerificationResult,
} from "@/types/domain";
import { isValidEnvironment } from "./environment";

function resultHash(result: Omit<VerificationResult, "resultHash">): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        classification: result.classification,
        groups: result.groups.map((group) => ({
          key: group.key,
          verdict: group.verdict,
          wallets: [...group.wallets].sort(),
        })),
        acceptedWallets: [...result.acceptedWallets].sort(),
      }),
    )
    .digest("hex");
}

export function verifySubmissions(
  submissions: Submission[],
  threshold: number,
  deadline: string,
): VerificationResult {
  const deadlineMs = new Date(deadline).getTime();
  const seenWallets = new Set<string>();
  const eligible = submissions.filter((submission) => {
    if (
      !submission.eligible ||
      new Date(submission.createdAt).getTime() > deadlineMs ||
      !isValidEnvironment(submission.environment) ||
      seenWallets.has(submission.wallet)
    ) {
      return false;
    }
    seenWallets.add(submission.wallet);
    return true;
  });

  const grouped = new Map<string, VerificationGroup>();
  for (const submission of eligible) {
    const key = `${submission.verdict}:${submission.normalizedEnvironmentKey}`;
    const group = grouped.get(key) ?? {
      key,
      verdict: submission.verdict,
      environment: submission.environment,
      count: 0,
      wallets: [],
      submissionIds: [],
    };
    group.count += 1;
    group.wallets.push(submission.wallet);
    group.submissionIds.push(submission.id);
    grouped.set(key, group);
  }

  const groups = [...grouped.values()].sort(
    (a, b) => b.count - a.count || a.key.localeCompare(b.key),
  );
  const qualifying = groups.filter((group) => group.count >= threshold);
  const reproduced = qualifying.filter((group) => group.verdict === "REPRODUCED");
  const notReproduced = qualifying.filter((group) => group.verdict === "NOT_REPRODUCED");

  let classification: VerificationClassification = "INSUFFICIENT_EVIDENCE";
  let explanation = `No normalized environment has ${threshold} eligible independent confirmations yet.`;
  let accepted: VerificationGroup | undefined;

  const sameEnvironmentConflict = reproduced.some((positive) =>
    notReproduced.some(
      (negative) =>
        positive.key.replace(/^REPRODUCED:/, "") ===
        negative.key.replace(/^NOT_REPRODUCED:/, ""),
    ),
  );

  if (sameEnvironmentConflict) {
    classification = "CONFLICTING";
    explanation = "The same normalized environment reached the threshold for conflicting verdicts.";
  } else if (reproduced.length > 0 && notReproduced.length > 0) {
    classification = "ENVIRONMENT_SPECIFIC";
    accepted = reproduced[0];
    explanation = `The bug reproduces in ${accepted.environment.runtime} ${accepted.environment.runtimeVersion} but a different environment independently reached NOT_REPRODUCED.`;
  } else if (reproduced.length > 0) {
    classification = "REPRODUCED";
    accepted = reproduced[0];
    explanation = `${accepted.count} independent contributors reproduced the bug in the same normalized environment.`;
  } else if (notReproduced.length > 0) {
    classification = "NOT_REPRODUCED";
    accepted = notReproduced[0];
    explanation = `${accepted.count} independent contributors could not reproduce the bug in the same normalized environment.`;
  } else if (eligible.length >= threshold && groups.length > 1) {
    classification = "CONFLICTING";
    explanation = "There is enough evidence to compare, but submissions disagree across verdicts or environments.";
  }

  const acceptedWallets = accepted?.wallets.slice(0, 5) ?? [];
  const acceptedSubmissionIds = accepted?.submissionIds.slice(0, 5) ?? [];
  const partial = {
    classification,
    explanation,
    thresholdReached: Boolean(accepted) && classification !== "CONFLICTING",
    groups,
    acceptedWallets,
    acceptedSubmissionIds,
  };
  return { ...partial, resultHash: resultHash(partial) };
}
