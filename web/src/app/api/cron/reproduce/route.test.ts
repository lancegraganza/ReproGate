// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/reproduction-cron", () => ({
  runAutomatedReproduction: vi.fn().mockResolvedValue({ status: "completed" }),
}));

import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("automated reproduction cron authorization", () => {
  it("does not run without a server-side CRON_SECRET", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(new Request("https://example.test/api/cron/reproduce"))).status).toBe(503);
  });

  it("requires the configured bearer token", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    expect((await GET(new Request("https://example.test/api/cron/reproduce"))).status).toBe(401);
    const response = await GET(new Request("https://example.test/api/cron/reproduce", {
      headers: { Authorization: "Bearer cron-secret" },
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "completed", scheduler: "cron-job.org" });
  });
});
