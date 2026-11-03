import {expect,test} from '@playwright/test';

const starters=['Resource competition','Hunters and prey','Recurring scarcity'];
for(const width of [390,1280])for(const name of starters){
 test(`${width}px ${name}: preview, review and real fixed world`,async({page})=>{
  await page.setViewportSize({width,height:844});
  const errors:string[]=[],inference:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/judge',route=>{inference.push(route.request().url());return route.abort()});
  await page.goto('/play');
  const choice=page.getByRole('button',{name:`Preview ${name}`,exact:true});
  await choice.click();
  const preview=page.getByRole('img',{name:/Starter habitat preview/});
  await expect(preview).toBeVisible();
  const size=await preview.boundingBox();
  expect(size!.width).toBeGreaterThanOrEqual(280);
  const target=await choice.boundingBox();expect(target!.height).toBeGreaterThanOrEqual(44);
  await page.getByRole('button',{name:'Review this world',exact:true}).click();
  await expect(page.getByRole('heading',{name:'World conditions',exact:true})).toBeVisible();
  await expect(page.getByLabel('World policy')).toHaveValue('fixed');
  await expect(page.getByTestId('interpreter-source')).not.toHaveText('Deterministic fallback');
  await page.getByRole('button',{name:/Seed ecosystem/}).click();
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await expect(page.locator('canvas.life-canvas')).toBeVisible();
  await expect(page.getByRole('region',{name:'Run status'})).toContainText('Fixed world rules');
  await page.getByRole('button',{name:'Inspect a living organism',exact:true}).click();
  await expect(page.getByRole('button',{name:/Follow founder lineage/})).toBeVisible();
  const generation=Number((await page.getByTestId('generation').innerText()).split('/')[0].trim());
  await page.getByRole('button',{name:'Step one generation',exact:true}).click();
  await expect(page.getByTestId('generation')).toHaveText(`${generation+1} / 180`);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  expect(inference).toEqual([]);expect(errors).toEqual([]);
 });
}

test('custom creation remains available with the original prose and request validation',async({page})=>{
 await page.goto('/play');
 await page.getByRole('button',{name:'Describe your own world',exact:true}).click();
 await expect(page.getByRole('button',{name:'Review this world',exact:true})).toHaveCount(0);
 const input=page.locator('.answer-field input');
 await input.fill('An ecology with two competing resource feeders');
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'Back',exact:true}).click();
 await expect(input).toHaveValue('An ecology with two competing resource feeders');
});
