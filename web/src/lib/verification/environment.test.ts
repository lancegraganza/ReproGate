import { describe, expect, it } from "vitest";
import { environmentKey, normalizeEnvironment } from "./environment";

const base = { operatingSystem: " Windows 11 ", runtime: "NodeJS", runtimeVersion: "v22.4.0", packageManager: "PNPM", packageManagerVersion: "9.x", dependencies: { React: "19.2.0", Next: "16.3.2" } };

describe("environment normalization", () => {
  it("normalizes aliases, case, versions, and dependency ordering", () => expect(normalizeEnvironment(base)).toEqual({ operatingSystem: "windows 11", runtime: "node.js", runtimeVersion: "22.4.0", packageManager: "pnpm", packageManagerVersion: "9.x", dependencies: { next: "16.3.2", react: "19.2.0" } }));
  it("creates the same key for semantically equal input", () => expect(environmentKey(base)).toBe(environmentKey({ ...base, runtime: "node.js", dependencies: { Next: "16.3.2", React: "19.2.0" } })));
});

