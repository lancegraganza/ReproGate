import Link from "next/link";
import Image from "next/image";

const workflow = [
  ["01", "Import the issue", "A maintainer turns a public GitHub issue into a structured reproduction objective."],
  ["02", "Lock the reward", "Testnet XLM is funded into a Soroban vault before the task opens."],
  ["03", "Compare evidence", "Independent wallets submit normalized environments, steps, and logs."],
  ["04", "Verify and pay", "The threshold result is finalized on-chain and accepted contributors are paid atomically."],
];

export default function LandingPage() {
  return (
    <main>
      <header className="landing-nav page-width">
        <Link className="brand" href="/">
          <Image className="brand-logo" src="/reprogatelogo.png" alt="" width={36} height={36} priority /> ReproGate
        </Link>
        <nav aria-label="Landing navigation">
          <a href="#workflow">How it works</a>
          <a href="#benefits">Why ReproGate</a>
          <Link className="button button-quiet button-small" href="/app">Open app</Link>
        </nav>
      </header>

      <section className="hero page-width">
        <div className="hero-copy">
          <p className="eyebrow">Independent reproduction, accountable results</p>
          <h1>Turn uncertain bug reports into evidence maintainers can act on.</h1>
          <p className="hero-lede">
            ReproGate coordinates student developers around real GitHub issues, compares structured
            environments, and distributes transparent Testnet XLM rewards when evidence is verified.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/app/tasks">Explore reproduction tasks</Link>
            <Link className="button button-secondary" href="/app/create">Create a task</Link>
          </div>
          <p className="fine-print">No arbitrary repository code runs on ReproGate servers.</p>
        </div>

        <div className="evidence-window" aria-label="Example verification evidence">
          <div className="window-bar"><span /><span /><span /><code>example/web-app #123</code></div>
          <div className="window-body">
            <div className="issue-heading">
              <span className="status-badge status-open">Open task</span>
              <span className="reward-chip">15 XLM</span>
            </div>
            <h2>Build crashes on Node.js 22</h2>
            <p className="mono muted">target: node@22 · threshold: 2</p>
            <div className="comparison-row">
              <div><span className="verdict reproduced">Reproduced</span><strong>Node.js 22.4</strong><small>2 matching contributors</small></div>
              <div><span className="verdict not-reproduced">Not reproduced</span><strong>Node.js 20.15</strong><small>2 matching contributors</small></div>
            </div>
            <div className="verified-result">
              <span className="status-dot" />
              <div><strong>Environment-specific bug verified</strong><small>Soroban result hash recorded · reward distributed</small></div>
            </div>
          </div>
        </div>
      </section>

      <section className="problem-strip">
        <div className="page-width metric-grid">
          <div><strong>Structured</strong><span>OS, runtime, dependencies, steps, logs</span></div>
          <div><strong>Independent</strong><span>One wallet, one task, one confirmation</span></div>
          <div><strong>Transparent</strong><span>Funded, finalized, and paid on Stellar</span></div>
        </div>
      </section>

      <section className="landing-section page-width" id="workflow">
        <p className="eyebrow">The verification path</p>
        <div className="section-heading">
          <h2>A real debugging workflow, end to end.</h2>
          <p>Evidence stays useful and readable off-chain. Funding and final state stay verifiable on-chain.</p>
        </div>
        <div className="workflow-grid">
          {workflow.map(([number, title, description]) => (
            <article key={number}><span className="step-number">{number}</span><h3>{title}</h3><p>{description}</p></article>
          ))}
        </div>
      </section>

      <section className="landing-section page-width" id="benefits">
        <div className="benefit-grid">
          <article className="benefit-card maintainer-card">
            <p className="eyebrow">For maintainers</p><h2>Get a report, not a pile of “works for me” comments.</h2>
            <ul><li>Normalized runtime and dependency comparisons</li><li>Deterministic copy and duplicate flags</li><li>A structured report ready for the original issue</li></ul>
          </article>
          <article className="benefit-card student-card">
            <p className="eyebrow">For student developers</p><h2>Build debugging skill on real software.</h2>
            <ul><li>Practice minimal, repeatable reproduction</li><li>Learn precise technical communication</li><li>Earn transparent Testnet XLM rewards</li></ul>
          </article>
        </div>
      </section>

      <section className="cta-band"><div className="page-width"><div><p className="eyebrow">A better gate for bug certainty</p><h2>Find the environment that makes the bug real.</h2></div><Link className="button button-inverse" href="/app/tasks">Browse open tasks</Link></div></section>
      <footer className="landing-footer page-width"><span className="brand"><Image className="brand-logo" src="/reprogatelogo.png" alt="" width={30} height={30} /> ReproGate</span><span>Built for Stellar Testnet · Mainnet disabled</span></footer>
    </main>
  );
}
