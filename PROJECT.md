# ReproGate

## Product

ReproGate is a **Stellar-powered bug reproduction marketplace** where software maintainers publish real bugs and student developers independently try to reproduce them.

Maintainers receive structured reproduction evidence.

Students gain practical debugging experience and earn **XLM rewards** when their reproduction result is accepted.

Example:

```text
GitHub Issue:
"App crashes during build on Node.js 22"

Reproduction Results:

Student A
Node.js 20
Not Reproduced

Student B
Node.js 22
Reproduced

Student C
Node.js 22
Reproduced

Result:
Verified Environment-Specific Bug
Affects Node.js 22

Reward:
15 XLM

Accepted Contributors:
2

Payout:
7.5 XLM each
```

ReproGate is non-custodial from the student's perspective.

Rewards are locked and distributed through Soroban contracts on **Stellar**.

---

# 1. Core Goal

Build one complete product demonstrating:

```text
GitHub Issue
     ↓
Maintainer Creates Reproduction Task
     ↓
Reward Locked
     ↓
Students Submit Independent Evidence
     ↓
Evidence Compared
     ↓
Confirmation Threshold Reached
     ↓
Bug Result Verified
     ↓
Soroban Finalizes Result
     ↓
Reward Distributed
     ↓
GitHub Issue Updated
```

The MVP should feel like a real debugging platform, not a collection of disconnected Stellar demonstrations.

---

# 2. Network Scope

Do not implement Stellar Mainnet infrastructure.

Do not spend development time on:

- Production USDC
- Mainnet RPC configuration
- Mainnet deployments
- Real-money payouts
- Production custody
- Fiat conversion
- Production KYC
- Mainnet fee optimization
- Production compliance infrastructure

For the MVP:

> **Rewards use Stellar Testnet XLM.**

---

# 3. Target Users

## Students

Primary student audience:

- Computer Science students
- Information Technology students
- Software Engineering students
- Student developers
- Junior developers learning debugging

Students gain practical experience with:

- Debugging
- Testing
- GitHub
- Dependency management
- Environment reproduction
- Logs
- Minimal reproductions
- Technical communication

---

## Maintainers

Potential maintainers include:

- Open-source maintainers
- Indie developers
- Startup developers
- Student project teams
- Small software teams

---

# 4. Technology Stack

Use:

- Next.js App Router
- TypeScript
- Tailwind CSS
- Next.js frontend
- Next.js backend
- PostgreSQL or another simple persistent database if required
- GitHub API
- StellarWalletsKit
- Stellar SDK
- Soroban
- Stellar RPC
- Stellar Testnet
- Vercel
- Vercel Analytics
- GitHub Actions

Do not create a separate backend service unless technically necessary.

Next.js should provide:

- Server Components
- Client Components where required
- Server Actions where appropriate
- Route Handlers
- Backend/domain services

---

# 5. Application Routes

Use a clear separation between marketing and product.

```text
/          → Landing page
/app       → Main ReproGate application
```

Possible application routes:

```text
/app
/app/tasks
/app/tasks/[id]
/app/create
/app/submissions
/app/history
/app/wallet
```

The exact route structure can be adjusted if a simpler architecture is better.

---

# 6. Landing Page

The root route should be a polished landing page explaining:

- The bug-report problem
- How independent reproduction works
- Why students participate
- Why maintainers benefit
- How Stellar handles transparent rewards
- How ReproGate works

Primary CTA:

> Explore Reproduction Tasks

Secondary CTA:

> Create a Task

The landing page should feel like a modern developer platform.

Avoid:

- Generic SaaS dashboards
- Excessive gradients
- Excessive animation
- AI-looking visual clutter
- Web3 jargon

---

# 7. Wallet Support

Use **StellarWalletsKit**.

The application must support:

- Wallet selection UI
- Freighter
- Other wallets supported by the installed StellarWalletsKit where practical
- Connect
- Disconnect
- Reconnect where appropriate
- Public address display
- Testnet detection

