import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
for(const width of [390,1280])test(`recorded species direction stays beside the habitat at ${width}px`,async({page},info)=>{
 test.setTimeout(60000);await page.setViewportSize({width,height:850});const errors:string[]=[],calls:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/\/api\/(judge|reflect|player-proposal)/.test(r.url()))calls.push(r.url())});
 await page.clock.install({time:new Date('2026-10-08T04:00:00Z')});await page.clock.pauseAt(new Date('2026-10-08T04:00:01Z'));
 await page.goto('/play');await page.getByLabel('Theme').selectOption('dark');await page.getByRole('button',{name:'Explore deterministic preset',exact:true}).click();await page.getByLabel('World policy',{exact:true}).selectOption('fixed');await page.getByRole('button',{name:/Seed ecosystem/}).click();await page.clock.runFor(1100);await page.getByRole('button',{name:'Pause',exact:true}).click();
 for(let i=1;i<24;i++)await page.getByRole('button',{name:'Step one generation',exact:true}).click();await expect(page.getByTestId('generation')).toHaveText('24 / 180');
 const before:Record<string,number>={};for(const id of ['A','B'])before[id]=Number(await page.getByLabel(`Species ${id} count`,{exact:true}).locator('b').innerText());
 for(let i=0;i<6;i++)await page.getByRole('button',{name:'Step one generation',exact:true}).click();await expect(page.getByTestId('generation')).toHaveText('30 / 180');
 for(const id of ['A','B']){
  const count=Number(await page.getByLabel(`Species ${id} count`,{exact:true}).locator('b').innerText());const delta=count-before[id];
  const cue=page.getByRole('img',{name:`Species ${id} population: ${before[id]} to ${count}, generations 24–30. Recorded change, not a prediction.`,exact:true});await expect(cue).toHaveText(`${delta>0?'↑':delta<0?'↓':'→'}${Math.abs(delta)} /6g`);
  const bounds=await cue.boundingBox();expect(bounds).not.toBeNull();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width);
 }
 const canvas=await page.locator('canvas.life-canvas').boundingBox();expect(canvas).not.toBeNull();
 if(process.env.LIFEPOT_SESSION_BASELINE){const baseline=JSON.parse(readFileSync(join(process.env.LIFEPOT_SESSION_BASELINE,`after-${width}x850-dark-gen30.json`),'utf8'));expect(canvas!.width).toBeGreaterThanOrEqual(baseline.canvas.width-.5);expect(canvas!.height).toBeGreaterThanOrEqual(baseline.canvas.height-.5);}
 const dir=process.env.LIFEPOT_SESSION_EVIDENCE??info.outputDir;mkdirSync(dir,{recursive:true});await page.screenshot({path:join(dir,`trends-${width}-g30.png`)});writeFileSync(join(dir,`trends-${width}-g30.json`),JSON.stringify({generation:30,before,canvas,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)},null,2));
 await page.getByRole('button',{name:'Inspect living organism',exact:true}).click();await expect(page.getByRole('img',{name:/Species A population:/})).toBeVisible();await page.getByRole('button',{name:/^Follow founder lineage #/}).click();await expect(page.getByTestId('generation')).toHaveText('30 / 180');expect(errors).toEqual([]);expect(calls).toEqual([]);
});
