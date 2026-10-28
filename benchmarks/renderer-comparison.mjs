#!/usr/bin/env node
// Compare complete LifePot canvas draw functions from base, original PR, and worktree.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(repo, "package.json"));
const ts = require("typescript"), esbuild = require("esbuild"), { chromium } = require("playwright");
const BASE = "116a7d311e3ef10123f74a110e1de477acce0900";
const PR = "17e006065338f876bfb9c6912e60d7b020a0c246";
const arg = (name, fallback) => { const index = process.argv.indexOf(name); return index < 0 ? fallback : process.argv[index + 1]; };
const sizes = arg("--sizes", "351,601").split(",").map(Number);
const dpr = Number(arg("--dpr", "1"));
const samples = Number(arg("--samples", "9"));
const warmups = Number(arg("--warmups", "2"));
const configFile = arg("--config", null);
const config = configFile ? JSON.parse(fs.readFileSync(configFile, "utf8")) : null;
const sourceAt = (revision) => execFileSync("git", ["show", `${revision}:src/components/GameCanvas.tsx`], { cwd: repo, encoding: "utf8" });
const candidate = fs.readFileSync(path.join(repo, "src/components/GameCanvas.tsx"), "utf8");
function extract(source, name) {
  const tree = ts.createSourceFile("source.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const node = tree.statements.find(item => ts.isFunctionDeclaration(item) && item.name?.text === "draw");
  if (!node) throw new Error(`draw missing in ${name}`);
  return node.getText(tree).replace(/^function draw\(/, `export function ${name}(`);
}
const imports = `import { GRID_SIZE, createSimulation, runSimulation, stepSimulation } from './src/game/world';
import { defaultConfig } from './src/game/setup';
import { EVENT_LIFETIME } from './src/game/event-effects';
import { isSurvivingNewborn } from './src/game/visuals';
import { speciesColor } from './src/game/species-colors';
import { traceOrganism, organismPath2D, organismSprite } from './src/game/organism-glyphs';`;
const source = `${imports}\n${extract(sourceAt(BASE), "baseDraw")}\n${extract(sourceAt(PR), "prDraw")}\n${extract(candidate, "candidateDraw")}\n` + `
export function populated() { return runSimulation(createSimulation({ seed: 684946020, config: ${config ? "providedConfig" : "defaultConfig()"} }), 180); }
export function fresh() { return createSimulation({seed:684946020,config:${config ? "providedConfig" : "defaultConfig()"}}); }
export function step(state) { return stepSimulation(state); }
export function dense(count=2500) { const state=createSimulation({seed:123,config:defaultConfig()}); state.generation=30; state.config.rules.species=['producer','grazer','scavenger','hunter','omnivore'].map((role,i)=>({id:['A','B','C','D','E'][i],role,selfInteraction:'neutral'})); state.guild.fill(0); state.ruleSpecies.fill(0); for(let i=0;i<2500;i++){state.resources[i]=(i*17)%150;state.hazards[i]=i%7===0?80:0;if(i<count){state.guild[i]=1;state.ruleSpecies[i]=i%5+1;state.age[i]=10;state.organismGeneration[i]=2;state.lineage[i]=i+1;}} return state; }
export function events(state) { return Array.from({length:Math.min(80,state.guild.length)},(_,at)=>({at,generation:state.generation,kind:at%3===0?'birth':at%3===1?'feeding':'death',source:at%2?'organism':'resource',expiresAt:2500+EVENT_LIFETIME*.5})); }
`;
const bundled = esbuild.buildSync({ stdin: { contents: source, resolveDir: repo, loader: "ts" }, bundle: true, write: false, format: "iife", globalName: "probe" }).outputFiles[0].text;
const pageConfig = `${config ? `const providedConfig=${JSON.stringify(config)}; window.expectedEndpoint={population:1092,births:2675,deaths:1609,kills:1269};` : ""}`;
(async () => {
  const browser = await chromium.launch({ headless: true });
  const rows = [];
  for (const size of sizes) {
    for (const fixture of ["engine-populated", "synthetic-dense"]) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: dpr });
      await page.setContent(`<canvas style="width:${size}px;height:${size}px"></canvas>`);
      await page.addScriptTag({ content: `${pageConfig}\n${bundled}` });
      const result = await page.evaluate(({size, fixture, samples, warmups, dpr}) => {
        const canvas=document.querySelector('canvas'), context=canvas.getContext('2d');
        const state=fixture==='engine-populated'?probe.populated():probe.dense();
        const roles=state.config.rules.species;
        if (fixture==='engine-populated' && window.expectedEndpoint) {
          const actual={population:state.stats.population,births:state.stats.births,deaths:state.stats.deaths,kills:state.stats.kills};
          if(JSON.stringify(actual)!==JSON.stringify(window.expectedEndpoint)) throw Error(`Recorded endpoint mismatch ${JSON.stringify(actual)}`);
        }
        const events=probe.events(state), variants=['base','pr','candidate'];
        const time=(variant, currentState=state, effects=[], selected=null, followed=null, focused=null) => {
          const start=performance.now(); probe[variant+'Draw'](canvas,currentState,selected,followed,effects,2500,focused);
          context.getImageData(0,0,canvas.width,canvas.height); return performance.now()-start;
        };
        // First paint shares this page/module context and is not cache-cold.
        const firstPaint = {};
        for(const variant of variants) firstPaint[variant]=time(variant,state,[],null,null,null);
        // Advance a real engine state for each sample; do not fabricate generations
        // by shallow-cloning one snapshot and changing only its counter.
        const changedStates=[];
        let evolving=probe.fresh();
        for(let i=0;i<samples+warmups;i++){
          evolving=probe.step(evolving);
          changedStates.push(evolving);
        }
        const distinctEngineGenerations=new Set(changedStates.map(item=>item.generation)).size;
        if(distinctEngineGenerations!==samples+warmups) throw Error(`Expected distinct engine states; saw ${distinctEngineGenerations} generations for ${samples+warmups} samples`);
        const modes={changedGeneration:Object.fromEntries(variants.map(name=>[name,[]])),eventRedraw:Object.fromEntries(variants.map(name=>[name,[]]))};
        for(let round=-warmups;round<samples;round++) {
          const order=round%2===0?variants:[...variants].reverse();
          for(const variant of order) {
            const stateIndex=round+warmups;
            const selected=state.guild.findIndex(Boolean), followed=selected>=0?state.lineage[selected]:null;
            const focused=roles[0]?.id??null;
            const changed=time(variant,changedStates[stateIndex],[],selected,followed,focused);
            const event=time(variant,state,events,selected,followed,focused);
            if(round>=0){modes.changedGeneration[variant].push(changed);modes.eventRedraw[variant].push(event);}
          }
        }
        const summarize=values=>({medianMs:Number(values.sort((a,b)=>a-b)[Math.floor(values.length/2)].toFixed(3)),p95Ms:Number(values[Math.min(values.length-1,Math.floor(values.length*.95))].toFixed(3)),samples:values.map(v=>Number(v.toFixed(3)))});
        return {size,dpr,fixture,population:state.guild.reduce((total,guild)=>total+Number(Boolean(guild)),0),endpoint:{generation:state.generation,births:state.stats.births,deaths:state.stats.deaths,kills:state.stats.kills},firstPaintMs:Object.fromEntries(Object.entries(firstPaint).map(([k,v])=>[k,Number(v.toFixed(3))])),changedGeneration:{distinctEngineGenerations,variants:Object.fromEntries(Object.entries(modes.changedGeneration).map(([k,v])=>[k,summarize([...v].sort((a,b)=>a-b))]))},eventRedraw:Object.fromEntries(Object.entries(modes.eventRedraw).map(([k,v])=>[k,summarize([...v].sort((a,b)=>a-b))]))};
      }, { size, fixture, samples, warmups, dpr });
      rows.push(result);
      await page.close();
    }
  }
  const report={browser:browser.version(),runtime:process.version,method:"Literal complete draw functions extracted by TypeScript AST from base, original PR, and current worktree. Canvas readback forces raster completion. Includes resource/hazard fields and separate populated, real engine-stepped generation redraws, event-redraw (80 effects plus selection/family/species focus), and first-paint timings. First paint shares its page/module context and is not cache-cold. Engine stepping, application scheduler, and CSS compositing excluded; not physical-device FPS.",dpr,samples,warmups,recordedConfig:configFile?path.basename(configFile):"defaultConfig",rows};
  console.log(JSON.stringify(report,null,2));
  await browser.close();
})().catch(error=>{console.error(error);process.exitCode=1;});
