import { test, expect, type Page } from '@playwright/test';

async function finishTrial(page: Page) {
  const step = page.getByRole('button', { name: 'Step one generation', exact: true });
  const control = await step.elementHandle();
  if (!control) throw new Error('Missing actual step control');
  for (let ticks = 0; ticks < 180;) {
    const action = await control.evaluate(button => {
      if (!button.isConnected) return 'complete';
      if (!(button instanceof HTMLButtonElement)) throw new Error('Invalid step control');
      if (button.disabled) return 'waiting';
      button.click();
      return 'stepped';
    });
    if (action === 'complete') break;
    if (action === 'waiting') await expect(step).toBeEnabled();
    else ticks++;
  }
  await expect(page.getByRole('region', { name: 'Run results', exact: true })).toBeVisible();
  await expect(page.getByTestId('generation')).toHaveText('180 / 180');
}

for (const width of [390, 1280]) test.describe.serial(`observed-history journey at ${width}px`, () => {
  let page: Page;
  let motivation = '';
  const errors: string[] = [], inference: string[] = [];
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({ viewport: { width, height: 850 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/{judge,reflect,player-proposal}', route => { inference.push(route.request().url()); return route.abort(); });
  });
  test.afterAll(async () => { await page?.close(); });

  test('inspect a real recorded scene and return to the unchanged completed world', async ({}, testInfo) => {
    await page.goto('/play');
    await page.getByRole('button', { name: 'Explore deterministic preset', exact: true }).click();
    await page.getByLabel('World policy', { exact: true }).selectOption('fixed');
    await page.getByLabel('Your question or prediction (optional)', { exact: true }).fill('Does resource abundance change this observed outcome?');
    await page.getByRole('button', { name: /Seed ecosystem/ }).click();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    for (let tick = 0; tick < 16; tick++) await page.getByRole('button', { name: 'Step one generation', exact: true }).click();
    const inspector = page.getByRole('region', { name: 'Creature inspector', exact: true });
    await inspector.getByRole('button', { name: 'Inspect a living organism', exact: true }).click();
    await inspector.getByRole('button', { name: /^Follow founder lineage #/ }).click();
    await finishTrial(page);
    const outcomes = page.getByRole('list', { name: 'Observed outcomes', exact: true });
    const before = await outcomes.innerText();
    const familyOutcome = await page.getByRole('status', { name: 'Followed lineage outcome' }).innerText();
    const picker = page.getByLabel('Recorded moment to investigate', { exact: true });
    await expect(picker).toBeVisible();
    // Choose an actual retained extinction when one exists, otherwise the factual final observation.
    const value = await picker.locator('option').evaluateAll(options => options.find(option => (option as HTMLOptionElement).value.startsWith('family:'))?.getAttribute('value') ?? options.find(option => (option as HTMLOptionElement).value.startsWith('extinction:'))?.getAttribute('value') ?? 'population');
    await picker.selectOption(value);
    motivation = await picker.locator('option:checked').innerText();
    const opener = page.getByRole('button', { name: 'Inspect recorded moment', exact: true });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Recorded moment', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('historical');
    await expect(dialog.getByRole('img', { name: /Ecosystem generation \d+; \d+ organisms/ })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('historical-initial.png') });
    const sceneBounds = await dialog.locator('canvas').boundingBox(), dialogBounds = await dialog.boundingBox();
    expect(sceneBounds).not.toBeNull(); expect(dialogBounds).not.toBeNull();
    expect(sceneBounds!.width).toBeGreaterThanOrEqual(dialogBounds!.width * 0.7);
    expect(sceneBounds!.height).toBeGreaterThanOrEqual(200);
    const historical = dialog.getByRole('region', { name: 'Historical creature inspector', exact: true });
    await historical.getByRole('button', { name: 'Inspect a living organism', exact: true }).click();
    await expect(historical.getByRole('region', { name: 'Organism and family summary' })).toBeVisible();
    await historical.getByRole('button', { name: /^Follow founder lineage #/ }).click();
    expect(await page.locator('[id]').evaluateAll(elements => {
      const ids = elements.map(element => element.id);
      return ids.length === new Set(ids).size;
    })).toBe(true);
    await dialog.getByRole('button', { name: 'More camera options', exact: true }).click();
    await expect(dialog.getByRole('region', { name: 'Camera options', exact: true })).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath('historical-scene.png') });
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(opener).toBeFocused();
    await expect(page.getByTestId('generation')).toHaveText('180 / 180');
    expect(await outcomes.innerText()).toBe(before);
    await expect(page.getByRole('status', { name: 'Followed lineage outcome' })).toHaveText(familyOutcome);
    expect(errors).toEqual([]); expect(inference).toEqual([]);
  });

  test('reflection facts stay readable and actual recorded generations open the inspector', async () => {
    let requests = 0;
    await page.route('**/api/reflect', route => {
      requests++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        observations: [{ text: 'Fixture-selected evidence', evidenceRefs: ['condition:environment.abundance', 'population'] }],
        nextExperiment: { title: 'Try less food', rationale: 'Compare recorded outcomes', evidenceRefs: ['condition:environment.abundance'], changes: [{ path: 'environment.abundance', value: 'scarce' }] },
        caveat: 'Controlled fixture, not live Jev quality or proof of cause',
      }) });
    });
    const panel = page.getByRole('region', { name: 'Jev run reflection', exact: true });
    await panel.getByRole('button', { name: 'Ask Jev about this run', exact: true }).click();
    await expect(panel).toContainText('Starting condition: Resource abundance: rich');
    await expect(panel).not.toContainText('Matching recorded evidence is unavailable');
    const inspect = panel.getByRole('button', { name: 'Inspect recorded evidence', exact: true });
    await expect(inspect).toHaveCount(1);
    await inspect.click();
    const dialog = page.getByRole('dialog', { name: 'Recorded moment', exact: true });
    await expect(dialog.getByRole('img', { name: /Ecosystem generation 180;/ })).toBeVisible();
    await page.keyboard.press('Escape'); await expect(inspect).toBeFocused();
    expect(requests).toBe(1); expect(errors).toEqual([]); expect(inference).toEqual([]);
    await page.unroute('**/api/reflect');
  });

  test('review a changed condition and carry its motivating observation into comparison', async () => {
    await page.getByRole('button', { name: 'Edit this world', exact: true }).click();
    const review = page.getByRole('region', { name: 'Review your next experiment', exact: true });
    await expect(review).toContainText(motivation);
    await page.getByLabel('Condition to explore', { exact: true }).selectOption('abundance');
    await page.getByLabel('Value to review', { exact: true }).selectOption('scarce');
    await expect(page.getByRole('list', { name: 'Reviewed condition changes', exact: true })).toContainText('Resource abundance: rich → scarce');
    await page.getByRole('button', { name: /Seed ecosystem/ }).click();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await finishTrial(page);
    const comparison = page.getByRole('region', { name: 'Previous trial comparison', exact: true });
    await expect(comparison.getByRole('region', { name: 'Observation being investigated', exact: true })).toContainText(motivation);
    await expect(comparison).toContainText('Resource abundance: rich → scarce');
    expect(await page.evaluate(() => {
      const comparison = document.querySelector('.run-comparison');
      const history = document.querySelector('svg[aria-label="Whole-run population history"]');
      return comparison && history ? Boolean(comparison.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING) : false;
    })).toBe(true);
    expect(errors).toEqual([]); expect(inference).toEqual([]);
  });

  test('a third trial compares with the second, without leaking the first focus', async () => {
    const picker = page.getByLabel('Recorded moment to investigate', { exact: true });
    await picker.selectOption('population');
    const secondMotivation = await picker.locator('option:checked').innerText();
    await page.getByRole('button', { name: 'Edit this world', exact: true }).click();
    const review = page.getByRole('region', { name: 'Review your next experiment', exact: true });
    await expect(review).toContainText(secondMotivation);
    if (secondMotivation !== motivation) await expect(review).not.toContainText(motivation);
    await page.getByLabel('Condition to explore', { exact: true }).selectOption('abundance');
    await page.getByLabel('Value to review', { exact: true }).selectOption('balanced');
    await expect(page.getByRole('list', { name: 'Reviewed condition changes', exact: true })).toContainText('Resource abundance: scarce → balanced');
    await page.getByRole('button', { name: /Seed ecosystem/ }).click();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await finishTrial(page);
    const comparison = page.getByRole('region', { name: 'Previous trial comparison', exact: true });
    await expect(comparison.getByRole('region', { name: 'Observation being investigated', exact: true })).toContainText(secondMotivation);
    await expect(comparison).toContainText('Resource abundance: scarce → balanced');
    expect(errors).toEqual([]); expect(inference).toEqual([]);
  });
});