The application should reject or clearly warn when the wallet is on the wrong network.

---

# 8. Wallet Balance

Display the connected wallet's:

- XLM balance

Balance UI must support:

```text
Loading
Loaded
Refresh
Error
Disconnected
```

Balance must be clearly visible in the application.

---

# 9. XLM Transfer Utility

Include a simple wallet utility demonstrating a direct Stellar XLM transfer.

User can:

1. Enter destination address.
2. Enter XLM amount.
3. Review transaction.
4. Sign through wallet.
5. Submit.
6. Track transaction.
7. View result.

Required states:

```text
Preparing
Awaiting Signature
Submitted
Pending
Confirmed
Rejected
Failed
```

After success display:

- Transaction hash
- Confirmation
- Stellar Explorer link where available

This utility exists as part of the wallet experience and Stellar fundamentals.

---

# 10. Wallet / Transaction Errors

Explicitly handle at least:

## Wallet Not Found

Display a recoverable message.

---

## User Rejected Signature

Treat rejection as a normal user-controlled action.

Do not display it as an unexpected application crash.

---

## Insufficient XLM

Detect insufficient XLM before or during transaction creation.

---

Also handle:

- Invalid Stellar address
- Wrong network
- RPC failure
- Wallet disconnect during flow
- Transaction simulation failure
- Transaction submission failure
- Confirmation timeout
- Contract invocation failure

---

# 11. GitHub Issue Import

A maintainer can create a reproduction task from a public GitHub issue.

Input:

```text
GitHub issue URL
```

Example:

```text
https://github.com/example/project/issues/123
```

ReproGate retrieves:

- Repository
- Issue number
- Issue title
- Issue body
- Issue labels
- Issue URL
- Author where useful
- Relevant public metadata

Do not copy unnecessary GitHub data.

---

# 12. GitHub Authentication

GitHub authentication should be required only when functionality genuinely requires authenticated GitHub access.

Examples:

- Posting the final verified report
- Acting on behalf of a maintainer

Use the minimum required GitHub permissions.

Public issue browsing/import should remain as simple as practical.

Never expose GitHub secrets to the client.

---

# 13. Create Reproduction Task

Maintainer creates a task containing:

- GitHub issue
- Reproduction objective
- Target environment
- Required confirmations
- Deadline
- XLM reward
- Optional reproduction notes

Example:

```text
Issue:
Build crashes on Node.js 22

Repository:
example/web-app

Required Confirmations:
2

Target:
Node.js 22

Deadline:
48 hours

Reward:
15 XLM
```

---

# 14. Reward Funding

Before a reproduction task becomes active, the reward must be funded on Stellar.

Expected flow:

```text
Maintainer creates task
        ↓
Reward amount defined
        ↓
Wallet transaction prepared
        ↓
Maintainer signs
        ↓
XLM locked
        ↓
Task becomes Active
```

Do not mark a task as funded unless the Stellar transaction has actually been confirmed.

---

# 15. Student Task Browser

Students can browse available tasks.

Each task card should show:

- Repository
- Issue title
- Reward
- Required confirmations
- Current submissions
- Deadline
- Environment
- Task status

Filters may include:

- Open
- Completed
- Expiring soon
- Reward size
- Environment

Keep the MVP filters simple.

---

# 16. Task Status

Possible states:

```text
DRAFT
FUNDING
OPEN
VERIFYING
VERIFIED
EXPIRED
CANCELLED
FAILED
```

State transitions must be explicit and validated.

---

# 17. Reproduction Submission

A student submits structured evidence.

Required fields:

- Result
- Operating system
- Runtime
- Runtime version
- Dependency versions
- Reproduction steps
- Relevant logs
- Notes

Optional:

- Minimal reproduction URL
- Commit hash
- Screenshot
- Additional environment metadata

Possible result:

```text
REPRODUCED
NOT_REPRODUCED
```

Environment-specific classification is determined from multiple submissions.

---

# 18. Structured Environment Model

