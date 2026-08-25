# Decisions

## 2026-08-24 — Hybrid Next.js and Soroban architecture

- Evidence and workflow records live in libSQL; funding, final state, payout, and refund authority live on Stellar.
- This minimizes on-chain data while preserving transparent financial invariants.

## 2026-08-24 — Two contracts with one-way payout orchestration

- `ReproTaskRegistry` calls `RewardVault` during finalize/expire; the vault never decides verification.
- Verification state and custody remain separately testable while settlement is atomic.

## 2026-08-24 — Native XLM through the SAC

- Use the canonical native XLM Stellar Asset Contract, not a custom token.

## 2026-08-24 — Deterministic verification

- Normalize environments and compare eligible unique-wallet verdict groups.
- Similar evidence is stored but excluded; no AI verifier is used.

## 2026-08-24 — Transaction-signature wallet authorization

- SEP-43 message signing is not uniform across Wallets Kit modules.
- Off-chain mutations use five-minute, single-use, non-submitted transaction challenges.
- Every supported wallet already signs transactions; verification spends no XLM.

## 2026-08-24 — Durable production database required

- A local libSQL file is allowed outside Vercel. Vercel fails without `DATABASE_URL` because its filesystem is not durable.

## 2026-08-24 — RPC events plus direct state verification

- Stellar RPC handles confirmation, typed reads, and cursor-based event polling; Horizon handles balances and classic payments.
- Public rendering never performs event-index writes. A `CRON_SECRET`-protected scheduled route owns polling, while transaction callbacks verify exact event identity and full task metadata.

## 2026-08-25 — Recoverable off-chain idempotency

- Eligible evidence fingerprints use a partial unique database index, so concurrent copies cannot both count.
- GitHub reports use a database publication lease plus a stable hidden comment marker. A stale lease is reclaimable and retries discover an already-posted comment before creating another.
- Wallet challenges contain only a bump-sequence operation, expire after five minutes, are single-use, and use shared libSQL rate counters scoped to caller and caller-wallet.

## 2026-08-25 — Automated Testnet reproduction is chain-gated

- The 30-minute cron uses a new ephemeral Friendbot-funded Testnet wallet per window and never persists its secret key.
- Gemini output is JSON/schema validated before the existing evidence service is called. Cron evidence starts `PENDING`; only a confirmed Testnet payment can transition it to `CONFIRMED` and eligible evaluation.
- A real payment hash is attached to the submission and transaction reference. Every Google Form payload is held until the task's Soroban finalization and all contributor payouts are confirmed; generation, validation, wallet funding, evidence payment, finalization, or payout failure prevents the form POST.
- The Google Form field IDs are configuration values with defaults captured from the currently published form metadata, so a form edit fails visibly rather than silently writing to the wrong fields.
- cron-job.org is the sole scheduler for recurring workflows; Vercel only hosts the protected endpoints. This avoids two schedulers creating duplicate sync work, Testnet wallets, and submissions.
- The endpoint acknowledges cron-job.org with `202` and runs the durable workflow in Next's `after()` phase, preventing the external scheduler's short request timeout from interrupting Testnet confirmation.

## 2026-08-25 — Automated settlement uses a dedicated Testnet maintainer

- Randomized evidence retains one confirmed normalized environment per task so independent runs can reach the deterministic threshold without copying steps or logs.
- The run that reaches the threshold enters `FINALIZATION_PENDING`; a server-only `CRON_MAINTAINER_SECRET` may sign only when its public key exactly matches the target task maintainer.
- Registry finalization and Reward Vault distribution remain one atomic Soroban transaction. Completion requires RPC `SUCCESS`, the expected task events and result hash, completed vault state, and paid state for every accepted wallet.
- Submitted evidence and finalization hashes are persisted separately. Before finalization broadcast, the exact signed envelope and its hash are checkpointed server-side; recovery resubmits that same envelope idempotently, then verifies the stored hash or discovers a legacy task event.
- Finalization atomically reserves a frozen verification snapshot only when no evidence transaction is pending. Google Form delivery uses a durable pre-submit state; an uncertain response is retained for audit instead of being blindly retried.
- This signing exception is Testnet-only and intended for a dedicated automation-owned task. Mainnet and end-user wallet custody remain prohibited.

## 2026-08-25 — Wallet reporting is application-observed and read-only

- `scripts/list-wallets.mjs` reports unique valid Stellar public keys from maintainer tasks, submissions, wallet challenges, automated reproduction runs, and indexed event payloads.
- The report intentionally does not infer wallets from unindexed chain history and never writes to the local or remote libSQL database.

## 2026-08-24 — Mainnet disabled in code

- Only `local` and `testnet` are accepted. `mainnet` and `public` throw.
