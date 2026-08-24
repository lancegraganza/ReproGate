import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CDDE25PTGG2XOTQHJ25CIQRUBJ6I6Q4WLIIWSURLLWP26B5HKABWNU5E",
  }
} as const


export interface Reward {
  amount: i128;
  deadline: u64;
  maintainer: string;
  registered: boolean;
  state: RewardState;
}

export type DataKey = {tag: "Admin", values: void} | {tag: "Registry", values: void} | {tag: "Token", values: void} | {tag: "Reward", values: readonly [Buffer]} | {tag: "Paid", values: readonly [Buffer, string]};

export const VaultError = {
  1: {message:"AlreadyConfigured"},
  2: {message:"NotConfigured"},
  3: {message:"InvalidAmount"},
  4: {message:"InvalidDeadline"},
  5: {message:"RewardExists"},
  6: {message:"RewardNotFound"},
  7: {message:"RewardNotFunded"},
  8: {message:"InvalidContributors"},
  9: {message:"DuplicateContributor"},
  10: {message:"AlreadyPaid"},
  11: {message:"DeadlinePassed"},
  12: {message:"DeadlineNotReached"},
  13: {message:"DeadlineTooFar"},
  14: {message:"AlreadyRegistered"},
  15: {message:"NotRegistered"}
}

export type RewardState = {tag: "Funded", values: void} | {tag: "Completed", values: void} | {tag: "Refunded", values: void};







