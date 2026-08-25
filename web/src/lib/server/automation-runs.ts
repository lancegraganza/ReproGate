import "server-only";

import { randomUUID } from "node:crypto";
import type { GoogleFormPayload } from "./google-form";
import { getDatabase, initializeDatabase } from "./database";

export type AutomationRunStatus =
  | "STARTED"
  | "EVIDENCE_SUBMITTED"
  | "PAYMENT_CONFIRMED"
  | "FINALIZATION_PENDING"
  | "FINALIZING"
  | "FINALIZED"
  | "FORM_PENDING"
  | "FORM_SUBMITTED"
  | "FORM_AMBIGUOUS"
  | "COMPLETED"
  | "FAILED";

export interface AutomationRun {
  windowKey: string;
  taskId: string;
  status: AutomationRunStatus;
  wallet?: string;
  submissionId?: string;
  transactionHash?: string;
  finalizationHash?: string;
  finalizationXdr?: string;
  formPayload?: GoogleFormPayload;
  error?: string;
  createdAt: string;
  updatedAt: string;
  formSubmittedAt?: string;
}

function optional(row: Record<string, unknown>, key: string): string | undefined {
  const value = row[key];
  return value == null || value === "" ? undefined : String(value);
}

function parseRun(row: Record<string, unknown>): AutomationRun {
  const payload = optional(row, "form_payload_json");
  return {
    windowKey: String(row.window_key),
    taskId: String(row.task_id),
    status: String(row.status) as AutomationRunStatus,
    wallet: optional(row, "wallet"),
    submissionId: optional(row, "submission_id"),
    transactionHash: optional(row, "transaction_hash"),
    finalizationHash: optional(row, "finalization_hash"),
    finalizationXdr: optional(row, "finalization_xdr"),
    formPayload: payload ? JSON.parse(payload) as GoogleFormPayload : undefined,
    error: optional(row, "error"),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    formSubmittedAt: optional(row, "form_submitted_at"),
  };
}

export async function acquireCronLock(lockKey: string, ttlMs = 15 * 60_000): Promise<string | undefined> {
  await initializeDatabase();
  const token = randomUUID();
  const now = new Date();
  const result = await getDatabase().execute({
    sql: `INSERT INTO cron_locks (lock_key, token, expires_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(lock_key) DO UPDATE SET token = excluded.token,
        expires_at = excluded.expires_at, updated_at = excluded.updated_at
      WHERE cron_locks.expires_at <= ?`,
    args: [
      lockKey,
      token,
      new Date(now.getTime() + ttlMs).toISOString(),
      now.toISOString(),
      now.toISOString(),
    ],
  });
  return Number(result.rowsAffected) === 1 ? token : undefined;
}

export async function releaseCronLock(lockKey: string, token: string): Promise<void> {
  await initializeDatabase();
  await getDatabase().execute({
    sql: "DELETE FROM cron_locks WHERE lock_key = ? AND token = ?",
    args: [lockKey, token],
  });
}

export function currentAutomationWindow(date = new Date()): string {
  return Math.floor(date.getTime() / (30 * 60_000)).toString();
}

export async function getAutomationRun(windowKey: string): Promise<AutomationRun | undefined> {
  await initializeDatabase();
  const result = await getDatabase().execute({
    sql: "SELECT * FROM automated_reproduction_runs WHERE window_key = ?",
    args: [windowKey],
  });
  return result.rows[0] ? parseRun(result.rows[0] as Record<string, unknown>) : undefined;
}

export async function getLatestAutomationRun(
  taskId: string,
  statuses: AutomationRunStatus[] = [
    "STARTED",
    "EVIDENCE_SUBMITTED",
    "FINALIZATION_PENDING",
    "FINALIZING",
    "FINALIZED",
    "FORM_PENDING",
  ],
): Promise<AutomationRun | undefined> {
  if (!statuses.length) return undefined;
  await initializeDatabase();
  const placeholders = statuses.map(() => "?").join(", ");
  const result = await getDatabase().execute({
    sql: `SELECT * FROM automated_reproduction_runs
      WHERE task_id = ? AND status IN (${placeholders})
      ORDER BY CASE status
        WHEN 'FORM_PENDING' THEN 0
        WHEN 'FINALIZED' THEN 1
        WHEN 'FINALIZING' THEN 2
        WHEN 'FINALIZATION_PENDING' THEN 3
        WHEN 'EVIDENCE_SUBMITTED' THEN 4
        ELSE 5
      END, updated_at DESC LIMIT 1`,
    args: [taskId, ...statuses],
  });
  return result.rows[0] ? parseRun(result.rows[0] as Record<string, unknown>) : undefined;
}

