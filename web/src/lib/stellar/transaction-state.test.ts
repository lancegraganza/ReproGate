import { describe, expect, it } from "vitest";
import { mapTransactionError } from "./transaction-state";

describe("transaction error mapping", () => {
  it("treats wallet rejection as recoverable", () => expect(mapTransactionError(new Error("User rejected request"))).toEqual({ status: "REJECTED", message: "Signature request was rejected. Nothing was sent." }));
  it("maps insufficient balance clearly", () => expect(mapTransactionError(new Error("op_underfunded insufficient balance")).message).toContain("insufficient"));
  it("maps confirmation timeouts to expired", () => expect(mapTransactionError(new Error("transaction timeout")).status).toBe("EXPIRED"));
});

