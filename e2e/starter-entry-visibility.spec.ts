import {expect,test} from '@playwright/test';
for(const width of [390,1280])test(`${width}px entry opens on the real square habitat without autofocus scrolling`,async({page})=>{
 const consoleErrors:string[]=[];
 page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});
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
 for(const name of ['Resource competition','Hunters and prey','Recurring scarcity']){
  const choice=await page.getByRole('button',{name:`Preview ${name}`,exact:true}).boundingBox();
  expect(choice!.height).toBeGreaterThanOrEqual(44);
  expect(choice!.y).toBeGreaterThanOrEqual(50);
  expect(choice!.y+choice!.height).toBeLessThanOrEqual(box!.y);
 }
 expect(review!.y+review!.height).toBeLessThanOrEqual(844);
 expect(consoleErrors.filter(message=>/hydrat|didn't match/i.test(message))).toEqual([]);
});