export async function listAutomationRuns(
  taskId: string,
  statuses: AutomationRunStatus[],
): Promise<AutomationRun[]> {
  if (!statuses.length) return [];
  await initializeDatabase();
  const placeholders = statuses.map(() => "?").join(", ");
  const result = await getDatabase().execute({
    sql: `SELECT * FROM automated_reproduction_runs
      WHERE task_id = ? AND status IN (${placeholders})
      ORDER BY created_at ASC`,
    args: [taskId, ...statuses],
  });
  return result.rows.map((row) => parseRun(row as Record<string, unknown>));
}

export async function startAutomationRun(windowKey: string, taskId: string): Promise<AutomationRun> {
  await initializeDatabase();
  const now = new Date().toISOString();
  await getDatabase().execute({
    sql: `INSERT INTO automated_reproduction_runs
      (window_key, task_id, status, created_at, updated_at)
      VALUES (?, ?, 'STARTED', ?, ?)
      ON CONFLICT(window_key) DO UPDATE SET task_id = excluded.task_id,
        status = 'STARTED', wallet = NULL, submission_id = NULL,
        transaction_hash = NULL, finalization_hash = NULL, finalization_xdr = NULL,
        form_payload_json = NULL, error = NULL,
        form_submitted_at = NULL, updated_at = excluded.updated_at`,
    args: [windowKey, taskId, now, now],
  });
  return (await getAutomationRun(windowKey))!;
}

export async function updateAutomationRun(
  windowKey: string,
  patch: Partial<Pick<AutomationRun, "status" | "wallet" | "submissionId" | "transactionHash" | "finalizationHash" | "finalizationXdr" | "formPayload" | "error" | "formSubmittedAt">>,
): Promise<AutomationRun> {
  await initializeDatabase();
  const fields: string[] = ["updated_at = ?"];
  const args: Array<string | null> = [new Date().toISOString()];
  if (patch.status !== undefined) { fields.push("status = ?"); args.push(patch.status); }
  if (patch.wallet !== undefined) { fields.push("wallet = ?"); args.push(patch.wallet); }
  if (patch.submissionId !== undefined) { fields.push("submission_id = ?"); args.push(patch.submissionId); }
  if (patch.transactionHash !== undefined) { fields.push("transaction_hash = ?"); args.push(patch.transactionHash); }
  if (patch.finalizationHash !== undefined) { fields.push("finalization_hash = ?"); args.push(patch.finalizationHash); }
  if (patch.finalizationXdr !== undefined) { fields.push("finalization_xdr = ?"); args.push(patch.finalizationXdr); }
  if (patch.formPayload !== undefined) { fields.push("form_payload_json = ?"); args.push(JSON.stringify(patch.formPayload)); }
  if (patch.error !== undefined) { fields.push("error = ?"); args.push(patch.error.slice(0, 1_000)); }
  if (patch.formSubmittedAt !== undefined) { fields.push("form_submitted_at = ?"); args.push(patch.formSubmittedAt); }
  args.push(windowKey);
  await getDatabase().execute({
    sql: `UPDATE automated_reproduction_runs SET ${fields.join(", ")} WHERE window_key = ?`,
    args,
  });
  return (await getAutomationRun(windowKey))!;
}

export async function clearAutomationFinalizationEnvelope(
  windowKey: string,
  clearHash = false,
): Promise<AutomationRun> {
  await initializeDatabase();
  await getDatabase().execute({
    sql: `UPDATE automated_reproduction_runs
      SET finalization_xdr = NULL,
        finalization_hash = CASE WHEN ? = 1 THEN NULL ELSE finalization_hash END,
        updated_at = ?
      WHERE window_key = ?`,
    args: [clearHash ? 1 : 0, new Date().toISOString(), windowKey],
  });
  return (await getAutomationRun(windowKey))!;
}
