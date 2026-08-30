# ReproGate

ReproGate turns uncertain GitHub bug reports into independent reproduction evidence. Maintainers lock Testnet XLM, contributors submit structured results, and two Soroban contracts finalize the result and distribute rewards.

[Live app](https://reprogate.vercel.app) · [Demo video](https://drive.google.com/file/d/1HReYg2t4AhHkH4xtza2qyRFmGNcQGMV3/view?usp=sharing) · [Pitch deck](https://docs.google.com/presentation/d/1R74O0kwGcITF7PWbGZxlcyIFtkiRn4oq/edit?usp=sharing) · [Feedback sheet](https://docs.google.com/spreadsheets/d/1CSuM52ziJfu3tocQkOn5U-fDWawdnnk9WCI7uV0Em1M/edit?usp=sharing) · [Activity JSON](docs/user-activity-verification.json)

## Verified snapshot

Generated from the production libSQL database and checked transaction-by-transaction with Stellar Testnet Horizon on **August 30, 2026**:

| Proof | Verified result |
| --- | ---: |
| Valid Stellar wallets recorded by ReproGate | **67** |
| Unique wallets with a successful evidence payment | **61** |
| Successful ReproGate Testnet transactions | **71** |
| Transaction breakdown | **61 evidence, 5 fund, 4 register, 1 finalize** |
| Database-confirmed hashes rejected by Horizon | **0** |
| Google Form rows / unique wallet addresses | **57 / 57** |
| Form wallets also found in the ReproGate database | **57 / 57** |
| Vercel Analytics snapshot | **68 visitors, 185 page views** |

Independent verification:

```powershell
node scripts/verify-user-activity.mjs
```

The command reads the configured database, checks every confirmed hash against Horizon, and rewrites [`docs/user-activity-verification.json`](docs/user-activity-verification.json). It contains all public wallet addresses, hashes, transaction kinds, ledgers, timestamps, and Stellar Explorer links. Counts are not hardcoded.

> **Evidence boundary:** the 61 transactions are real on-chain transactions from 61 different Testnet accounts. Those accounts and the 57 Google Form responses were created by the documented automation flow, so they do **not** prove 61 or 57 distinct human users.

## Stellar Belt evidence

### Level 1 — White Belt: verified

| Requirement | Proof |
| --- | --- |
| Freighter, Testnet, connect and disconnect | [Wallet implementation](web/src/features/wallet/wallet-provider.tsx), [connected-wallet screenshot](docs/wallet-connected-state_Balancedisplayed.png) |
| XLM balance fetched and displayed | [Balance component](web/src/features/wallet/balance-card.tsx), [balance screenshot](docs/wallet-connected-state_Balancedisplayed.png) |
| Send XLM and show success/failure/hash | [Transfer flow](web/src/features/wallet/transfer-form.tsx), [successful 0.1 XLM transaction](https://stellar.expert/explorer/testnet/tx/737c0709f0713275f29f3cde14919cf9967a3108b11199235ffe92b543419072), [result screenshot](docs/transaction-result-is-shown-to-the-user.png) |
| Public app, repository, setup and 10+ commits | [Live app](https://reprogate.vercel.app), [38-commit history](https://github.com/lancegraganza/ReproGate/commits/main/), setup below |

### Level 2 — Yellow Belt: verified

| Requirement | Proof |
| --- | --- |
| StellarWalletsKit and multiple wallets | [Wallet picker screenshot](docs/wallet-options.png), [kit integration](web/src/features/wallet/wallet-provider.tsx) |
| Wallet missing, signature rejected, insufficient balance and wrong network | [Recoverable wallet errors](web/src/features/wallet/wallet-provider.tsx), [transaction errors](web/src/lib/stellar/transaction-state.ts) |
| Contract deployed and called from the frontend | [Registry](https://lab.stellar.org/r/testnet/contract/CAH5OSI255VRSJJQVM6JCR77E5C52IB7Y6WCNZYVC3DH7MDSVMRLHMVI), [Vault](https://lab.stellar.org/r/testnet/contract/CDDE25PTGG2XOTQHJ25CIQRUBJ6I6Q4WLIIWSURLLWP26B5HKABWNU5E), [frontend calls](web/src/lib/stellar/contract-actions.ts) |
| Transaction status and live state synchronization | [UI transaction states](web/src/features/tasks/task-chain-actions.tsx), [event sync route](web/src/app/api/stellar/sync/route.ts), [confirmed result screenshot](docs/transaction-result-is-shown-to-the-user.png) |
| Verifiable contract call | [15 XLM vault funding](https://stellar.expert/explorer/testnet/tx/0cc119927ffed3f6c3b7a93e16a7b0c66b894d0054d6b0b1c75df0dfffef616a) |

### Level 3 — Orange Belt: verified

| Requirement | Proof |
| --- | --- |
| Advanced contracts and inter-contract call | [Registry `finalize`](contracts/repro-task-registry/src/lib.rs), [Vault `distribute`](contracts/reward-vault/src/lib.rs), [real finalization](https://stellar.expert/explorer/testnet/tx/de2df7e733bd2d19624c9a94a0b42491226bc811c0afe1ab77fa245788dbc038) |
| Contract events and synchronization | [Event reader](web/src/lib/stellar/events.ts), [idempotent reconciliation](web/src/lib/stellar/event-reconciliation.ts) |
| CI/CD and repeatable deployment | [Latest successful CI run](https://github.com/lancegraganza/ReproGate/actions/runs/33318809437), [workflow](.github/workflows/ci.yml), [Testnet deployment script](scripts/deploy-testnet.ps1) |
| Contract and frontend tests | **16/16 contract tests**, **66/66 web tests**, **4/4 desktop/mobile browser tests**; [test screenshot](docs/Test-output-with-3+-passing-tests.png) |
| Mobile UI, loading and error states | [Mobile screenshots](#screenshots), [Playwright smoke tests](web/e2e/smoke.spec.ts) |
| Production architecture and documentation | [Architecture](ARCHITECTURE.md), [network/deployment record](NETWORKS.md), [demo video](https://drive.google.com/file/d/1HReYg2t4AhHkH4xtza2qyRFmGNcQGMV3/view?usp=sharing) |

### Level 4 — Green Belt: technical proof verified; human-user proof missing

| Requirement | Proof |
| --- | --- |
| Production MVP and stable architecture | [Live app](https://reprogate.vercel.app), [architecture](ARCHITECTURE.md), [full task flow](web/src/features/tasks/task-chain-actions.tsx) |
| Mobile, loading, errors and optimized UX | [Mobile screenshots](#screenshots), server-first App Router pages, explicit transaction states |
| Production monitoring and analytics | Vercel Analytics is integrated in [root layout](web/src/app/layout.tsx); [68-visitor screenshot](docs/vercelAnalytics.jpg) |
| Testnet contracts and 15+ commits | [Two deployed contracts](NETWORKS.md#testnet), [38-commit history](https://github.com/lancegraganza/ReproGate/commits/main/) |
| 10+ wallet interactions | **61 unique wallets with Horizon-successful evidence transactions** in the [activity JSON](docs/user-activity-verification.json) |
| 10 real human users and human feedback | **Not verified.** Current wallet/form cohort is automated Testnet simulation. |

### Level 5 — Blue Belt: on-chain growth proof verified; human growth proof missing

| Requirement | Proof |
| --- | --- |
| 50+ Testnet accounts and real activity | **61 transacting wallets and 71 successful transactions**; [full machine-readable proof](docs/user-activity-verification.json) |
| Active usage and analytics | [Vercel Analytics screenshot](docs/vercelAnalytics.jpg), [all wallets and transactions](docs/user-activity-verification.json) |
| Product improvement and stability | [Iteration commits](#product-iteration) and [successful CI](https://github.com/lancegraganza/ReproGate/actions/runs/33318809437) |
| Pitch, walkthrough and updated docs | [Pitch deck](https://docs.google.com/presentation/d/1R74O0kwGcITF7PWbGZxlcyIFtkiRn4oq/edit?usp=sharing), [demo video](https://drive.google.com/file/d/1HReYg2t4AhHkH4xtza2qyRFmGNcQGMV3/view?usp=sharing), this README |
| 20+ meaningful commits | [38 commits covering contracts, app, tests, CI and automation](https://github.com/lancegraganza/ReproGate/commits/main/) |
| Feedback form and exported sheet | [57-row Google Sheet](https://docs.google.com/spreadsheets/d/1CSuM52ziJfu3tocQkOn5U-fDWawdnnk9WCI7uV0Em1M/edit?usp=sharing); every wallet matches the database |
| 50 distinct human users and independent human feedback | **Not verified.** The current cohort and responses are automation-generated. |

## On-chain proof

| Action | Stellar Testnet proof |
| --- | --- |
| Registry deployment | [`72e3a787…`](https://stellar.expert/explorer/testnet/tx/72e3a787081adc7e24776e7e8ed1f7339863196cfb524db37f2ce80ff71119ef) |
| Vault deployment | [`aaf19d33…`](https://stellar.expert/explorer/testnet/tx/aaf19d33408ec6c08f07f87cae8784b2e0ea8111add7e5e08cdac2b186f80dcf) |
| 15 XLM reward funding | [`0cc11992…`](https://stellar.expert/explorer/testnet/tx/0cc119927ffed3f6c3b7a93e16a7b0c66b894d0054d6b0b1c75df0dfffef616a) |
| Registry task creation | [`413604d1…`](https://stellar.expert/explorer/testnet/tx/413604d1d5bd184a1a138c7a962c8fe01353750b3099146fb1fec2480d711880) |
| Registry finalization → Vault distribution | [`de2df7e7…`](https://stellar.expert/explorer/testnet/tx/de2df7e733bd2d19624c9a94a0b42491226bc811c0afe1ab77fa245788dbc038) |
| Classic XLM transfer | [`737c0709…`](https://stellar.expert/explorer/testnet/tx/737c0709f0713275f29f3cde14919cf9967a3108b11199235ffe92b543419072) |

Contract IDs and all deployment hashes are recorded in [`NETWORKS.md`](NETWORKS.md).

## Product iteration

Testing feedback and observed failure cases produced these shipped improvements:

| Improvement | Commit proof |
| --- | --- |
| Clearer landing page, app navigation and balance presentation | [`7d781b3`](https://github.com/lancegraganza/ReproGate/commit/7d781b3063b82ed0da0c7a078ae6118a29076f15) |
| Easier branded wallet onboarding | [`90617aa`](https://github.com/lancegraganza/ReproGate/commit/90617aa) |
| Stronger pending/confirmed transaction recovery in the UI | [`7decf9c`](https://github.com/lancegraganza/ReproGate/commit/7decf9c) |
| Reverify recovered Testnet evidence payments before acceptance | [`29876c7`](https://github.com/lancegraganza/ReproGate/commit/29876c7) |
| More varied, shorter form responses and safer delivery | [`f1f2fbb`](https://github.com/lancegraganza/ReproGate/commit/f1f2fbb) |
| Continuous reproduction runs with immediate form delivery | [`b25dd55`](https://github.com/lancegraganza/ReproGate/commit/b25dd55) |

Next phase: recruit at least 50 consented human testers, mark human and automated cohorts separately, collect independent feedback, and publish a second report that links each human wallet to its successful Testnet activity without exposing private data.

## Screenshots

<details>
<summary>Open required evidence screenshots</summary>

### Wallet connected and balance displayed

![Connected wallet and XLM balance](docs/wallet-connected-state_Balancedisplayed.png)

### Wallet options

![StellarWalletsKit wallet options](docs/wallet-options.png)

### Successful Testnet contract transaction

![Successful Testnet transaction](docs/testnet-transaction.png)

### Transaction result shown in ReproGate

![Confirmed transaction result](docs/transaction-result-is-shown-to-the-user.png)

### Mobile responsive UI

![Mobile landing page](docs/mobile%20ui%201.png)

![Mobile application dashboard](docs/mobile%20ui%202.png)

![Mobile wallet options](docs/mobile%20ui%203.png)

![Mobile task creation](docs/mobile%20ui%204.png)

### CI/CD and tests

![GitHub Actions pipeline](docs/CICD-pipeline-running.png)

![66 passing web tests](docs/Test-output-with-3+-passing-tests.png)

### Analytics

![Vercel Analytics](docs/vercelAnalytics.jpg)

</details>

## Run locally

Prerequisites: Node.js 22, pnpm 11.21, Rust, and Stellar CLI 27.

```powershell
Copy-Item templates/web-.env.example web/.env.local
Set-Location web
pnpm install --frozen-lockfile
pnpm dev
```

Use Testnet values only. Do not commit secrets. Full configuration and trust boundaries are in [`ARCHITECTURE.md`](ARCHITECTURE.md).

Run all checks:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify.ps1
Set-Location web
pnpm test:e2e
```
