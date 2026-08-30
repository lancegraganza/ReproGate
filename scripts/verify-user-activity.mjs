#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WEB_DIR = join(ROOT_DIR, "web");
const DEFAULT_OUTPUT = join(ROOT_DIR, "docs", "user-activity-verification.json");
const DEFAULT_HORIZON_URL = "https://horizon-testnet.stellar.org";
const EXPLORER_TX_BASE = "https://stellar.expert/explorer/testnet/tx";
const EXPLORER_ACCOUNT_BASE = "https://stellar.expert/explorer/testnet/account";
const requireFromWeb = createRequire(join(WEB_DIR, "package.json"));
const { createClient } = requireFromWeb("@libsql/client");
const { StrKey } = requireFromWeb("@stellar/stellar-sdk");

function printHelp() {
  console.log(`Usage: node scripts/verify-user-activity.mjs [options]

Build a read-only JSON report from ReproGate's database, then verify every
recorded successful transaction against Stellar Testnet Horizon.

Options:
  --output <path>       JSON output path
  --database-url <url>  Override DATABASE_URL
  --horizon-url <url>   Override the Testnet Horizon endpoint
  --stdout              Also print the complete JSON report
  --help                Show this help

Defaults:
  output: docs/user-activity-verification.json
  database: DATABASE_URL from web/.env.local, else web/.data/reprogate.db
  Horizon: NEXT_PUBLIC_STELLAR_HORIZON_URL, else ${DEFAULT_HORIZON_URL}`);
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
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
  return `file:${join(WEB_DIR, ".data", "reprogate.db").replaceAll("\\", "/")}`;
}

function validWallet(value) {
  return typeof value === "string" && StrKey.isValidEd25519PublicKey(value.trim());
}

function validHash(value) {
  return typeof value === "string" && /^[a-fA-F0-9]{64}$/.test(value.trim());
}

function accountExplorerUrl(address) {
  return `${EXPLORER_ACCOUNT_BASE}/${address}`;
}

function transactionExplorerUrl(hash) {
  return `${EXPLORER_TX_BASE}/${hash}`;
}

async function existingTables(db) {
  const result = await db.execute("SELECT name FROM sqlite_master WHERE type = 'table'");
  return new Set(result.rows.map((row) => String(row.name)));
}

function createWalletMap() {
  const wallets = new Map();
  return {
    wallets,
    add(rawAddress, source) {
      if (!validWallet(rawAddress)) return;
      const address = rawAddress.trim();
      const entry = wallets.get(address) ?? {
        address,
        explorerUrl: accountExplorerUrl(address),
        sources: new Set(),
        confirmedEvidenceTransactionHashes: new Set(),
      };
      entry.sources.add(source);
      wallets.set(address, entry);
    },
    addEvidenceTransaction(rawAddress, rawHash) {
      if (!validWallet(rawAddress) || !validHash(rawHash)) return;
      const address = rawAddress.trim();
      this.add(address, "submissions.confirmed_evidence");
      wallets.get(address).confirmedEvidenceTransactionHashes.add(rawHash.trim().toLowerCase());
    },
  };
}

