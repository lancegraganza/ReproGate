"use client";

import { useWallet } from "./wallet-provider";

function shortAddress(address: string): string {
  return `${address.slice(0, 5)}…${address.slice(-5)}`;
}

export function WalletButton() {
  const wallet = useWallet();
  if (wallet.address) {
    return (
      <div className="wallet-actions">
        <span className="address-chip" title={wallet.address}>
          <span className="status-dot" />
          {shortAddress(wallet.address)}
        </span>
        <button className="button button-quiet button-small" onClick={() => void wallet.disconnect()}>
          Disconnect
        </button>
      </div>
    );
  }
  return (
    <div>
      <button
        className="button button-primary button-small"
        disabled={wallet.state === "CONNECTING"}
        onClick={() => void wallet.connect()}
      >
        {wallet.state === "CONNECTING" ? "Opening wallets…" : "Connect wallet"}
      </button>
      {wallet.error ? <p className="field-error compact-error">{wallet.error}</p> : null}
    </div>
  );
}

