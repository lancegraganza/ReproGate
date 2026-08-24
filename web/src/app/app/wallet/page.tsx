import type { Metadata } from "next";
import { BalanceCard } from "@/features/wallet/balance-card";
import { TransferForm } from "@/features/wallet/transfer-form";

export const metadata: Metadata = { title: "Wallet" };
export default function WalletPage() { return <><div className="page-heading"><div><p className="eyebrow">Stellar fundamentals</p><h1>Wallet</h1><p>Connect through StellarWalletsKit, inspect XLM, and exercise a direct Testnet transfer.</p></div></div><div className="grid-2"><div className="stack"><BalanceCard /><section className="panel"><p className="eyebrow">Network policy</p><h2>Testnet only</h2><p className="muted">ReproGate rejects wrong-network signatures and never requests a private key or seed phrase.</p></section></div><TransferForm /></div></>; }

