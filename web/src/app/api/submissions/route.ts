import { errorResponse } from "@/lib/server/http";
import { listWalletSubmissions } from "@/lib/server/repository";

export async function GET(request: Request) {
  try {
    const wallet = new URL(request.url).searchParams.get("wallet");
    if (!wallet) throw new Error("Wallet address is required.");
    return Response.json({ submissions: await listWalletSubmissions(wallet) });
  } catch (error) { return errorResponse(error); }
}

