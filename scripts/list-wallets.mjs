#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WEB_DIR = join(ROOT_DIR, "web");
const requireFromWeb = createRequire(join(WEB_DIR, "package.json"));
const { createClient } = requireFromWeb("@libsql/client");

let stellarStrKey;
try {
  ({ StrKey: stellarStrKey } = requireFromWeb("@stellar/stellar-sdk"));
} catch {
  // The shape check below still protects the report if the SDK is unavailable.
}

const WALLET_PATTERN = /^G[A-Z2-7]{55}$/;
const TABLES = [
  "tasks",
  "submissions",
  "wallet_challenges",
  "automated_reproduction_runs",
  "indexed_events",
];

function printHelp() {
  console.log(`Usage: node scripts/list-wallets.mjs [options]

List unique Stellar wallet addresses observed by ReproGate.

Options:
  --database-url <url>  Override DATABASE_URL (use file:/... for local SQLite)
  --json                Print machine-readable JSON instead of the report view
  --help                Show this help

By default the script loads web/.env.local, then web/.env, and falls back to
web/.data/reprogate.db when DATABASE_URL is not configured. It only executes
read-only SELECT statements.`);
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed.at(-1);
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, name, rawValue] = match;
    if (process.env[name] === undefined) process.env[name] = unquote(rawValue);
  }
}

function loadEnvironment() {
  for (const file of [
    join(WEB_DIR, ".env.local"),
    join(WEB_DIR, ".env"),
    join(ROOT_DIR, ".env.local"),
    join(ROOT_DIR, ".env"),
  ]) {
    loadEnvFile(file);
  }
}

function localDatabaseUrl() {
  const databaseFile = join(WEB_DIR, ".data", "reprogate.db").replaceAll("\\", "/");
  return `file:${databaseFile}`;
}

function isStellarWallet(value) {
  if (typeof value !== "string") return false;
  const address = value.trim();
  if (!WALLET_PATTERN.test(address)) return false;
  if (stellarStrKey && typeof stellarStrKey.isValidEd25519PublicKey === "function") {
    try {
      return stellarStrKey.isValidEd25519PublicKey(address);
    } catch {
      return false;
    }
  }
  return true;
}

function sourceLabel(table, column) {
  return `${table}.${column}`;
}

function createWalletReport() {
  const wallets = new Map();

  function record(value, source, detail) {
    if (!isStellarWallet(value)) return;
    const address = value.trim();
    let entry = wallets.get(address);
    if (!entry) {
      entry = { address, interactions: 0, sources: new Map() };
      wallets.set(address, entry);
    }
    entry.interactions += 1;
    const sourceEntry = entry.sources.get(source) ?? { count: 0, details: [] };
    sourceEntry.count += 1;
    if (detail && sourceEntry.details.length < 5) sourceEntry.details.push(detail);
    entry.sources.set(source, sourceEntry);
  }

  return { wallets, record };
}

function walkEventPayload(value, visit, path = "$", seen = new Set()) {
  if (typeof value === "string") {
    visit(value, path);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkEventPayload(item, visit, `${path}[${index}]`, seen));
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    walkEventPayload(item, visit, `${path}.${key}`, seen);
  }
}

async function tableNames(db) {
  const result = await db.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (" +
      TABLES.map(() => "?").join(", ") +
      ")",
    TABLES,
  );
  return new Set(result.rows.map((row) => String(row.name)));
}

async function collectFromTable(db, tables, report) {
  if (tables.has("tasks")) {
    const result = await db.execute("SELECT id, maintainer_wallet FROM tasks");
    for (const row of result.rows) {
      report.record(row.maintainer_wallet, sourceLabel("tasks", "maintainer_wallet"), `task ${row.id}`);
    }
  }

  if (tables.has("submissions")) {
    const result = await db.execute("SELECT id, task_id, wallet FROM submissions");
    for (const row of result.rows) {
      report.record(row.wallet, sourceLabel("submissions", "wallet"), `submission ${row.id} task ${row.task_id}`);
    }
  }

  if (tables.has("wallet_challenges")) {
    const result = await db.execute("SELECT id, purpose, wallet FROM wallet_challenges");
    for (const row of result.rows) {
      report.record(row.wallet, sourceLabel("wallet_challenges", "wallet"), `${row.purpose} challenge ${row.id}`);
    }
  }

  if (tables.has("automated_reproduction_runs")) {
    const result = await db.execute("SELECT window_key, status, wallet FROM automated_reproduction_runs");
    for (const row of result.rows) {
      report.record(row.wallet, sourceLabel("automated_reproduction_runs", "wallet"), `${row.status} window ${row.window_key}`);
    }
  }

  if (tables.has("indexed_events")) {
    const result = await db.execute("SELECT event_id, contract_id, payload_json FROM indexed_events");
    for (const row of result.rows) {
      let payload;
      try {
        payload = JSON.parse(String(row.payload_json));
      } catch {
        continue;
      }
      const source = sourceLabel("indexed_events", "payload_json");
      walkEventPayload(payload, (value, path) => {
        report.record(value, source, `event ${row.event_id} contract ${row.contract_id} at ${path}`);
      });
    }
  }
}

function serializedReport(wallets, databaseKind) {
  const entries = [...wallets.values()]
    .sort((left, right) => left.address.localeCompare(right.address))
    .map((entry) => ({
      address: entry.address,
      interactions: entry.interactions,
      sources: Object.fromEntries(
        [...entry.sources.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([source, value]) => [source, { count: value.count, details: value.details }]),
      ),
    }));
  return {
    generatedAt: new Date().toISOString(),
    database: databaseKind,
    walletCount: entries.length,
    wallets: entries,
  };
}

function printReport(report) {
  console.log("ReproGate wallet interaction report");
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Unique Stellar wallets: ${report.walletCount}`);
  if (report.walletCount === 0) {
    console.log("No valid Stellar public addresses were found in the observed records.");
    return;
  }

  for (const [index, wallet] of report.wallets.entries()) {
    console.log(`\n${index + 1}. ${wallet.address}`);
    console.log(`   Interactions observed: ${wallet.interactions}`);
    for (const [source, details] of Object.entries(wallet.sources)) {
      console.log(`   ${source}: ${details.count}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    printHelp();
    return;
  }
  if (args.includes("--json") && args.includes("--text")) {
    throw new Error("Choose either --json or the default report view.");
  }

  loadEnvironment();
  const overrideUrl = optionValue(args, "--database-url");
  const databaseUrl = overrideUrl ?? process.env.DATABASE_URL?.trim() ?? localDatabaseUrl();
  if (databaseUrl.startsWith("file:") && !existsSync(databaseUrl.slice(5))) {
    throw new Error(`Local database file was not found: ${databaseUrl.slice(5)}`);
  }

  const db = createClient({
    url: databaseUrl,
    authToken: process.env.DATABASE_AUTH_TOKEN?.trim() || undefined,
  });
  let tables;
  try {
    tables = await tableNames(db);
    const reportBuilder = createWalletReport();
    await collectFromTable(db, tables, reportBuilder);
    const report = serializedReport(
      reportBuilder.wallets,
      databaseUrl.startsWith("file:") ? "local SQLite" : "remote libSQL",
    );
    if (args.includes("--json")) console.log(JSON.stringify(report, null, 2));
    else printReport(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/401|unauthorized|authentication|forbidden/i.test(message)) {
      throw new Error("Database authentication failed. Check DATABASE_URL and DATABASE_AUTH_TOKEN.");
    }
    throw error;
  } finally {
    db.close?.();
  }
}

main().catch((error) => {
  console.error(`Wallet report failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
