import "server-only";

import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Operation,
  StrKey,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { xlmToStroops } from "@/lib/stellar/amounts";
import { explorerTransactionUrl, stellarConfig } from "@/lib/stellar/config";

const friendbotUrl = process.env.STELLAR_FRIENDBOT_URL ?? "https://friendbot.stellar.org";
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function createAndFundTestnetWallet(): Promise<Keypair> {
  if (stellarConfig.network !== "testnet") {
    throw new Error("Automated evidence wallets require Stellar Testnet.");
  }
  const keypair = Keypair.random();
  const response = await fetch(`${friendbotUrl}?addr=${encodeURIComponent(keypair.publicKey())}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Testnet Friendbot funding failed (${response.status}).`);
  }
  return keypair;
}

export async function sendEvidencePayment(
  keypair: Keypair,
  destination: string,
  amountXlm: string,
): Promise<{ hash: string; explorerUrl: string }> {
  if (!StrKey.isValidEd25519PublicKey(destination)) throw new Error("Invalid Testnet payment destination.");
  if (xlmToStroops(amountXlm) <= 0n) throw new Error("Evidence payment must be positive.");
  const server = new Horizon.Server(stellarConfig.horizonUrl);
  let source: Awaited<ReturnType<typeof server.loadAccount>> | undefined;
  let accountError: unknown;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    try {
      source = await server.loadAccount(keypair.publicKey());
      break;
    } catch (error) {
      accountError = error;
      if (attempt < 14) await wait(1_000);
    }
  }
  if (!source) throw new Error(`Funded Testnet wallet was not ready: ${String(accountError)}`);
  const transaction = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: stellarConfig.networkPassphrase,
  })
    .addOperation(Operation.payment({ destination, asset: Asset.native(), amount: amountXlm }))
    .setTimeout(180)
    .build();
  transaction.sign(keypair);
  const response = await server.submitTransaction(transaction);
  const hash = response.hash;
  let lastError: unknown;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const confirmed = await server.transactions().transaction(hash).call();
      if (!confirmed.successful) {
        throw new Error("Testnet evidence payment was not successful on-chain.");
      }
      if (confirmed.source_account !== keypair.publicKey()) {
        throw new Error("Testnet evidence payment source did not match the generated wallet.");
      }
      return { hash, explorerUrl: explorerTransactionUrl(hash) };
    } catch (error) {
      lastError = error;
      if (attempt < 29) await wait(1_000);
    }
  }
  throw new Error(`Testnet transaction was submitted but confirmation could not be read: ${String(lastError)}`);
}

export async function verifyTestnetTransaction(
  hash: string,
  sourceAccount: string,
): Promise<void> {
  if (!hash.trim()) throw new Error("A Testnet transaction hash is required.");
  if (!StrKey.isValidEd25519PublicKey(sourceAccount)) {
    throw new Error("Invalid generated Testnet wallet address.");
  }
  const server = new Horizon.Server(stellarConfig.horizonUrl);
  const transaction = await server.transactions().transaction(hash).call();
  if (!transaction.successful) {
    throw new Error("The recorded Testnet transaction did not succeed on-chain.");
  }
  if (transaction.source_account !== sourceAccount) {
    throw new Error("The recorded Testnet transaction was not signed by the generated wallet.");
  }
}
