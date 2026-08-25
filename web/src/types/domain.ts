export type TaskStatus =
  | "DRAFT"
  | "FUNDING"
  | "OPEN"
  | "VERIFYING"
  | "VERIFIED"
  | "EXPIRED"
  | "CANCELLED"
  | "FAILED";

export type ReproductionVerdict = "REPRODUCED" | "NOT_REPRODUCED";

export type VerificationClassification =
  | "REPRODUCED"
  | "NOT_REPRODUCED"
  | "ENVIRONMENT_SPECIFIC"
  | "INSUFFICIENT_EVIDENCE"
  | "CONFLICTING";

export interface GitHubIssue {
  owner: string;
  repo: string;
  number: number;
  title: string;
  body: string;
  labels: string[];
  url: string;
  author?: string;
}

export interface StructuredEnvironment {
  operatingSystem: string;
  runtime: string;
  runtimeVersion: string;
  packageManager: string;
  packageManagerVersion: string;
  dependencies: Record<string, string>;
}

export interface VerificationGroup {
  key: string;
  verdict: ReproductionVerdict;
  environment: StructuredEnvironment;
  count: number;
  wallets: string[];
  submissionIds: string[];
}

export interface VerificationResult {
  classification: VerificationClassification;
  explanation: string;
  thresholdReached: boolean;
  groups: VerificationGroup[];
  acceptedWallets: string[];
  acceptedSubmissionIds: string[];
  resultHash: string;
}

export interface ReproTask {
  id: string;
  taskHash: string;
  githubIssue: GitHubIssue;
  objective: string;
  targetEnvironment: string;
  reproductionNotes: string;
  threshold: number;
  deadline: string;
  deadlinePassed: boolean;
  rewardStroops: string;
  maintainerWallet: string;
  status: TaskStatus;
  vaultFundingTx?: string;
  registryTx?: string;
  finalizationTx?: string;
  verification?: VerificationResult;
  githubReportUrl?: string;
  createdAt: string;
  updatedAt: string;
  submissionCount: number;
}

export interface Submission {
  id: string;
  taskId: string;
  wallet: string;
  verdict: ReproductionVerdict;
  environment: StructuredEnvironment;
  reproductionSteps: string;
  relevantLogs: string;
  notes: string;
  minimalReproductionUrl?: string;
  commitHash?: string;
  evidenceHash: string;
  normalizedEnvironmentKey: string;
  eligible: boolean;
  suspiciousReason?: string;
  chainStatus?: "PENDING" | "CONFIRMED" | "FAILED";
  transactionHash?: string;
  transactionExplorerUrl?: string;
  createdAt: string;
}

export interface TaskDetail extends ReproTask {
  submissions: Submission[];
}

export type TransactionStatus =
  | "IDLE"
  | "PREPARING"
  | "SIMULATING"
  | "AWAITING_SIGNATURE"
  | "SIGNED"
  | "SUBMITTING"
  | "SUBMITTED"
  | "PENDING"
  | "CONFIRMED"
  | "FAILED"
  | "REJECTED"
  | "EXPIRED";
