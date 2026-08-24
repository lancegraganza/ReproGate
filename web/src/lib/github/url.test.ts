import { describe, expect, it } from "vitest";
import { parseGitHubIssueUrl } from "./url";

describe("GitHub issue URL parsing", () => {
  it("parses a public issue URL", () => expect(parseGitHubIssueUrl("https://github.com/stellar/js-stellar-sdk/issues/123")).toEqual({ owner: "stellar", repo: "js-stellar-sdk", number: 123 }));
  it("rejects pull request URLs", () => expect(() => parseGitHubIssueUrl("https://github.com/stellar/js-stellar-sdk/pull/123")).toThrow());
  it("rejects lookalike hosts", () => expect(() => parseGitHubIssueUrl("https://github.com.example.org/a/b/issues/1")).toThrow());
});

