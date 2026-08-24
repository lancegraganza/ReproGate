# ReproGate

ReproGate turns uncertain public GitHub bug reports into independently confirmed reproduction results. Maintainers fund Testnet XLM rewards; student developers submit structured local evidence; a deterministic engine compares environments; Soroban records the result and pays accepted contributors atomically.

## Verify it quickly

- [Repro Task Registry](https://lab.stellar.org/r/testnet/contract/CAH5OSI255VRSJJQVM6JCR77E5C52IB7Y6WCNZYVC3DH7MDSVMRLHMVI)
- [Reward Vault](https://lab.stellar.org/r/testnet/contract/CDDE25PTGG2XOTQHJ25CIQRUBJ6I6Q4WLIIWSURLLWP26B5HKABWNU5E)
- [2 XLM funding](https://stellar.expert/explorer/testnet/tx/9fdb126a67e18e5e1f381d687a6a00570eb6fbd1ca32782f317b221859d687d9)
- [Registry invocation](https://stellar.expert/explorer/testnet/tx/06b624053e8c2311028e3b6c69cc11a3f781414abbb8de3687c7ddb6440cb895)
- [Atomic finalization and two 1 XLM payouts](https://stellar.expert/explorer/testnet/tx/52223943fc94b5648d802c6d9b52dc194fec801d57d51e8ab8082e3ae21f81c1)
- [Classic 0.1 XLM transfer](https://stellar.expert/explorer/testnet/tx/737c0709f0713275f29f3cde14919cf9967a3108b11199235ffe92b543419072)
- 16 Soroban tests, 44 frontend/domain/integration tests, 4 desktop/mobile browser tests, lint, typecheck, and build
- All hashes and network facts: [NETWORKS.md](NETWORKS.md)

## Product

Issue threads often collapse into “works for me” because environment details are inconsistent and no independent threshold exists. ReproGate gives maintainers an actionable comparison and gives student developers practice in minimal reproduction, exact versions, logs, and technical communication.

No repository or submitted code is executed. Contributors reproduce locally and submit evidence only.

### Flow

1. A maintainer connects a wallet and imports a public GitHub issue.
2. They create a signed task with objective, environment, threshold, deadline, and reward.
3. They fund native XLM in the vault and register the task.
4. Independent wallets submit normalized evidence. Duplicate wallets are rejected and similar evidence is excluded.
5. The engine classifies reproduced, not reproduced, conflicting, insufficient, or environment-specific results.
6. The registry finalizes through the vault; unique accepted contributors are paid atomically.
7. Events reconcile the UI and a structured GitHub report is ready.

Stellar supplies user-controlled signing, fast Testnet settlement, the native XLM SAC, observable events, and atomic cross-contract calls. Evidence stays off-chain while money and final state remain public.

## Architecture

- `web/`: Next.js 16 App Router, TypeScript, Tailwind, libSQL, StellarWalletsKit v2, SDK 17, and Vercel Analytics.
- `contracts/repro-task-registry`: lifecycle, threshold/deadline checks, result hash, and vault orchestration.
- `contracts/reward-vault`: XLM custody, deterministic split, replay protection, payout/refund exclusivity.
- `web/src/lib/verification`: normalization, copy detection, confirmation, and classification.
- `web/src/lib/stellar/generated`: CLI-generated typed clients.
- `GET|POST /api/stellar/sync`: authenticated, cursor-based, idempotent event/state reconciliation.

See [ARCHITECTURE.md](ARCHITECTURE.md) and [DECISIONS.md](DECISIONS.md).

## Setup

Prerequisites: Node.js 22, pnpm 11.21, Rust 1.96+, Stellar CLI 27, and Docker only for local Quickstart.

```powershell
Copy-Item web/.env.example web/.env.local
Set-Location web
pnpm install --frozen-lockfile
pnpm dev
```

Public issue import needs no GitHub login. `GITHUB_TOKEN` is optional and only needed for higher limits or posting. Local development uses `web/.data/reprogate.db`; Vercel requires remote durable libSQL.
Hosted event polling uses the five-minute Vercel cron in `web/vercel.json`; configure a random `CRON_SECRET` so the endpoint rejects public invocations.

## Verification

```powershell
./scripts/verify.ps1
Set-Location web
pnpm test:e2e
```

Individual commands: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `cargo test --workspace`, and `stellar contract build`.

## Testnet deployment

```powershell
stellar keys generate reprogate-deployer --secure-store --fund --network testnet
./scripts/deploy-testnet.ps1 -Identity reprogate-deployer
```

The script runs gates, deploys both contracts, configures references, regenerates bindings from deployed IDs, and prints only public values. `scripts/smoke-testnet.ps1` runs a unique lock/register/finalize/payout flow.

## Environment

| Variable | Required |
| --- | --- |
| `NEXT_PUBLIC_STELLAR_NETWORK` | yes; `testnet` or `local` |
| `NEXT_PUBLIC_REPRO_REGISTRY_CONTRACT_ID` | for contract flows |
| `NEXT_PUBLIC_REWARD_VAULT_CONTRACT_ID` | for contract flows |
| `NEXT_PUBLIC_STELLAR_RPC_URL`, `NEXT_PUBLIC_STELLAR_HORIZON_URL` | optional defaults |
| `DATABASE_URL`, `DATABASE_AUTH_TOKEN` | remote database; URL required on Vercel |
| `GITHUB_TOKEN` | optional; required to post comments |
| `CRON_SECRET` | required on Vercel for authenticated event polling |

## Security and deployment status

Wallet secrets never enter the app. Mutations use single-use, non-transfer wallet-signed challenges with distributed rate limits. Contract callbacks are bound to the expected transaction event and full typed state. Mainnet is rejected. Arbitrary imported code is never executed.

Contracts and the full application lifecycle are live-verified on Testnet. Local Quickstart needs Docker, unavailable on this machine. Vercel additionally needs user-owned Vercel and durable libSQL credentials; the app intentionally refuses ephemeral Vercel storage.
