// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/settlement-recovery", () => ({
  runSettlementRecovery: vi.fn().mockResolvedValue({ status: "idle" }),
}));

import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("settlement recovery cron authorization", () => {
  it("does not run without a server-side CRON_SECRET", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(new Request("https://example.test/api/cron/settle"))).status).toBe(503);
  });

  it("requires the configured bearer token", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    expect((await GET(new Request("https://example.test/api/cron/settle"))).status).toBe(401);
    const response = await GET(new Request("https://example.test/api/cron/settle", {
      headers: { Authorization: "Bearer cron-secret" },
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "idle" });
  });
});