Environment information should be normalized.

Example:

```text
OS:
Windows 11

Runtime:
Node.js

Runtime Version:
22.4.0

Package Manager:
pnpm

Package Manager Version:
9.x

Relevant Dependency:
example-package@4.2.0
```

Do not treat free-form environment descriptions as the primary comparison mechanism.

---

# 19. Evidence Storage

Full reproduction evidence stays off-chain.

Store off-chain:

- Logs
- Reproduction steps
- Environment data
- Minimal reproduction URLs
- GitHub metadata

Soroban should only store the minimum information necessary for verifiable reward/state logic.

Where useful, store a deterministic hash of accepted evidence on-chain.

Never store large logs directly in Soroban.

---

# 20. Duplicate Submission Prevention

A wallet must not submit multiple independent confirmations for the same task.

Enforce:

```text
one wallet
+
one task
=
one independent submission
```

Prevent duplicate submissions at:

- Backend/domain level
- Database constraint level where applicable

Do not rely only on UI disabling.

---

# 21. Evidence Similarity / Copy Detection

The MVP should detect obvious copied submissions without requiring a complex AI system.

Use lightweight deterministic checks such as:

- Exact duplicate reproduction steps
- Duplicate normalized logs
- Identical evidence hashes
- Same minimal reproduction URL
- Suspiciously identical environment + evidence combinations

Flag suspicious submissions for exclusion or review.

Do not build a large ML plagiarism system.

---

# 22. Independent Confirmation Engine

ReproGate compares independent submissions for the same task.

The confirmation engine should group results using:

- Reproduction verdict
- Normalized environment
- Runtime/version
- Relevant dependency versions
- Evidence validity

Example:

```text
Student A
Node 20
NOT_REPRODUCED

Student B
Node 22
REPRODUCED

Student C
Node 22
REPRODUCED
```

If the confirmation threshold is:

```text
2
```

then:

```text
Node 22
REPRODUCED
2 matching independent confirmations
```

is verified.

---

# 23. Environment-Specific Bug Detection

A task may be classified as:

```text
REPRODUCED
NOT_REPRODUCED
ENVIRONMENT_SPECIFIC
INSUFFICIENT_EVIDENCE
CONFLICTING
```

Example:

```text
Node 20
2 independent NOT_REPRODUCED results

Node 22
2 independent REPRODUCED results
```

Result:

> Verified Environment-Specific Bug affecting Node.js 22.

The result must explain the evidence behind the classification.

---

# 24. Confirmation Threshold

Maintainer selects the required confirmation threshold.

For MVP:

```text
2–5 confirmations
```

Recommended default:

```text
2
```

The task cannot be automatically verified before the configured threshold is reached.

Only eligible independent submissions count.

---

# 25. Result Verification

The backend/domain layer computes the proposed verified result.

Conceptually:

```text
Submissions
    ↓
Normalize
    ↓
Validate
    ↓
Remove duplicates
    ↓
Group by result/environment
    ↓
Apply confirmation threshold
    ↓
Proposed verified result
```

Once a result qualifies, the application proceeds to Soroban finalization.

---

# 26. Soroban Architecture

Use **two meaningful Soroban contracts**.

## Contract A — Repro Task Registry

Responsibilities:

- Register funded reproduction task
- Store task identifier
- Store maintainer
- Store reward contract reference
- Store confirmation threshold
- Store deadline
- Store task state
- Record verified result hash
- Enforce valid state transitions
- Emit task events

---

## Contract B — Reward Vault

Responsibilities:

- Hold reward funds
- Associate reward with task
- Track accepted contributors
- Calculate reward share
- Prevent duplicate payout
- Distribute reward
- Track claim/payout state
- Emit reward events

The Reward Vault must not be an unrelated second contract.

---

# 27. Inter-Contract Communication

The contracts must communicate.

Expected lifecycle:

