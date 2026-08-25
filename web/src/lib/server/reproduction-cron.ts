import "server-only";

import { randomUUID } from "node:crypto";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import { createSubmissionSchema } from "@/lib/validation/schemas";
import {
  getTask,
  attachSubmissionTransaction,
  confirmSubmissionTransaction,
  failSubmissionTransaction,
  reserveTaskFinalization,
} from "./repository";
import { createWalletChallenge } from "./wallet-auth";
import { submitEvidence } from "./submissions";
import {
  createAndFundTestnetWallet,
  sendEvidencePayment,
  verifyTestnetTransaction,
} from "./testnet-wallet";
import { generateEvidence, randomizeEvidence } from "./gemini-evidence";
import {
  createGoogleFormPayload,
  GoogleFormSubmissionError,
  submitGoogleForm,
  type GoogleFormPayload,
} from "./google-form";
import {
  acquireCronLock,
  clearAutomationFinalizationEnvelope,
  currentAutomationWindow,
  getAutomationRun,
  getLatestAutomationRun,
  listAutomationRuns,
  releaseCronLock,
  startAutomationRun,
  updateAutomationRun,
  type AutomationRun,
} from "./automation-runs";
import { explorerTransactionUrl, stellarConfig } from "@/lib/stellar/config";
import type { StructuredEnvironment, TaskDetail } from "@/types/domain";
import {
  finalizeTaskForAutomation,
  recoverAutomatedFinalization,
  validateAutomationMaintainer,
} from "./cron-finalization";

export const DEFAULT_CRON_TASK_ID = "6c2754ab-4201-42b6-87c4-8dc309bf31f1";

function targetTaskId(): string {
  return process.env.CRON_REPRO_TASK_ID?.trim() || DEFAULT_CRON_TASK_ID;
}

function paymentDestination(taskMaintainer: string): string {
  return process.env.CRON_PAYMENT_DESTINATION?.trim() || taskMaintainer;
}

function paymentAmount(): string {
  return process.env.CRON_EVIDENCE_AMOUNT_XLM?.trim() || "0.1";
}

export function selectAutomationEnvironment(
  task: TaskDetail,
): StructuredEnvironment | undefined {
  const reference = task.submissions.find(
    (submission) =>
      submission.eligible &&
      submission.verdict === "REPRODUCED" &&
      (submission.chainStatus ?? "CONFIRMED") === "CONFIRMED",
  )?.environment;
  return reference
    ? { ...reference, dependencies: { ...reference.dependencies } }
    : undefined;
}

