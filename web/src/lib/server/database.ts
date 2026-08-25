import "server-only";

import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

let client: Client | undefined;
let initialization: Promise<void> | undefined;

function databaseUrl(): string {
  const configured = process.env.DATABASE_URL?.trim();
  if (configured) return configured;
  if (process.env.VERCEL) {
    throw new Error(
      "DATABASE_URL is required on Vercel. Configure a remote libSQL database; Vercel storage is not durable.",
    );
  }
  const file = resolve(process.cwd(), ".data", "reprogate.db");
  mkdirSync(dirname(file), { recursive: true });
  return `file:${file.replace(/\\/g, "/")}`;
}

export function getDatabase(): Client {
  if (!client) {
    client = createClient({
      url: databaseUrl(),
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
  }
  return client;
}

export async function initializeDatabase(): Promise<void> {
  if (!initialization) {
    initialization = (async () => {
      const db = getDatabase();
      await db.batch(
        [
          `CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            task_hash TEXT NOT NULL UNIQUE,
            github_issue_json TEXT NOT NULL,
            objective TEXT NOT NULL,
            target_environment TEXT NOT NULL,
            reproduction_notes TEXT NOT NULL DEFAULT '',
            threshold INTEGER NOT NULL CHECK (threshold BETWEEN 2 AND 5),
            deadline TEXT NOT NULL,
            reward_stroops TEXT NOT NULL,
            maintainer_wallet TEXT NOT NULL,
            status TEXT NOT NULL,
            vault_funding_tx TEXT,
            registry_tx TEXT,
            finalization_tx TEXT,
            verification_json TEXT,
            github_report_url TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )`,
          `CREATE TABLE IF NOT EXISTS submissions (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            wallet TEXT NOT NULL,
            verdict TEXT NOT NULL,
            environment_json TEXT NOT NULL,
            reproduction_steps TEXT NOT NULL,
            relevant_logs TEXT NOT NULL,
            notes TEXT NOT NULL,
            minimal_reproduction_url TEXT,
            commit_hash TEXT,
            evidence_hash TEXT NOT NULL,
            normalized_environment_key TEXT NOT NULL,
            eligible INTEGER NOT NULL DEFAULT 1,
            suspicious_reason TEXT,
            created_at TEXT NOT NULL,
            UNIQUE(task_id, wallet)
          )`,
          `CREATE INDEX IF NOT EXISTS submissions_task_idx ON submissions(task_id, created_at)`,
          `CREATE UNIQUE INDEX IF NOT EXISTS submissions_unique_eligible_evidence_idx
            ON submissions(task_id, evidence_hash) WHERE eligible = 1`,
          `CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status, deadline)`,
          `CREATE TABLE IF NOT EXISTS transaction_references (
            hash TEXT PRIMARY KEY,
            task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            kind TEXT NOT NULL,
            status TEXT NOT NULL,
            explorer_url TEXT,
            created_at TEXT NOT NULL,
            confirmed_at TEXT
          )`,
          `CREATE TABLE IF NOT EXISTS indexed_events (
            event_id TEXT PRIMARY KEY,
            contract_id TEXT NOT NULL,
            ledger INTEGER NOT NULL,
            payload_json TEXT NOT NULL,
            created_at TEXT NOT NULL
          )`,
          `CREATE TABLE IF NOT EXISTS report_publications (
            task_id TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
            status TEXT NOT NULL,
            url TEXT,
            attempt_id TEXT,
            updated_at TEXT NOT NULL
          )`,
          `CREATE TABLE IF NOT EXISTS app_state (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )`,
          `CREATE TABLE IF NOT EXISTS wallet_challenges (
            id TEXT PRIMARY KEY,
            wallet TEXT NOT NULL,
            purpose TEXT NOT NULL,
            task_id TEXT,
            unsigned_xdr TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            used_at TEXT,
            created_at TEXT NOT NULL
          )`,
          `CREATE INDEX IF NOT EXISTS wallet_challenges_lookup_idx
            ON wallet_challenges(wallet, purpose, task_id, expires_at)`,
          `CREATE TABLE IF NOT EXISTS challenge_rate_limits (
            rate_key TEXT NOT NULL,
            minute_bucket TEXT NOT NULL,
            request_count INTEGER NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (rate_key, minute_bucket)
          )`,
          `CREATE TABLE IF NOT EXISTS cron_locks (
            lock_key TEXT PRIMARY KEY,
            token TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )`,
          `CREATE TABLE IF NOT EXISTS automated_reproduction_runs (
            window_key TEXT PRIMARY KEY,
            task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            status TEXT NOT NULL,
            wallet TEXT,
            submission_id TEXT,
            transaction_hash TEXT,
            finalization_hash TEXT,
            finalization_xdr TEXT,
            form_payload_json TEXT,
            error TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            form_submitted_at TEXT
          )`,
        ],
        "write",
      );
      for (const statement of [
        "ALTER TABLE submissions ADD COLUMN chain_status TEXT NOT NULL DEFAULT 'CONFIRMED'",
        "ALTER TABLE submissions ADD COLUMN transaction_hash TEXT",
        "ALTER TABLE submissions ADD COLUMN transaction_explorer_url TEXT",
        "ALTER TABLE automated_reproduction_runs ADD COLUMN finalization_hash TEXT",
        "ALTER TABLE automated_reproduction_runs ADD COLUMN finalization_xdr TEXT",
      ]) {
        try {
          await db.execute(statement);
        } catch (error) {
          if (!String(error).toLowerCase().includes("duplicate column name")) throw error;
        }
      }
      try {
        await db.execute("ALTER TABLE report_publications ADD COLUMN attempt_id TEXT");
      } catch (error) {
        if (!String(error).toLowerCase().includes("duplicate column name")) throw error;
      }
    })();
  }
  await initialization;
}