```text
Task funded
     ↓
Repro Task Registry
     ↓
Students submit evidence off-chain
     ↓
Confirmation threshold reached
     ↓
Verified result finalized
     ↓
Repro Task Registry
calls Reward Vault
     ↓
Reward Vault validates task
     ↓
Accepted contributors paid
     ↓
Reward Vault reports completion
     ↓
Registry marks task COMPLETED
```

This must use actual Soroban cross-contract invocation.

---

# 28. Reward Distribution

For:

```text
Reward:
15 XLM

Accepted Contributors:
3
```

Expected:

```text
5 XLM each
```

Reward distribution must account for indivisible remainder behavior safely.

Rules must be deterministic.

---

# 29. Duplicate Reward Prevention

A contributor must never receive the same task reward twice.

The Reward Vault must enforce this on-chain.

The backend/UI must not be the only protection.

---

# 30. Expired Tasks

If deadline passes before verification:

```text
OPEN
 ↓
EXPIRED
```

Define a clear refund strategy for unused reward funds.

The safest simple MVP flow is:

```text
Task expires
     ↓
No verified result
     ↓
Maintainer can reclaim remaining reward
```

The smart contract must prevent both refund and payout from succeeding for the same funds.

---

# 31. Abandoned Tasks

Abandoned tasks follow the same deterministic expiration/refund lifecycle.

Do not require manual administrators to resolve ordinary expired tasks.

---

# 32. Contract Events

Emit meaningful events.

Examples:

```text
TaskRegistered
TaskFunded
TaskVerified
TaskExpired
RewardDistributionStarted
ContributorPaid
RewardCompleted
RewardRefunded
```

Do not put sensitive submission evidence into contract events.

---

# 33. Real-Time State Synchronization

Application state should respond to contract activity without requiring manual page refresh.

Possible flow:

```text
Soroban Event
     ↓
event polling/indexing
     ↓
Next.js backend
     ↓
application state
     ↓
UI refresh
```

Polling is acceptable if it is the simplest reliable solution.

Do not build unnecessary infrastructure solely to claim real-time support.

---

# 34. Transaction Status

Every blockchain operation must expose status.

Use states such as:

```text
Preparing
Simulating
Awaiting Signature
Signed
Submitting
Pending
Confirmed
Failed
Rejected
Expired
```

Applicable operations include:

- XLM transfer
- Task funding
- Contract registration
- Result finalization
- Reward payout
- Refund

Never treat transaction submission as confirmation.

---

# 35. Student Rewards

Students should clearly see:

- Earned XLM
- Pending reward
- Paid reward
- Related task
- Transaction hash
- Explorer link

---

# 36. GitHub Final Report

After successful verification, ReproGate generates a structured report.

Example:

```text
ReproGate Verification

Status:
Environment-Specific

Verified Environment:
Node.js 22

Independent Confirmations:
2

Not Reproduced:
Node.js 20

Accepted Reproductions:
- Contributor A
- Contributor B

Evidence:
[ReproGate task URL]

Stellar Verification:
[Explorer / transaction reference]
```

If GitHub authorization is available, post this report back to the original issue.

Do not close the issue automatically unless explicitly configured.

---

# 37. Main Application Flow

## Maintainer

```text
Connect wallet
      ↓
Import GitHub issue
      ↓
Configure reproduction task
      ↓
Set confirmation threshold
      ↓
Set XLM reward
      ↓
Sign funding transaction
      ↓
Task becomes open
      ↓
Receive reproduction submissions
      ↓
Threshold reached
      ↓
Result verified
      ↓
Soroban finalization
      ↓
Reward distributed
      ↓
GitHub updated
```

---

## Student

```text
Connect wallet
      ↓
Browse tasks
      ↓
Choose bug
      ↓
Reproduce locally
      ↓
Submit structured evidence
      ↓
Wait for independent confirmations
      ↓
Submission accepted
      ↓
Receive XLM
      ↓
View reward transaction
```

---

# 38. Frontend Architecture

Use Next.js App Router.

Prefer:

