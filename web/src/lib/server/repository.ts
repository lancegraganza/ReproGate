import "server-only";

import { randomUUID } from "node:crypto";
import type { Row } from "@libsql/client";
import type {
  GitHubIssue,
  ReproTask,
  Submission,
  TaskDetail,
  TaskStatus,
  VerificationResult,
} from "@/types/domain";
import type { CreateSubmissionInput, CreateTaskInput } from "@/lib/validation/schemas";
import { xlmToStroops } from "@/lib/stellar/amounts";
import { taskHashForId } from "@/lib/stellar/hashing";
import { environmentKey, normalizeEnvironment } from "@/lib/verification/environment";
import { evidenceHash, findSuspiciousSimilarity } from "@/lib/verification/evidence";
import { verifySubmissions } from "@/lib/verification/engine";
import { assertTaskTransition } from "@/lib/verification/task-state";
import { getDatabase, initializeDatabase } from "./database";

function text(row: Row, key: string): string {
  const value = row[key];
  return value == null ? "" : String(value);
}

function optionalText(row: Row, key: string): string | undefined {
  const value = row[key];
  return value == null || value === "" ? undefined : String(value);
}

function jsonForStorage(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    typeof item === "bigint" ? item.toString() : item,
  );
}

function parseTask(row: Row): ReproTask {
  return {
    id: text(row, "id"),
    taskHash: text(row, "task_hash"),
    githubIssue: JSON.parse(text(row, "github_issue_json")) as GitHubIssue,
    objective: text(row, "objective"),
    targetEnvironment: text(row, "target_environment"),
    reproductionNotes: text(row, "reproduction_notes"),
    threshold: Number(row.threshold),
    deadline: text(row, "deadline"),
    deadlinePassed: new Date(text(row, "deadline")).getTime() <= Date.now(),
    rewardStroops: text(row, "reward_stroops"),
    maintainerWallet: text(row, "maintainer_wallet"),
    status: text(row, "status") as TaskStatus,
    vaultFundingTx: optionalText(row, "vault_funding_tx"),
    registryTx: optionalText(row, "registry_tx"),
    finalizationTx: optionalText(row, "finalization_tx"),
    verification: optionalText(row, "verification_json")
      ? (JSON.parse(text(row, "verification_json")) as VerificationResult)
      : undefined,
    githubReportUrl: optionalText(row, "github_report_url"),
    createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"),
    submissionCount: Number(row.submission_count ?? 0),
  };
}

function parseSubmission(row: Row): Submission {
  return {
    id: text(row, "id"),
    taskId: text(row, "task_id"),
    wallet: text(row, "wallet"),
    verdict: text(row, "verdict") as Submission["verdict"],
    environment: JSON.parse(text(row, "environment_json")),
    reproductionSteps: text(row, "reproduction_steps"),
    relevantLogs: text(row, "relevant_logs"),
    notes: text(row, "notes"),
    minimalReproductionUrl: optionalText(row, "minimal_reproduction_url"),
    commitHash: optionalText(row, "commit_hash"),
    evidenceHash: text(row, "evidence_hash"),
    normalizedEnvironmentKey: text(row, "normalized_environment_key"),
    eligible: Number(row.eligible) === 1,
    suspiciousReason: optionalText(row, "suspicious_reason"),
    chainStatus: (optionalText(row, "chain_status") ?? "CONFIRMED") as Submission["chainStatus"],
    transactionHash: optionalText(row, "transaction_hash"),
    transactionExplorerUrl: optionalText(row, "transaction_explorer_url"),
    createdAt: text(row, "created_at"),
  };
}

export class DuplicateSubmissionError extends Error {
  constructor() {
    super("This wallet already submitted independent evidence for this task.");
  }
}

export type SubmissionChainStatus = "PENDING" | "CONFIRMED";

const PENDING_CHAIN_REASON = "Awaiting Stellar Testnet transaction confirmation.";

