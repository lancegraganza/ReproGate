import Link from "next/link";
import { WalletButton } from "@/features/wallet/wallet-button";

export default function ApplicationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner page-width">
          <Link className="brand" href="/app"><span className="brand-mark">R/</span> ReproGate</Link>
          <nav className="app-nav" aria-label="Application navigation">
            <Link href="/app/tasks">Tasks</Link>
            <Link href="/app/create">Create</Link>
            <Link href="/app/submissions">My evidence</Link>
            <Link href="/app/history">History</Link>
            <Link href="/app/wallet">Wallet</Link>
          </nav>
          <WalletButton />
        </div>
      </header>
      <main className="app-content page-width">{children}</main>
      <footer className="app-footer"><div className="page-width"><span>ReproGate · Stellar Testnet</span><span>Mainnet disabled · Evidence is never executed</span></div></footer>
    </div>
  );
}