- Server Components by default
- Client Components for wallets/interactivity
- Server Actions for appropriate mutations
- Route Handlers for GitHub/external APIs

Suggested structure:

```text
web/src/
├── app/
├── components/
├── features/
│   ├── tasks/
│   ├── submissions/
│   ├── verification/
│   ├── rewards/
│   └── wallet/
├── lib/
│   ├── server/
│   ├── github/
│   ├── stellar/
│   └── verification/
└── types/
```

Avoid giant page components.

---

# 39. Backend Responsibilities

Next.js server-side code handles:

- GitHub API
- Issue import
- Task management
- Submission validation
- Environment normalization
- Duplicate detection
- Confirmation engine
- Verification classification
- GitHub report generation
- Contract-read aggregation
- Transaction-state queries

Keep business logic outside React components.

---

# 40. Database Scope

Use a database only for off-chain information that genuinely needs persistence.

Possible entities:

```text
users
github_issues
repro_tasks
submissions
submission_evidence
verification_results
transaction_references
```

Blockchain state remains authoritative for:

- funded reward
- finalized task state
- reward payout
- duplicate reward prevention

Do not duplicate blockchain state unnecessarily.

---

# 41. Loading States

Required loading states include:

- Wallet connection
- Balance loading
- GitHub issue import
- Task creation
- Reward funding
- Task list
- Submission upload
- Verification calculation
- Wallet signature
- Contract invocation
- Reward distribution
- GitHub report posting

Never leave the UI blank during remote operations.

---

# 42. Error Handling

Handle:

- Wallet not installed
- Wallet rejection
- Wrong network
- Insufficient XLM
- Invalid GitHub URL
- GitHub issue unavailable
- GitHub API failure
- Duplicate submission
- Invalid evidence
- Expired task
- Conflicting evidence
- Missing confirmation threshold
- RPC failure
- Soroban failure
- Reward payout failure
- GitHub report failure
- Transaction timeout

Failures should be recoverable where possible.

---

# 43. Mobile Responsive UI

The complete application must work on:

- Mobile
- Tablet
- Desktop

Important mobile flows:

- Wallet connection
- Browse tasks
- Task details
- Evidence submission
- Reward status
- Maintainer task creation
- Verification result

Avoid desktop-only wide tables where cards would work better.

---

# 44. UX Direction

ReproGate should visually feel like:

> GitHub issue tracking + modern developer tooling + transparent reward system.

Priorities:

- Developer-focused
- Clean
- Technical
- Easy scanning
- Strong code/environment typography
- Clear statuses
- Minimal unnecessary decoration
- Mobile responsive

Use monospace typography selectively for:

- Runtime versions
- Logs
- Commit hashes
- Transaction hashes
- Environment values

Avoid making the product look like a cryptocurrency trading app.

Stellar should power the reward/verification infrastructure without dominating the product identity.

---

# 45. Tests

Testing is mandatory.

## Soroban Tests

Test at minimum:

- Task registration
- Authorization
- Invalid maintainer
- Funding
- Verification finalization
- Invalid threshold
- Contract-to-contract invocation
- Reward calculation
- Multiple contributors
- Duplicate payout prevention
- Expired task
- Refund
- Payout vs refund exclusivity
- Event emission

---

## Verification Engine Tests

Test:

- One reproduction
- Threshold not reached
- Threshold reached
- Duplicate wallet submission
- Duplicate evidence
- Conflicting results
- Environment-specific result
- Reproduced result
- Not-reproduced result
- Expired submissions
- Invalid environment data

---

## Frontend / Domain Tests

Test:

- GitHub URL parsing
- Environment normalization
- Task validation
- Transaction-state mapping
- Reward display formatting
- Important error mapping

Have substantially more than three meaningful tests.

---

# 46. CI/CD

Use GitHub Actions.

Required pipeline:

```text
Install
   ↓
Lint
   ↓
TypeScript
   ↓
Frontend/domain tests
   ↓
Next.js production build
   ↓
Rust contract tests
   ↓
Soroban contract build
```

