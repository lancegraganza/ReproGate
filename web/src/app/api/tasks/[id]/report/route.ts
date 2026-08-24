import { buildGitHubReport, postGitHubReport } from "@/lib/github/report";
import { errorResponse } from "@/lib/server/http";
import {
  claimGitHubReport,
  completeGitHubReport,
  failGitHubReport,
  getTask,
  renewGitHubReportClaim,
} from "@/lib/server/repository";
import { verifyAndConsumeWalletAuthorization } from "@/lib/server/wallet-auth";
import { walletAuthorizationSchema } from "@/lib/validation/schemas";

export const maxDuration = 60;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const task = await getTask(id);
    if (!task || task.status !== "VERIFIED") throw new Error("Verified task not found.");
    return Response.json({ report: buildGitHubReport(task, new URL(request.url).origin) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const task = await getTask(id);
    if (!task || task.status !== "VERIFIED") throw new Error("Verified task not found.");
    if (task.githubReportUrl) return Response.json({ url: task.githubReportUrl, posted: false });
    if (!process.env.GITHUB_TOKEN) {
      return Response.json(
        { error: "GITHUB_TOKEN is not configured. The report is ready to copy manually." },
        { status: 503 },
      );
    }
    const body = walletAuthorizationSchema.parse((await request.json()).authorization);
    await verifyAndConsumeWalletAuthorization(
      task.maintainerWallet,
      "POST_REPORT",
      body,
      id,
    );
    const claim = await claimGitHubReport(id);
    if (!claim.claimed) return Response.json({ url: claim.url, posted: false });
    try {
      const url = await postGitHubReport(
        task,
        new URL(request.url).origin,
        () => renewGitHubReportClaim(id, claim.attemptId),
      );
      if (!url) throw new Error("GITHUB_TOKEN is not configured.");
      await completeGitHubReport(id, url, claim.attemptId);
      return Response.json({ url, posted: true });
    } catch (error) {
      await failGitHubReport(id, claim.attemptId);
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
