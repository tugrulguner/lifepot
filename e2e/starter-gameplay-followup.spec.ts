import {expect,test,type BrowserContext,type Page} from '@playwright/test';
// Keep each real trial inside the original test budget. Serial legs preserve the actual
// completed baseline, rather than injecting outcomes or extending the whole test timeout.
// Fast functional checks are separate from the retained ordinary-speed play sessions.
for(const width of [390,1280])test.describe.serial(`${width}px connected starter gameplay`,()=>{
 let context:BrowserContext,page:Page,calls=0;
 test.beforeAll(async({browser})=>{context=await browser.newContext({viewport:{width,height:844}});page=await context.newPage();await page.route('**/api/judge',route=>{calls++;return route.abort()})});
 test.afterAll(async()=>{await context?.close()});
 test('the baseline retains the actual followed family at its ending',async()=>{
  await page.goto('/play');await page.getByRole('button',{name:'Review this world',exact:true}).click();
  await page.getByRole('button',{name:/Seed ecosystem/}).click();
  await page.getByRole('button',{name:'Inspect living organism',exact:true}).first().click();
  const lineage=(await page.getByRole('button',{name:/Follow founder lineage/}).innerText()).match(/#(\d+)/)![1];
  await page.getByRole('button',{name:'Pin this family',exact:true}).click();
  await page.getByRole('combobox',{name:'Playback speed'}).selectOption('fast');
  await page.getByRole('button',{name:'Resume',exact:true}).click();
  await expect(page.getByRole('region',{name:'Run status'})).toContainText('Observation complete',{timeout:30000});
  await expect(page.getByTestId('generation')).toHaveText('180 / 180');
  const fate=page.getByRole('status',{name:'Followed lineage outcome',exact:true});await expect(fate).toContainText(`Lineage #${lineage}`);
  const fateBox=await fate.boundingBox(),actionsBox=await page.getByRole('navigation',{name:'Run actions',exact:true}).boundingBox();expect(fateBox!.y).toBeLessThan(actionsBox!.y);
  await expect(page.getByText('Offline · no intervention',{exact:true})).toHaveCount(0);expect(calls).toBe(0);
 });
 test('a genuine follow-up presents the changed condition before raw histories',async()=>{
  await page.getByRole('button',{name:'Edit this world',exact:true}).click();
  await expect(page.getByLabel('World policy')).toHaveValue('fixed');
  await page.locator('summary').filter({hasText:'Edit world conditions'}).click();
  await page.getByLabel('Resource abundance',{exact:true}).selectOption('rich');await expect(page.getByText('rich resources',{exact:true})).toBeVisible();
  // Comparison/data acceptance excludes decorative motion; normal-motion cadence
  // and ordinary-speed journeys are qualified separately without this preference.
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByRole('button',{name:/Seed ecosystem/}).click();
  await expect(page.getByRole('combobox',{name:'Playback speed'})).toHaveValue('fast');
  await expect(page.getByRole('region',{name:'Run status'})).toContainText('Observation complete',{timeout:30000});
  await expect(page.getByTestId('generation')).toHaveText('180 / 180');
  expect(await page.locator('.run-results__measurements tbody th').allTextContents()).toEqual(Array.from({length:181},(_,generation)=>String(generation)));
  const comparison=page.getByRole('region',{name:'Previous trial comparison',exact:true});
  await expect(comparison).toContainText('Same initial seed: 241.');await expect(comparison).toContainText('Single-condition fixed comparison');
  const changes=comparison.locator('ul').first().getByRole('listitem');await expect(changes).toHaveCount(1);await expect(changes).toContainText('balanced');await expect(changes).toContainText('rich');
  const changedBox=await comparison.boundingBox(),rawHistoryBox=await page.getByRole('img',{name:'Whole-run population history',exact:true}).boundingBox();expect(changedBox!.y).toBeLessThan(rawHistoryBox!.y);expect(calls).toBe(0);
 });
});
