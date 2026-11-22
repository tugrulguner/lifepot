import { expect, test } from '@playwright/test';

for (const suffix of ['#example', '?replay=invalid#kept', '#replay=invalid']) test(`legacy entry retains its explicit payload: ${suffix}`, async ({ page }) => {
  const apiCalls: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiCalls.push(request.url()); });
  await page.goto('/play' + suffix);
  await expect(page).toHaveURL(new RegExp('/experiment' + suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
  if (suffix === '#example') await expect(page.locator('canvas.life-canvas')).toBeVisible();
  else await expect(page.getByRole('button', {name:'Describe your own world', exact:true})).toBeVisible();
  expect(apiCalls).toEqual([]);
});

for (const width of [390, 1280]) test(`approved observatory opens ready to observe at ${width}px`, async ({ page }) => {
  await page.setViewportSize({width,height:900});
  const errors: string[] = [], apiCalls: string[] = [];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))apiCalls.push(r.url());});
  await page.goto('/play');
  await expect(page.locator('#phase')).toHaveText('Paused · generation 0');
  await expect(page.locator('#world')).toBeVisible();
  await expect(page.locator('#population')).not.toHaveText('0');
  await expect(page.getByRole('button',{name:'Play',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/Seed ecosystem|Review this world/})).toHaveCount(0);
  const initial = await page.evaluate('window.worldProbe.full()');
  await page.locator('#step').click();
  await expect(page.locator('#phase')).toHaveText('Paused · generation 1');
  for (const [id,span] of [['zoom-wide',25],['zoom-mid',10],['zoom-in',5]] as const) {
    await page.locator(`#${id}`).click();
    expect(await page.evaluate('window.worldProbe.camera().span')).toBe(span);
    await expect(page.locator('#phase')).toHaveText('Paused · generation 1');
  }
  await page.locator('#zoom-out').click();
  await page.locator('#play').click();
  await expect.poll(()=>page.evaluate('window.worldProbe.snapshot().generation')).toBeGreaterThanOrEqual(3);
  await page.locator('#play').click();
  expect(await page.evaluate('window.worldProbe.full()')).toEqual(await page.evaluate('window.worldProbe.canonical()'));
  await page.locator('#restart').click();
  expect(await page.evaluate('window.worldProbe.full()')).toEqual(initial);
  expect(await page.evaluate('window.worldProbe.playing()')).toBe(false);
  const subject = await page.evaluate<{id: number; point: [number, number]}>('(()=>{const s=worldProbe.snapshot(),i=Array.from(s.guild).findIndex(Boolean),id=s.organismId[i];return {id,point:worldProbe.point(id)}})()');
  const board=await page.locator('#world').boundingBox();
  if(!board)throw new Error('Missing world bounds');
  await page.mouse.click(board.x+subject.point[0]*board.width,board.y+subject.point[1]*board.height);
  expect(await page.evaluate('window.worldProbe.selected()')).toBe(subject.id);
  await page.locator('#follow').click();
  expect(await page.evaluate('window.worldProbe.following()')).toBe(true);
  await page.locator('#clear').click();
  expect(await page.evaluate('window.worldProbe.selected()')).toBe(0);
  expect(errors).toEqual([]);expect(apiCalls).toEqual([]);
});
