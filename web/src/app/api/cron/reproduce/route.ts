import { runAutomatedReproduction } from "@/lib/server/reproduction-cron";
import { after } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function authorize(request: Request): Response | undefined {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return Response.json({ error: "CRON_SECRET is required for automated reproduction." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  return undefined;
}

async function handle(request: Request): Promise<Response> {
  const denied = authorize(request);
  if (denied) return denied;
  after(async () => {
    try {
      await runAutomatedReproduction();
    } catch (error) {
      console.error("Automated reproduction cron failed", error);
    }
  });
  return Response.json({ status: "accepted", scheduler: "cron-job.org" }, { status: 202 });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
