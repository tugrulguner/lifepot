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

for (const width of [390, 1280]) test(`observatory exposes advanced journeys without a setup gate at ${width}px`, async ({ page }) => {
  await page.setViewportSize({width,height:900});
  const inference: string[]=[];
  page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))inference.push(r.url());});
  await page.goto('/play');
  await expect(page.locator('#phase')).toHaveText('Paused · generation 0');
  await expect(page.getByRole('link',{name:'Custom and adaptive experiments',exact:true})).toBeHidden();
  await page.getByText('World settings & study notes',{exact:true}).click();
  await expect(page.getByRole('link',{name:'Custom and adaptive experiments',exact:true})).toBeVisible();
  await expect(page.locator('#phase')).toHaveText('Paused · generation 0');
  await page.getByRole('link',{name:'Custom and adaptive experiments',exact:true}).click();
  await expect(page).toHaveURL(/\/experiment$/);
  await expect(page.getByRole('button',{name:'Describe your own world',exact:true})).toBeVisible();
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