export async function createTask(input: CreateTaskInput, issue: GitHubIssue): Promise<ReproTask> {
  await initializeDatabase();
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();
  const taskHash = taskHashForId(id);
  await db.execute({
    sql: `INSERT INTO tasks (
      id, task_hash, github_issue_json, objective, target_environment, reproduction_notes,
      threshold, deadline, reward_stroops, maintainer_wallet, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?)`,
    args: [
      id,
      taskHash,
      JSON.stringify(issue),
      input.objective,
      input.targetEnvironment,
      input.reproductionNotes,
      input.threshold,
      input.deadline.toISOString(),
      xlmToStroops(input.rewardXlm).toString(),
      input.maintainerWallet,
      now,
      now,
    ],
  });
  return (await getTask(id))!;
}

export async function listTasks(options?: {
  status?: TaskStatus;
  wallet?: string;
}): Promise<ReproTask[]> {
  await initializeDatabase();
  const clauses: string[] = [];
  const args: string[] = [];
  if (options?.status) {
    clauses.push("t.status = ?");
    args.push(options.status);
  }
  if (options?.wallet) {
    clauses.push("t.maintainer_wallet = ?");
    args.push(options.wallet);
  }
  const result = await getDatabase().execute({
    sql: `SELECT t.*, COUNT(s.id) AS submission_count
      FROM tasks t LEFT JOIN submissions s ON s.task_id = t.id
      ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
      GROUP BY t.id
      ORDER BY CASE t.status WHEN 'OPEN' THEN 0 WHEN 'VERIFYING' THEN 1 ELSE 2 END,
        t.created_at DESC
      LIMIT 100`,
    args,
  });
  return result.rows.map(parseTask);
}

export async function getTask(id: string): Promise<TaskDetail | undefined> {
  await initializeDatabase();
  const taskResult = await getDatabase().execute({
    sql: `SELECT t.*, COUNT(s.id) AS submission_count
      FROM tasks t LEFT JOIN submissions s ON s.task_id = t.id
      WHERE t.id = ? GROUP BY t.id`,
    args: [id],
  });
  if (!taskResult.rows[0]) return undefined;
  const submissions = await listTaskSubmissions(id);
  return { ...parseTask(taskResult.rows[0]), submissions };
}

export async function getTaskByHash(taskHash: string): Promise<ReproTask | undefined> {
  await initializeDatabase();
  const result = await getDatabase().execute({
    sql: `SELECT t.*, COUNT(s.id) AS submission_count
      FROM tasks t LEFT JOIN submissions s ON s.task_id = t.id
      WHERE t.task_hash = ? GROUP BY t.id`,
    args: [taskHash],
  });
  return result.rows[0] ? parseTask(result.rows[0]) : undefined;
}

export async function listTaskSubmissions(taskId: string): Promise<Submission[]> {
  await initializeDatabase();
  const result = await getDatabase().execute({
    sql: "SELECT * FROM submissions WHERE task_id = ? ORDER BY created_at ASC",
    args: [taskId],
  });
  return result.rows.map(parseSubmission);
}

export async function listWalletSubmissions(wallet: string): Promise<Submission[]> {
  await initializeDatabase();
  const result = await getDatabase().execute({
    sql: "SELECT * FROM submissions WHERE wallet = ? ORDER BY created_at DESC LIMIT 100",
    args: [wallet],
  });
  return result.rows.map(parseSubmission);
}

