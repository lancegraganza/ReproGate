import { importGitHubIssue } from "@/lib/github/issues";
import { errorResponse } from "@/lib/server/http";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url).searchParams.get("url");
    if (!url) throw new Error("GitHub issue URL is required.");
    return Response.json({ issue: await importGitHubIssue(url) });
  } catch (error) {
    return errorResponse(error);
  }
}

