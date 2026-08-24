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
    contractId: "CAH5OSI255VRSJJQVM6JCR77E5C52IB7Y6WCNZYVC3DH7MDSVMRLHMVI",
  }
} as const


export interface Task {
  deadline: u64;
  maintainer: string;
  result_hash: Option<Buffer>;
  reward_amount: i128;
  state: TaskState;
  threshold: u32;
}

export type DataKey = {tag: "Admin", values: void} | {tag: "Vault", values: void} | {tag: "Task", values: readonly [Buffer]};

export type TaskState = {tag: "Open", values: void} | {tag: "Completed", values: void} | {tag: "Expired", values: void};



export interface VaultReward {
  amount: i128;
  deadline: u64;
  maintainer: string;
  registered: boolean;
  state: VaultRewardState;
}



export const RegistryError = {
  1: {message:"AlreadyConfigured"},
  2: {message:"NotConfigured"},
  3: {message:"InvalidThreshold"},
  4: {message:"InvalidDeadline"},
  5: {message:"InvalidReward"},
  6: {message:"TaskExists"},
  7: {message:"TaskNotFound"},
  8: {message:"FundingMismatch"},
  9: {message:"InvalidState"},
  10: {message:"DeadlinePassed"},
  11: {message:"DeadlineNotReached"},
  12: {message:"InvalidContributors"},
  13: {message:"DuplicateContributor"},
  14: {message:"InvalidResultHash"},
  15: {message:"VaultFailure"},
  16: {message:"DeadlineTooFar"}
}



export type VaultRewardState = {tag: "Funded", values: void} | {tag: "Completed", values: void} | {tag: "Refunded", values: void};

