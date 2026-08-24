import { errorResponse } from "@/lib/server/http";
import { getTask } from "@/lib/server/repository";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const task = await getTask(id);
    if (!task) return Response.json({ error: "Task not found." }, { status: 404 });
    return Response.json({ task });
  } catch (error) {
    return errorResponse(error);
  }
}

