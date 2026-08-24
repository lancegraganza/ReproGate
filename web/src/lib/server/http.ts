import { ZodError } from "zod";

export function errorResponse(error: unknown, fallbackStatus = 500): Response {
  if (error instanceof ZodError) {
    return Response.json(
      { error: error.issues[0]?.message ?? "Invalid request.", issues: error.issues },
      { status: 400 },
    );
  }
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  const normalized = message.toLowerCase();
  const status =
    normalized.includes("not found") || normalized.includes("not public")
      ? 404
      : normalized.includes("duplicate") || normalized.includes("already")
        ? 409
        : normalized.includes("invalid") ||
            normalized.includes("expired") ||
            normalized.includes("not accepting") ||
            normalized.includes("does not match")
          ? 400
          : fallbackStatus;
  if (status >= 500) console.error("ReproGate request failed", error);
  return Response.json({ error: message }, { status });
}