async function finishPendingForm(
  run: AutomationRun,
): Promise<Record<string, unknown>> {
  if (!run.formPayload)
    throw new Error("A form-pending run is missing its payload.");
  await updateAutomationRun(run.windowKey, {
    status: "FORM_SUBMITTING",
    error: "",
  });
  try {
    await submitGoogleForm(run.formPayload);
  } catch (error) {
    await updateAutomationRun(run.windowKey, {
      status:
        error instanceof GoogleFormSubmissionError && !error.ambiguous
          ? "FORM_PENDING"
          : "FORM_AMBIGUOUS",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
  const completed = await updateAutomationRun(run.windowKey, {
    status: "COMPLETED",
    formSubmittedAt: new Date().toISOString(),
    error: "",
  });
  return {
    status: "completed",
    window: completed.windowKey,
    wallet: completed.wallet,
    submissionId: completed.submissionId,
    transactionHash: completed.transactionHash,
    finalizationHash: completed.finalizationHash,
    googleForm: "submitted",
  };
}

async function finishHeldForms(
  taskId: string,
  finalizationHash: string,
  preferredWindow?: string,
): Promise<Record<string, unknown>> {
  const held = await listAutomationRuns(taskId, [
    "AWAITING_FINALIZATION",
    "FINALIZATION_PENDING",
    "FORM_PENDING",
  ]);
  const failures: Array<{ window: string; status: string; error: string }> = [];
  let result: Record<string, unknown> = {
    status: "completed",
    finalizationHash,
    googleForm: "no held submissions",
  };
  for (const run of held) {
    const pending = await updateAutomationRun(run.windowKey, {
      status: run.formPayload ? "FORM_PENDING" : "COMPLETED",
      finalizationHash,
      error: "",
    });
    if (!pending.formPayload) continue;
    try {
      const completed = await finishPendingForm(pending);
      if (!preferredWindow || run.windowKey === preferredWindow) {
        result = completed;
      }
    } catch (error) {
      const failed = await getAutomationRun(run.windowKey);
      failures.push({
        window: run.windowKey,
        status: failed?.status ?? "FORM_AMBIGUOUS",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const uncertain = await listAutomationRuns(taskId, [
    "FORM_SUBMITTING",
    "FORM_AMBIGUOUS",
  ]);
  for (const run of uncertain) {
    if (run.status === "FORM_SUBMITTING") {
      await updateAutomationRun(run.windowKey, {
        status: "FORM_AMBIGUOUS",
        error: "The process stopped while the Google Form request outcome was unknown.",
      });
    }
    if (!failures.some((failure) => failure.window === run.windowKey)) {
      failures.push({
        window: run.windowKey,
        status: "FORM_AMBIGUOUS",
        error: run.error ?? "Google Form delivery requires an outcome audit.",
      });
    }
  }
  if (failures.length) {
    return {
      ...result,
      status: "settled_with_form_delivery_pending",
      googleForm: "some responses require retry or outcome audit",
      formFailures: failures,
    };
  }
  return result;
}

async function finishPendingFinalization(
  run: AutomationRun,
): Promise<Record<string, unknown>> {
  let task = await getTask(run.taskId);
  if (!task) {
    throw new Error("Target task not found while finalizing the cron run.");
  }
  if (task.status === "VERIFYING") {
    validateAutomationMaintainer(task);
    task = await reserveTaskFinalization(task.id);
  }
  let finalizationHash = await recoverAutomatedFinalization(
    task,
    run.finalizationHash,
    run.finalizationXdr,
  );
  if (!finalizationHash) {
    if (run.finalizationXdr || run.finalizationHash) {
      await clearAutomationFinalizationEnvelope(run.windowKey, true);
    }
    finalizationHash = await finalizeTaskForAutomation(
      task,
      async (submittedHash, signedXdr) => {
        await updateAutomationRun(run.windowKey, {
          status: "FINALIZATION_PENDING",
          finalizationHash: submittedHash,
          finalizationXdr: signedXdr,
        });
      },
    );
  }
  await updateAutomationRun(run.windowKey, {
    status: "FINALIZATION_PENDING",
    finalizationHash,
    error: "",
  });
  await clearAutomationFinalizationEnvelope(run.windowKey);
  return finishHeldForms(run.taskId, finalizationHash, run.windowKey);
}

async function finishConfirmedSubmission(
  run: AutomationRun,
): Promise<Record<string, unknown>> {
  const task = await getTask(run.taskId);
  if (!task) {
    throw new Error("Target task not found after evidence confirmation.");
  }
  if (
    task.status === "VERIFIED" ||
    task.status === "FINALIZING" ||
    (task.status === "VERIFYING" && task.verification?.thresholdReached)
  ) {
    await updateAutomationRun(run.windowKey, {
      status: "FINALIZATION_PENDING",
    });
    const latest = await getAutomationRun(run.windowKey);
    if (!latest) throw new Error("Finalization-pending cron run disappeared.");
    return finishPendingFinalization(latest);
  }
  const waiting = await updateAutomationRun(run.windowKey, {
    status: "AWAITING_FINALIZATION",
    error: "",
  });
  return {
    status: "awaiting_finalization",
    window: waiting.windowKey,
    wallet: waiting.wallet,
    submissionId: waiting.submissionId,
    transactionHash: waiting.transactionHash,
    googleForm: "held until Soroban finalization and reward distribution succeed",
  };
}

async function recoverPendingSubmission(
  run: AutomationRun,
): Promise<Record<string, unknown> | undefined> {
  if (
    run.status !== "SUBMISSION_PENDING" ||
    !run.submissionId ||
    !run.wallet ||
    !run.transactionHash
  )
    return undefined;
  const task = await getTask(run.taskId);
  if (!task)
    throw new Error("Target task not found while recovering the cron run.");
  await verifyTestnetTransaction(run.transactionHash, run.wallet);
  const explorerUrl = explorerTransactionUrl(run.transactionHash);
  await attachSubmissionTransaction(
    run.submissionId,
    run.taskId,
    run.transactionHash,
    explorerUrl,
  );
  await confirmSubmissionTransaction(
    run.submissionId,
    run.taskId,
    run.transactionHash,
    explorerUrl,
  );
  const latest = await getAutomationRun(run.windowKey);
  if (!latest) throw new Error("Recovered cron run disappeared.");
  return finishConfirmedSubmission(latest);
}

async function continueExistingRun(
  run: AutomationRun,
): Promise<Record<string, unknown> | undefined> {
  if (run.status === "FORM_PENDING") {
    const completed = await finishPendingForm(run);
    const task = await getTask(run.taskId);
    if (task?.status === "VERIFIED" && task.finalizationTx) {
      return finishHeldForms(run.taskId, task.finalizationTx, run.windowKey);
    }
    return completed;
  }
  if (run.status === "FINALIZATION_PENDING") {
    return finishPendingFinalization(run);
  }
  if (run.status === "SUBMISSION_PENDING") {
    if (!run.submissionId || !run.wallet || !run.transactionHash) {
      if (run.submissionId) {
        await failSubmissionTransaction(
          run.submissionId,
          run.taskId,
          "The automated run stopped before a confirmed Testnet transaction was recorded.",
        ).catch(() => undefined);
      }
      await updateAutomationRun(run.windowKey, {
        status: "FAILED",
        error:
          "The automated run stopped before a confirmed Testnet transaction was recorded.",
      });
      return undefined;
    }
    return recoverPendingSubmission(run);
  }
  await updateAutomationRun(run.windowKey, {
    status: "FAILED",
    error: "The automated run stopped before evidence submission was created.",
  });
  return undefined;
}

export async function runAutomatedReproduction(): Promise<
  Record<string, unknown>
> {
  if (stellarConfig.network !== "testnet")
    throw new Error("Automated reproduction is Testnet-only.");
  const taskId = targetTaskId();
  const windowKey = currentAutomationWindow();
  const lockKey = `reprogate-reproduction:${taskId}`;
  const lockToken = await acquireCronLock(lockKey);
  if (!lockToken)
    return {
      status: "skipped",
      reason: "A cron invocation is already running.",
    };

  let pendingSubmissionId: string | undefined;
  let transactionHash: string | undefined;
  let recoveryRun: AutomationRun | undefined;
  try {
    let run = await getAutomationRun(windowKey);
    if (run?.status === "COMPLETED" || run?.status === "AWAITING_FINALIZATION")
      return {
        status: "skipped",
        reason: "This 30-minute window has already submitted its evidence.",
      };
    const pendingRun = await getLatestAutomationRun(taskId);
    if (pendingRun) {
      recoveryRun = pendingRun;
      const recovered = await continueExistingRun(pendingRun);
      if (recovered) return recovered;
      recoveryRun = undefined;
    }

    const task = await getTask(taskId);
    if (!task) throw new Error("Target reproduction task was not found.");
    if (task.status === "VERIFIED" && task.finalizationTx) {
      return finishHeldForms(task.id, task.finalizationTx);
    }
    if (
      task.status !== "OPEN" &&
      task.status !== "VERIFYING" &&
      task.status !== "FINALIZING"
    ) {
      return {
        status: "skipped",
        reason: `Target task is ${task.status}, not accepting evidence.`,
      };
    }
    run = await startAutomationRun(windowKey, taskId);
    if (
      (task.status === "VERIFYING" || task.status === "FINALIZING") &&
      task.verification?.thresholdReached
    ) {
      await updateAutomationRun(windowKey, { status: "FINALIZATION_PENDING" });
      const finalizationRun = await getAutomationRun(windowKey);
      if (!finalizationRun) {
        throw new Error("Finalization-only cron run disappeared.");
      }
      return finishPendingFinalization(finalizationRun);
    }

    const wallet = await createAndFundTestnetWallet();
    const walletAddress = wallet.publicKey();
    await updateAutomationRun(windowKey, { wallet: walletAddress });

    const seed = randomUUID();
    const requiredEnvironment = selectAutomationEnvironment(task);
    const generatedByGemini = await generateEvidence(
      task,
      seed,
      requiredEnvironment,
    );
    const generated = randomizeEvidence(
      requiredEnvironment
        ? { ...generatedByGemini, environment: requiredEnvironment }
        : generatedByGemini,
      seed,
    );
    const input = createSubmissionSchema.parse({
      wallet: walletAddress,
      verdict: generated.verdict,
      environment: generated.environment,
      reproductionSteps: generated.reproductionSteps,
      relevantLogs: generated.relevantLogs,
      notes: generated.notes,
      minimalReproductionUrl: "",
      commitHash: "",
    });
    const formPayload: GoogleFormPayload = createGoogleFormPayload(
      walletAddress,
      generated,
    );
    await updateAutomationRun(windowKey, {
      wallet: walletAddress,
      formPayload,
    });

    const challenge = await createWalletChallenge(
      walletAddress,
      "SUBMIT_EVIDENCE",
      taskId,
      `cron:${windowKey}:${walletAddress}`,
    );
    const signedChallenge = TransactionBuilder.fromXdr(
      challenge.xdr,
      stellarConfig.networkPassphrase,
    );
    signedChallenge.sign(wallet);
    const pending = await submitEvidence(
      taskId,
      input,
      {
        challengeId: challenge.challengeId,
        signedXdr: signedChallenge.toXdr(),
      },
      { chainStatus: "PENDING" },
    );
    pendingSubmissionId = pending.submission.id;
    await updateAutomationRun(windowKey, {
      status: "SUBMISSION_PENDING",
      submissionId: pendingSubmissionId,
    });

    const payment = await sendEvidencePayment(
      wallet,
      paymentDestination(task.maintainerWallet),
      paymentAmount(),
    );
    transactionHash = payment.hash;
    await updateAutomationRun(windowKey, {
      status: "SUBMISSION_PENDING",
      transactionHash,
    });
    await attachSubmissionTransaction(
      pendingSubmissionId,
      taskId,
      payment.hash,
      payment.explorerUrl,
    );
    await confirmSubmissionTransaction(
      pendingSubmissionId,
      taskId,
      payment.hash,
      payment.explorerUrl,
    );
    const latest = await getAutomationRun(windowKey);
    if (!latest)
      throw new Error("Cron run disappeared after transaction confirmation.");
    return finishConfirmedSubmission(latest);
  } catch (error) {
    if (recoveryRun) {
      const current = await getAutomationRun(recoveryRun.windowKey).catch(
        () => undefined,
      );
      await updateAutomationRun(recoveryRun.windowKey, {
        status:
          current?.status === "FORM_PENDING" ||
          current?.status === "FORM_SUBMITTING" ||
          current?.status === "FORM_AMBIGUOUS"
            ? current.status
            : current?.status === "FINALIZATION_PENDING"
              ? "FINALIZATION_PENDING"
            : "SUBMISSION_PENDING",
        error: error instanceof Error ? error.message : String(error),
      }).catch(() => undefined);
      throw error;
    }
    if (pendingSubmissionId && !transactionHash) {
      await failSubmissionTransaction(
        pendingSubmissionId,
        taskId,
        error instanceof Error ? error.message : "Stellar transaction failed.",
      ).catch(() => undefined);
    }
    const current = await getAutomationRun(windowKey).catch(() => undefined);
    const status =
      current?.status === "FORM_PENDING" ||
      current?.status === "FORM_SUBMITTING" ||
      current?.status === "FORM_AMBIGUOUS" ||
      current?.status === "FINALIZATION_PENDING"
        ? current.status
        : transactionHash
          ? "SUBMISSION_PENDING"
          : "FAILED";
    await updateAutomationRun(windowKey, {
      status,
      transactionHash,
      error: error instanceof Error ? error.message : String(error),
    }).catch(() => undefined);
    throw error;
  } finally {
    await releaseCronLock(lockKey, lockToken);
  }
}
