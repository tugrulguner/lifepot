import { expect, test } from "vitest";
import { visualProgress, spriteCullExtent, crossedWorldEdge } from "./visual-transition";
import { clampZoom, cameraViewportRects } from "./camera";

test("approved movement finishes at 350ms while events continue to 450ms", () => {
  expect(visualProgress(175).movement).toBe(.5);
  expect(visualProgress(350)).toEqual({ movement: 1, event: 350 / 450 });
  expect(visualProgress(450)).toEqual({ movement: 1, event: 1 });
  expect(visualProgress(-10)).toEqual({ movement: 0, event: 0 });
});
test("culling encloses every rotated and feeding-scaled sprite corner", () => {
  for (const zoom of [1,2,5,10]) for (const angle of [0,.3,.8,Math.PI/2]) {
    for (const x of [-96,96]) for (const y of [-96,96]) {
      const px=(x*Math.cos(angle)-y*Math.sin(angle))*1.09*zoom;
      expect(Math.abs(px)).toBeLessThanOrEqual(spriteCullExtent(192,zoom)+1e-10);
    }
  }
});
test("crossing boxes use actual identity movement across either world edge", () => {
  expect(crossedWorldEdge([49.5,4.5],[.5,4.5])).toBe(true);
  expect(crossedWorldEdge([4.5,.5],[4.5,49.5])).toBe(true);
  expect(crossedWorldEdge([4.5,4.5],[5.5,4.5])).toBe(false);
});
test("approved magnifications retain their actual world span", () => {
  for (const zoom of [1,2,5,10]) {
    expect(clampZoom(zoom)).toBe(zoom);
    expect(cameraViewportRects({zoom,x:0,y:0})[0].width).toBe(50/zoom);
  }
  expect(clampZoom(100)).toBe(10);
});