CI must fail when required verification fails.

---

# 47. Contract Deployment Workflow

Provide repeatable deployment scripts.

Expected:

```text
Build
  ↓
Contract Tests
  ↓
Deploy Repro Task Registry
  ↓
Deploy Reward Vault
  ↓
Configure Contract References
  ↓
Test Inter-Contract Invocation
  ↓
Record Addresses
```

Only Stellar deployment is required.

---

# 48. Vercel Deployment

Deploy the Next.js application to Vercel.

Requirements:

- Production build passes
- HTTPS
- Testnet configuration
- Environment variables protected
- Functional wallet integration
- Functional GitHub integration where configured
- Mobile responsive

---

# 49. Analytics

Use **Vercel Analytics only**.

Do not add:

- PostHog
- Sentry
- Datadog
- Google Analytics

unless the project scope explicitly changes.

Possible anonymous product metrics:

- Tasks viewed
- Tasks created
- Reproduction submissions
- Verified bugs
- Reward flows initiated

Do not send sensitive logs or wallet secrets to analytics.

---

# 50. Monitoring

Keep monitoring simple:

- Vercel runtime logs
- Vercel deployment logs
- Vercel Analytics
- Clear server-side error logging

Do not introduce unnecessary monitoring infrastructure.

---

# 51. Performance

Important optimizations:

- Cache safe GitHub issue metadata where appropriate
- Avoid unnecessary GitHub API requests
- Batch/parallelize safe independent blockchain reads
- Avoid unnecessary client JavaScript
- Use Server Components where practical
- Paginate task lists
- Avoid rendering huge raw logs by default

Do not prematurely optimize insignificant code.

---

# 52. Security

Never:

- Store wallet secret keys
- Request seed phrases
- Sign user transactions server-side
- Expose GitHub client secrets
- Trust client-side authorization
- Pay the same contributor twice
- Allow payout after refund
- Allow refund after payout
- Store sensitive issue information on-chain
- Commit `.env`

Wallet signatures remain controlled by the user.

---

# 53. Meaningful Commits

Maintain at least:

> **15+ meaningful commits**

Example progression:

```text
feat: add stellar wallet connection
feat: display xlm balance
feat: add xlm transfer utility
feat: add github issue import
feat: add reproduction task creation
feat: implement structured evidence submission
feat: add environment normalization
feat: implement confirmation engine
feat: detect environment-specific bugs
feat: add repro task registry contract
feat: add reward vault contract
test: cover duplicate reward prevention
feat: add inter-contract reward flow
feat: synchronize contract events
feat: post verified report to github
ci: add web and soroban verification
feat: add vercel analytics
docs: document evidence
```

Do not create meaningless commits solely to increase the count.

---

# 54. README Evidence

The final README should make verification easy.

Include:

## Project

- Problem
- Solution
- Target users
- How ReproGate works
- Why Stellar

## Technical Architecture

- Next.js architecture
- GitHub integration
- Verification engine
- Soroban architecture
- Inter-contract communication
- Reward lifecycle

## Setup

- Local installation
- Environment variables
- GitHub configuration
- Stellar setup
- Contract testing
- Application testing

## Evidence

Include:

- Repro Task Registry address
- Reward Vault address
- XLM transfer transaction
- Contract invocation transaction
- Reward payout transaction
- Explorer links

---

# 55. Built-In Stellar Belt Coverage

The application should naturally cover the technical requirements across the Stellar builder levels.

## Foundation

ReproGate includes:

- Freighter
- Stellar Testnet
- Wallet connect
- Wallet disconnect
- XLM balance
- XLM transaction
- Success/failure feedback
- Transaction hash

---

## Multi-Wallet + Contracts

ReproGate includes:

- StellarWalletsKit
- Multiple wallet options
- Wallet-not-found handling
- Rejected-signature handling
- Insufficient-balance handling
- Deployed Soroban contracts
- Frontend contract calls
- Transaction status
- Contract events
- Application synchronization

---

