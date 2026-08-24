import { StrKey } from "@stellar/stellar-sdk";
import { z } from "zod";
import { xlmToStroops } from "@/lib/stellar/amounts";

const MAX_TASK_DURATION_MS = 90 * 24 * 60 * 60 * 1_000;

export const walletAddressSchema = z
  .string()
  .trim()
  .refine((value) => StrKey.isValidEd25519PublicKey(value), {
    message: "Enter a valid Stellar G-address.",
  });

export const githubIssueUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname === "github.com";
    } catch {
      return false;
    }
  }, "Use a public https://github.com issue URL.");

export const createTaskSchema = z.object({
  githubIssueUrl: githubIssueUrlSchema,
  objective: z.string().trim().min(20).max(2_000),
  targetEnvironment: z.string().trim().min(3).max(300),
  reproductionNotes: z.string().trim().max(4_000).default(""),
  threshold: z.coerce.number().int().min(2).max(5),
  deadline: z.coerce.date().refine((date) => date.getTime() > Date.now() + 300_000, {
    message: "Deadline must be at least five minutes in the future.",
  }),
  rewardXlm: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,7})?$/, "Use an XLM amount with at most 7 decimals.")
    .refine((value) => Number(value) > 0, "Reward must be greater than zero."),
  maintainerWallet: walletAddressSchema,
}).superRefine((value, context) => {
  if (value.deadline.getTime() > Date.now() + MAX_TASK_DURATION_MS) {
    context.addIssue({
      code: "custom",
      path: ["deadline"],
      message: "Deadline must be within 90 days so contract storage stays live.",
    });
  }
  if (xlmToStroops(value.rewardXlm) < BigInt(value.threshold)) {
    context.addIssue({
      code: "custom",
      path: ["rewardXlm"],
      message: "Reward must contain at least one stroop per required contributor.",
    });
  }
});

export const walletAuthorizationSchema = z.object({
  challengeId: z.string().uuid(),
  signedXdr: z.string().min(100).max(10_000),
});

export const createTaskRequestSchema = createTaskSchema.extend({
  authorization: walletAuthorizationSchema,
});

export const walletChallengeRequestSchema = z.object({
  wallet: walletAddressSchema,
  purpose: z.enum(["CREATE_TASK", "SUBMIT_EVIDENCE", "POST_REPORT"]),
  taskId: z.string().uuid().optional(),
}).superRefine((value, context) => {
  if (value.purpose !== "CREATE_TASK" && !value.taskId) {
    context.addIssue({ code: "custom", message: "A task is required for this authorization." });
  }
});

export const dependenciesSchema = z.record(
  z.string().trim().min(1).max(100),
  z.string().trim().min(1).max(100),
);

export const environmentSchema = z.object({
  operatingSystem: z.string().trim().min(2).max(100),
  runtime: z.string().trim().min(2).max(100),
  runtimeVersion: z.string().trim().min(1).max(100),
  packageManager: z.string().trim().min(2).max(100),
  packageManagerVersion: z.string().trim().min(1).max(100),
  dependencies: dependenciesSchema,
});

export const createSubmissionSchema = z.object({
  wallet: walletAddressSchema,
  verdict: z.enum(["REPRODUCED", "NOT_REPRODUCED"]),
  environment: environmentSchema,
  reproductionSteps: z.string().trim().min(30).max(20_000),
  relevantLogs: z.string().trim().min(10).max(40_000),
  notes: z.string().trim().min(5).max(8_000),
  minimalReproductionUrl: z.union([z.literal(""), z.string().trim().url().max(500)]).optional(),
  commitHash: z
    .union([z.literal(""), z.string().trim().regex(/^[a-fA-F0-9]{7,64}$/)])
    .optional(),
});

export const createSubmissionRequestSchema = createSubmissionSchema.extend({
  authorization: walletAuthorizationSchema,
});

export const taskTransactionSchema = z.object({
  kind: z.enum(["FUND", "REGISTER", "FINALIZE", "REFUND"]),
  hash: z.string().trim().regex(/^[a-fA-F0-9]{64}$/, "Invalid transaction hash."),
});

export const transferSchema = z.object({
  destination: walletAddressSchema,
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,7})?$/)
    .refine((value) => Number(value) > 0),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
