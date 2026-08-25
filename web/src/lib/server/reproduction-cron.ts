import "server-only";

import { randomUUID } from "node:crypto";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import { createSubmissionSchema } from "@/lib/validation/schemas";
import { getTask, attachSubmissionTransaction, confirmSubmissionTransaction, failSubmissionTransaction } from "./repository";
import { createWalletChallenge } from "./wallet-auth";
import { submitEvidence } from "./submissions";
import { createAndFundTestnetWallet, sendEvidencePayment } from "./testnet-wallet";
import { generateEvidence, randomizeEvidence } from "./gemini-evidence";
import { createGoogleFormPayload, submitGoogleForm, type GoogleFormPayload } from "./google-form";
import {
  acquireCronLock,
  currentAutomationWindow,
  getAutomationRun,
  getLatestAutomationRun,
  releaseCronLock,
  startAutomationRun,
  updateAutomationRun,
  type AutomationRun,
} from "./automation-runs";
import { explorerTransactionUrl, stellarConfig } from "@/lib/stellar/config";

export const DEFAULT_CRON_TASK_ID = "a6896709-c73d-4aea-a896-c90437dad8fb";

function targetTaskId(): string {
  return process.env.CRON_REPRO_TASK_ID?.trim() || DEFAULT_CRON_TASK_ID;
}

function paymentDestination(taskMaintainer: string): string {
  return process.env.CRON_PAYMENT_DESTINATION?.trim() || taskMaintainer;
}

function paymentAmount(): string {
  return process.env.CRON_EVIDENCE_AMOUNT_XLM?.trim() || "0.1";
}

async function finishPendingForm(run: AutomationRun): Promise<Record<string, unknown>> {
  if (!run.formPayload) throw new Error("A form-pending run is missing its payload.");
  await submitGoogleForm(run.formPayload);
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
    googleForm: "submitted",
  };
}

async function recoverPendingSubmission(run: AutomationRun): Promise<Record<string, unknown> | undefined> {
  if (run.status !== "SUBMISSION_PENDING" || !run.submissionId || !run.wallet || !run.transactionHash) return undefined;
  const task = await getTask(run.taskId);
  if (!task) throw new Error("Target task not found while recovering the cron run.");
  const explorerUrl = explorerTransactionUrl(run.transactionHash);
  await attachSubmissionTransaction(run.submissionId, run.taskId, run.transactionHash, explorerUrl);
  await confirmSubmissionTransaction(run.submissionId, run.taskId, run.transactionHash, explorerUrl);
  await updateAutomationRun(run.windowKey, { status: "FORM_PENDING" });
  const latest = await getAutomationRun(run.windowKey);
  if (!latest) throw new Error("Recovered cron run disappeared.");
  return finishPendingForm(latest);
}

async function continueExistingRun(run: AutomationRun): Promise<Record<string, unknown> | undefined> {
  if (run.status === "FORM_PENDING") {
    return finishPendingForm(run);
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
        error: "The automated run stopped before a confirmed Testnet transaction was recorded.",
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

export async function runAutomatedReproduction(): Promise<Record<string, unknown>> {
  if (stellarConfig.network !== "testnet") throw new Error("Automated reproduction is Testnet-only.");
  const taskId = targetTaskId();
  const windowKey = currentAutomationWindow();
  const lockKey = `reprogate-reproduction:${taskId}`;
  const lockToken = await acquireCronLock(lockKey);
  if (!lockToken) return { status: "skipped", reason: "A cron invocation is already running." };

  let pendingSubmissionId: string | undefined;
  let transactionHash: string | undefined;
  let recoveryRun: AutomationRun | undefined;
  try {
    let run = await getAutomationRun(windowKey);
    if (run?.status === "COMPLETED") return { status: "skipped", reason: "This 30-minute window is already completed." };
    const pendingRun = await getLatestAutomationRun(taskId);
    if (pendingRun) {
      recoveryRun = pendingRun;
      const recovered = await continueExistingRun(pendingRun);
      if (recovered) return recovered;
      recoveryRun = undefined;
    }

    const task = await getTask(taskId);
    if (!task) throw new Error("Target reproduction task was not found.");
    if (task.status !== "OPEN" && task.status !== "VERIFYING") {
      return { status: "skipped", reason: `Target task is ${task.status}, not accepting evidence.` };
    }
    run = await startAutomationRun(windowKey, taskId);

    const wallet = await createAndFundTestnetWallet();
    const walletAddress = wallet.publicKey();
    await updateAutomationRun(windowKey, { wallet: walletAddress });

    const seed = randomUUID();
    const generated = randomizeEvidence(await generateEvidence(task, seed), seed);
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
    const formPayload: GoogleFormPayload = createGoogleFormPayload(walletAddress, generated);
    await updateAutomationRun(windowKey, { wallet: walletAddress, formPayload });

    const challenge = await createWalletChallenge(
      walletAddress,
      "SUBMIT_EVIDENCE",
      taskId,
      `cron:${windowKey}:${walletAddress}`,
    );
    const signedChallenge = TransactionBuilder.fromXdr(challenge.xdr, stellarConfig.networkPassphrase);
    signedChallenge.sign(wallet);
    const pending = await submitEvidence(
      taskId,
      input,
      { challengeId: challenge.challengeId, signedXdr: signedChallenge.toXdr() },
      { chainStatus: "PENDING" },
    );
    pendingSubmissionId = pending.submission.id;
    await updateAutomationRun(windowKey, { status: "SUBMISSION_PENDING", submissionId: pendingSubmissionId });

    const payment = await sendEvidencePayment(wallet, paymentDestination(task.maintainerWallet), paymentAmount());
    transactionHash = payment.hash;
    await updateAutomationRun(windowKey, { status: "SUBMISSION_PENDING", transactionHash });
    await attachSubmissionTransaction(pendingSubmissionId, taskId, payment.hash, payment.explorerUrl);
    await confirmSubmissionTransaction(pendingSubmissionId, taskId, payment.hash, payment.explorerUrl);
    await updateAutomationRun(windowKey, { status: "FORM_PENDING" });
    const latest = await getAutomationRun(windowKey);
    if (!latest) throw new Error("Cron run disappeared after transaction confirmation.");
    return finishPendingForm(latest);
  } catch (error) {
    if (recoveryRun) {
      const current = await getAutomationRun(recoveryRun.windowKey).catch(() => undefined);
      await updateAutomationRun(recoveryRun.windowKey, {
        status: current?.status === "FORM_PENDING" ? "FORM_PENDING" : "SUBMISSION_PENDING",
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
    await updateAutomationRun(windowKey, {
      status: transactionHash ? "SUBMISSION_PENDING" : "FAILED",
      transactionHash,
      error: error instanceof Error ? error.message : String(error),
    }).catch(() => undefined);
    throw error;
  } finally {
    await releaseCronLock(lockKey, lockToken);
  }
}
