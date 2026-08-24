import { describe, expect, it } from "vitest";
import { formatXlm, stroopsToXlm, xlmToStroops } from "./amounts";

describe("XLM amounts", () => {
  it("converts XLM to stroops exactly", () => expect(xlmToStroops("15.25")).toBe(BigInt(152_500_000)));
  it("formats stroops without floating point loss", () => expect(stroopsToXlm("75000001")).toBe("7.5000001"));
  it("formats rewards for display", () => expect(formatXlm("150000000")).toBe("15"));
  it("rejects precision beyond seven decimals", () => expect(() => xlmToStroops("1.00000001")).toThrow());
});

