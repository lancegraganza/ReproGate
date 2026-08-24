// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/stellar/events", () => ({
  syncContractEventsThrottled: vi.fn().mockResolvedValue({ indexed: 0, reconciled: 0 }),
}));

import { GET, POST } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("hosted event sync authorization", () => {
  it("rejects missing hosted configuration", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("CRON_SECRET", "");
    expect((await POST(new Request("https://example.test/api/stellar/sync", { method: "POST" }))).status)
      .toBe(503);
  });

  it("rejects the wrong bearer token and accepts the configured token", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("CRON_SECRET", "correct-secret");
    const wrong = await POST(new Request("https://example.test/api/stellar/sync", {
      method: "POST",
      headers: { Authorization: "Bearer wrong-secret" },
    }));
    expect(wrong.status).toBe(401);
    const accepted = await POST(new Request("https://example.test/api/stellar/sync", {
      method: "POST",
      headers: { Authorization: "Bearer correct-secret" },
    }));
    expect(accepted.status).toBe(200);
    const cron = await GET(new Request("https://example.test/api/stellar/sync", {
      headers: { Authorization: "Bearer correct-secret" },
    }));
    expect(cron.status).toBe(200);
  });
});
