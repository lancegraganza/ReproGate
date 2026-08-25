// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/stellar/server", () => ({
  reconcileTaskWithChain: vi.fn().mockImplementation((id: string) => {
    if (id === "non-existent") throw new Error("Task not found.");
    return Promise.resolve({
      id,
      status: "FUNDING",
      vaultFundingTx: "onchain-hash",
    });
  }),
}));

import { POST } from "./route";

describe("POST /api/tasks/[id]/sync", () => {
  it("returns reconciled task state when successful", async () => {
    const request = new Request("https://example.test/api/tasks/test-task/sync", { method: "POST" });
    const response = await POST(request, { params: Promise.resolve({ id: "test-task" }) });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { task: { id: string; status: string } };
    expect(body.task.status).toBe("FUNDING");
    expect(body.task.id).toBe("test-task");
  });

  it("returns error response when task is not found", async () => {
    const request = new Request("https://example.test/api/tasks/non-existent/sync", { method: "POST" });
    const response = await POST(request, { params: Promise.resolve({ id: "non-existent" }) });
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("Task not found");
  });
});
