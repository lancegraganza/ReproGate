import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getDatabase, initializeDatabase } from "./database";
import { stellarConfig } from "@/lib/stellar/config";
import {
  buildWalletChallengeTransaction,
  verifySignedWalletChallenge,
} from "@/lib/stellar/wallet-proof";

export type WalletAuthPurpose = "CREATE_TASK" | "SUBMIT_EVIDENCE" | "POST_REPORT";
export interface WalletAuthorization { challengeId: string; signedXdr: string }

async function enforceChallengeRateLimit(rateKey: string, limit: number, now: Date): Promise<void> {
  const result = await getDatabase().execute({
    sql: `INSERT INTO challenge_rate_limits
      (rate_key, minute_bucket, request_count, updated_at) VALUES (?, ?, 1, ?)
      ON CONFLICT(rate_key, minute_bucket) DO UPDATE SET
        request_count = challenge_rate_limits.request_count + 1,
        updated_at = excluded.updated_at
      RETURNING request_count`,
    args: [rateKey, now.toISOString().slice(0, 16), now.toISOString()],
  });
  if (Number(result.rows[0]?.request_count ?? 1) > limit) {
    throw new Error("Wallet authorization is temporarily rate limited. Try again shortly.");
  }
}

export async function createWalletChallenge(
  wallet: string,
  purpose: WalletAuthPurpose,
  taskId?: string,
  callerKey = "unknown",
): Promise<{ challengeId: string; xdr: string; expiresAt: string }> {
  await initializeDatabase();
  const now = new Date();
  await getDatabase().execute({
    sql: "DELETE FROM wallet_challenges WHERE used_at IS NOT NULL OR expires_at <= ?",
    args: [now.toISOString()],
  });
  await getDatabase().execute({
    sql: "DELETE FROM challenge_rate_limits WHERE updated_at < ?",
    args: [new Date(now.getTime() - 24 * 60 * 60_000).toISOString()],
  });
  const callerHash = createHash("sha256").update(callerKey).digest("hex");
  await enforceChallengeRateLimit(`caller:${callerHash}`, 30, now);
  await enforceChallengeRateLimit(`caller-wallet:${callerHash}:${wallet}`, 8, now);
  await enforceChallengeRateLimit("global", 500, now);
  const challengeId = randomUUID();
  const expiresAt = new Date(now.getTime() + 5 * 60_000);
  const xdr = buildWalletChallengeTransaction(
    wallet,
    randomBytes(32).toString("hex"),
    expiresAt,
    stellarConfig.networkPassphrase,
  );
  await getDatabase().execute({
    sql: `INSERT INTO wallet_challenges
      (id, wallet, purpose, task_id, unsigned_xdr, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [challengeId, wallet, purpose, taskId ?? null, xdr, expiresAt.toISOString(), now.toISOString()],
  });
  return { challengeId, xdr, expiresAt: expiresAt.toISOString() };
}

export async function verifyAndConsumeWalletAuthorization(
  wallet: string,
  purpose: WalletAuthPurpose,
  authorization: WalletAuthorization,
  taskId?: string,
): Promise<void> {
  await initializeDatabase();
  const result = await getDatabase().execute({
    sql: `SELECT * FROM wallet_challenges
      WHERE id = ? AND wallet = ? AND purpose = ?
        AND COALESCE(task_id, '') = COALESCE(?, '')`,
    args: [authorization.challengeId, wallet, purpose, taskId ?? null],
  });
  const challenge = result.rows[0];
  if (!challenge || challenge.used_at || new Date(String(challenge.expires_at)).getTime() <= Date.now()) {
    throw new Error("Wallet authorization expired or was already used. Sign a fresh request.");
  }
  if (!verifySignedWalletChallenge(
    String(challenge.unsigned_xdr),
    authorization.signedXdr,
    wallet,
    stellarConfig.networkPassphrase,
  )) {
    throw new Error("Wallet authorization signature is invalid.");
  }
  const consumed = await getDatabase().execute({
    sql: "UPDATE wallet_challenges SET used_at = ? WHERE id = ? AND used_at IS NULL",
    args: [new Date().toISOString(), authorization.challengeId],
  });
  if (Number(consumed.rowsAffected) !== 1) {
    throw new Error("Wallet authorization was already used. Sign a fresh request.");
  }
}
