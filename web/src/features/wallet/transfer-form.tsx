"use client";

import { useState } from "react";
import {
  Asset,
  BASE_FEE,
  Horizon,
  Operation,
  TransactionBuilder,
  StrKey,
} from "@stellar/stellar-sdk";
import type { TransactionStatus } from "@/types/domain";
import { stellarConfig } from "@/lib/stellar/config";
import { mapTransactionError } from "@/lib/stellar/transaction-state";
import { useWallet } from "./wallet-provider";

export function TransferForm() {
  const wallet = useWallet();
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<TransactionStatus>("IDLE");
  const [hash, setHash] = useState<string>();
  const [message, setMessage] = useState<string>();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(undefined);
    setHash(undefined);
    if (!wallet.address) {
      setMessage("Connect a wallet first.");
      return;
    }
    if (!StrKey.isValidEd25519PublicKey(destination) || !/^\d+(\.\d{1,7})?$/.test(amount)) {
      setMessage("Enter a valid destination and positive XLM amount.");
      return;
    }
    try {
      setStatus("PREPARING");
      const server = new Horizon.Server(stellarConfig.horizonUrl);
      const source = await server.loadAccount(wallet.address);
      const native = source.balances.find((balance) => balance.asset_type === "native");
      if (!native || Number(native.balance) <= Number(amount) + 1) {
        throw new Error("Insufficient spendable XLM after the account reserve and fee.");
      }
      const transaction = new TransactionBuilder(source, {
        fee: BASE_FEE,
        networkPassphrase: stellarConfig.networkPassphrase,
      })
        .addOperation(Operation.payment({ destination, asset: Asset.native(), amount }))
        .setTimeout(180)
        .build();

      setStatus("AWAITING_SIGNATURE");
      const signedXdr = await wallet.signTransaction(transaction.toXdr());
      setStatus("SIGNED");
      const signed = TransactionBuilder.fromXdr(signedXdr, stellarConfig.networkPassphrase);
      setStatus("SUBMITTING");
      const response = await server.submitTransaction(signed);
      setHash(response.hash);
      setStatus("CONFIRMED");
      setMessage("Transfer confirmed on Stellar Testnet.");
      await wallet.refreshBalance();
    } catch (reason) {
      const mapped = mapTransactionError(reason);
      setStatus(mapped.status);
      setMessage(mapped.message);
    }
  }

  const busy = !["IDLE", "CONFIRMED", "FAILED", "REJECTED", "EXPIRED"].includes(status);
  return (
    <form className="panel stack" onSubmit={submit}>
      <div>
        <p className="eyebrow">Direct transfer utility</p>
        <h2>Send Testnet XLM</h2>
        <p className="muted">Review the destination and amount before your wallet signs.</p>
      </div>
      <label>
        Destination address
        <input value={destination} onChange={(event) => setDestination(event.target.value)} />
      </label>
      <label>
        Amount (XLM)
        <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </label>
      <button className="button button-primary" disabled={!wallet.address || busy}>
        {busy ? status.replaceAll("_", " ").toLowerCase() : "Review and send"}
      </button>
      {message ? <p className={status === "CONFIRMED" ? "notice notice-success" : "notice notice-error"}>{message}</p> : null}
      {hash ? (
        <a
          className="mono transaction-link"
          href={`${stellarConfig.explorerUrl}/tx/${hash}`}
          rel="noreferrer"
          target="_blank"
        >
          {hash}
        </a>
      ) : null}
    </form>
  );
}
