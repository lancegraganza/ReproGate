import { errorResponse } from "@/lib/server/http";
import { createWalletChallenge } from "@/lib/server/wallet-auth";
import { walletChallengeRequestSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const input = walletChallengeRequestSchema.parse(await request.json());
    const forwardedFor =
      request.headers.get("x-vercel-forwarded-for") ??
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const callerKey = `${forwardedFor.split(",")[0]?.trim()}|${request.headers.get("user-agent") ?? "unknown"}`;
    return Response.json(
      await createWalletChallenge(input.wallet, input.purpose, input.taskId, callerKey),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
