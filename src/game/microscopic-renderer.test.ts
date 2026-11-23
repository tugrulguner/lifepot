import { describe, expect, it } from "vitest";
import { resourceFieldColor } from "./microscopic-renderer";

describe("native habitat resource field encoding", () => {
  it("makes depleted and resource-rich cells clearly distinct at overview and zoom sampling", () => {
    const depleted = resourceFieldColor(0);
    const rich = resourceFieldColor(255);
    const distance = Math.hypot(rich[0] - depleted[0], rich[1] - depleted[1], rich[2] - depleted[2]);
    expect(distance).toBeGreaterThanOrEqual(60);
    expect(rich[1]).toBeGreaterThan(depleted[1]);
    expect(rich[2]).toBeGreaterThan(depleted[2]);
    expect(resourceFieldColor(128)[1]).toBeGreaterThan(depleted[1]);
    expect(resourceFieldColor(128)[1]).toBeLessThan(rich[1]);
  });
});
