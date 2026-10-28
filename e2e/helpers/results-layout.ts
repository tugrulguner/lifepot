import type { Page } from "@playwright/test";

/** Observe settled post-resize layout before choosing an intentional scroll position. */
export async function settleResultsLayout(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const started = performance.now();
    let previous = "", stableFrames = 0;
    const observe = () => {
      const board = document.querySelector("canvas.life-canvas")?.getBoundingClientRect();
      const results = document.querySelector('[aria-label="Run results"]')?.getBoundingClientRect();
      const current = JSON.stringify([
        innerWidth, innerHeight, document.documentElement.scrollHeight,
        board?.width, board?.height, results ? results.top + scrollY : null,
      ]);
      stableFrames = current === previous ? stableFrames + 1 : 0;
      previous = current;
      if (stableFrames >= 3) return resolve();
      if (performance.now() - started > 1000) return reject(new Error("Results layout did not settle after resize"));
      requestAnimationFrame(observe);
    };
    requestAnimationFrame(observe);
  }));
}
