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

// ---------------------------------------------------------------------------
// Form delivery
// ---------------------------------------------------------------------------

async function finishPendingForm(
  run: AutomationRun,
): Promise<Record<string, unknown>> {
  if (!run.formPayload)
    throw new Error("[FORM] A form-pending run is missing its payload.");
  await updateAutomationRun(run.windowKey, {
    status: "FORM_PENDING",
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
      error: `[FORM] ${error instanceof Error ? error.message : String(error)}`,
    });
    throw error;
  }
  await updateAutomationRun(run.windowKey, {
    status: "FORM_SUBMITTED",
    formSubmittedAt: new Date().toISOString(),
    error: "",
  });
  const completed = await updateAutomationRun(run.windowKey, {
    status: "COMPLETED",
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
    "PAYMENT_CONFIRMED",
    "FINALIZATION_PENDING",
    "FINALIZING",
    "FINALIZED",
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
    "FORM_AMBIGUOUS",
  ]);
  for (const run of uncertain) {
    if (!failures.some((failure) => failure.window === run.windowKey)) {
      failures.push({
        window: run.windowKey,
        status: "FORM_AMBIGUOUS",
        error: run.error ?? "[FORM] Google Form delivery requires an outcome audit.",
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

// ---------------------------------------------------------------------------
// Soroban finalization
// ---------------------------------------------------------------------------

async function finishPendingFinalization(
  run: AutomationRun,
): Promise<Record<string, unknown>> {
  let task = await getTask(run.taskId);
  if (!task) {
    throw new Error("[FINALIZATION] Target task not found while finalizing the cron run.");
  }
  if (task.status === "VERIFYING") {
    validateAutomationMaintainer(task);
    task = await reserveTaskFinalization(task.id);
  }

  // Attempt recovery of a previously checkpointed finalization envelope.
  await updateAutomationRun(run.windowKey, {
    status: "FINALIZING",
    error: "",
  });
  let finalizationHash = await recoverAutomatedFinalization(
    task,
    run.finalizationHash,
    run.finalizationXdr,
  );

  if (!finalizationHash) {
    if (run.finalizationXdr || run.finalizationHash) {
      await clearAutomationFinalizationEnvelope(run.windowKey, true);
    }
    // Prepare and checkpoint the signed envelope before submission.
    finalizationHash = await finalizeTaskForAutomation(
      task,
      async (submittedHash, signedXdr) => {
        await updateAutomationRun(run.windowKey, {
          status: "FINALIZING",
          finalizationHash: submittedHash,
          finalizationXdr: signedXdr,
        });
      },
    );
  }

  // Soroban confirmed and payouts verified.
  await updateAutomationRun(run.windowKey, {
    status: "FINALIZED",
    finalizationHash,
    error: "",
  });
  await clearAutomationFinalizationEnvelope(run.windowKey);
  return finishHeldForms(run.taskId, finalizationHash, run.windowKey);
}

// ---------------------------------------------------------------------------
// Post-payment continuation
// ---------------------------------------------------------------------------

async function finishConfirmedSubmission(
  run: AutomationRun,
): Promise<Record<string, unknown>> {
  const task = await getTask(run.taskId);
  if (!task) {
    throw new Error("[PAYMENT] Target task not found after evidence confirmation.");
  }
  if (run.formPayload) {
    return finishPendingForm(run);
  }
  const completed = await updateAutomationRun(run.windowKey, {
    status: "COMPLETED",
    error: "",
  });
  return {
    status: "completed",
    window: completed.windowKey,
    wallet: completed.wallet,
    submissionId: completed.submissionId,
    transactionHash: completed.transactionHash,
    googleForm: "no form payload",
  };
}

// ---------------------------------------------------------------------------
// Recovery from interrupted runs
// ---------------------------------------------------------------------------

async function recoverPendingSubmission(
  run: AutomationRun,
): Promise<Record<string, unknown> | undefined> {
  if (
    !run.submissionId ||
    !run.wallet ||
    !run.transactionHash
  )
    return undefined;
  const task = await getTask(run.taskId);
  if (!task)
    throw new Error("[PAYMENT] Target task not found while recovering the cron run.");
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
  await updateAutomationRun(run.windowKey, {
    status: "PAYMENT_CONFIRMED",
    error: "",
  });
  const latest = await getAutomationRun(run.windowKey);
  if (!latest) throw new Error("[PAYMENT] Recovered cron run disappeared.");
  return finishConfirmedSubmission(latest);
}

async function continueExistingRun(
  run: AutomationRun,
): Promise<Record<string, unknown> | undefined> {
  switch (run.status) {
    case "FORM_PENDING":
      return finishPendingForm(run);

    case "FORM_SUBMITTED": {
      const completed = await updateAutomationRun(run.windowKey, {
        status: "COMPLETED",
        error: "",
      });
      return {
        status: "completed",
        window: completed.windowKey,
        googleForm: "already submitted",
      };
    }

    case "FINALIZED": {
      const task = await getTask(run.taskId);
      if (task?.status === "VERIFIED" && task.finalizationTx) {
        return finishHeldForms(run.taskId, task.finalizationTx, run.windowKey);
      }
      if (run.formPayload) return finishPendingForm(run);
      return updateAutomationRun(run.windowKey, { status: "COMPLETED", error: "" }).then(
        (completed) => ({ status: "completed", window: completed.windowKey }),
      );
    }

    case "FINALIZING":
    case "FINALIZATION_PENDING":
      return finishPendingFinalization(run);

    case "PAYMENT_CONFIRMED": {
      if (run.formPayload) {
        return finishPendingForm(run);
      }
      return updateAutomationRun(run.windowKey, {
        status: "COMPLETED",
        error: "",
      }).then((completed) => ({
        status: "completed",
        window: completed.windowKey,
        googleForm: "no form payload",
      }));
    }

    case "EVIDENCE_SUBMITTED": {
      if (!run.submissionId || !run.wallet || !run.transactionHash) {
        if (run.submissionId) {
          await failSubmissionTransaction(
            run.submissionId,
            run.taskId,
            "[PAYMENT] The automated run stopped before a confirmed Testnet transaction was recorded.",
          ).catch(() => undefined);
        }
        await updateAutomationRun(run.windowKey, {
          status: "FAILED",
          error:
            "[PAYMENT] The automated run stopped before a confirmed Testnet transaction was recorded.",
        });
        return undefined;
      }
      return recoverPendingSubmission(run);
    }

    case "STARTED":
    default:
      await updateAutomationRun(run.windowKey, {
        status: "FAILED",
        error: "[STARTED] The automated run stopped before evidence submission was created.",
      });
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Main orchestration
// ---------------------------------------------------------------------------

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
    if (
      run?.status === "COMPLETED" ||
      run?.status === "PAYMENT_CONFIRMED" ||
      run?.status === "FORM_SUBMITTED"
    )
      return {
        status: "skipped",
        reason: "This automation window has already submitted its evidence.",
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
    if (
      task.status === "EXPIRED" ||
      task.status === "DRAFT"
    ) {
      return {
        status: "skipped",
        reason: `Target task is ${task.status}, not accepting evidence.`,
      };
    }
    run = await startAutomationRun(windowKey, taskId);

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
      status: "EVIDENCE_SUBMITTED",
      submissionId: pendingSubmissionId,
    });

    const payment = await sendEvidencePayment(
      wallet,
      paymentDestination(task.maintainerWallet),
      paymentAmount(),
    );
    transactionHash = payment.hash;
    await updateAutomationRun(windowKey, {
      status: "PAYMENT_CONFIRMED",
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
      throw new Error("[PAYMENT] Cron run disappeared after transaction confirmation.");
    return finishConfirmedSubmission(latest);
  } catch (error) {
    if (recoveryRun) {
      const current = await getAutomationRun(recoveryRun.windowKey).catch(
        () => undefined,
      );
      await updateAutomationRun(recoveryRun.windowKey, {
        status:
          current?.status === "FORM_PENDING" ||
          current?.status === "FORM_SUBMITTED" ||
          current?.status === "FORM_AMBIGUOUS"
            ? current.status
            : current?.status === "FINALIZING" || current?.status === "FINALIZATION_PENDING"
              ? current.status
            : current?.status === "FINALIZED"
              ? "FINALIZED"
            : "EVIDENCE_SUBMITTED",
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
      current?.status === "FORM_SUBMITTED" ||
      current?.status === "FORM_AMBIGUOUS" ||
      current?.status === "FINALIZING" ||
      current?.status === "FINALIZATION_PENDING" ||
      current?.status === "FINALIZED"
        ? current.status
        : transactionHash
          ? "EVIDENCE_SUBMITTED"
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
