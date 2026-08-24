import "server-only";

import { Buffer } from "buffer";
import { rpc, scValToNative } from "@stellar/stellar-sdk";
import { Client as RegistryClient } from "./generated/repro-task-registry/src";
import { Client as VaultClient } from "./generated/reward-vault/src";
import type { ReproTask } from "@/types/domain";
import { requireContractIds, stellarConfig } from "./config";

function taskIdBuffer(task: ReproTask): Buffer {
  return Buffer.from(task.taskHash, "hex");
}

export async function confirmContractTransaction(hash: string): Promise<number> {
  const server = new rpc.Server(stellarConfig.rpcUrl);
  const response = await server.getTransaction(hash);
  if (response.status === "NOT_FOUND") {
    throw new Error("Transaction is not confirmed yet.");
  }
  if (response.status !== "SUCCESS") {
    throw new Error(`Transaction did not succeed (${response.status}).`);
  }
  return response.ledger;
}

export async function verifyTaskTransactionEvent(
  task: ReproTask,
  kind: "FUND" | "REGISTER" | "FINALIZE" | "REFUND",
  hash: string,
  ledger: number,
): Promise<void> {
  const ids = requireContractIds();
  const expected = {
    FUND: { contractId: ids.vault, names: ["reward_funded"] },
    REGISTER: { contractId: ids.registry, names: ["task_registered"] },
    FINALIZE: { contractId: ids.registry, names: ["task_verified", "task_completed"] },
    REFUND: { contractId: ids.registry, names: ["task_expired"] },
  }[kind];
  const server = new rpc.Server(stellarConfig.rpcUrl);
  const response = await server.getEvents({
    startLedger: ledger,
    filters: [{ type: "contract", contractIds: [expected.contractId] }],
    limit: 100,
  });
  const matches = response.events.some((event) => {
    if (event.ledger !== ledger || event.txHash !== hash) return false;
    const topic = event.topic.map((value) => scValToNative(value));
    const eventName = typeof topic[0] === "string" ? topic[0] : "";
    const eventTask = topic[1] instanceof Uint8Array
      ? Buffer.from(topic[1]).toString("hex")
      : undefined;
    return expected.names.includes(eventName) && eventTask === task.taskHash;
  });
  if (!matches) {
    throw new Error("Transaction does not contain the expected contract event for this task.");
  }
}

export async function verifyFundedReward(task: ReproTask): Promise<void> {
  const { vault } = requireContractIds();
  const client = new VaultClient({
    contractId: vault,
    rpcUrl: stellarConfig.rpcUrl,
    networkPassphrase: stellarConfig.networkPassphrase,
  });
  const transaction = await client.get_reward({ task_id: taskIdBuffer(task) });
  const reward = transaction.result.unwrap();
  if (
    reward.state.tag !== "Funded" ||
    reward.maintainer !== task.maintainerWallet ||
    reward.amount !== BigInt(task.rewardStroops) ||
    reward.deadline !== BigInt(Math.floor(new Date(task.deadline).getTime() / 1_000))
  ) {
    throw new Error("Confirmed reward does not match this task.");
  }
}

export async function verifyRegisteredTask(task: ReproTask): Promise<void> {
  const { registry } = requireContractIds();
  const client = new RegistryClient({
    contractId: registry,
    rpcUrl: stellarConfig.rpcUrl,
    networkPassphrase: stellarConfig.networkPassphrase,
  });
  const transaction = await client.get_task({ task_id: taskIdBuffer(task) });
  const onChain = transaction.result.unwrap();
  if (
    onChain.state.tag !== "Open" ||
    onChain.maintainer !== task.maintainerWallet ||
    onChain.reward_amount !== BigInt(task.rewardStroops) ||
    onChain.threshold !== task.threshold ||
    onChain.deadline !== BigInt(Math.floor(new Date(task.deadline).getTime() / 1_000))
  ) {
    throw new Error("Confirmed registry task does not match the off-chain task.");
  }
}

export async function verifyFinalizedTask(task: ReproTask): Promise<"VERIFIED" | "EXPIRED"> {
  const { registry } = requireContractIds();
  const client = new RegistryClient({
    contractId: registry,
    rpcUrl: stellarConfig.rpcUrl,
    networkPassphrase: stellarConfig.networkPassphrase,
  });
  const transaction = await client.get_task({ task_id: taskIdBuffer(task) });
  const onChain = transaction.result.unwrap();
  if (onChain.state.tag === "Completed") {
    if (!task.verification || !onChain.result_hash) {
      throw new Error("Finalized task is missing its verified result hash.");
    }
    if (Buffer.from(onChain.result_hash).toString("hex") !== task.verification.resultHash) {
      throw new Error("On-chain result hash does not match the accepted evidence.");
    }
    return "VERIFIED";
  }
  if (onChain.state.tag === "Expired") return "EXPIRED";
  throw new Error("Task transaction is confirmed but the registry state is not final.");
}