export interface Client {
  /**
   * Construct and simulate a lock transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  lock: ({task_id, maintainer, amount, deadline}: {task_id: Buffer, maintainer: string, amount: i128, deadline: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a refund transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  refund: ({task_id}: {task_id: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a is_paid transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_paid: ({task_id, contributor}: {task_id: Buffer, contributor: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a activate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  activate: ({task_id}: {task_id: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a distribute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  distribute: ({task_id, contributors}: {task_id: Buffer, contributors: Array<string>}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_reward transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_reward: ({task_id}: {task_id: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Reward>>>

  /**
   * Construct and simulate a set_registry transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_registry: ({registry}: {registry: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a refund_unregistered transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  refund_unregistered: ({task_id}: {task_id: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, token}: {admin: string, token: string},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({admin, token}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAQAAAAAAAAAAAAAABlJld2FyZAAAAAAABQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAhkZWFkbGluZQAAAAYAAAAAAAAACm1haW50YWluZXIAAAAAABMAAAAAAAAACnJlZ2lzdGVyZWQAAAAAAAEAAAAAAAAABXN0YXRlAAAAAAAH0AAAAAtSZXdhcmRTdGF0ZQA=",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABQAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAIUmVnaXN0cnkAAAAAAAAAAAAAAAVUb2tlbgAAAAAAAAEAAAAAAAAABlJld2FyZAAAAAAAAQAAA+4AAAAgAAAAAQAAAAAAAAAEUGFpZAAAAAIAAAPuAAAAIAAAABM=",
        "AAAAAAAAAAAAAAAEbG9jawAAAAQAAAAAAAAAB3Rhc2tfaWQAAAAD7gAAACAAAAAAAAAACm1haW50YWluZXIAAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAIZGVhZGxpbmUAAAAGAAAAAQAAA+kAAAACAAAH0AAAAApWYXVsdEVycm9yAAA=",
        "AAAABAAAAAAAAAAAAAAAClZhdWx0RXJyb3IAAAAAAA8AAAAAAAAAEUFscmVhZHlDb25maWd1cmVkAAAAAAAAAQAAAAAAAAANTm90Q29uZmlndXJlZAAAAAAAAAIAAAAAAAAADUludmFsaWRBbW91bnQAAAAAAAADAAAAAAAAAA9JbnZhbGlkRGVhZGxpbmUAAAAABAAAAAAAAAAMUmV3YXJkRXhpc3RzAAAABQAAAAAAAAAOUmV3YXJkTm90Rm91bmQAAAAAAAYAAAAAAAAAD1Jld2FyZE5vdEZ1bmRlZAAAAAAHAAAAAAAAABNJbnZhbGlkQ29udHJpYnV0b3JzAAAAAAgAAAAAAAAAFER1cGxpY2F0ZUNvbnRyaWJ1dG9yAAAACQAAAAAAAAALQWxyZWFkeVBhaWQAAAAACgAAAAAAAAAORGVhZGxpbmVQYXNzZWQAAAAAAAsAAAAAAAAAEkRlYWRsaW5lTm90UmVhY2hlZAAAAAAADAAAAAAAAAAORGVhZGxpbmVUb29GYXIAAAAAAA0AAAAAAAAAEUFscmVhZHlSZWdpc3RlcmVkAAAAAAAADgAAAAAAAAANTm90UmVnaXN0ZXJlZAAAAAAAAA8=",
        "AAAAAAAAAAAAAAAGcmVmdW5kAAAAAAABAAAAAAAAAAd0YXNrX2lkAAAAA+4AAAAgAAAAAQAAA+kAAAACAAAH0AAAAApWYXVsdEVycm9yAAA=",
        "AAAAAgAAAAAAAAAAAAAAC1Jld2FyZFN0YXRlAAAAAAMAAAAAAAAAAAAAAAZGdW5kZWQAAAAAAAAAAAAAAAAACUNvbXBsZXRlZAAAAAAAAAAAAAAAAAAACFJlZnVuZGVk",
        "AAAAAAAAAAAAAAAHaXNfcGFpZAAAAAACAAAAAAAAAAd0YXNrX2lkAAAAA+4AAAAgAAAAAAAAAAtjb250cmlidXRvcgAAAAATAAAAAQAAAAE=",
        "AAAAAAAAAAAAAAAIYWN0aXZhdGUAAAABAAAAAAAAAAd0YXNrX2lkAAAAA+4AAAAgAAAAAQAAA+kAAAACAAAH0AAAAApWYXVsdEVycm9yAAA=",
        "AAAABQAAAAAAAAAAAAAADFJld2FyZEZ1bmRlZAAAAAEAAAANcmV3YXJkX2Z1bmRlZAAAAAAAAAQAAAAAAAAAB3Rhc2tfaWQAAAAD7gAAACAAAAABAAAAAAAAAAptYWludGFpbmVyAAAAAAATAAAAAQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAAAAAAIZGVhZGxpbmUAAAAGAAAAAAAAAAI=",
        "AAAAAAAAAAAAAAAKZGlzdHJpYnV0ZQAAAAAAAgAAAAAAAAAHdGFza19pZAAAAAPuAAAAIAAAAAAAAAAMY29udHJpYnV0b3JzAAAD6gAAABMAAAABAAAD6QAAAAIAAAfQAAAAClZhdWx0RXJyb3IAAA==",
        "AAAAAAAAAAAAAAAKZ2V0X3Jld2FyZAAAAAAAAQAAAAAAAAAHdGFza19pZAAAAAPuAAAAIAAAAAEAAAPpAAAH0AAAAAZSZXdhcmQAAAAAB9AAAAAKVmF1bHRFcnJvcgAA",
        "AAAABQAAAAAAAAAAAAAADlJld2FyZFJlZnVuZGVkAAAAAAABAAAAD3Jld2FyZF9yZWZ1bmRlZAAAAAADAAAAAAAAAAd0YXNrX2lkAAAAA+4AAAAgAAAAAQAAAAAAAAAKbWFpbnRhaW5lcgAAAAAAEwAAAAEAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAAD0NvbnRyaWJ1dG9yUGFpZAAAAAABAAAAEGNvbnRyaWJ1dG9yX3BhaWQAAAADAAAAAAAAAAd0YXNrX2lkAAAAA+4AAAAgAAAAAQAAAAAAAAALY29udHJpYnV0b3IAAAAAEwAAAAEAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAAD1Jld2FyZENvbXBsZXRlZAAAAAABAAAAEHJld2FyZF9jb21wbGV0ZWQAAAACAAAAAAAAAAd0YXNrX2lkAAAAA+4AAAAgAAAAAQAAAAAAAAAFdG90YWwAAAAAAAALAAAAAAAAAAI=",
        "AAAAAAAAAAAAAAAMc2V0X3JlZ2lzdHJ5AAAAAQAAAAAAAAAIcmVnaXN0cnkAAAATAAAAAQAAA+kAAAACAAAH0AAAAApWYXVsdEVycm9yAAA=",
        "AAAABQAAAAAAAAAAAAAAEFJld2FyZFJlZ2lzdGVyZWQAAAABAAAAEXJld2FyZF9yZWdpc3RlcmVkAAAAAAAAAQAAAAAAAAAHdGFza19pZAAAAAPuAAAAIAAAAAEAAAAC",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAA==",
        "AAAAAAAAAAAAAAATcmVmdW5kX3VucmVnaXN0ZXJlZAAAAAABAAAAAAAAAAd0YXNrX2lkAAAAA+4AAAAgAAAAAQAAA+kAAAACAAAH0AAAAApWYXVsdEVycm9yAAA=",
        "AAAABQAAAAAAAAAAAAAAGVJld2FyZERpc3RyaWJ1dGlvblN0YXJ0ZWQAAAAAAAABAAAAG3Jld2FyZF9kaXN0cmlidXRpb25fc3RhcnRlZAAAAAADAAAAAAAAAAd0YXNrX2lkAAAAA+4AAAAgAAAAAQAAAAAAAAARY29udHJpYnV0b3JfY291bnQAAAAAAAAEAAAAAAAAAAAAAAAFdG90YWwAAAAAAAALAAAAAAAAAAI=" ]),
      options
    )
  }
  public readonly fromJSON = {
    lock: this.txFromJSON<Result<void>>,
        refund: this.txFromJSON<Result<void>>,
        is_paid: this.txFromJSON<boolean>,
        activate: this.txFromJSON<Result<void>>,
        distribute: this.txFromJSON<Result<void>>,
        get_reward: this.txFromJSON<Result<Reward>>,
        set_registry: this.txFromJSON<Result<void>>,
        refund_unregistered: this.txFromJSON<Result<void>>
  }
}