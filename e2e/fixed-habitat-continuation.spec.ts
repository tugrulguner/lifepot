import { test, expect } from "@playwright/test";
import { deepStrictEqual } from "node:assert";
import { defaultConfig } from "../src/game/setup";
import { advanceFixedHabitat, createFixedHabitat, extendFixedHabitat } from "../src/game/fixed-habitat";

// Complete populated-world engine acceptance in the existing Playwright lane.
// This does not exercise the UI, browser reload or checkpoint persistence.
// The equivalent short-window unit remains in fixed-habitat.test.ts. The full
// 720-transition comparison exceeded Vitest's unchanged five-second default;
// retain all original worlds/steps and strengthen equality here, without a
// per-test timeout override or a claim about stepping/rendering performance.
test("fixed habitat extension through 180 to 360 preserves the complete deterministic state", () => {
  const extended = createFixedHabitat({ seed: 41, config: defaultConfig() });
  const direct = createFixedHabitat({ seed: 41, config: defaultConfig(), observationLimit: 360 });
  const at180 = advanceFixedHabitat(extended, 180);
  const continued = advanceFixedHabitat(extendFixedHabitat(at180, 360), 180);
  const uninterrupted = advanceFixedHabitat(direct, 360);
  expect(at180.generation).toBe(180);
  expect(continued.generation).toBe(360);
  deepStrictEqual(continued, uninterrupted);
});
