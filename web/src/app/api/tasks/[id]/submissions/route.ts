import { errorResponse } from "@/lib/server/http";
import { createSubmission } from "@/lib/server/repository";
import { verifyAndConsumeWalletAuthorization } from "@/lib/server/wallet-auth";
import { createSubmissionRequestSchema } from "@/lib/validation/schemas";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const requestInput = createSubmissionRequestSchema.parse(await request.json());
    const { authorization, ...input } = requestInput;
    await verifyAndConsumeWalletAuthorization(
      input.wallet,
      "SUBMIT_EVIDENCE",
      authorization,
      id,
    );
    const result = await createSubmission(id, input);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
