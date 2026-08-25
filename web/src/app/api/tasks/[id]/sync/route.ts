import { errorResponse } from "@/lib/server/http";
import { reconcileTaskWithChain } from "@/lib/stellar/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const task = await reconcileTaskWithChain(id);
    return Response.json({ task });
  } catch (error) {
    return errorResponse(error);
  }
}
