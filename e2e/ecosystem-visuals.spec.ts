import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
declare global { interface Window { ringDraws: {color:string;width:number;dash:number[];radius:number}[] } }
for(const width of [1280,390])for(const theme of ['Light','Dark'])test(`readable ecosystem at ${width}px ${theme}`,async({page},testInfo)=>{
 test.setTimeout(60_000);
 await page.setViewportSize({width,height:850});const errors:string[]=[];const calls:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/judge',r=>{calls.push(r.request().url());return r.abort();});
 await page.clock.install({time:new Date('2026-10-08T04:00:00Z')});await page.clock.pauseAt(new Date('2026-10-08T04:00:01Z'));
 await page.addInitScript(()=>{
  window.ringDraws=[];
  const radii=new WeakMap<CanvasRenderingContext2D,number>();
  const originalArc=CanvasRenderingContext2D.prototype.arc;
  const originalBegin=CanvasRenderingContext2D.prototype.beginPath;
  const originalStroke=CanvasRenderingContext2D.prototype.stroke;
  const originalFillRect=CanvasRenderingContext2D.prototype.fillRect;
  CanvasRenderingContext2D.prototype.fillRect=function(...args:Parameters<CanvasRenderingContext2D['fillRect']>){if(args[0]===0&&args[1]===0)window.ringDraws=[];return originalFillRect.apply(this,args);};
  CanvasRenderingContext2D.prototype.beginPath=function(){radii.delete(this);return originalBegin.call(this);};
  CanvasRenderingContext2D.prototype.arc=function(...args:Parameters<CanvasRenderingContext2D['arc']>){radii.set(this,args[2]);return originalArc.apply(this,args);};
  CanvasRenderingContext2D.prototype.stroke=function(path?:Path2D){
   const radius=radii.get(this);
   const bounds=this.canvas.getBoundingClientRect();
   const ringRadius=Math.max(1.25,Math.min(bounds.width-36,bounds.height-36)/50*.34)*1.48;
   if(radius!==undefined&&Math.abs(radius-ringRadius)<.001&&this.lineWidth>=1.3&&(this.strokeStyle==='#ffffff'||this.strokeStyle==='#ffd36a'))window.ringDraws.push({color:String(this.strokeStyle),width:this.lineWidth,dash:this.getLineDash(),radius});
   return path?originalStroke.call(this,path):(originalStroke as ()=>void).call(this);
  };
 });
 await page.goto('/');await page.getByLabel('Theme').selectOption(theme.toLowerCase());await page.getByRole('button',{name:'Explore deterministic preset'}).click();await page.getByLabel('World policy').selectOption('fixed');await page.getByRole('button',{name:/Seed ecosystem/}).click();await page.getByRole('button',{name:'Pause',exact:true}).click();
 await expect(page.getByTestId('generation')).toHaveText('0 / 180');for(let i=0;i<30;i++)await page.getByRole('button',{name:'Step one generation'}).click();await expect(page.getByTestId('generation')).toHaveText('30 / 180');
 const phase=process.env.LIFEPOT_VISUAL_PHASE??'after';if(phase==='after'){await expect(page.locator('.legend')).toContainText('⬡ Producer');await expect(page.locator('.legend')).toContainText('◇ Omnivore');await expect(page.locator('.legend')).toContainText('local hazard intensity');}
 await page.evaluate(()=>scrollTo(0,0));
 const metrics=await page.evaluate(()=>{const canvas=document.querySelector('canvas.life-canvas') as HTMLCanvasElement;const b=canvas.getBoundingClientRect(),header=document.querySelector('.family-header')!.getBoundingClientRect(),controls=document.querySelector('.controls')!.getBoundingClientRect();const context=canvas.getContext('2d')!,pixels=context.getImageData(0,0,canvas.width,canvas.height).data;const background=Array.from(context.getImageData(0,0,1,1).data);let different=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]!==background[0]||pixels[i+1]!==background[1]||pixels[i+2]!==background[2])different++;return {canvas:{x:b.x,y:b.y,width:b.width,height:b.height,bottom:b.bottom},headerBottom:header.bottom,controlsTop:controls.top,background,different,overflow:document.documentElement.scrollWidth>innerWidth,generation:document.querySelector('[data-testid=generation]')!.textContent,species:Array.from(document.querySelectorAll('.species-focus button')).map(b=>b.textContent)};});
 expect(metrics.overflow).toBe(false);expect(metrics.canvas.y).toBeGreaterThanOrEqual(metrics.headerBottom);expect(metrics.canvas.bottom).toBeLessThanOrEqual(850);expect(metrics.different).toBeGreaterThan(100);if(phase==='after')expect(metrics.background.slice(0,3)).toEqual([2,10,9]);
 const dir=process.env.LIFEPOT_VISUAL_EVIDENCE??testInfo.outputDir;mkdirSync(dir,{recursive:true});const key=`${phase}-${width}x850-${theme.toLowerCase()}-gen30`;writeFileSync(join(dir,key+'.json'),JSON.stringify(metrics,null,2));await page.screenshot({path:join(dir,key+'.png')});await page.locator('canvas.life-canvas').screenshot({path:join(dir,key+'-board.png')});
 await page.evaluate(()=>{window.ringDraws=[];});
 await page.getByRole('button',{name:'Inspect living organism',exact:true}).click();
 await expect(page.getByRole('button',{name:/^Follow founder lineage #/})).toBeVisible();
 if(phase==='after'){
  await expect.poll(()=>page.evaluate(()=>window.ringDraws.some(r=>r.color==='#ffffff'&&r.dash.length===0))).toBe(true);
  await page.locator('canvas.life-canvas').screenshot({path:join(dir,key+'-selected.png')});
 }
 await page.getByRole('button',{name:/^Follow founder lineage #/}).click();
 await page.evaluate(()=>{window.ringDraws=[];});
 await page.getByRole('button',{name:'Clear inspection',exact:true}).click();
 if(phase==='after'){
  await expect.poll(()=>page.evaluate(()=>window.ringDraws.some(r=>r.color==='#ffd36a'&&r.dash.length===2&&r.dash.every(v=>v>0)))).toBe(true);
  expect(await page.evaluate(()=>window.ringDraws.some(r=>r.color==='#ffffff'))).toBe(false);
  writeFileSync(join(dir,key+'-rings.json'),JSON.stringify(await page.evaluate(()=>window.ringDraws),null,2));
  await page.locator('canvas.life-canvas').screenshot({path:join(dir,key+'-followed.png')});
 }
 await expect(page.getByTestId('generation')).toHaveText('30 / 180');
 await page.getByRole('button',{name:'Resume',exact:true}).click();await page.clock.runFor(650);await expect(page.getByTestId('generation')).not.toHaveText('30 / 180');expect(calls).toEqual([]);expect(errors).toEqual([]);
});