export async function createSubmission(
  taskId: string,
  input: CreateSubmissionInput,
  options: { chainStatus?: SubmissionChainStatus } = {},
): Promise<{ submission: Submission; verification: VerificationResult }> {
  const task = await getTask(taskId);
  if (!task) throw new Error("Task not found.");
  if (task.status !== "OPEN" && task.status !== "VERIFYING") {
    throw new Error("This task is not accepting evidence.");
  }
  if (new Date(task.deadline).getTime() <= Date.now()) {
    throw new Error("This task has expired.");
  }

  const environment = normalizeEnvironment(input.environment);
  const normalizedEnvironmentKey = environmentKey(environment);
  const hash = evidenceHash({
    environment,
    reproductionSteps: input.reproductionSteps,
    relevantLogs: input.relevantLogs,
    minimalReproductionUrl: input.minimalReproductionUrl || undefined,
  });
  const existing = task.submissions;
  const suspiciousReason = findSuspiciousSimilarity(
    {
      evidenceHash: hash,
      reproductionSteps: input.reproductionSteps,
      relevantLogs: input.relevantLogs,
      minimalReproductionUrl: input.minimalReproductionUrl || undefined,
      normalizedEnvironmentKey,
    },
    existing,
  );

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const chainStatus = options.chainStatus ?? "CONFIRMED";
  const eligible = !suspiciousReason && chainStatus === "CONFIRMED";
  const storedReason = suspiciousReason ?? (chainStatus === "PENDING" ? PENDING_CHAIN_REASON : undefined);
  const insertSubmission = async (eligible: boolean, reason?: string) =>
    getDatabase().execute({
      sql: `INSERT INTO submissions (
        id, task_id, wallet, verdict, environment_json, reproduction_steps, relevant_logs,
        notes, minimal_reproduction_url, commit_hash, evidence_hash, normalized_environment_key,
        eligible, suspicious_reason, chain_status, created_at
      ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        FROM tasks WHERE id = ? AND status IN ('OPEN', 'VERIFYING', 'VERIFIED')`,
      args: [
        id,
        taskId,
        input.wallet,
        input.verdict,
        JSON.stringify(environment),
        input.reproductionSteps,
        input.relevantLogs,
        input.notes,
        input.minimalReproductionUrl || null,
        input.commitHash || null,
        hash,
        normalizedEnvironmentKey,
        eligible ? 1 : 0,
        reason ?? null,
        chainStatus,
        createdAt,
        taskId,
      ],
    });
  try {
    const inserted = await insertSubmission(eligible, storedReason);
    if (Number(inserted.rowsAffected) !== 1) {
      throw new Error("This task is not accepting evidence.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("unique") || message.includes("constraint")) {
      const duplicateWallet = await getDatabase().execute({
        sql: "SELECT 1 FROM submissions WHERE task_id = ? AND wallet = ? LIMIT 1",
        args: [taskId, input.wallet],
      });
      if (duplicateWallet.rows.length) throw new DuplicateSubmissionError();
      const inserted = await insertSubmission(false, chainStatus === "PENDING"
        ? PENDING_CHAIN_REASON
        : "Evidence duplicates an existing eligible submission.");
      if (Number(inserted.rowsAffected) !== 1) {
        throw new Error("This task is not accepting evidence.");
      }
    } else {
      throw error;
    }
  }

  const submissions = await listTaskSubmissions(taskId);
  const verification = verifySubmissions(submissions, task.threshold, task.deadline);
  const nextStatus: TaskStatus = verification.thresholdReached ? "VERIFYING" : "OPEN";
  if (task.status !== nextStatus) assertTaskTransition(task.status, nextStatus);
  await getDatabase().execute({
    sql: "UPDATE tasks SET verification_json = ?, status = ?, updated_at = ? WHERE id = ?",
    args: [JSON.stringify(verification), nextStatus, new Date().toISOString(), taskId],
  });

  return {
    submission: submissions.find((submission) => submission.id === id)!,
    verification,
  };
}

export async function attachSubmissionTransaction(
  submissionId: string,
  taskId: string,
  hash: string,
  explorerUrl: string,
): Promise<void> {
  await initializeDatabase();
  const now = new Date().toISOString();
  const result = await getDatabase().batch(
    [
      {
        sql: `UPDATE submissions SET transaction_hash = ?, transaction_explorer_url = ?
          WHERE id = ? AND task_id = ? AND chain_status = 'PENDING'`,
        args: [hash, explorerUrl, submissionId, taskId],
      },
      {
        sql: `INSERT INTO transaction_references
          (hash, task_id, kind, status, explorer_url, created_at, confirmed_at)
          VALUES (?, ?, 'EVIDENCE', 'PENDING', ?, ?, NULL)
          ON CONFLICT(hash) DO UPDATE SET task_id = excluded.task_id,
            status = 'PENDING', explorer_url = excluded.explorer_url`,
        args: [hash, taskId, explorerUrl, now],
      },
    ],
    "write",
  );
  if (Number(result[0]?.rowsAffected ?? 0) !== 1) {
    const existing = await getDatabase().execute({
      sql: "SELECT transaction_hash FROM submissions WHERE id = ? AND task_id = ?",
      args: [submissionId, taskId],
    });
    if (String(existing.rows[0]?.transaction_hash ?? "") === hash) return;
    throw new Error("Pending evidence submission was not found.");
  }
}

export async function confirmSubmissionTransaction(
  submissionId: string,
  taskId: string,
  hash: string,
  explorerUrl: string,
): Promise<{ submission: Submission; verification: VerificationResult }> {
  await initializeDatabase();
  const task = await getTask(taskId);
  if (!task) throw new Error("Task not found.");
  const current = task.submissions.find((submission) => submission.id === submissionId);
  if (!current) throw new Error("Pending evidence submission was not found.");
  if (current.chainStatus === "CONFIRMED") return { submission: current, verification: verifySubmissions(task.submissions, task.threshold, task.deadline) };
  if (task.status === "FINALIZING") {
    throw new Error("This task has frozen evidence while finalization is in progress.");
  }
  if (current.chainStatus !== "PENDING") throw new Error("Evidence submission is not awaiting confirmation.");

  const candidate = {
    evidenceHash: current.evidenceHash,
    reproductionSteps: current.reproductionSteps,
    relevantLogs: current.relevantLogs,
    minimalReproductionUrl: current.minimalReproductionUrl,
    normalizedEnvironmentKey: current.normalizedEnvironmentKey,
  };
  const existing = task.submissions.filter((submission) => submission.id !== submissionId);
  const suspiciousReason = findSuspiciousSimilarity(candidate, existing);
  const now = new Date().toISOString();
  const eligible = !suspiciousReason;
  try {
    const results = await getDatabase().batch(
      [
        {
          sql: `UPDATE submissions SET chain_status = 'CONFIRMED', eligible = ?, suspicious_reason = ?,
            transaction_hash = ?, transaction_explorer_url = ?
            WHERE id = ? AND task_id = ? AND chain_status = 'PENDING'`,
          args: [eligible ? 1 : 0, suspiciousReason ?? null, hash, explorerUrl, submissionId, taskId],
        },
        {
          sql: `UPDATE transaction_references SET status = 'CONFIRMED', confirmed_at = ?
            WHERE hash = ? AND task_id = ?`,
          args: [now, hash, taskId],
        },
      ],
      "write",
    );
    if (Number(results[0]?.rowsAffected ?? 0) !== 1) {
      throw new Error("Evidence submission was already finalized or is no longer pending.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (!message.includes("unique") && !message.includes("constraint")) throw error;
    await getDatabase().execute({
      sql: `UPDATE submissions SET chain_status = 'CONFIRMED', eligible = 0,
        suspicious_reason = 'Evidence duplicates an existing eligible submission.',
        transaction_hash = ?, transaction_explorer_url = ?
        WHERE id = ? AND task_id = ? AND chain_status = 'PENDING'`,
      args: [hash, explorerUrl, submissionId, taskId],
    });
  }
  const submissions = await listTaskSubmissions(taskId);
  const verification = verifySubmissions(submissions, task.threshold, task.deadline);
  const nextStatus: TaskStatus = task.status === "VERIFIED" ? "VERIFIED" : (verification.thresholdReached ? "VERIFYING" : "OPEN");
  const latestTask = await getTask(taskId);
  if (latestTask && latestTask.status !== nextStatus) assertTaskTransition(latestTask.status, nextStatus);
  await getDatabase().execute({
    sql: "UPDATE tasks SET verification_json = ?, status = ?, updated_at = ? WHERE id = ?",
    args: [JSON.stringify(verification), nextStatus, now, taskId],
  });
  return { submission: submissions.find((submission) => submission.id === submissionId)!, verification };
}

export async function reserveTaskFinalization(taskId: string): Promise<TaskDetail> {
  await initializeDatabase();
  const task = await getTask(taskId);
  if (!task) throw new Error("Task not found.");
  if (
    task.status === "FINALIZING" &&
    task.verification?.thresholdReached
  ) {
    return task;
  }
  if (task.status !== "VERIFYING" || !task.verification?.thresholdReached) {
    throw new Error("Task is not ready for finalization.");
  }
  const verificationJson = JSON.stringify(task.verification);
  const reserved = await getDatabase().execute({
    sql: `UPDATE tasks SET status = 'FINALIZING', updated_at = ?
      WHERE id = ? AND status = 'VERIFYING' AND verification_json = ?
      AND NOT EXISTS (
        SELECT 1 FROM submissions
        WHERE task_id = ? AND chain_status = 'PENDING'
      )`,
    args: [new Date().toISOString(), taskId, verificationJson, taskId],
  });
  if (Number(reserved.rowsAffected) !== 1) {
    throw new Error(
      "Task finalization could not be reserved because evidence is still pending or the verification snapshot changed.",
    );
  }
  return (await getTask(taskId))!;
}

export async function failSubmissionTransaction(submissionId: string, taskId: string, reason: string): Promise<void> {
  await initializeDatabase();
  await getDatabase().execute({
    sql: `UPDATE submissions SET chain_status = 'FAILED', eligible = 0, suspicious_reason = ?
      WHERE id = ? AND task_id = ? AND chain_status = 'PENDING' AND transaction_hash IS NULL`,
    args: [reason.slice(0, 500), submissionId, taskId],
  });
}

export async function recordTaskTransaction(
  taskId: string,
  kind: "FUND" | "REGISTER" | "FINALIZE" | "REFUND",
  hash: string,
  explorerUrl: string,
): Promise<ReproTask> {
  const task = await getTask(taskId);
  if (!task) throw new Error("Task not found.");
  const now = new Date().toISOString();
  let nextStatus: TaskStatus;
  let column: string;
  switch (kind) {
    case "FUND":
      nextStatus = "FUNDING";
      column = "vault_funding_tx";
      break;
    case "REGISTER":
      nextStatus = "OPEN";
      column = "registry_tx";
      break;
    case "FINALIZE":
      nextStatus = "VERIFIED";
      column = "finalization_tx";
      break;
    case "REFUND":
      nextStatus = "EXPIRED";
      column = "finalization_tx";
      break;
  }
  if (task.status !== nextStatus) assertTaskTransition(task.status, nextStatus);
  await getDatabase().batch(
    [
      {
        sql: `UPDATE tasks SET ${column} = ?, status = ?, updated_at = ? WHERE id = ?`,
        args: [hash, nextStatus, now, taskId],
      },
      {
        sql: `INSERT INTO transaction_references
          (hash, task_id, kind, status, explorer_url, created_at, confirmed_at)
          VALUES (?, ?, ?, 'CONFIRMED', ?, ?, ?)
          ON CONFLICT(hash) DO UPDATE SET status = 'CONFIRMED', confirmed_at = excluded.confirmed_at`,
        args: [hash, taskId, kind, explorerUrl, now, now],
      },
    ],
    "write",
  );
  return (await getTask(taskId))!;
}

export async function setGitHubReportUrl(taskId: string, url: string): Promise<void> {
  await initializeDatabase();
  await getDatabase().execute({
    sql: "UPDATE tasks SET github_report_url = ?, updated_at = ? WHERE id = ?",
    args: [url, new Date().toISOString(), taskId],
  });
}

export async function claimGitHubReport(
  taskId: string,
): Promise<{ claimed: true; attemptId: string } | { claimed: false; url: string }> {
  await initializeDatabase();
  const db = getDatabase();
  const now = new Date().toISOString();
  const attemptId = randomUUID();
  const inserted = await db.execute({
    sql: `INSERT OR IGNORE INTO report_publications (task_id, status, attempt_id, updated_at)
      VALUES (?, 'PENDING', ?, ?)`,
    args: [taskId, attemptId, now],
  });
  if (Number(inserted.rowsAffected) === 1) return { claimed: true, attemptId };

  const existing = await db.execute({
    sql: "SELECT status, url, updated_at FROM report_publications WHERE task_id = ?",
    args: [taskId],
  });
  const row = existing.rows[0];
  if (row?.status === "POSTED" && row.url) {
    return { claimed: false, url: String(row.url) };
  }
  if (row?.status === "FAILED") {
    const retried = await db.execute({
      sql: `UPDATE report_publications SET status = 'PENDING', url = NULL, attempt_id = ?, updated_at = ?
        WHERE task_id = ? AND status = 'FAILED'`,
      args: [attemptId, now, taskId],
    });
    if (Number(retried.rowsAffected) === 1) return { claimed: true, attemptId };
  }
  if (
    row?.status === "PENDING" &&
    new Date(String(row.updated_at)).getTime() <= Date.now() - 2 * 60_000
  ) {
    const reclaimed = await db.execute({
      sql: `UPDATE report_publications SET attempt_id = ?, updated_at = ?
        WHERE task_id = ? AND status = 'PENDING' AND updated_at = ?`,
      args: [attemptId, now, taskId, String(row.updated_at)],
    });
    if (Number(reclaimed.rowsAffected) === 1) return { claimed: true, attemptId };
  }
  throw new Error("A GitHub report publication is already in progress. Retry shortly.");
}

export async function renewGitHubReportClaim(taskId: string, attemptId: string): Promise<void> {
  await initializeDatabase();
  const renewed = await getDatabase().execute({
    sql: `UPDATE report_publications SET updated_at = ?
      WHERE task_id = ? AND status = 'PENDING' AND attempt_id = ?`,
    args: [new Date().toISOString(), taskId, attemptId],
  });
  if (Number(renewed.rowsAffected) !== 1) {
    throw new Error("GitHub report publication lease was lost. Retry the request.");
  }
}

export async function completeGitHubReport(
  taskId: string,
  url: string,
  attemptId: string,
): Promise<void> {
  await initializeDatabase();
  const now = new Date().toISOString();
  const results = await getDatabase().batch(
    [
      {
        sql: `UPDATE tasks SET github_report_url = ?, updated_at = ? WHERE id = ?
          AND EXISTS (SELECT 1 FROM report_publications
            WHERE task_id = ? AND status = 'PENDING' AND attempt_id = ?)`,
        args: [url, now, taskId, taskId, attemptId],
      },
      {
        sql: `UPDATE report_publications SET status = 'POSTED', url = ?, updated_at = ?
          WHERE task_id = ? AND status = 'PENDING' AND attempt_id = ?`,
        args: [url, now, taskId, attemptId],
      },
    ],
    "write",
  );
  if (results.some((result) => Number(result.rowsAffected) !== 1)) {
    throw new Error("GitHub report publication lease was lost before completion.");
  }
}

export async function failGitHubReport(taskId: string, attemptId: string): Promise<void> {
  await initializeDatabase();
  await getDatabase().execute({
    sql: `UPDATE report_publications SET status = 'FAILED', updated_at = ?
      WHERE task_id = ? AND status = 'PENDING' AND attempt_id = ?`,
    args: [new Date().toISOString(), taskId, attemptId],
  });
}

export async function recordIndexedEvents(
  events: Array<{
    id: string;
    contractId: string;
    ledger: number;
    payload: unknown;
    eventType?: string;
    taskHash?: string;
    transactionHash?: string;
    explorerUrl?: string;
  }>,
  cursor?: string,
): Promise<{ indexed: number }> {
  await initializeDatabase();
  if (events.length === 0 && !cursor) return { indexed: 0 };
  const now = new Date().toISOString();
  const statements = events.map((event) => ({
    sql: `INSERT OR IGNORE INTO indexed_events
      (event_id, contract_id, ledger, payload_json, created_at) VALUES (?, ?, ?, ?, ?)`,
    args: [event.id, event.contractId, event.ledger, jsonForStorage(event.payload), now],
  }));
  if (cursor) {
    statements.push({
      sql: `INSERT INTO app_state (key, value, updated_at) VALUES ('stellar_event_cursor', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      args: [cursor, now],
    });
  }
  const results = await getDatabase().batch(statements, "write");
  const indexed = results
    .slice(0, events.length)
    .reduce((total, result) => total + Number(result.rowsAffected), 0);
  return { indexed };
}

export async function getEventCursor(): Promise<string | undefined> {
  await initializeDatabase();
  const result = await getDatabase().execute(
    "SELECT value FROM app_state WHERE key = 'stellar_event_cursor'",
  );
  return result.rows[0] ? text(result.rows[0], "value") : undefined;
}
