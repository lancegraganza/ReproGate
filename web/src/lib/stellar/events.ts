import "server-only";

import { Buffer } from "buffer";
import { rpc, scValToNative } from "@stellar/stellar-sdk";
import {
  getEventCursor,
  getTaskByHash,
  recordIndexedEvents,
  recordTaskTransaction,
} from "@/lib/server/repository";
import { requireContractIds, stellarConfig } from "./config";
import { planForContractEvent } from "./event-reconciliation";
import { verifyFinalizedTask, verifyFundedReward, verifyRegisteredTask } from "./server";

function bytesToHex(value: unknown): string | undefined {
  if (Buffer.isBuffer(value)) return value.toString("hex");
  if (value instanceof Uint8Array) return Buffer.from(value).toString("hex");
  return undefined;
}

export async function syncContractEvents(): Promise<{
  indexed: number;
  reconciled: number;
  cursor?: string;
}> {
  const ids = requireContractIds();
  const server = new rpc.Server(stellarConfig.rpcUrl);
  const cursor = await getEventCursor();
  const latest = await server.getLatestLedger();
  const startLedger = Math.max(latest.sequence - 1_000, 1);
  const response = await server.getEvents({
    ...(cursor ? { cursor } : { startLedger }),
    filters: [{ type: "contract", contractIds: [ids.registry, ids.vault] }],
    limit: 100,
  });
  const events = response.events.filter((event) => event.contractId).map((event) => {
    const topic = event.topic.map((value) => scValToNative(value));
    const eventType = typeof topic[0] === "string" ? topic[0] : undefined;
    const taskHash = bytesToHex(topic[1]);
    return {
      id: event.id,
      contractId: event.contractId!.contractId(),
      ledger: event.ledger,
      eventType,
      taskHash,
      transactionHash: event.txHash,
      explorerUrl: stellarConfig.explorerUrl
        ? `${stellarConfig.explorerUrl}/tx/${event.txHash}`
        : undefined,
      payload: {
        topic,
        value: scValToNative(event.value),
        transactionHash: event.txHash,
      },
    };
  });
  const nextCursor = events.length ? response.cursor : cursor;
  const result = await recordIndexedEvents(events, nextCursor);
  let reconciled = 0;
  for (const event of events) {
    if (!event.eventType || !event.taskHash || !event.transactionHash) continue;
    const plan = planForContractEvent(event.eventType);
    if (!plan) continue;
    const task = await getTaskByHash(event.taskHash);
    if (!task) continue;
    if (task.status !== plan.status && !plan.allowedFrom.includes(task.status)) continue;
    try {
      if (plan.transactionKind === "FUND") await verifyFundedReward(task);
      if (plan.transactionKind === "REGISTER") await verifyRegisteredTask(task);
      if (plan.transactionKind === "FINALIZE" || plan.transactionKind === "REFUND") {
        const state = await verifyFinalizedTask(task);
        if (plan.transactionKind === "FINALIZE" && state !== "VERIFIED") continue;
        if (plan.transactionKind === "REFUND" && state !== "EXPIRED") continue;
      }
      const previousStatus = task.status;
      await recordTaskTransaction(
        task.id,
        plan.transactionKind,
        event.transactionHash,
        event.explorerUrl ?? "",
      );
      if (previousStatus !== plan.status) reconciled += 1;
    } catch (error) {
      console.warn("Ignored contract event that did not match the off-chain task", {
        eventId: event.id,
        taskHash: event.taskHash,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { ...result, reconciled, cursor: nextCursor };
}

let lastSyncAt = 0;
let activeSync: Promise<{ indexed: number; reconciled: number; cursor?: string }> | undefined;

export async function syncContractEventsThrottled() {
  if (activeSync) return activeSync;
  if (Date.now() - lastSyncAt < 10_000) return { indexed: 0, reconciled: 0 };
  activeSync = syncContractEvents().finally(() => {
    lastSyncAt = Date.now();
    activeSync = undefined;
  });
  return activeSync;
}
