import { errorResponse } from "@/lib/server/http";
import { getTask, recordTaskTransaction } from "@/lib/server/repository";
import {
  confirmContractTransaction,
  verifyFinalizedTask,
  verifyFundedReward,
  verifyRegisteredTask,
  verifyTaskTransactionEvent,
} from "@/lib/stellar/server";
import { explorerTransactionUrl } from "@/lib/stellar/config";
import { taskTransactionSchema } from "@/lib/validation/schemas";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const input = taskTransactionSchema.parse(await request.json());
    const task = await getTask(id);
    if (!task) throw new Error("Task not found.");
    const ledger = await confirmContractTransaction(input.hash);
    await verifyTaskTransactionEvent(task, input.kind, input.hash, ledger);

    if (input.kind === "FUND") await verifyFundedReward(task);
    if (input.kind === "REGISTER") await verifyRegisteredTask(task);
    if (input.kind === "FINALIZE" || input.kind === "REFUND") {
      const state = await verifyFinalizedTask(task);
      if (input.kind === "FINALIZE" && state !== "VERIFIED") {
        throw new Error("Expected a completed registry task.");
      }
      if (input.kind === "REFUND" && state !== "EXPIRED") {
        throw new Error("Expected an expired registry task.");
      }
    }

    const updated = await recordTaskTransaction(
      id,
      input.kind,
      input.hash,
      explorerTransactionUrl(input.hash),
    );
    return Response.json({ task: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
