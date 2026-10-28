import { describe, expect, it } from "vitest";
import { clampZoom, screenToWorld, worldToScreen, boundCamera, followCamera, type Camera } from "./camera";
import { createSimulation } from "./world";
import { defaultConfig } from "./setup";

it("bounds normalized panning without exposing empty habitat", () => {
  expect(boundCamera({ zoom: 2, x: 4, y: -4 })).toEqual({ zoom: 2, x: .5, y: -.5 });
  expect(boundCamera({ zoom: 1, x: 1, y: -1 })).toEqual({ zoom: 1, x: 0, y: 0 });
});
it("follows identities rather than cells and reports lost targets", () => {
  const state = createSimulation({ seed: 12, config: defaultConfig() });
  const cell = state.guild.findIndex(Boolean), id = state.organismId[cell];
  const camera = { zoom: 3, x: 0, y: 0 };
  const snapshot = JSON.stringify(state);
  expect(followCamera(camera, state, { kind: "organism", id })?.zoom).toBe(3);
  expect(followCamera(camera, state, { kind: "organism", id: 999999 })).toBeNull();
  expect(followCamera(camera, state, { kind: "family", id: state.lineage[cell] })).not.toBeNull();
  expect(JSON.stringify(state)).toBe(snapshot);
});

it("tracks the oldest family member across the seam and switches after death", () => {
  const state = createSimulation({ seed: 12, config: defaultConfig() });
  state.guild.fill(0); state.organismId.fill(0); state.lineage.fill(0);
  state.guild[0] = state.guild[49] = 1;
  state.organismId[0] = 3; state.organismId[49] = 8;
  state.lineage[0] = state.lineage[49] = 12;
  const camera = { zoom: 3, x: 0, y: 0 };
  expect(followCamera(camera, state, { kind: "family", id: 12 })).toEqual({ zoom: 3, x: 1, y: 1 });
  state.organismId[0] = 8; state.organismId[49] = 3;
  expect(followCamera(camera, state, { kind: "organism", id: 3 })?.x).toBe(-1);
  expect(followCamera(camera, state, { kind: "family", id: 12 })?.x).toBe(-1);
  state.guild[49] = 0;
  expect(followCamera(camera, state, { kind: "family", id: 12 })?.x).toBe(1);
  expect(followCamera(camera, state, { kind: "organism", id: 3 })).toBeNull();
  state.guild[0] = 0;
  expect(followCamera(camera, state, { kind: "family", id: 12 })).toBeNull();
});

it("keeps every followed cell center inside the drawable habitat at every supported zoom", () => {
  const state = createSimulation({ seed: 12, config: defaultConfig() });
  state.guild.fill(0); state.organismId.fill(0);
  for (const zoom of [1, 1.5, 2, 2.5, 3]) {
    for (let index = 0; index < 2500; index++) {
      state.guild[index] = 1; state.organismId[index] = 1;
      const camera = followCamera({ zoom, x: 0, y: 0 }, state, { kind: "organism", id: 1 })!;
      for (const width of [180, 318, 600]) {
        const size = { width, height: width }, interior = width - 36;
        const point = { x: 18 + (index % 50 + .5) * interior / 50, y: 18 + (Math.floor(index / 50) + .5) * interior / 50 };
        const screen = worldToScreen(point, { ...camera, x: camera.x * interior, y: camera.y * interior }, size);
        expect(screen.x).toBeGreaterThan(18); expect(screen.x).toBeLessThan(width - 18);
        expect(screen.y).toBeGreaterThan(18); expect(screen.y).toBeLessThan(width - 18);
      }
      state.guild[index] = 0; state.organismId[index] = 0;
    }
  }
});

describe("camera transforms", () => {
  it("round-trips world points through zoom and pan", () => {
    const camera: Camera = { zoom: 2, x: 120, y: -35 };
    const screen = worldToScreen({ x: 60, y: 50 }, camera, { width: 400, height: 300 });
    expect(screenToWorld(screen, camera, { width: 400, height: 300 })).toEqual({ x: 60, y: 50 });
  });
  it("bounds zoom and keeps full-world reset neutral", () => {
    expect(clampZoom(.01)).toBe(1);
    expect(clampZoom(8)).toBe(3);
    expect(clampZoom(1)).toBe(1);
  });
});
