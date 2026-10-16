// Capture the real GameCanvas, not a reimplementation or invented animation.
// Run an owned dev/Worker server first; node scripts/capture-example.mjs <origin> <scratch-dir>.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const [origin, output] = process.argv.slice(2);
if (!origin || !output) throw new Error('Supply origin and scratch output directory');
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
 const page = await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1});
 const errors=[]; let calls=0;
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/{judge,reflect}', r=>{calls++;return r.abort();});
 await page.goto(origin+'/play#example');
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 await page.getByLabel('Playback speed').selectOption('normal');
 await page.evaluate(()=>localStorage.setItem('lifepot-theme','dark'));
 await page.getByLabel('Color theme').selectOption('dark');
 await page.evaluate(()=>{
  const canvas=document.querySelector('canvas.life-canvas');
  window.captureChunks=[];
  window.captureRecorder=new MediaRecorder(canvas.captureStream(20),{mimeType:'video/webm;codecs=vp9'});
  window.captureRecorder.ondataavailable=e=>{if(e.data.size)window.captureChunks.push(e.data);};
  window.captureRecorder.start();
 });
 const checkpoints=[];
 const checkpoint=async label=>checkpoints.push({label,text:await page.locator('.stats-strip').innerText(),time:Date.now()});
 await checkpoint('start');
 await page.getByRole('button',{name:'Resume',exact:true}).click();
 await page.waitForTimeout(5000);
 await checkpoint('full habitat');
 await page.getByRole('button',{name:'Inspect a living organism',exact:true}).click();
 await page.getByRole('button',{name:/Follow founder lineage/}).click();
 await page.getByRole('button',{name:'Follow organism with camera',exact:true}).click();
 await page.getByRole('button',{name:'Resume',exact:true}).click();
 await page.waitForTimeout(7000);
 await checkpoint('following an organism');
 await page.getByRole('button',{name:'Full world',exact:true}).click();
 await page.waitForTimeout(5000);
 await checkpoint('return to habitat');
 const data=await page.evaluate(async()=>{
  const stopped=new Promise(resolve=>window.captureRecorder.onstop=resolve);
  window.captureRecorder.stop();await stopped;
  const b=new Blob(window.captureChunks,{type:'video/webm'});
  return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(b);});
 });
 if(calls||errors.length)throw new Error(JSON.stringify({calls,errors}));
 await writeFile(resolve(output,'example-raw.webm'),Buffer.from(data,'base64'));
 await writeFile(resolve(output,'capture-evidence.json'),JSON.stringify({origin,calls,errors,checkpoints},null,2));
 console.log(JSON.stringify({calls,errors,checkpoints},null,2));
} finally {await browser.close();}
