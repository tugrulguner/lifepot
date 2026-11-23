import { describe, expect, it } from "vitest";
import { hazardHatchAlpha, resourceFieldColor, resourceGrainOffset } from "./microscopic-renderer";

describe("native habitat resource field encoding", () => {
  it("keeps resource grain absent on depletion and brings it back with abundance", () => {
    expect(resourceGrainOffset(10, 20, 0)).toBe(0);
    expect(resourceGrainOffset(10, 20, 1)).not.toBe(0);
    expect(Math.abs(resourceGrainOffset(10, 20, 0.25))).toBeLessThan(Math.abs(resourceGrainOffset(10, 20, 1)));
  });
  it("uses deterministic periodic world-anchored grain", () => {
    const offset = resourceGrainOffset(10.25, 20.75, 1);
    expect(resourceGrainOffset(10.25, 20.75, 1)).toBe(offset);
    expect(resourceGrainOffset(10.25 + 50, 20.75, 1)).toBe(offset);
    expect(resourceGrainOffset(10.25, 20.75, 0)).toBe(0);
  });
  it("hatches hazards only where abundance exists, with stronger values more visible", () => {
    expect(hazardHatchAlpha(0, 1, 0)).toBe(0);
    const hatch = [[0,0],[0,1],[1,0],[1,1]].map(([x,y]) => hazardHatchAlpha(255,x,y));
    const low = [[0,0],[0,1],[1,0],[1,1]].map(([x,y]) => hazardHatchAlpha(12,x,y));
    expect(hatch.some(a => a > 0)).toBe(true);
    expect(Math.min(...hatch)).toBeGreaterThan(0);
    expect(Math.max(...hatch)).toBeGreaterThan(Math.min(...hatch));
    expect(low.every((a,i) => a <= hatch[i])).toBe(true);
  });
  it("maps resource levels to distinct but restrained field colors", () => {
    const depleted = resourceFieldColor(0), rich = resourceFieldColor(255);
    const distance = Math.hypot(rich[0] - depleted[0], rich[1] - depleted[1], rich[2] - depleted[2]);
    expect(distance).toBeGreaterThanOrEqual(60);
    expect(rich[1]).toBeGreaterThan(depleted[1]);
    expect(rich[2]).toBeGreaterThan(depleted[2]);
    expect(resourceFieldColor(128)[1]).toBeGreaterThan(depleted[1]);
    expect(resourceFieldColor(128)[1]).toBeLessThan(rich[1]);
  });
});
