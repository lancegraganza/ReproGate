import { describe, expect, it } from "vitest";
import { mapTransactionError } from "./transaction-state";

describe("transaction error mapping", () => {
  it("treats wallet rejection as recoverable", () =>
    expect(mapTransactionError(new Error("User rejected request"))).toEqual({
      status: "REJECTED",
      message: "Signature request was rejected. Nothing was sent.",
    }));

  it("maps insufficient balance clearly", () =>
    expect(mapTransactionError(new Error("op_underfunded insufficient balance")).message).toContain(
      "insufficient",
    ));

  it("maps confirmation timeouts to expired", () =>
    expect(mapTransactionError(new Error("transaction timeout")).status).toBe("EXPIRED"));

  it("decodes Soroban Error(Contract, #5) on reward vault lock as RewardExists", () => {
    const errorMsg =
      'Transaction simulation failed: "HostError: Error(Contract, #5) Event log (newest first): 0: [Diagnostic Event] contract:CDDE25PTGG2XOTQHJ25CIQRUBJ6I6Q4WLIIWSURLLWP26B5HKABWNU5E, topics:[error, Error(Contract, #5)], data:"escalating Ok(ScErrorType::Contract) frame-exit to Err" 1: [Diagnostic Event] topics:[fn_call, CDDE25PTGG2XOTQHJ25CIQRUBJ6I6Q4WLIIWSURLLWP26B5HKABWNU5E, lock], data:[Bytes(0da81888b70d5605b53a54c9daf9bd33f6ddef6066942d3d6123a153befffdac), GCBXRXZRQ5SUC3AZDY3QZ5SCKLCX7MRC2C25A2HHUJPFZHORZTKMWPSZ, 150000000, 1787885700] "';
    const mapped = mapTransactionError(new Error(errorMsg));
    expect(mapped.status).toBe("FAILED");
    expect(mapped.contractErrorCode).toBe(5);
    expect(mapped.contractErrorName).toBe("RewardExists");
    expect(mapped.message).toBe("This reward is already locked in the vault.");
    expect(mapped.isAlreadyLocked).toBe(true);
  });

  it("decodes Soroban registry error codes accurately", () => {
    const errorMsg = 'HostError: Error(Contract, #6) topics:[fn_call, registry, register_task]';
    const mapped = mapTransactionError(new Error(errorMsg));
    expect(mapped.status).toBe("FAILED");
    expect(mapped.contractErrorCode).toBe(6);
    expect(mapped.contractErrorName).toBe("TaskExists");
    expect(mapped.message).toBe("This task is already registered in the registry.");
    expect(mapped.isAlreadyRegistered).toBe(true);
  });

  it("decodes Soroban auth failures", () => {
    const errorMsg = 'HostError: Error(Auth, InvalidSignature)';
    const mapped = mapTransactionError(new Error(errorMsg));
    expect(mapped.status).toBe("FAILED");
    expect(mapped.message).toContain("Authorization failed");
  });
});


