"use client";

import type { WalletAuthPurpose } from "@/lib/server/wallet-auth";

export async function authorizeWalletMutation(
  wallet: string,
  purpose: WalletAuthPurpose,
  signTransaction: (xdr: string) => Promise<string>,
  taskId?: string,
): Promise<{ challengeId: string; signedXdr: string }> {
  const response = await fetch("/api/auth/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet, purpose, taskId }),
  });
  const body = (await response.json()) as { challengeId?: string; xdr?: string; error?: string };
  if (!response.ok || !body.challengeId || !body.xdr) {
    throw new Error(body.error ?? "Could not create wallet authorization.");
  }
  return { challengeId: body.challengeId, signedXdr: await signTransaction(body.xdr) };
}

