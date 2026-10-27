import { test, expect } from '@playwright/test';

declare global {
  interface Window { organismEventMarks: { arcs: number; lines: number; closed: boolean }[] }
}

for (const width of [390, 1280]) test(`recorded prey captures and resource feeding have distinct marks at ${width}px`, async ({ page }, testInfo) => {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/judge', route => { requests.push(route.request().url()); return route.abort(); });
  await page.setViewportSize({ width, height: 850 });
  await page.clock.install({ time: new Date('2026-10-26T02:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-26T02:00:01Z'));
  await page.addInitScript(() => {
    window.organismEventMarks = [];
    const paths = new WeakMap<CanvasRenderingContext2D, { arcs: number; lines: number; closed: boolean }>();
    const proto = CanvasRenderingContext2D.prototype;
    const begin = proto.beginPath, arc = proto.arc, line = proto.lineTo, close = proto.closePath, stroke = proto.stroke;
    proto.beginPath = function () { paths.set(this, { arcs: 0, lines: 0, closed: false }); return begin.call(this); };
    proto.arc = function (...args: Parameters<typeof arc>) { const path = paths.get(this); if (path) path.arcs++; return arc.apply(this, args); };
    proto.lineTo = function (...args: Parameters<typeof line>) { const path = paths.get(this); if (path) path.lines++; return line.apply(this, args); };
    proto.closePath = function () { const path = paths.get(this); if (path) path.closed = true; return close.call(this); };
    proto.stroke = function (path?: Path2D) {
      const mark = paths.get(this);
      if (mark && this.canvas.classList.contains('life-canvas') && this.strokeStyle === '#ffd65c') window.organismEventMarks.push({ ...mark });
      return path ? stroke.call(this, path) : (stroke as () => void).call(this);
    };
  });
  await page.goto('/play');
  await page.getByRole('button', { name: 'Explore deterministic preset' }).click();
  await page.getByLabel('World policy').selectOption('fixed');
  await page.getByRole('button', { name: /Seed ecosystem/ }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const step = page.getByRole('button', { name: 'Step one generation' });
  for (let generation = 0; generation < 15; generation++) await step.click();
  await page.clock.runFor(100);
  await expect(page.getByTestId('generation')).toHaveText('15 / 180');
  const marks = await page.evaluate(() => window.organismEventMarks);
  expect(marks.some(mark => mark.arcs === 1 && !mark.closed)).toBe(true);
  expect(marks.some(mark => mark.lines === 3 && mark.closed && mark.arcs === 0)).toBe(true);
  await expect(page.locator('.legend')).toContainText('gold diamond = prey capture');
  await page.locator('canvas.life-canvas').screenshot({ path: testInfo.outputPath(`recorded-events-${width}.png`) });
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

test('reduced motion keeps factual activity without transient event marks', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-10-26T03:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-26T03:00:01Z'));
  await page.addInitScript(() => {
    window.organismEventMarks = [];
    const stroke = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function (path?: Path2D) {
      if (this.canvas.classList.contains('life-canvas') && ['#ffd65c', '#ff8877'].includes(String(this.strokeStyle))) window.organismEventMarks.push({ arcs: 0, lines: 0, closed: false });
      return path ? stroke.call(this, path) : (stroke as () => void).call(this);
    };
  });
  await page.route('**/api/judge', route => route.abort());
  await page.goto('/play');
  await page.getByRole('button', { name: 'Explore deterministic preset' }).click();
  await page.getByLabel('World policy').selectOption('fixed');
  await page.getByRole('button', { name: /Seed ecosystem/ }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Step one generation' }).click();
  await expect(page.getByTestId('generation')).toHaveText('1 / 180');
  await expect(page.getByRole('region', { name: 'Recorded activity' })).toContainText('feedings');
  await page.clock.runFor(100);
  expect(await page.evaluate(() => window.organismEventMarks)).toEqual([]);
});
