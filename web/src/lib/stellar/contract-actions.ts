"use client";

import { Buffer } from "buffer";
import type { Watcher } from "@stellar/stellar-sdk/contract";
import { Client as RegistryClient } from "./generated/repro-task-registry/src";
import { Client as VaultClient } from "./generated/reward-vault/src";
import { requireContractIds, stellarConfig } from "./config";
import type { TransactionStatus } from "@/types/domain";

interface ExecuteOptions {
  address: string;
  signTransaction(xdr: string): Promise<string>;
  onStatus(status: TransactionStatus, hash?: string): void;
}

function signer(options: ExecuteOptions) {
  return async (xdr: string) => ({ signedTxXdr: await options.signTransaction(xdr) });
}

function watcher(options: ExecuteOptions): Watcher {
  return {
    onSubmitted(response) {
      options.onStatus("SUBMITTED", response?.hash);
    },
    onProgress(response) {
      options.onStatus(response?.status === "SUCCESS" ? "CONFIRMED" : "PENDING");
    },
  };
}

function commonClientOptions(options: ExecuteOptions, contractId: string) {
  return {
    contractId,
    rpcUrl: stellarConfig.rpcUrl,
    networkPassphrase: stellarConfig.networkPassphrase,
    publicKey: options.address,
    signTransaction: signer(options),
  };
}

async function execute(
  options: ExecuteOptions,
  build: () => Promise<{ signAndSend(input: { watcher: Watcher }): Promise<unknown> }>,
): Promise<string> {
  options.onStatus("SIMULATING");
  const transaction = await build();
  options.onStatus("AWAITING_SIGNATURE");
  let hash = "";
  const trackingWatcher = watcher({
    ...options,
    onStatus(status, value) {
      if (value) hash = value;
      options.onStatus(status, value);
    },
  });
  await transaction.signAndSend({ watcher: trackingWatcher });
  options.onStatus("CONFIRMED", hash);
  return hash;
}

export async function lockTaskReward(
  task: { taskHash: string; rewardStroops: string; deadline: string },
  options: ExecuteOptions,
): Promise<string> {
  const { vault } = requireContractIds();
  const client = new VaultClient(commonClientOptions(options, vault));
  return execute(options, () =>
    client.lock({
      task_id: Buffer.from(task.taskHash, "hex"),
      maintainer: options.address,
      amount: BigInt(task.rewardStroops),
      deadline: BigInt(Math.floor(new Date(task.deadline).getTime() / 1_000)),
    }),
  );
}

export async function registerFundedTask(
  task: {
    taskHash: string;
    rewardStroops: string;
    deadline: string;
    threshold: number;
  },
  options: ExecuteOptions,
): Promise<string> {
  const { registry } = requireContractIds();
  const client = new RegistryClient(commonClientOptions(options, registry));
  return execute(options, () =>
    client.register_task({
      task_id: Buffer.from(task.taskHash, "hex"),
      maintainer: options.address,
      reward_amount: BigInt(task.rewardStroops),
      threshold: task.threshold,
      deadline: BigInt(Math.floor(new Date(task.deadline).getTime() / 1_000)),
    }),
  );
}

export async function finalizeTaskReward(
  task: { taskHash: string; resultHash: string; contributors: string[] },
  options: ExecuteOptions,
): Promise<string> {
  const { registry } = requireContractIds();
  const client = new RegistryClient(commonClientOptions(options, registry));
  return execute(options, () =>
    client.finalize({
      task_id: Buffer.from(task.taskHash, "hex"),
      result_hash: Buffer.from(task.resultHash, "hex"),
      contributors: task.contributors,
    }),
  );
}

export async function expireTaskReward(
  taskHash: string,
  options: ExecuteOptions,
): Promise<string> {
  const { registry } = requireContractIds();
  const client = new RegistryClient(commonClientOptions(options, registry));
  return execute(options, () =>
    client.expire({ task_id: Buffer.from(taskHash, "hex") }),
  );
}

