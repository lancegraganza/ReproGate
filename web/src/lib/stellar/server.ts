import "server-only";

import { Buffer } from "buffer";
import { rpc, scValToNative, TransactionBuilder } from "@stellar/stellar-sdk";
import { Client as RegistryClient } from "./generated/repro-task-registry/src";
import { Client as VaultClient } from "./generated/reward-vault/src";
import type { ReproTask } from "@/types/domain";
import { explorerTransactionUrl, requireContractIds, stellarConfig } from "./config";
import { getTask, recordTaskTransaction } from "@/lib/server/repository";

function taskIdBuffer(task: ReproTask): Buffer {
  return Buffer.from(task.taskHash, "hex");
}

type TaskTransactionKind = "FUND" | "REGISTER" | "FINALIZE" | "REFUND";

function expectedTaskEvent(kind: TaskTransactionKind) {
  const ids = requireContractIds();
  return {
    FUND: { contractId: ids.vault, names: ["reward_funded"] },
    REGISTER: { contractId: ids.registry, names: ["task_registered"] },
    FINALIZE: {
      contractId: ids.registry,
      names: ["task_verified", "task_completed"],
    },
    REFUND: { contractId: ids.registry, names: ["task_expired"] },
  }[kind];
}

function eventMatchesTask(
  event: { topic: Array<Parameters<typeof scValToNative>[0]> },
  task: ReproTask,
  names: string[],
): boolean {
  const topic = event.topic.map((value) => scValToNative(value));
  const eventName = typeof topic[0] === "string" ? topic[0] : "";
  const eventTask =
    topic[1] instanceof Uint8Array
      ? Buffer.from(topic[1]).toString("hex")
      : undefined;
  return names.includes(eventName) && eventTask === task.taskHash;
}

async function contractEventsAtLedger(
  server: rpc.Server,
  contractId: string,
  ledger: number,
) {
  const filters = [{ type: "contract" as const, contractIds: [contractId] }];
  const events: Awaited<ReturnType<rpc.Server["getEvents"]>>["events"] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 50; page += 1) {
    const response = await server.getEvents(
      cursor
        ? { cursor, filters, limit: 100 }
        : { startLedger: ledger, endLedger: ledger, filters, limit: 100 },
    );
    events.push(...response.events.filter((event) => event.ledger === ledger));
    if (
      response.events.length < 100 ||
      response.cursor === cursor ||
      response.events.some((event) => event.ledger > ledger)
    ) {
      break;
    }
    cursor = response.cursor;
  }
  return events;
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

export class SignedContractTransactionExpiredError extends Error {}

