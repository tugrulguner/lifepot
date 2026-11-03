import {expect,test} from '@playwright/test';
for(const width of [390,1280])test(`${width}px entry opens on the real square habitat without autofocus scrolling`,async({page})=>{
 await page.setViewportSize({width,height:844});
 await page.goto('/play');
 const preview=page.getByRole('img',{name:/Starter habitat preview/});
 await expect(preview).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>scrollY)).toBeLessThan(20);
 const box=await preview.boundingBox();
 expect(box!.width).toBeGreaterThanOrEqual(280);
 expect(Math.abs(box!.width-box!.height)).toBeLessThan(2);
 expect(box!.y).toBeGreaterThanOrEqual(50);
 expect(box!.y+box!.height).toBeLessThanOrEqual(844);
 const review=await page.getByRole('button',{name:'Review this world',exact:true}).boundingBox();
 expect(review!.y+review!.height).toBeLessThanOrEqual(844);
});
