import { describe, expect, it } from "vitest";
import { assertTaskTransition, canTransition } from "./task-state";

describe("task state transitions", () => {
  it("allows confirmed funding and activation", () => { expect(canTransition("DRAFT", "FUNDING")).toBe(true); expect(canTransition("FUNDING", "OPEN")).toBe(true); });
  it("rejects activation directly from draft", () => expect(() => assertTaskTransition("DRAFT", "OPEN")).toThrow());
  it("freezes a verification snapshot before finalization", () => {
    expect(canTransition("VERIFYING", "FINALIZING")).toBe(true);
    expect(canTransition("FINALIZING", "VERIFIED")).toBe(true);
    expect(canTransition("OPEN", "FINALIZING")).toBe(false);
  });
  it("makes verified tasks terminal", () => expect(canTransition("VERIFIED", "OPEN")).toBe(false));
});
