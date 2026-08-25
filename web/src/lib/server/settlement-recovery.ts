import "server-only";

import {
  acquireCronLock,
  listAutomationRuns,
  releaseCronLock,
  updateAutomationRun,
  clearAutomationFinalizationEnvelope,
  type AutomationRun,
} from "./automation-runs";
import {
  getTask,
  reserveTaskFinalization,
} from "./repository";
import {
  finalizeTaskForAutomation,
  recoverAutomatedFinalization,
  validateAutomationMaintainer,
} from "./cron-finalization";
import {
  GoogleFormSubmissionError,
  submitGoogleForm,
} from "./google-form";
import { stellarConfig } from "@/lib/stellar/config";

const DEFAULT_TASK_ID = "6c2754ab-4201-42b6-87c4-8dc309bf31f1";

function targetTaskId(): string {
  return process.env.CRON_REPRO_TASK_ID?.trim() || DEFAULT_TASK_ID;
}

// ---------------------------------------------------------------------------
// Form delivery for a single run
// ---------------------------------------------------------------------------

async function settleForm(
  run: AutomationRun,
): Promise<{ window: string; status: string; error?: string }> {
  if (!run.formPayload) {
    await updateAutomationRun(run.windowKey, { status: "COMPLETED", error: "" });
    return { window: run.windowKey, status: "COMPLETED" };
  }
  await updateAutomationRun(run.windowKey, { status: "FORM_PENDING", error: "" });
  try {
    await submitGoogleForm(run.formPayload);
  } catch (error) {
    const status =
      error instanceof GoogleFormSubmissionError && !error.ambiguous
        ? "FORM_PENDING"
        : "FORM_AMBIGUOUS";
    const message = `[FORM] ${error instanceof Error ? error.message : String(error)}`;
    await updateAutomationRun(run.windowKey, { status, error: message });
    return { window: run.windowKey, status, error: message };
  }
  await updateAutomationRun(run.windowKey, {
    status: "FORM_SUBMITTED",
    formSubmittedAt: new Date().toISOString(),
    error: "",
  });
  await updateAutomationRun(run.windowKey, { status: "COMPLETED", error: "" });
  return { window: run.windowKey, status: "COMPLETED" };
}

// ---------------------------------------------------------------------------
// Flush all held forms for a verified task
// ---------------------------------------------------------------------------

async function settleHeldForms(
  taskId: string,
  finalizationHash: string,
): Promise<Array<{ window: string; status: string; error?: string }>> {
  const held = await listAutomationRuns(taskId, [
    "PAYMENT_CONFIRMED",
    "FINALIZATION_PENDING",
    "FINALIZING",
    "FINALIZED",
    "FORM_PENDING",
  ]);
  const outcomes: Array<{ window: string; status: string; error?: string }> = [];
  for (const run of held) {
    await updateAutomationRun(run.windowKey, { finalizationHash });
    outcomes.push(await settleForm(run));
  }
  return outcomes;
}

// ---------------------------------------------------------------------------
// Soroban finalization recovery
// ---------------------------------------------------------------------------

async function settleFinalization(
  run: AutomationRun,
): Promise<string> {
  let task = await getTask(run.taskId);
  if (!task) throw new Error("[SETTLE:FINALIZATION] Target task not found.");

  // If already verified, return the recorded hash.
  if (task.status === "VERIFIED" && task.finalizationTx) {
    await updateAutomationRun(run.windowKey, {
      status: "FINALIZED",
      finalizationHash: task.finalizationTx,
      error: "",
    });
    await clearAutomationFinalizationEnvelope(run.windowKey);
    return task.finalizationTx;
  }

  if (task.status === "VERIFYING") {
    validateAutomationMaintainer(task);
    task = await reserveTaskFinalization(task.id);
  }

  await updateAutomationRun(run.windowKey, { status: "FINALIZING", error: "" });

  // Attempt to recover a checkpointed envelope.
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
          status: "FINALIZING",
          finalizationHash: submittedHash,
          finalizationXdr: signedXdr,
        });
      },
    );
  }

  await updateAutomationRun(run.windowKey, {
    status: "FINALIZED",
    finalizationHash,
    error: "",
  });
  await clearAutomationFinalizationEnvelope(run.windowKey);
  return finalizationHash;
}

// ---------------------------------------------------------------------------
// Main recovery entry point
// ---------------------------------------------------------------------------

export async function runSettlementRecovery(): Promise<
  Record<string, unknown>
> {
  if (stellarConfig.network !== "testnet")
    throw new Error("Settlement recovery is Testnet-only.");

  const taskId = targetTaskId();
  const lockKey = `reprogate-settlement:${taskId}`;
  const lockToken = await acquireCronLock(lockKey, 5 * 60_000);
  if (!lockToken) {
    return { status: "skipped", reason: "A settlement recovery is already running." };
  }

  try {
    // 1. Check if the task is already fully verified; flush any remaining held forms.
    const task = await getTask(taskId);
    if (!task) return { status: "idle", reason: "Target task not found." };
    if (task.status === "VERIFIED" && task.finalizationTx) {
      const outcomes = await settleHeldForms(taskId, task.finalizationTx);
      if (outcomes.length === 0) return { status: "idle", reason: "No pending runs to settle." };
      return { status: "settled_forms", finalizationHash: task.finalizationTx, runs: outcomes };
    }

    // 2. Find the highest-priority stuck run.
    const stuck = await listAutomationRuns(taskId, [
      "FINALIZATION_PENDING",
      "FINALIZING",
      "FINALIZED",
      "FORM_PENDING",
    ]);
    if (stuck.length === 0) {
      // Also check for PAYMENT_CONFIRMED runs where the task has since been verified.
      const waiting = await listAutomationRuns(taskId, ["PAYMENT_CONFIRMED"]);
      if (waiting.length === 0) return { status: "idle" };
      // Task is not yet verified but runs are waiting — nothing to recover.
      return { status: "idle", reason: "Waiting for more evidence before finalization." };
    }

    // Process each stuck run in priority order.
    const finalizationRuns = stuck.filter(
      (run) => run.status === "FINALIZATION_PENDING" || run.status === "FINALIZING",
    );
    const finalizedRuns = stuck.filter((run) => run.status === "FINALIZED");
    const formRuns = stuck.filter((run) => run.status === "FORM_PENDING");

    let finalizationHash: string | undefined;

    // 2a. Recover finalization for the first stuck finalization run.
    if (finalizationRuns.length > 0) {
      const run = finalizationRuns[0]!;
      try {
        finalizationHash = await settleFinalization(run);
      } catch (error) {
        const message = `[SETTLE:FINALIZATION] ${error instanceof Error ? error.message : String(error)}`;
        await updateAutomationRun(run.windowKey, { error: message }).catch(() => undefined);
        throw error;
      }
    }

    // 2b. If we have a finalization hash, flush all held forms.
    if (finalizationHash) {
      const outcomes = await settleHeldForms(taskId, finalizationHash);
      return { status: "settled", finalizationHash, runs: outcomes };
    }

    // 2c. Handle already-finalized runs that just need form delivery.
    if (finalizedRuns.length > 0 || formRuns.length > 0) {
      const fHash = finalizedRuns[0]?.finalizationHash ?? formRuns[0]?.finalizationHash;
      if (fHash) {
        const outcomes = await settleHeldForms(taskId, fHash);
        return { status: "settled_forms", finalizationHash: fHash, runs: outcomes };
      }
    }

    return { status: "idle", reason: "No actionable stuck runs." };
  } finally {
    await releaseCronLock(lockKey, lockToken);
  }
}
