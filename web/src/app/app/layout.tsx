import Link from "next/link";
import Image from "next/image";
import { WalletButton } from "@/features/wallet/wallet-button";

export default function ApplicationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner page-width">
          <Link className="brand" href="/app">
            <Image
              className="brand-logo"
              src="/reprogatelogo.png"
              alt=""
              width={36}
              height={36}
              priority
            />{" "}
            ReproGate
          </Link>
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
      <footer className="app-footer">
        <div className="page-width">
          <span>ReproGate</span>
          <span>Stellar Testnet</span>
        </div>
      </footer>
    </div>
  );
}
