import { describe, expect, it } from "vitest";
import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";
import { buildWalletChallengeTransaction, verifySignedWalletChallenge } from "./wallet-proof";

describe("wallet mutation proof", () => {
  it("accepts only a signature from the challenged wallet", () => {
    const owner = Keypair.random();
    const attacker = Keypair.random();
    const unsigned = buildWalletChallengeTransaction(
      owner.publicKey(),
      "a".repeat(64),
      new Date(Date.now() + 300_000),
      Networks.TESTNET,
    );
    const signedByOwner = TransactionBuilder.fromXdr(unsigned, Networks.TESTNET);
    signedByOwner.sign(owner);
    const signedByAttacker = TransactionBuilder.fromXdr(unsigned, Networks.TESTNET);
    signedByAttacker.sign(attacker);

    expect(
      verifySignedWalletChallenge(unsigned, signedByOwner.toXdr(), owner.publicKey(), Networks.TESTNET),
    ).toBe(true);
    expect(
      verifySignedWalletChallenge(unsigned, signedByAttacker.toXdr(), owner.publicKey(), Networks.TESTNET),
    ).toBe(false);
    expect(signedByOwner.operations).toHaveLength(1);
    expect(signedByOwner.operations[0]?.type).toBe("bumpSequence");
  });

  it("rejects a different transaction body", () => {
    const owner = Keypair.random();
    const first = buildWalletChallengeTransaction(
      owner.publicKey(), "a".repeat(64), new Date(Date.now() + 300_000), Networks.TESTNET,
    );
    const second = TransactionBuilder.fromXdr(buildWalletChallengeTransaction(
      owner.publicKey(), "b".repeat(64), new Date(Date.now() + 300_000), Networks.TESTNET,
    ), Networks.TESTNET);
    second.sign(owner);
    expect(verifySignedWalletChallenge(first, second.toXdr(), owner.publicKey(), Networks.TESTNET)).toBe(false);
  });
});
