import { describe, expect, it } from "vitest";
import { buildState, releaseVersion, LATEST_RELEASE_URL } from "./app-release";

describe("Android build status", () => {
  it("reports a started workflow as building", () => expect(buildState("in_progress", null)).toBe("Building"));
  it("reports successful completion", () => expect(buildState("completed", "success")).toBe("Succeeded"));
  it("reports a failed workflow", () => expect(buildState("completed", "failure")).toBe("Failed"));
  it("does not treat cancelled builds as successful", () => expect(buildState("completed", "cancelled")).toBe("Cancelled"));
  it("does not treat queued builds as started", () => expect(buildState("queued", null)).toBe("Queued"));
  it("maps workflow release numbers to installed Android versions", () => expect(releaseVersion("build-4")).toBe("1.0.4"));
  it("does not invent versions for unknown release tags", () => expect(releaseVersion("v6")).toBeNull());
  it("links to the supplied repository's stable release", () => expect(LATEST_RELEASE_URL).toBe("https://github.com/zhemondev-ctrl/winlog-calls/releases/latest"));
});