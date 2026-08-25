import "server-only";

import type { CreateSubmissionInput } from "@/lib/validation/schemas";
import { createSubmission, type SubmissionChainStatus } from "./repository";
import { verifyAndConsumeWalletAuthorization, type WalletAuthorization } from "./wallet-auth";

export async function submitEvidence(
  taskId: string,
  input: CreateSubmissionInput,
  authorization: WalletAuthorization,
  options: { chainStatus?: SubmissionChainStatus } = {},
) {
  await verifyAndConsumeWalletAuthorization(input.wallet, "SUBMIT_EVIDENCE", authorization, taskId);
  return createSubmission(taskId, input, options);
}
