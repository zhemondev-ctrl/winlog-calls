import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Android build triggers", () => {
  it("builds every pushed commit without limiting changed paths", () => {
    const workflow = readFileSync(".github/workflows/android-apk.yml", "utf8");
    const push = workflow.split("  push:")[1]?.split("  workflow_dispatch:")[0];
    expect(push).toBeDefined();
    expect(push).toContain('branches: ["**"]');
    expect(push).not.toMatch(/paths(?:-ignore)?:/);
  });
});