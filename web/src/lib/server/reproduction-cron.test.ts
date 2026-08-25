// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { selectAutomationEnvironment } from "./reproduction-cron";
import type { TaskDetail } from "@/types/domain";

describe("automated evidence environment", () => {
  it("reuses the first confirmed eligible reproduction environment", () => {
    const environment = {
      operatingSystem: "macos sonoma 14.4",
      runtime: "node.js",
      runtimeVersion: "20.11.1",
      packageManager: "npm",
      packageManagerVersion: "10.2.4",
      dependencies: { express: "4.18.3" },
    };
    const task = {
      submissions: [
        {
          eligible: false,
          verdict: "REPRODUCED",
          chainStatus: "CONFIRMED",
          environment: { ...environment, runtimeVersion: "18.0.0" },
        },
        {
          eligible: true,
          verdict: "REPRODUCED",
          chainStatus: "CONFIRMED",
          environment,
        },
      ],
    } as unknown as TaskDetail;

    const selected = selectAutomationEnvironment(task);
    expect(selected).toEqual(environment);
    expect(selected).not.toBe(environment);
    expect(selected?.dependencies).not.toBe(environment.dependencies);
  });
});
