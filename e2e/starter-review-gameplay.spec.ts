import {expect,test} from '@playwright/test';
for(const width of [390,1280])test(`${width}px designed review keeps seeding reachable without a long scroll`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.goto('/play');
 await page.getByRole('button',{name:'Review this world',exact:true}).click();
 await expect(page.getByRole('heading',{name:'World conditions',exact:true})).toBeVisible();
 const seed=page.getByRole('button',{name:/Seed ecosystem/});
 await expect(seed).toHaveCount(1);await expect(seed).toBeEnabled();
 const box=await seed.boundingBox();expect(box!.height).toBeGreaterThanOrEqual(44);
 expect(box!.y).toBeGreaterThanOrEqual(60);expect(box!.y+box!.height).toBeLessThanOrEqual(844);
 expect(await seed.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===el||el.contains(hit)})).toBe(true);
 await expect(page.getByLabel('World policy')).toHaveValue('fixed');
 await expect(page.getByRole('heading',{name:'Your world, interpreted',exact:true})).toHaveCount(0);
});
