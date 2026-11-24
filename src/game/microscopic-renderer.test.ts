import { afterEach, describe, expect, it, vi } from "vitest";
import { hazardHatchAlpha, paintResourceField, resourceFieldColor, resourceGrainOffset } from "./microscopic-renderer";

let images: Uint8ClampedArray[] = [];
function paint(resources: Uint8Array, hazards = new Uint8Array(2500), showHazards = false) {
  images = [];
  const makeCanvas = () => {
    let data: Uint8ClampedArray;
    const ctx = { createImageData(w: number, h: number) { data = new Uint8ClampedArray(w*h*4); return { data }; }, putImageData() { images.push(data); }, drawImage() {}, save() {}, restore() {}, set globalCompositeOperation(_v: string) {}, set globalAlpha(_v: number) {} };
    return { width: 0, height: 0, getContext: () => ctx };
  };
  vi.stubGlobal("document", { createElement: makeCanvas });
  paintResourceField({ drawImage() {}, save() {}, restore() {}, set globalCompositeOperation(_v: string) {}, set globalAlpha(_v: number) {} } as unknown as CanvasRenderingContext2D, 0, 1, 1, 50, 50, resources, hazards, showHazards);
  return images;
}

describe("native habitat resource field encoding", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("renders distinct normalized resource levels with spatial 5-cell grain", () => {
    const a = new Uint8Array(2500).fill(150), b = new Uint8Array(2500).fill(235);
    const first = paint(a)[0], second = paint(b)[0];
    expect(first.some((v, i) => i % 4 !== 3 && v > 0)).toBe(true);
    expect(Array.from(first)).not.toEqual(Array.from(second));
    const channel = (x: number, y: number) => first[(y * 200 + x) * 4 + 1];
    expect(channel(20, 20)).toBe(channel(40, 20));
    expect(channel(20, 20)).toBe(channel(20, 40));
  });
  it("keeps hazard alpha gaps transparent independently of food", () => {
    const hazards = new Uint8Array(2500).fill(255);
    const [food, hazard] = paint(new Uint8Array(2500).fill(150), hazards, true);
    expect(food[3]).toBe(255);
    expect(hazard.length).toBe(160*160*4);
    const alphas = Array.from({ length: hazard.length / 4 }, (_, i) => hazard[i * 4 + 3]);
    expect(alphas.some(a => a === 0)).toBe(true);
    expect(alphas.some(a => a > 0)).toBe(true);
  });
  it("keeps resource grain absent on depletion and brings it back with abundance", () => {
    expect(resourceGrainOffset(10, 20, 0)).toBe(0);
    expect(resourceGrainOffset(10, 20, 1)).not.toBe(0);
    expect(Math.abs(resourceGrainOffset(10, 20, 0.25))).toBeLessThan(Math.abs(resourceGrainOffset(10, 20, 1)));
  });
  it("uses deterministic periodic world-anchored grain", () => {
    const offset = resourceGrainOffset(10.25, 20.75, 1);
    expect(offset).toBeGreaterThan(0);
    expect(resourceGrainOffset(10.25, 20.75, 1)).toBe(offset);
    expect(resourceGrainOffset(15.25, 20.75, 1)).toBeCloseTo(offset, 5);
    expect(resourceGrainOffset(10.25, 25.75, 1)).toBeCloseTo(offset, 5);
    expect(resourceGrainOffset(11.25, 20.75, 1)).not.toBeCloseTo(offset, 5);
    expect(resourceGrainOffset(10.25, 21.75, 1)).not.toBeCloseTo(offset, 5);
    expect(resourceGrainOffset(10.25 + 50, 20.75, 1)).toBeCloseTo(offset, 5);
    expect(resourceGrainOffset(10.25, 20.75, 0)).toBe(0);
  });
  it("hatches only where hazard is present, with stronger values more visible", () => {
    expect(hazardHatchAlpha(0, 1, 0)).toBe(0);
    const points = [[0,0],[.2,0],[.5,0],[.1,.1]];
    const hatch = points.map(([x,y]) => hazardHatchAlpha(255,x,y));
    const low = points.map(([x,y]) => hazardHatchAlpha(12,x,y));
    expect(hatch.some(a => a > 0)).toBe(true);
    expect(Math.min(...hatch)).toBe(0);
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