## Advanced dApp

ReproGate includes:

- Two meaningful Soroban contracts
- Inter-contract communication
- Event synchronization
- CI/CD
- Deployment workflow
- Mobile-responsive frontend
- Error/loading states
- Contract tests
- Frontend/domain tests
- Production-style architecture
- Complete technical documentation

---

## Polished MVP

ReproGate includes:

- Stable frontend/backend architecture
- Stable smart contract architecture
- Vercel deployment
- Vercel Analytics
- Performance optimization
- Runtime logging
- Professional onboarding
- Proper repository structure
- Public evidence
- 15+ meaningful commits

---

# 56. Explicit Non-Goals

The MVP does not require:

- Stellar Mainnet
- Real USDC
- Real monetary rewards
- Production payment infrastructure
- Fiat payouts
- Private GitHub repositories
- GitLab
- Bitbucket
- Languages beyond JavaScript/TypeScript
- Automated execution of untrusted student code on ReproGate servers
- Containerized remote reproduction infrastructure
- Full plagiarism AI
- AI-generated bug verification
- Native mobile app
- Enterprise SSO
- Microservices
- Kubernetes
- Production KYC
- Custom token

Do not implement these unless the project scope explicitly changes.

---

# 57. Critical Safety Constraint

ReproGate must **not automatically execute arbitrary code submitted by students or imported from unknown repositories on the production server**.

Students perform reproduction locally.

ReproGate receives structured evidence.

If automated sandbox execution is considered in the future, it requires a separate security architecture and is outside this MVP.

---

# 58. Definition of Done

ReproGate is technically complete when this flow works:

```text
Open deployed ReproGate
        ↓
Connect Stellar wallet
        ↓
View XLM balance
        ↓
Successfully send XLM
        ↓
Maintainer imports GitHub issue
        ↓
Creates reproduction task
        ↓
Sets confirmation threshold
        ↓
Sets XLM reward
        ↓
Signs funding transaction
        ↓
Task becomes available
        ↓
Multiple student wallets submit evidence
        ↓
ReproGate normalizes environments
        ↓
Independent results are compared
        ↓
Confirmation threshold is reached
        ↓
Bug classification is generated
        ↓
Verified result is recorded through Soroban
        ↓
Registry communicates with Reward Vault
        ↓
Accepted contributors receive XLM
        ↓
Duplicate payouts are prevented
        ↓
Events synchronize UI state
        ↓
Final result appears in history
        ↓
GitHub issue receives structured report
```

And all technical gates pass:

- Freighter works
- Multi-wallet selection works
- Connect/disconnect works
- Enforcement works
- XLM balance displays correctly
- XLM transfer works
- Transaction feedback works
- Transaction hash is displayed
- Wallet-not-found error works
- Rejected-signature error works
- Insufficient-balance error works
- GitHub issue import works
- Task creation works
- Structured reproduction evidence works
- Duplicate submissions are prevented
- Environment normalization works
- Confirmation threshold works
- Conflicting results are handled
- Environment-specific classification works
- Repro Task Registry is deployed
- Reward Vault is deployed
- Inter-contract communication works
- Reward funding works
- Reward distribution works
- Duplicate reward claims are impossible
- Expiration/refund behavior works
- Contract events are emitted
- Application state synchronizes from contract activity
- Transaction pending/success/failure states work
- Contract tests pass
- Verification-engine tests pass
- Frontend/domain tests pass
- Next.js lint passes
- TypeScript passes
- Next.js production build passes
- Soroban contract build passes
- GitHub Actions CI passes
- Vercel deployment works
- Mobile UI works
- Vercel Analytics is enabled
- Runtime logs are available
- Contract addresses are documented
- Public transaction evidence is documented
- README provides clear technical verification
- Repository contains at least 15 meaningful commits

The final engineering objective is:

> **Build a polished Stellar platform that turns uncertain GitHub bug reports into independently verified reproduction results while giving student developers practical debugging experience and transparent XLM rewards.**
