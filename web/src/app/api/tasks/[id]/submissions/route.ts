import { errorResponse } from "@/lib/server/http";
import { submitEvidence } from "@/lib/server/submissions";
import { createSubmissionRequestSchema } from "@/lib/validation/schemas";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const requestInput = createSubmissionRequestSchema.parse(await request.json());
    const { authorization, ...input } = requestInput;
    const result = await submitEvidence(id, input, authorization);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
