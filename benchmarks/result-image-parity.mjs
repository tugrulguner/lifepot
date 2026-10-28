#!/usr/bin/env node
// Compare decoded production PNG silhouettes with an independent contour render.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(repo, "package.json"));
const esbuild = require("esbuild"), { chromium } = require("playwright");
const output = path.resolve(process.argv[2] ?? path.join(repo, ".local-evidence", "result-image-parity.png"));
const bundle = esbuild.buildSync({
  stdin: {
    resolveDir: repo,
    loader: "ts",
    contents: `import { createSimulation } from './src/game/world';
import { defaultConfig } from './src/game/setup';
import { buildResultImageModel, createResultImageBlob } from './src/game/result-image';
import { traceOrganism } from './src/game/organism-glyphs';
import { speciesColor } from './src/game/species-colors';
import { SPECIES_IDS, SPECIES_PAIRS, validateRuleGraph } from './src/game/rules';
const cases=[['producer','grazer','scavenger','hunter'],['omnivore','producer']];
const background=[16,34,55];
async function renderCase(roles){
 const state=createSimulation({seed:71,config:defaultConfig(),initialPopulation:[]});
 state.config.rules.species=roles.map((role,index)=>({id:['A','B','C','D'][index],role,selfInteraction:'neutral'}));
 const ids = SPECIES_IDS.slice(0, roles.length);
 state.config.rules.interactions = SPECIES_PAIRS.filter(pair => pair.split(":").every(id => ids.includes(id))).map(pair => ({ pair, mode: "neutral" }));
 validateRuleGraph(state.config.rules);
 state.guild.fill(0); state.ruleSpecies.fill(0); state.resources.fill(0);
 roles.forEach((_,index)=>{state.guild[index]=1;state.ruleSpecies[index]=index+1;});
 const model=buildResultImageModel(state,'','PNG contour check');
 const blob=await createResultImageBlob(model),bitmap=await createImageBitmap(blob);
 const decoded=document.createElement('canvas');decoded.width=bitmap.width;decoded.height=bitmap.height;
 const dc=decoded.getContext('2d');if(!dc)throw Error('PNG decode canvas unavailable');dc.drawImage(bitmap,0,0);
 const expected=document.createElement('canvas');expected.width=720;expected.height=720;
 const ec=expected.getContext('2d');if(!ec)throw Error('Reference canvas unavailable');
 ec.fillStyle='rgb(16,34,55)';ec.fillRect(0,0,720,720);
 const pitch=720/50,radius=pitch*.44, rows=[];
 for(let index=0;index<roles.length;index++){
  const role=roles[index],id=['A','B','C','D'][index],x=index*pitch,y=0,cx=x+pitch/2,cy=y+pitch/2,color=speciesColor(id);
  ec.fillStyle=color;traceOrganism(ec,role,cx,cy,radius);ec.fill();
  ec.lineJoin='round';ec.strokeStyle='#07100f';ec.lineWidth=pitch*.07;ec.stroke();
  ec.strokeStyle='rgba(241,248,237,.94)';ec.lineWidth=pitch*.035;ec.stroke();
  const actual=dc.getImageData(72+Math.floor(x),160+Math.floor(y),Math.ceil(pitch),Math.ceil(pitch)).data;
  const reference=ec.getImageData(Math.floor(x),Math.floor(y),Math.ceil(pitch),Math.ceil(pitch)).data;
  let actualPixels=0,referencePixels=0,mismatch=0,intersection=0;
  for(let py=0;py<Math.ceil(pitch);py++)for(let px=0;px<Math.ceil(pitch);px++){
   const a=(py*Math.ceil(pitch)+px)*4;
   const af=actual[a]!==background[0]||actual[a+1]!==background[1]||actual[a+2]!==background[2];
   const rf=reference[a]!==background[0]||reference[a+1]!==background[1]||reference[a+2]!==background[2];
   if(af)actualPixels++;if(rf)referencePixels++;if(af&&rf)intersection++;if(af!==rf)mismatch++;
  }
  const union=actualPixels+referencePixels-intersection,iou=union?intersection/union:1;
  if(actualPixels<8||referencePixels<8||iou<.99||mismatch>4)throw Error(role+' PNG contour mismatch: '+JSON.stringify({actualPixels,referencePixels,mismatch,iou}));
  rows.push({role,species:id,actualPixels,referencePixels,mismatchedPixels:mismatch,intersectionOverUnion:Number(iou.toFixed(6))});
 }
 const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let offset=0;offset<bytes.length;offset+=0x8000)binary+=String.fromCharCode(...bytes.subarray(offset,offset+0x8000));
 return {width:bitmap.width,height:bitmap.height,pngSignature:[137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value),species:rows,base64:btoa(binary)};
}
export async function render(){return await Promise.all(cases.map(renderCase));}`,
  },
  bundle: true,
  write: false,
  format: "iife",
  globalName: "imageProbe",
}).outputFiles[0].text;

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  await page.setContent("<!doctype html><canvas></canvas>");
  await page.addScriptTag({ content: bundle });
  const reports = await page.evaluate(() => imageProbe.render());
  const roles = reports.flatMap(report => report.species.map(item => item.role));
  if (reports.some(report => !report.pngSignature || report.width !== 1600 || report.height !== 1000) || new Set(roles).size !== 5) throw new Error("Unexpected PNG metadata or missing role coverage");
  for (const [index, report] of reports.entries()) {
    const file = index === 0 ? output : output.replace(/\.png$/i, "-omnivore.png");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(report.base64, "base64"));
    delete report.base64;
    report.output = path.relative(repo, file);
  }
  console.log(JSON.stringify({ comparison: "decoded per-cell foreground masks versus traceOrganism contour reference", threshold: { minIoU: 0.99, maxMismatchedPixels: 4 }, validGraphSizes: reports.map(report => report.species.length), reports }, null, 2));
} finally { await browser.close(); }
