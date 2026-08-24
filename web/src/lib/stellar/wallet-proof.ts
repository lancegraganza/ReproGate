import {
  Account,
  BASE_FEE,
  Keypair,
  Memo,
  Operation,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { Buffer } from "buffer";

export function buildWalletChallengeTransaction(
  wallet: string,
  nonce: string,
  expiresAt: Date,
  networkPassphrase: string,
): string {
  return new TransactionBuilder(new Account(wallet, "0"), {
    fee: BASE_FEE,
    networkPassphrase,
    timebounds: {
      minTime: Math.floor(Date.now() / 1_000),
      maxTime: Math.floor(expiresAt.getTime() / 1_000),
    },
  })
    .addMemo(Memo.hash(nonce))
    .addOperation(Operation.bumpSequence({ bumpTo: "0" }))
    .build()
    .toXdr();
}

export function verifySignedWalletChallenge(
  unsignedXdr: string,
  signedXdr: string,
  wallet: string,
  networkPassphrase: string,
): boolean {
  try {
    const expected = TransactionBuilder.fromXdr(unsignedXdr, networkPassphrase);
    const signed = TransactionBuilder.fromXdr(signedXdr, networkPassphrase);
    if (!(expected instanceof Transaction) || !(signed instanceof Transaction)) return false;
    if (signed.source !== wallet || !Buffer.from(signed.hash()).equals(Buffer.from(expected.hash()))) {
      return false;
    }
    const keypair = Keypair.fromPublicKey(wallet);
    return signed.signatures.some((item) =>
      keypair.verify(signed.hash(), item.signature.toXdrObject()),
    );
  } catch {
    return false;
  }
}