async function collectDatabaseEvidence(db, tables) {
  const walletReport = createWalletMap();
  const transactionCandidates = new Map();
  const sourceCounts = {};

  function count(name, amount = 1) {
    sourceCounts[name] = (sourceCounts[name] ?? 0) + amount;
  }

  if (tables.has("tasks")) {
    const result = await db.execute(
      "SELECT id, maintainer_wallet, vault_funding_tx, registry_tx, finalization_tx FROM tasks",
    );
    count("tasks", result.rows.length);
    for (const row of result.rows) {
      walletReport.add(row.maintainer_wallet, "tasks.maintainer_wallet");
    }
  }

  if (tables.has("submissions")) {
    const result = await db.execute(
      `SELECT id, task_id, wallet, chain_status, transaction_hash, transaction_explorer_url
       FROM submissions`,
    );
    count("submissions", result.rows.length);
    for (const row of result.rows) {
      walletReport.add(row.wallet, "submissions.wallet");
      if (String(row.chain_status) === "CONFIRMED") {
        walletReport.addEvidenceTransaction(row.wallet, row.transaction_hash);
      }
    }
  }

  if (tables.has("automated_reproduction_runs")) {
    const result = await db.execute(
      `SELECT window_key, task_id, status, wallet, transaction_hash, finalization_hash
       FROM automated_reproduction_runs`,
    );
    count("automatedReproductionRuns", result.rows.length);
    for (const row of result.rows) {
      walletReport.add(row.wallet, "automated_reproduction_runs.wallet");
    }
  }

  if (tables.has("wallet_challenges")) {
    const result = await db.execute("SELECT wallet FROM wallet_challenges");
    count("walletChallenges", result.rows.length);
    for (const row of result.rows) walletReport.add(row.wallet, "wallet_challenges.wallet");
  }

  if (tables.has("transaction_references")) {
    const result = await db.execute(
      `SELECT hash, task_id, kind, status, explorer_url, created_at, confirmed_at
       FROM transaction_references WHERE status = 'CONFIRMED' ORDER BY confirmed_at ASC`,
    );
    count("databaseConfirmedTransactionReferences", result.rows.length);
    for (const row of result.rows) {
      if (!validHash(row.hash)) continue;
      const hash = String(row.hash).toLowerCase();
      transactionCandidates.set(hash, {
        hash,
        taskId: String(row.task_id),
        kind: String(row.kind),
        databaseStatus: String(row.status),
        databaseCreatedAt: String(row.created_at),
        databaseConfirmedAt: row.confirmed_at == null ? null : String(row.confirmed_at),
        explorerUrl: String(row.explorer_url || transactionExplorerUrl(hash)),
      });
    }
  }

  return { walletReport, transactionCandidates, sourceCounts };
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function fetchWithRetry(url, attempts = 4) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "ReproGate-verification/1.0" },
      });
      if (response.ok) return response;
      const body = await response.text();
      if (response.status !== 429 && response.status < 500) {
        throw new Error(`Horizon returned ${response.status}: ${body.slice(0, 200)}`);
      }
      lastError = new Error(`Horizon returned ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
    await delay(500 * 2 ** attempt);
  }
  throw lastError ?? new Error("Horizon request failed.");
}

async function verifyTransaction(candidate, horizonUrl) {
  const response = await fetchWithRetry(
    `${horizonUrl.replace(/\/$/, "")}/transactions/${candidate.hash}`,
  );
  const transaction = await response.json();
  if (transaction.successful !== true) {
    throw new Error("Horizon found the transaction but did not report success.");
  }
  return {
    ...candidate,
    horizonSuccessful: true,
    ledger: Number(transaction.ledger),
    sourceAccount: String(transaction.source_account),
    operationCount: Number(transaction.operation_count),
    feeChargedStroops: String(transaction.fee_charged),
    createdAt: String(transaction.created_at),
    explorerUrl: transactionExplorerUrl(candidate.hash),
  };
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
  return results;
}

async function verifyTransactions(candidates, horizonUrl) {
  const successful = [];
  const rejected = [];
  await mapWithConcurrency(candidates, 6, async (candidate) => {
    try {
      successful.push(await verifyTransaction(candidate, horizonUrl));
    } catch (error) {
      rejected.push({
        hash: candidate.hash,
        kind: candidate.kind,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  });
  successful.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  rejected.sort((left, right) => left.hash.localeCompare(right.hash));
  return { successful, rejected };
}

function serializeWallets(walletReport, successfulHashSet) {
  return [...walletReport.wallets.values()]
    .sort((left, right) => left.address.localeCompare(right.address))
    .map((wallet) => {
      const hashes = [...wallet.confirmedEvidenceTransactionHashes]
        .filter((hash) => successfulHashSet.has(hash))
        .sort();
      return {
        address: wallet.address,
        explorerUrl: wallet.explorerUrl,
        sources: [...wallet.sources].sort(),
        successfulEvidenceTransactionCount: hashes.length,
        successfulEvidenceTransactionHashes: hashes,
      };
    });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    printHelp();
    return;
  }

  loadEnvironment();
  const databaseUrl =
    optionValue(args, "--database-url") ?? process.env.DATABASE_URL?.trim() ?? localDatabaseUrl();
  const horizonUrl =
    optionValue(args, "--horizon-url") ??
    process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL?.trim() ??
    DEFAULT_HORIZON_URL;
  const outputPath = resolve(optionValue(args, "--output") ?? DEFAULT_OUTPUT);
  if (databaseUrl.startsWith("file:") && !existsSync(databaseUrl.slice(5))) {
    throw new Error(`Local database file was not found: ${databaseUrl.slice(5)}`);
  }

  const db = createClient({
    url: databaseUrl,
    authToken: process.env.DATABASE_AUTH_TOKEN?.trim() || undefined,
  });

  try {
    const tables = await existingTables(db);
    const { walletReport, transactionCandidates, sourceCounts } =
      await collectDatabaseEvidence(db, tables);
    const { successful, rejected } = await verifyTransactions(
      [...transactionCandidates.values()],
      horizonUrl,
    );
    const successfulHashSet = new Set(successful.map((transaction) => transaction.hash));
    const wallets = serializeWallets(walletReport, successfulHashSet);
    const transactingWallets = wallets.filter(
      (wallet) => wallet.successfulEvidenceTransactionCount > 0,
    );
    const transactionKinds = Object.fromEntries(
      [...new Set(successful.map((transaction) => transaction.kind))]
        .sort()
        .map((kind) => [
          kind,
          successful.filter((transaction) => transaction.kind === kind).length,
        ]),
    );

    const report = {
      generatedAt: new Date().toISOString(),
      network: "Stellar Testnet",
      sources: {
        database: databaseUrl.startsWith("file:") ? "local SQLite" : "remote libSQL",
        stellar: horizonUrl,
        databaseRecords: sourceCounts,
      },
      definitions: {
        totalUsers:
          "Unique valid Stellar wallet addresses recorded by ReproGate tasks, submissions, wallet challenges, or automation runs.",
        totalUniqueWallets: "Same deduplicated public-address set as totalUsers.",
        usersWithSuccessfulEvidenceTransactions:
          "Unique submission wallets whose confirmed evidence-payment hash is independently reported successful by Horizon.",
        totalSuccessfulReproGateTransactions:
          "Distinct CONFIRMED transaction_references that Horizon independently reports as successful on Stellar Testnet.",
      },
      totals: {
        totalUsers: wallets.length,
        totalUniqueWallets: wallets.length,
        usersWithSuccessfulEvidenceTransactions: transactingWallets.length,
        totalSuccessfulReproGateTransactions: successful.length,
        successfulTransactionsByKind: transactionKinds,
        databaseConfirmedTransactionsRejectedByHorizon: rejected.length,
      },
      uniqueWalletAddresses: wallets.map((wallet) => wallet.address),
      wallets,
      successfulTransactionHashes: successful.map((transaction) => transaction.hash),
      successfulTransactions: successful,
      rejectedTransactions: rejected,
    };

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`Wrote ${outputPath}`);
    console.log(JSON.stringify(report.totals, null, 2));
    if (args.includes("--stdout")) console.log(JSON.stringify(report, null, 2));

    if (rejected.length > 0) process.exitCode = 2;
  } finally {
    db.close?.();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`User activity verification failed: ${message}`);
  process.exitCode = 1;
});
