import { describe, expect, it, vi } from "vitest";
import { organismContours, organismPath, organismPath2D, organismSprite, paintOrganism, traceOrganism, type OrganismRole } from "./organism-glyphs";
import * as artwork from "./organism-glyphs";
const roles: OrganismRole[] = ["producer", "grazer", "scavenger", "hunter", "omnivore"];
describe("shared organism silhouettes", () => {
  it("gives each feeding role distinct geometry", () => {
    expect(new Set(roles.map(role => organismPath(role))).size).toBe(5);
    expect(organismContours("scavenger")).toHaveLength(3);
    expect(organismContours("producer")).toHaveLength(1);
    expect(organismPath(undefined)).toBe(organismPath("grazer"));
  });
  it("uses broad asymmetric and visibly distinct primary body contours", () => {
    const grazer = organismContours("grazer")[0];
    const xs = grazer.map(([x]) => x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(1.7);
    expect(new Set(xs.map(x => x.toFixed(3))).size).toBeGreaterThan(12);
    expect(organismContours("scavenger")).toHaveLength(3);
    expect(organismContours("producer")[0].filter(([x,y]) => Math.hypot(x,y) > .9).length).toBeGreaterThan(8);
    expect(organismContours("hunter")[0].some(([x, y]) => x < -.7 && Math.abs(y) > .25)).toBe(true);
    const middle = organismContours("scavenger")[1].map(([, y]) => y);
    expect(Math.max(...middle) - Math.min(...middle)).toBeGreaterThan(1);
  });
  it("derives Canvas and SVG internal accents from one normalized command source", () => {
    expect(artwork.organismAccentPath).toBeTypeOf("function");
    expect(artwork.traceOrganismAccents).toBeTypeOf("function");
    for (const role of roles) {
      const drawn: number[] = [];
      const c = { beginPath() {}, closePath() {}, moveTo: (...p: number[]) => drawn.push(...p), lineTo: (...p: number[]) => drawn.push(...p), quadraticCurveTo: (...p: number[]) => drawn.push(...p) };
      artwork.traceOrganismAccents(c as unknown as CanvasRenderingContext2D, role, 11, 17, 2.8);
      const svg = artwork.organismAccentPath(role, 11, 17, 2.8).match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi)!.map(Number);
      expect(svg).toEqual(drawn);
      expect(drawn.length).toBeGreaterThan(0);
    }
  });
  it("keeps body clipping active while painting internal role accents", () => {
    let clipped = false, strokeStyle = "";
    const stack: boolean[] = [], accents: boolean[] = [];
    const operations = {
      save: () => stack.push(clipped), restore: () => { clipped = stack.pop()!; }, clip: () => { clipped = true; },
      createLinearGradient: () => ({ addColorStop: vi.fn() }),
      stroke: () => { if (strokeStyle === "rgba(7,16,15,.62)") accents.push(clipped); },
    };
    const context = new Proxy(operations, {
      get(target, key) { return Reflect.get(target, key) ?? (() => {}); },
      set(_target, key, value) { if (key === "strokeStyle") strokeStyle = value; return true; },
    });
    paintOrganism(context as unknown as CanvasRenderingContext2D, "scavenger", "#abcdef", 0, 0, 8);
    expect(accents).toEqual([true]);
    expect(clipped).toBe(false);
  });
  it("paints clipped shading and accents in shared organism artwork", () => {
    const calls: string[] = [];
    const context = new Proxy({} as object, { get(_t, key) { if (key === "createLinearGradient") return () => ({ addColorStop: vi.fn() }); return () => calls.push(String(key)); }, set(_t, key) { calls.push(`set:${String(key)}`); return true; } });
    paintOrganism(context as CanvasRenderingContext2D, "hunter", "#abcdef", 0, 0, 8);
    expect(calls).toContain("fillRect");
    expect(calls).toContain("clip");
    expect(calls.filter(name => name === "fill").length).toBeGreaterThanOrEqual(3);
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
  it("caches exact shared Path2D contours with a bounded radius-keyed cache", () => {
    class FakePath2D {
      readonly commands: Array<[string, number?, number?]> = [];
      moveTo(x: number, y: number) { this.commands.push(["moveTo", x, y]); }
      lineTo(x: number, y: number) { this.commands.push(["lineTo", x, y]); }
      closePath() { this.commands.push(["closePath"]); }
    }
    vi.stubGlobal("Path2D", FakePath2D);
    try {
      const producer = organismPath2D("producer", 4);
      expect(producer).toBe(organismPath2D("producer", 4));
      expect((producer as unknown as FakePath2D).commands).toEqual(organismContours("producer").flatMap(contour => [
        ["moveTo", contour[0][0] * 4, contour[0][1] * 4],
        ...contour.slice(1).map(([x, y]) => ["lineTo", x * 4, y * 4]),
        ["closePath"],
      ]));
      const first = organismPath2D("grazer", 1);
      for (let radius = 2; radius <= 65; radius++) organismPath2D("grazer", radius);
      expect(organismPath2D("grazer", 1)).not.toBe(first);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("centers fractional-pitch silhouettes inside the rounded sprite bitmap", () => {
    class FakePath2D { moveTo() {} lineTo() {} closePath() {} }
    vi.stubGlobal("Path2D", FakePath2D);
    const context = { setTransform: vi.fn(), translate: vi.fn(), fill: vi.fn(), stroke: vi.fn(), save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), clip: vi.fn(), fillRect: vi.fn(), quadraticCurveTo: vi.fn(), createLinearGradient: () => ({ addColorStop: vi.fn() }) };
    vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
    try {
      for (const pitch of [2.88, 4.08, 5.64, 6.3, 11.28]) for (const dpr of [1, 1.5, 2]) for (const role of roles) {
        const sprite = organismSprite(role, "#fe0123", pitch, dpr)!;
        const [scaleX, , , scaleY] = context.setTransform.mock.lastCall!;
        const [centerX, centerY] = context.translate.mock.lastCall!;
        expect(centerX * scaleX).toBeCloseTo(sprite.width / 2, 10);
        expect(centerY * scaleY).toBeCloseTo(sprite.height / 2, 10);
        for (const contour of organismContours(role)) for (const [x, y] of contour) {
          expect((Math.abs(x) * pitch * .44 + pitch * .07 / 2) * scaleX).toBeLessThan(sprite.width / 2);
          expect((Math.abs(y) * pitch * .44 + pitch * .07 / 2) * scaleY).toBeLessThan(sprite.height / 2);
        }
      }
    } finally { vi.unstubAllGlobals(); }
  });
  it("rasterizes a reusable, role-colored cell sprite keyed by pitch and DPR", () => {
    class FakePath2D { moveTo() {} lineTo() {} closePath() {} }
    class FakeCanvas { width = 0; height = 0; getContext() { return context as unknown as CanvasRenderingContext2D; } }
    vi.stubGlobal("Path2D", FakePath2D);
    const calls: Array<[string, ...unknown[]]> = [];
    const context = new Proxy({} as object, { get(_target, key) { if (key === "createLinearGradient") return () => ({ addColorStop: vi.fn() }); return (...args: unknown[]) => calls.push([String(key), ...args]); }, set(_target, key, value) { calls.push([`set:${String(key)}`, value]); return true; } });
    vi.stubGlobal("document", { createElement: vi.fn(() => new FakeCanvas()) });
    try {
      const sprite = organismSprite("hunter", "#abcdef", 7, 2);
      expect(sprite).toBeInstanceOf(FakeCanvas);
      expect(organismSprite("hunter", "#abcdef", 7, 2)).toBe(sprite);
      expect(sprite!.width).toBe(14);
      expect(calls).toContainEqual(["set:fillStyle", "#abcdef"]);
      expect(calls.filter(([name]) => name === "stroke")).toHaveLength(3);
      expect(calls).toContainEqual(["set:lineWidth", 7 * .07]);
      expect(organismSprite("hunter", "#abcdef", 7, 1)).not.toBe(sprite);
      const first = organismSprite("producer", "#fedcba", 1, 1);
      for (let pitch = 2; pitch <= 65; pitch++) organismSprite("producer", "#fedcba", pitch, 1);
      expect(organismSprite("producer", "#fedcba", 1, 1)).not.toBe(first);
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
  });
});
