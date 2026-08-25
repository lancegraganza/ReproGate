import "server-only";

import { z } from "zod";
import type { ReproTask } from "@/types/domain";

const generatedEvidenceSchema = z.object({
  verdict: z.literal("REPRODUCED"),
  environment: z.object({
    operatingSystem: z.string().trim().min(2).max(100),
    runtime: z.string().trim().min(2).max(100),
    runtimeVersion: z.string().trim().min(1).max(100),
    packageManager: z.string().trim().min(2).max(100),
    packageManagerVersion: z.string().trim().min(1).max(100),
    dependencies: z.record(z.string().trim().min(1).max(100), z.string().trim().min(1).max(100))
      .refine((value) => Object.keys(value).length >= 1 && Object.keys(value).length <= 12),
  }),
  reproductionSteps: z.string().trim().min(30).max(20_000),
  relevantLogs: z.string().trim().min(10).max(40_000),
  notes: z.string().trim().min(5).max(8_000),
  googleFeedback: z.string().trim().min(1).max(300),
});

export type GeneratedEvidence = z.infer<typeof generatedEvidenceSchema>;

// Gemini's JSON MIME type alone does not guarantee the shape expected by the
// evidence validator. Keep this REST JSON Schema in sync with the required
// fields above so the model cannot collapse `environment` into a free-form
// string (which caused the first production cron run to fail validation).
const generatedEvidenceResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    verdict: { type: "string", enum: ["REPRODUCED"] },
    environment: {
      type: "object",
      additionalProperties: false,
      properties: {
        operatingSystem: { type: "string" },
        runtime: { type: "string" },
        runtimeVersion: { type: "string" },
        packageManager: { type: "string" },
        packageManagerVersion: { type: "string" },
        dependencies: {
          type: "object",
          additionalProperties: { type: "string" },
        },
      },
      required: [
        "operatingSystem",
        "runtime",
        "runtimeVersion",
        "packageManager",
        "packageManagerVersion",
        "dependencies",
      ],
    },
    reproductionSteps: { type: "string" },
    relevantLogs: { type: "string" },
    notes: { type: "string" },
    googleFeedback: { type: "string" },
  },
  required: [
    "verdict",
    "environment",
    "reproductionSteps",
    "relevantLogs",
    "notes",
    "googleFeedback",
  ],
} as const;

const reproductionVariations = [
  {
    step: "Repeat once after force-stopping and reopening the app.",
    log: "replay=clean-launch result=tag-visible",
    note: "A clean launch showed the same ending marker.",
  },
  {
    step: "Repeat in a fresh conversation without changing the prompt text.",
    log: "replay=fresh-conversation result=tag-visible",
    note: "The result was consistent in a new conversation.",
  },
  {
    step: "Repeat after switching the device between portrait and landscape.",
    log: "replay=orientation-change result=tag-visible",
    note: "The rendering issue did not depend on the initial orientation.",
  },
  {
    step: "Repeat once with the same input after clearing the previous response.",
    log: "replay=cleared-response result=tag-visible",
    note: "Clearing the previous response did not remove the extra tag.",
  },
];

export function randomizeEvidence(generated: GeneratedEvidence, seed: string): GeneratedEvidence {
  const index = Number.parseInt(seed.replaceAll("-", "").slice(0, 8), 16) % reproductionVariations.length;
  const variation = reproductionVariations[index] ?? reproductionVariations[0];
  const marker = seed.replaceAll("-", "").slice(-8);
  return {
    ...generated,
    reproductionSteps: `${generated.reproductionSteps.slice(0, 19_500)}\n${variation.step}`,
    relevantLogs: `${generated.relevantLogs.slice(0, 39_500)}\n[synthetic-trace ${marker}] ${variation.log}`,
    notes: `${generated.notes.slice(0, 7_500)} ${variation.note}`,
  };
}

function responseText(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const candidates = (body as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates;
  return candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
}

function parseJson(value: string): unknown {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] ?? value;
  return JSON.parse(fenced);
}

export async function generateEvidence(task: ReproTask, seed: string): Promise<GeneratedEvidence> {
  const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite";
  const context = JSON.stringify({
    objective: task.objective,
    targetEnvironment: task.targetEnvironment,
    reproductionNotes: task.reproductionNotes,
    issue: {
      title: task.githubIssue.title,
      body: task.githubIssue.body.slice(0, 12_000),
      url: task.githubIssue.url,
    },
  });
  const prompt = `Create one synthetic but technically realistic independent reproduction evidence package for this ReproGate task.

Task context:
${context}

Requirements:
- Return JSON only with exactly: verdict, environment, reproductionSteps, relevantLogs, notes, googleFeedback.
- verdict must be REPRODUCED because this cron exercises the reproduce-evidence path.
- environment must be an object with operatingSystem, runtime, runtimeVersion, packageManager, packageManagerVersion, and a dependencies object; never return environment as a string.
- dependencies must be a JSON object whose keys are dependency names and whose values are version strings.
- Keep the environment internally consistent with the actual issue. Prefer the mobile/device environment described in the issue when it is relevant; otherwise use a plausible current developer environment.
- Make reproductionSteps concrete, ordered, and at least 30 characters. Make logs plausible but concise; do not invent secrets, credentials, private URLs, or an on-chain transaction.
- Make notes useful and written in natural ESL-style technical English.
- googleFeedback must be natural ESL-style feedback of 1 to 20 words about the form/app experience, not a copy of the evidence.
- Use a different wording, version detail, and observation emphasis for randomization seed ${seed}; do not mention the seed.
This is a synthetic testnet simulation. Do not claim that you personally ran code. Only produce the requested evidence fields.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: generatedEvidenceResponseSchema,
          temperature: 1.05,
          maxOutputTokens: 1_600,
          thinkingConfig: { thinkingLevel: "low" },
        },
      }),
      signal: AbortSignal.timeout(45_000),
    },
  );
  if (!response.ok) throw new Error(`Gemini evidence generation failed (${response.status}).`);
  const generated = responseText(await response.json());
  if (!generated) throw new Error("Gemini returned no evidence content.");
  try {
    return generatedEvidenceSchema.parse(parseJson(generated));
  } catch {
    throw new Error("Gemini returned evidence that did not match the required JSON schema.");
  }
}
