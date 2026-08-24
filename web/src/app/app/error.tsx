"use client";

export default function ApplicationError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="panel empty-state"><div><p className="eyebrow">Recoverable error</p><h2>This view could not be loaded.</h2><p className="muted">Check the database and Testnet configuration, then try again.</p><button className="button button-primary" onClick={reset}>Try again</button></div></div>;
}

