# Architecture

## Application shape

ReproGate is a hybrid full-stack dApp. Next.js App Router owns the UI, GitHub integration, validation, deterministic verification, libSQL persistence, wallet proof verification, transaction reconciliation, and event indexing. Stellar Testnet owns funded reward state, final task state, and payout/refund exclusivity.

```text
Browser + StellarWalletsKit
        │ signed transactions / authenticated mutations
        ▼
Next.js Route Handlers + Server Components
        │                 │
        │                 ├── GitHub public issue API / optional comment API
        │                 └── libSQL task, evidence, event, and challenge records
        ▼
Stellar RPC ── ReproTaskRegistry ── cross-contract call ── RewardVault ── native XLM SAC
```

There is no second backend service. Local development uses `web/.data/reprogate.db`; Vercel requires durable remote libSQL through `DATABASE_URL` and `DATABASE_AUTH_TOKEN`.

## Next.js boundaries

- Server Components load task, history, and submission views from the repository.
- Client Components are limited to wallet access, forms, transaction progress, polling, and report actions.
- Route Handlers validate every request with Zod.
- Wallet-owned mutations use a five-minute, single-use, non-submitted Testnet challenge transaction. The server compares its immutable hash and verifies an Ed25519 signature for the claimed G-address before consuming it.
- The browser never receives database credentials, GitHub credentials, or signing material.

## Stellar architecture

`ReproTaskRegistry` stores task hash, maintainer, threshold, deadline, reward amount, state, and final result hash. It validates the matching funded reward, requires maintainer authorization, and calls the vault atomically for payout or refund.

`RewardVault` custodies native Testnet XLM through the canonical SAC. It records one reward per task hash, splits the amount deterministically across two to five unique contributors, tracks paid addresses, and makes completed/refunded states mutually exclusive.

Both contracts use typed persistent storage, bounded inputs, TTL extension, structured errors, and observable events. Generated TypeScript clients live under `web/src/lib/stellar/generated/`.

## State ownership and invariants

- GitHub issue text and structured reproduction evidence remain off-chain.
- A task opens only after vault funding and registry creation both confirm.
- One wallet may submit once per task; the database unique constraint is the final guard.
- Similar evidence is retained for audit but excluded from threshold.
- Only unique eligible wallets count. Finalization cannot occur after the deadline.
- Payout and refund are exclusive. A contributor cannot be paid twice.
- Contract state is authoritative. Confirmed callbacks and event polling reconcile the database without state downgrades.
- Mainnet values are rejected by configuration.

## Transaction and event lifecycle

UI transactions expose simulate → await signature → submit → pending → confirmed/failed. Wallet rejection, wrong network, missing wallet, insufficient balance, and RPC failures are recoverable states. The server accepts a transaction reference only after RPC confirmation and a matching typed contract read.

`GET|POST /api/stellar/sync` polls both contracts with a durable cursor behind `CRON_SECRET`; Vercel invokes it every five minutes. Event IDs are inserted idempotently, then full typed contract state is compared with off-chain task metadata before any lifecycle transition. Confirmed transaction callbacks additionally require the expected contract event, task hash, transaction hash, and ledger.

## Security and promotion

- No seed phrase, secret key, or production credential is accepted or stored.
- GitHub tokens are optional and server-only. Posting requires fresh maintainer-wallet proof.
- ReproGate never clones or executes imported repository or contributor code.
- Promotion order is web/contract gates → browser → local Quickstart when Docker is available → Testnet → Vercel.
- Mainnet requires a separate explicit request and review.
