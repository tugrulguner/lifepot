import { describe, expect, it, vi } from "vitest";
import { organismContours, organismPath, traceOrganism, type OrganismRole } from "./organism-glyphs";
const roles: OrganismRole[] = ["producer", "grazer", "scavenger", "hunter", "omnivore"];
describe("shared organism silhouettes", () => {
  it("gives each feeding role distinct geometry", () => {
    expect(new Set(roles.map(role => organismPath(role))).size).toBe(5);
    expect(organismContours("scavenger")).toHaveLength(3);
    expect(organismContours("producer")).toHaveLength(1);
    expect(organismPath(undefined)).toBe(organismPath("grazer"));
  });
  for (const role of roles) for (const pitch of [2.88, 4.08, 5.64, 11.28]) it(`${role} drawing bounds at ${pitch}px pitch`, () => {
    const drawn: number[][] = [];
    const context = { beginPath: vi.fn(), closePath: vi.fn(), moveTo: (x: number, y: number) => drawn.push([x, y]), lineTo: (x: number, y: number) => drawn.push([x, y]) };
    traceOrganism(context as unknown as CanvasRenderingContext2D, role, 0, 0, pitch * .44);
    expect(drawn.length).toBeGreaterThan(40);
    expect(context.closePath).toHaveBeenCalledTimes(organismContours(role).length);
    // Actual submitted vertices plus the outer half-stroke, not an assumed radius.
    for (const vertex of drawn) for (const coordinate of vertex) expect(Math.abs(coordinate) + pitch * .07 / 2).toBeLessThan(pitch / 2);
    const svg = organismPath(role, 0, 0, pitch * .44).match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi)!.map(Number);
    expect(svg).toEqual(drawn.flat());
  });
});
