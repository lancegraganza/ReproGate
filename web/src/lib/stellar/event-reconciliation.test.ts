import { describe, expect, it } from "vitest";
import { planForContractEvent } from "./event-reconciliation";

describe("contract event reconciliation", () => {
  it("maps funding and registration events without allowing state downgrades", () => {
    expect(planForContractEvent("reward_funded")).toMatchObject({
      status: "FUNDING",
      transactionKind: "FUND",
      allowedFrom: ["DRAFT", "FAILED"],
    });
    expect(planForContractEvent("task_registered")).toMatchObject({
      status: "OPEN",
      transactionKind: "REGISTER",
    });
  });

  it("maps terminal events to their exclusive final state", () => {
    expect(planForContractEvent("task_completed")?.status).toBe("VERIFIED");
    expect(planForContractEvent("reward_refunded")?.status).toBe("EXPIRED");
  });

  it("ignores unknown events", () => {
    expect(planForContractEvent("transfer")).toBeUndefined();
  });
});

