import { errorResponse } from "@/lib/server/http";
import { syncContractEventsThrottled } from "@/lib/stellar/events";

export const dynamic = "force-dynamic";

async function synchronize(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (process.env.VERCEL && !secret) {
      return Response.json({ error: "CRON_SECRET is required for hosted event sync." }, { status: 503 });
    }
    if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }
    return Response.json(await syncContractEventsThrottled());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: Request) {
  return synchronize(request);
}

export async function POST(request: Request) {
  return synchronize(request);
}
