import "server-only";

import { Buffer } from "buffer";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { basicNodeSigner } from "@stellar/stellar-sdk/contract";
import { Client as RegistryClient } from "@/lib/stellar/generated/repro-task-registry/src";
import {
  explorerTransactionUrl,
  requireContractIds,
  stellarConfig,
} from "@/lib/stellar/config";
import {
  confirmContractTransaction,
  findTaskTransactionEvent,
  submitSignedContractTransaction,
  SignedContractTransactionExpiredError,
  verifyFinalizedTask,
  verifyRewardPayouts,
  verifyTaskTransactionEvent,
} from "@/lib/stellar/server";
import type { ReproTask } from "@/types/domain";
import { recordTaskTransaction } from "./repository";

function maintainerKeypair(task: ReproTask): Keypair {
  if (stellarConfig.network !== "testnet") {
    throw new Error("Automated Soroban finalization is Testnet-only.");
  }
  const secret = process.env.CRON_MAINTAINER_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "CRON_MAINTAINER_SECRET is required when automated evidence reaches the finalization threshold.",
    );
  }
  if (!StrKey.isValidEd25519SecretSeed(secret)) {
    throw new Error("CRON_MAINTAINER_SECRET is not a valid Stellar secret seed.");
  }
  const keypair = Keypair.fromSecret(secret);
  if (keypair.publicKey() !== task.maintainerWallet) {
    throw new Error(
      "CRON_MAINTAINER_SECRET does not match the target task maintainer wallet.",
    );
  }
  return keypair;
}

export function validateAutomationMaintainer(task: ReproTask): void {
  maintainerKeypair(task);
}

async function verifyAndRecordFinalization(
  task: ReproTask,
  hash: string,
  ledger?: number,
): Promise<string> {
  const confirmedLedger = ledger ?? (await confirmContractTransaction(hash));
  await verifyTaskTransactionEvent(task, "FINALIZE", hash, confirmedLedger);
  const state = await verifyFinalizedTask(task);
  if (state !== "VERIFIED") {
    throw new Error("Automated finalization did not complete the Registry task.");
  }
  await verifyRewardPayouts(task, hash, confirmedLedger);
  if (task.status !== "VERIFIED" || task.finalizationTx !== hash) {
    await recordTaskTransaction(
      task.id,
      "FINALIZE",
      hash,
      explorerTransactionUrl(hash),
    );
  }
  return hash;
}

export async function recoverAutomatedFinalization(
  task: ReproTask,
  recordedHash?: string,
  recordedXdr?: string,
): Promise<string | undefined> {
  if (recordedHash) {
    if (recordedXdr) {
      try {
        const ledger = await submitSignedContractTransaction(recordedXdr, recordedHash);
        return verifyAndRecordFinalization(task, recordedHash, ledger);
      } catch (error) {
        if (!(error instanceof SignedContractTransactionExpiredError)) throw error;
        const event = await findTaskTransactionEvent(task, "FINALIZE");
        if (event) return verifyAndRecordFinalization(task, event.hash, event.ledger);
        return undefined;
      }
    }
    return verifyAndRecordFinalization(task, recordedHash);
  }
  if (task.status === "VERIFIED" && task.finalizationTx) {
    return verifyAndRecordFinalization(task, task.finalizationTx);
  }
  const event = await findTaskTransactionEvent(task, "FINALIZE");
  if (!event) return undefined;
  return verifyAndRecordFinalization(task, event.hash, event.ledger);
}

export async function finalizeTaskForAutomation(
  task: ReproTask,
  onPrepared?: (hash: string, signedXdr: string) => Promise<void>,
): Promise<string> {
  if (task.status !== "FINALIZING" || !task.verification?.thresholdReached) {
    throw new Error("Target task is not ready for automated finalization.");
  }
  if (task.verification.acceptedWallets.length < task.threshold) {
    throw new Error("Target task does not have enough accepted contributor wallets.");
  }
  const signer = maintainerKeypair(task);
  const nodeSigner = basicNodeSigner(signer, stellarConfig.networkPassphrase);
  const { registry } = requireContractIds();
  const client = new RegistryClient({
    contractId: registry,
    rpcUrl: stellarConfig.rpcUrl,
    networkPassphrase: stellarConfig.networkPassphrase,
    publicKey: signer.publicKey(),
    signTransaction: nodeSigner.signTransaction,
    signAuthEntry: nodeSigner.signAuthEntry,
  });
  const transaction = await client.finalize({
    task_id: Buffer.from(task.taskHash, "hex"),
    result_hash: Buffer.from(task.verification.resultHash, "hex"),
    contributors: task.verification.acceptedWallets,
  });
  await transaction.sign();
  if (!transaction.signed) {
    throw new Error("Soroban finalization could not produce a signed transaction.");
  }
  const signedXdr = transaction.signed.toXdr();
  const hash = Buffer.from(transaction.signed.hash()).toString("hex");
  await onPrepared?.(hash, signedXdr);
  const ledger = await submitSignedContractTransaction(signedXdr, hash);
  return verifyAndRecordFinalization(task, hash, ledger);
}