export interface Client {
  /**
   * Construct and simulate a expire transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  expire: ({task_id}: {task_id: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a finalize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  finalize: ({task_id, result_hash, contributors}: {task_id: Buffer, result_hash: Buffer, contributors: Array<string>}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_task transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_task: ({task_id}: {task_id: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Task>>>

  /**
   * Construct and simulate a set_vault transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_vault: ({vault}: {vault: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a register_task transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  register_task: ({task_id, maintainer, reward_amount, threshold, deadline}: {task_id: Buffer, maintainer: string, reward_amount: i128, threshold: u32, deadline: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin}: {admin: string},
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
    return ContractClient.deploy({admin}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAQAAAAAAAAAAAAAABFRhc2sAAAAGAAAAAAAAAAhkZWFkbGluZQAAAAYAAAAAAAAACm1haW50YWluZXIAAAAAABMAAAAAAAAAC3Jlc3VsdF9oYXNoAAAAA+gAAAPuAAAAIAAAAAAAAAANcmV3YXJkX2Ftb3VudAAAAAAAAAsAAAAAAAAABXN0YXRlAAAAAAAH0AAAAAlUYXNrU3RhdGUAAAAAAAAAAAAACXRocmVzaG9sZAAAAAAAAAQ=",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAwAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAFVmF1bHQAAAAAAAABAAAAAAAAAARUYXNrAAAAAQAAA+4AAAAg",
        "AAAAAgAAAAAAAAAAAAAACVRhc2tTdGF0ZQAAAAAAAAMAAAAAAAAAAAAAAARPcGVuAAAAAAAAAAAAAAAJQ29tcGxldGVkAAAAAAAAAAAAAAAAAAAHRXhwaXJlZAA=",
        "AAAABQAAAAAAAAAAAAAAClRhc2tGdW5kZWQAAAAAAAEAAAALdGFza19mdW5kZWQAAAAAAgAAAAAAAAAHdGFza19pZAAAAAPuAAAAIAAAAAEAAAAAAAAADXJld2FyZF9hbW91bnQAAAAAAAALAAAAAAAAAAI=",
        "AAAAAQAAAAAAAAAAAAAAC1ZhdWx0UmV3YXJkAAAAAAUAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAIZGVhZGxpbmUAAAAGAAAAAAAAAAptYWludGFpbmVyAAAAAAATAAAAAAAAAApyZWdpc3RlcmVkAAAAAAABAAAAAAAAAAVzdGF0ZQAAAAAAB9AAAAAQVmF1bHRSZXdhcmRTdGF0ZQ==",
        "AAAABQAAAAAAAAAAAAAAC1Rhc2tFeHBpcmVkAAAAAAEAAAAMdGFza19leHBpcmVkAAAAAQAAAAAAAAAHdGFza19pZAAAAAPuAAAAIAAAAAEAAAAC",
        "AAAABQAAAAAAAAAAAAAADFRhc2tWZXJpZmllZAAAAAEAAAANdGFza192ZXJpZmllZAAAAAAAAAMAAAAAAAAAB3Rhc2tfaWQAAAAD7gAAACAAAAABAAAAAAAAAAtyZXN1bHRfaGFzaAAAAAPuAAAAIAAAAAAAAAAAAAAAEWNvbnRyaWJ1dG9yX2NvdW50AAAAAAAABAAAAAAAAAAC",
        "AAAABAAAAAAAAAAAAAAADVJlZ2lzdHJ5RXJyb3IAAAAAAAAQAAAAAAAAABFBbHJlYWR5Q29uZmlndXJlZAAAAAAAAAEAAAAAAAAADU5vdENvbmZpZ3VyZWQAAAAAAAACAAAAAAAAABBJbnZhbGlkVGhyZXNob2xkAAAAAwAAAAAAAAAPSW52YWxpZERlYWRsaW5lAAAAAAQAAAAAAAAADUludmFsaWRSZXdhcmQAAAAAAAAFAAAAAAAAAApUYXNrRXhpc3RzAAAAAAAGAAAAAAAAAAxUYXNrTm90Rm91bmQAAAAHAAAAAAAAAA9GdW5kaW5nTWlzbWF0Y2gAAAAACAAAAAAAAAAMSW52YWxpZFN0YXRlAAAACQAAAAAAAAAORGVhZGxpbmVQYXNzZWQAAAAAAAoAAAAAAAAAEkRlYWRsaW5lTm90UmVhY2hlZAAAAAAACwAAAAAAAAATSW52YWxpZENvbnRyaWJ1dG9ycwAAAAAMAAAAAAAAABREdXBsaWNhdGVDb250cmlidXRvcgAAAA0AAAAAAAAAEUludmFsaWRSZXN1bHRIYXNoAAAAAAAADgAAAAAAAAAMVmF1bHRGYWlsdXJlAAAADwAAAAAAAAAORGVhZGxpbmVUb29GYXIAAAAAABA=",
        "AAAABQAAAAAAAAAAAAAADVRhc2tDb21wbGV0ZWQAAAAAAAABAAAADnRhc2tfY29tcGxldGVkAAAAAAABAAAAAAAAAAd0YXNrX2lkAAAAA+4AAAAgAAAAAQAAAAI=",
        "AAAABQAAAAAAAAAAAAAADlRhc2tSZWdpc3RlcmVkAAAAAAABAAAAD3Rhc2tfcmVnaXN0ZXJlZAAAAAAFAAAAAAAAAAd0YXNrX2lkAAAAA+4AAAAgAAAAAQAAAAAAAAAKbWFpbnRhaW5lcgAAAAAAEwAAAAEAAAAAAAAACXRocmVzaG9sZAAAAAAAAAQAAAAAAAAAAAAAAAhkZWFkbGluZQAAAAYAAAAAAAAAAAAAAA1yZXdhcmRfYW1vdW50AAAAAAAACwAAAAAAAAAC",
        "AAAAAgAAAAAAAAAAAAAAEFZhdWx0UmV3YXJkU3RhdGUAAAADAAAAAAAAAAAAAAAGRnVuZGVkAAAAAAAAAAAAAAAAAAlDb21wbGV0ZWQAAAAAAAAAAAAAAAAAAAhSZWZ1bmRlZA==",
        "AAAAAAAAAAAAAAAGZXhwaXJlAAAAAAABAAAAAAAAAAd0YXNrX2lkAAAAA+4AAAAgAAAAAQAAA+kAAAACAAAH0AAAAA1SZWdpc3RyeUVycm9yAAAA",
        "AAAAAAAAAAAAAAAIZmluYWxpemUAAAADAAAAAAAAAAd0YXNrX2lkAAAAA+4AAAAgAAAAAAAAAAtyZXN1bHRfaGFzaAAAAAPuAAAAIAAAAAAAAAAMY29udHJpYnV0b3JzAAAD6gAAABMAAAABAAAD6QAAAAIAAAfQAAAADVJlZ2lzdHJ5RXJyb3IAAAA=",
        "AAAAAAAAAAAAAAAIZ2V0X3Rhc2sAAAABAAAAAAAAAAd0YXNrX2lkAAAAA+4AAAAgAAAAAQAAA+kAAAfQAAAABFRhc2sAAAfQAAAADVJlZ2lzdHJ5RXJyb3IAAAA=",
        "AAAAAAAAAAAAAAAJc2V0X3ZhdWx0AAAAAAAAAQAAAAAAAAAFdmF1bHQAAAAAAAATAAAAAQAAA+kAAAACAAAH0AAAAA1SZWdpc3RyeUVycm9yAAAA",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAANcmVnaXN0ZXJfdGFzawAAAAAAAAUAAAAAAAAAB3Rhc2tfaWQAAAAD7gAAACAAAAAAAAAACm1haW50YWluZXIAAAAAABMAAAAAAAAADXJld2FyZF9hbW91bnQAAAAAAAALAAAAAAAAAAl0aHJlc2hvbGQAAAAAAAAEAAAAAAAAAAhkZWFkbGluZQAAAAYAAAABAAAD6QAAAAIAAAfQAAAADVJlZ2lzdHJ5RXJyb3IAAAA=" ]),
      options
    )
  }
  public readonly fromJSON = {
    expire: this.txFromJSON<Result<void>>,
        finalize: this.txFromJSON<Result<void>>,
        get_task: this.txFromJSON<Result<Task>>,
        set_vault: this.txFromJSON<Result<void>>,
        register_task: this.txFromJSON<Result<void>>
  }
}