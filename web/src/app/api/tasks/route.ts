import type { TaskStatus } from "@/types/domain";
import { importGitHubIssue } from "@/lib/github/issues";
import { createTask, listTasks } from "@/lib/server/repository";
import { errorResponse } from "@/lib/server/http";
import { verifyAndConsumeWalletAuthorization } from "@/lib/server/wallet-auth";
import { createTaskRequestSchema } from "@/lib/validation/schemas";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const status = params.get("status") as TaskStatus | null;
    const wallet = params.get("wallet") ?? undefined;
    return Response.json({ tasks: await listTasks({ status: status ?? undefined, wallet }) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const requestInput = createTaskRequestSchema.parse(await request.json());
    const { authorization, ...input } = requestInput;
    await verifyAndConsumeWalletAuthorization(
      input.maintainerWallet,
      "CREATE_TASK",
      authorization,
    );
    const issue = await importGitHubIssue(input.githubIssueUrl);
    const task = await createTask(input, issue);
    return Response.json({ task }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
