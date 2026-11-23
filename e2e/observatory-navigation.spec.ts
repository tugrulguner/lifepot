import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

test('portable observatory explains web-only tools without broken links or requests', async ({ page, request }) => {
  const response=await request.get('/play');
  expect(response.ok()).toBe(true);
  const file=test.info().outputPath('portable-play.html');
  await mkdir(dirname(file),{recursive:true});
  await writeFile(file,await response.text());
  const remote: string[]=[];
  page.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url());});
  await page.goto(pathToFileURL(file).href);
  await expect(page.locator('#phase')).toHaveText('Paused · generation 0');
  await page.getByText('World settings & study notes',{exact:true}).click();
  await expect(page.locator('#offline-tools')).toBeVisible();
  await expect(page.locator('#advanced-tools')).toBeHidden();
  await page.locator('#step').click();
  await expect(page.locator('#phase')).toHaveText('Paused · generation 1');
  expect(remote).toEqual([]);
});

test('static HTTP copies at the app path stay playable without server routes', async ({ page, request }) => {
  const response = await request.get('/play');
  expect(response.ok()).toBe(true);
  const body = await response.body();
  const requests: string[] = [];
  // A bare static server supplies exactly the document bytes, not the app marker.
  await page.route('http://portable.invalid/**', async route => {
    const url = new URL(route.request().url());
    requests.push(url.pathname + url.search);
    await route.fulfill(url.pathname === '/play'
      ? { status: 200, contentType: 'text/html', body }
      : { status: 404, body: 'Not found' });
  });
  for (const suffix of ['', '#example', '?replay=fixture', '#replay=fixture']) {
    const before = requests.length;
    const address = `http://portable.invalid/play${suffix}`;
    await page.goto('about:blank');
    await page.goto(address);
    await expect(page.locator('#phase')).toHaveText('Paused · generation 0');
    await expect(page).toHaveURL(address);
    await page.getByText('World settings & study notes', { exact: true }).click();
    await expect(page.locator('#offline-tools')).toBeVisible();
    await expect(page.locator('#advanced-tools')).toBeHidden();
    await page.locator('#step').click();
    await expect(page.locator('#phase')).toHaveText('Paused · generation 1');
    expect(requests.slice(before)).toEqual(['/play' + new URL(address).search]);
  }
});

for (const width of [390, 1280]) test(`observatory exposes advanced journeys without a setup gate at ${width}px`, async ({ page }) => {
  await page.setViewportSize({width,height:900});
  const inference: string[]=[];
  page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))inference.push(r.url());});
  const response = await page.goto('/play');
  expect(response?.headers()['server-timing']).toContain('lifepot-app');
  expect(await page.evaluate(() => (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).serverTiming.some(item => item.name === 'lifepot-app'))).toBe(true);
  await expect(page.locator('#phase')).toHaveText('Paused · generation 0');
  await expect(page.getByRole('link',{name:'Custom and adaptive experiments',exact:true})).toBeHidden();
  await page.getByText('World settings & study notes',{exact:true}).click();
  await expect(page.getByRole('link',{name:'Custom and adaptive experiments',exact:true})).toBeVisible();
  await expect(page.locator('#phase')).toHaveText('Paused · generation 0');
  await page.getByRole('link',{name:'Custom and adaptive experiments',exact:true}).click();
  await expect(page).toHaveURL(/\/experiment$/);
  await expect(page.getByRole('textbox',{name:'What exists in your world?' })).toBeVisible();
  await page.getByRole('link',{name:'Back to observatory',exact:true}).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.locator('#phase')).toHaveText('Paused · generation 0');
  await page.getByText('World settings & study notes',{exact:true}).click();
  await page.getByRole('link',{name:'Saved worlds and replay imports',exact:true}).click();
  await expect(page).toHaveURL(/\/experiment#my-worlds-shelf$/);
  await expect(page.getByRole('region',{name:'My Worlds — browser-local saves',exact:true})).toBeInViewport();
  await expect(page.getByRole('button',{name:'Import world export',exact:true})).toBeVisible();
  expect(inference).toEqual([]);
});
