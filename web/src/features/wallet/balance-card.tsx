"use client";

import { useWallet } from "./wallet-provider";

export function BalanceCard() {
  const wallet = useWallet();
  return (
    <section className="panel balance-panel">
      <div>
        <p className="eyebrow">Testnet balance</p>
        {!wallet.address ? <p className="balance-value muted">Disconnected</p> : null}
        {wallet.balanceState === "LOADING" ? <p className="balance-value">Loading…</p> : null}
        {wallet.balanceState === "LOADED" ? (
          <p className="balance-value">
            {Number(wallet.balance ?? "0").toLocaleString(undefined, {
              maximumFractionDigits: 7,
            })}{" "}
            <span>XLM</span>
          </p>
        ) : null}
        {wallet.balanceState === "ERROR" ? (
          <p className="field-error">Balance unavailable. Check the Testnet connection.</p>
        ) : null}
      </div>
      <button
        className="button button-quiet button-small"
        disabled={!wallet.address || wallet.balanceState === "LOADING"}
        onClick={() => void wallet.refreshBalance()}
      >
        Refresh
      </button>
      {wallet.networkWarning ? <p className="notice notice-warning">{wallet.networkWarning}</p> : null}
    </section>
  );
}