export async function submitSignedContractTransaction(
  signedXdr: string,
  expectedHash: string,
): Promise<number> {
  const transaction = TransactionBuilder.fromXdr(
    signedXdr,
    stellarConfig.networkPassphrase,
  );
  const actualHash = Buffer.from(transaction.hash()).toString("hex");
  if (actualHash !== expectedHash) {
    throw new Error("Stored finalization envelope does not match its transaction hash.");
  }
  const server = new rpc.Server(stellarConfig.rpcUrl);
  const existing = await server.getTransaction(expectedHash);
  if (existing.status === "SUCCESS") return existing.ledger;
  if (existing.status === "FAILED") {
    throw new Error("Soroban finalization failed on-chain.");
  }
  const maxTime = "timeBounds" in transaction
    ? transaction.timeBounds?.maxTime
    : undefined;
  if (maxTime && BigInt(maxTime) <= BigInt(Math.floor(Date.now() / 1_000))) {
    throw new SignedContractTransactionExpiredError(
      "The checkpointed Soroban finalization envelope expired before submission.",
    );
  }
  const submitted = await server.sendTransaction(transaction);
  if (submitted.status === "ERROR") {
    throw new Error("Soroban RPC rejected the signed finalization transaction.");
  }
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await server.getTransaction(expectedHash);
    if (response.status === "SUCCESS") return response.ledger;
    if (response.status === "FAILED") {
      throw new Error("Soroban finalization failed on-chain.");
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("Soroban finalization was submitted but confirmation timed out.");
}

export async function verifyTaskTransactionEvent(
  task: ReproTask,
  kind: TaskTransactionKind,
  hash: string,
  ledger: number,
): Promise<void> {
  const expected = expectedTaskEvent(kind);
  const server = new rpc.Server(stellarConfig.rpcUrl);
  const events = await contractEventsAtLedger(server, expected.contractId, ledger);
  const matchedNames = new Set<string>();
  for (const event of events) {
    if (event.ledger !== ledger || event.txHash !== hash) continue;
    if (!eventMatchesTask(event, task, expected.names)) continue;
    const topic = event.topic.map((value) => scValToNative(value));
    if (typeof topic[0] === "string") matchedNames.add(topic[0]);
  }
  if (!expected.names.every((name) => matchedNames.has(name))) {
    throw new Error("Transaction does not contain the expected contract event for this task.");
  }
}

export async function findTaskTransactionEvent(
  task: ReproTask,
  kind: TaskTransactionKind,
): Promise<{ hash: string; ledger: number } | undefined> {
  const expected = expectedTaskEvent(kind);
  const server = new rpc.Server(stellarConfig.rpcUrl);
  const latest = await server.getLatestLedger();
  const filters = [
    { type: "contract" as const, contractIds: [expected.contractId] },
  ];
  let cursor: string | undefined;
  let match: { hash: string; ledger: number } | undefined;
  for (let page = 0; page < 50; page += 1) {
    const response = await server.getEvents(
      cursor
        ? { cursor, filters, limit: 100 }
        : {
            startLedger: Math.max(latest.sequence - 10_000, 1),
            filters,
            limit: 100,
          },
    );
    for (const event of response.events) {
      if (
        event.txHash &&
        eventMatchesTask(event, task, expected.names) &&
        (!match || event.ledger >= match.ledger)
      ) {
        match = { hash: event.txHash, ledger: event.ledger };
      }
    }
    if (response.events.length < 100 || response.cursor === cursor) break;
    cursor = response.cursor;
  }
  return match;
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

export async function verifyRewardPayouts(
  task: ReproTask,
  hash: string,
  ledger: number,
): Promise<void> {
  if (!task.verification?.thresholdReached || task.verification.acceptedWallets.length === 0) {
    throw new Error("Task does not have accepted contributors to verify.");
  }
  const { vault } = requireContractIds();
  const client = new VaultClient({
    contractId: vault,
    rpcUrl: stellarConfig.rpcUrl,
    networkPassphrase: stellarConfig.networkPassphrase,
  });
  const rewardTransaction = await client.get_reward({
    task_id: taskIdBuffer(task),
  });
  const reward = rewardTransaction.result.unwrap();
  if (
    reward.state.tag !== "Completed" ||
    !reward.registered ||
    reward.maintainer !== task.maintainerWallet ||
    reward.amount !== BigInt(task.rewardStroops)
  ) {
    throw new Error("Reward Vault did not complete the expected task payout.");
  }
  for (const contributor of task.verification.acceptedWallets) {
    const paid = await client.is_paid({
      task_id: taskIdBuffer(task),
      contributor,
    });
    if (!paid.result) {
      throw new Error(`Reward Vault did not record payout for ${contributor}.`);
    }
  }

  const server = new rpc.Server(stellarConfig.rpcUrl);
  const events = await contractEventsAtLedger(server, vault, ledger);
  const taskEvents = events.filter((event) => {
    if (event.ledger !== ledger || event.txHash !== hash) return false;
    const topic = event.topic.map((value) => scValToNative(value));
    return (
      topic[1] instanceof Uint8Array &&
      Buffer.from(topic[1]).toString("hex") === task.taskHash
    );
  });
  const paidAmounts = new Map<string, bigint>();
  let completedTotal: bigint | undefined;
  for (const event of taskEvents) {
    const topic = event.topic.map((value) => scValToNative(value));
    const value = scValToNative(event.value) as {
      amount?: bigint;
      total?: bigint;
    };
    if (topic[0] === "contributor_paid" && typeof topic[2] === "string") {
      if (typeof value.amount !== "bigint") {
        throw new Error("Reward Vault payout event is missing its amount.");
      }
      paidAmounts.set(topic[2], value.amount);
    }
    if (topic[0] === "reward_completed" && typeof value.total === "bigint") {
      completedTotal = value.total;
    }
  }
  const contributors = task.verification.acceptedWallets;
  const total = BigInt(task.rewardStroops);
  const base = total / BigInt(contributors.length);
  const remainder = total % BigInt(contributors.length);
  for (const [index, contributor] of contributors.entries()) {
    const expected = base + (BigInt(index) < remainder ? 1n : 0n);
    if (paidAmounts.get(contributor) !== expected) {
      throw new Error(`Reward Vault payout event did not match ${contributor}.`);
    }
  }
  if (paidAmounts.size !== contributors.length || completedTotal !== total) {
    throw new Error("Reward Vault completion events do not match the expected payout.");
  }
}

export async function reconcileTaskWithChain(taskId: string): Promise<ReproTask> {
  const task = await getTask(taskId);
  if (!task) throw new Error("Task not found.");
  if (!stellarConfig.registryContractId || !stellarConfig.vaultContractId) {
    return task;
  }
  const ids = requireContractIds();

  // 1. Check Reward Vault
  let onChainReward:
    | {
        state: { tag: string };
        maintainer: string;
        amount: bigint;
        deadline: bigint;
        registered: boolean;
      }
    | undefined;
  try {
    const vaultClient = new VaultClient({
      contractId: ids.vault,
      rpcUrl: stellarConfig.rpcUrl,
      networkPassphrase: stellarConfig.networkPassphrase,
    });
    const res = await vaultClient.get_reward({ task_id: taskIdBuffer(task) });
    if (res.result && typeof res.result.unwrap === "function") {
      try {
        onChainReward = res.result.unwrap();
      } catch {
        // Not found or error
      }
    }
  } catch {
    // Reward not found in vault
  }

  // 2. Check Task Registry
  let onChainTask:
    | {
        state: { tag: string };
        maintainer: string;
        reward_amount: bigint;
        threshold: number;
        deadline: bigint;
        result_hash?: Buffer | null;
      }
    | undefined;
  try {
    const registryClient = new RegistryClient({
      contractId: ids.registry,
      rpcUrl: stellarConfig.rpcUrl,
      networkPassphrase: stellarConfig.networkPassphrase,
    });
    const res = await registryClient.get_task({ task_id: taskIdBuffer(task) });
    if (res.result && typeof res.result.unwrap === "function") {
      try {
        onChainTask = res.result.unwrap();
      } catch {
        // Not found or error
      }
    }
  } catch {
    // Task not found in registry
  }

  let updated: ReproTask = task;

  // 3. If reward is funded in the vault and task is DRAFT or FAILED, advance to FUNDING
  if (onChainReward && onChainReward.state.tag === "Funded") {
    if (updated.status === "DRAFT" || updated.status === "FAILED") {
      const fundEvent = await findTaskTransactionEvent(task, "FUND");
      const fundTx = fundEvent?.hash || updated.vaultFundingTx || "onchain-verified";
      updated = await recordTaskTransaction(
        updated.id,
        "FUND",
        fundTx,
        explorerTransactionUrl(fundTx),
      );
    }
  }

  // 4. If task is in registry, advance according to on-chain state
  if (onChainTask) {
    if (onChainTask.state.tag === "Open") {
      if (updated.status === "DRAFT") {
        const fundEvent = await findTaskTransactionEvent(task, "FUND");
        const fundTx = fundEvent?.hash || updated.vaultFundingTx || "onchain-verified";
        updated = await recordTaskTransaction(
          updated.id,
          "FUND",
          fundTx,
          explorerTransactionUrl(fundTx),
        );
      }
      if (updated.status === "FUNDING") {
        const regEvent = await findTaskTransactionEvent(task, "REGISTER");
        const regTx = regEvent?.hash || updated.registryTx || "onchain-verified";
        updated = await recordTaskTransaction(
          updated.id,
          "REGISTER",
          regTx,
          explorerTransactionUrl(regTx),
        );
      }
    } else if (onChainTask.state.tag === "Completed") {
      if (updated.status !== "VERIFIED") {
        const finalEvent = await findTaskTransactionEvent(task, "FINALIZE");
        const finalTx = finalEvent?.hash || updated.finalizationTx || "onchain-verified";
        updated = await recordTaskTransaction(
          updated.id,
          "FINALIZE",
          finalTx,
          explorerTransactionUrl(finalTx),
        );
      }
    } else if (onChainTask.state.tag === "Expired") {
      if (updated.status !== "EXPIRED") {
        const expEvent = await findTaskTransactionEvent(task, "REFUND");
        const expTx = expEvent?.hash || updated.finalizationTx || "onchain-verified";
        updated = await recordTaskTransaction(
          updated.id,
          "REFUND",
          expTx,
          explorerTransactionUrl(expTx),
        );
      }
    }
  }

  return updated;
}

