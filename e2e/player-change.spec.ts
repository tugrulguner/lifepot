import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {decodeReplay,playReplay} from '../src/game/replay';
import {ENVIRONMENT_PRESSURES} from '../src/game/rules';
const proposal=(pressure:'nutrient_bloom'|'drought')=>({version:1,source:'jev',model:'fixture',usage:{input_tokens:1,output_tokens:1},pressure,duration:6,evidence:{choice:pressure,confidence:.7,probabilities:Object.fromEntries(['unsupported',...ENVIRONMENT_PRESSURES].map(k=>[k,k===pressure?1:0]))}});
for(const width of [320,375,390,1280])for(const pressure of ['nutrient_bloom','drought'] as const)test(`reviewed ${pressure} executes and restores at ${width}px`,async({page},testInfo)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const requests:Record<string,unknown>[]=[];
 await page.route('**/*posthog.com/**',route=>route.abort());await page.route('**/api/judge',route=>route.abort());
 await page.route('**/api/player-proposal',route=>{requests.push(route.request().postDataJSON());return route.fulfill({json:{outcome:'proposed',proposal:proposal(pressure)}})});
 await page.setViewportSize({width,height:850});await page.clock.install({time:new Date('2026-10-26T02:00:00Z')});await page.clock.pauseAt(new Date('2026-10-26T02:00:01Z'));
 await page.goto('/play');await page.getByRole('button',{name:'Explore deterministic preset'}).click();await page.getByText('Edit world conditions',{exact:true}).click();await page.getByLabel('Environment pressure',{exact:true}).selectOption('stability');
 // Fixture-backed proposal semantics are distinct from live Jev evaluation.
 await page.getByRole('button',{name:/Seed ecosystem/}).click();await expect(page.getByTestId('generation')).toHaveText('0 / 180');
 await page.getByRole('button',{name:'Ask Jev to change this world'}).click();
 const dialog=page.getByRole('dialog',{name:'Review a player-directed world change'});await expect(dialog).toBeVisible();
 await page.getByRole('textbox',{name:'Request a temporary world change'}).fill(pressure==='nutrient_bloom'?'Temporarily increase nutrients':'Temporarily reduce nutrients');
 await page.getByRole('button',{name:'Ask Jev for a proposal'}).click();await expect(page.getByRole('region',{name:'Review Jev proposal'})).toBeVisible();
 await expect(page.getByTestId('generation')).toHaveText('0 / 180');
 const box=(await dialog.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);await dialog.screenshot({path:testInfo.outputPath('proposal-review.png')});
 await page.getByRole('button',{name:'Accept this change'}).click();await expect(dialog).toHaveCount(0);await expect(page.getByLabel('Player change status')).toContainText('Accepted');
 expect(Object.keys(requests[0]).sort()).toEqual(['config','generation','request']);
 const step=page.getByRole('button',{name:'Step one generation'});await step.click();await expect(page.getByLabel('Player change status')).toContainText('Active');
 for(let i=2;i<=7;i++)await step.click();
 await expect(page.getByTestId('generation')).toHaveText('7 / 180');await expect(page.getByLabel('Player change status')).toContainText('restored');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:testInfo.outputPath('restored.png')});expect(errors).toEqual([]);
});

test('player-authorized run saves as v4 and visible replay reproduces it without inference',async({page},testInfo)=>{
 test.setTimeout(120000);let calls=0;const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*posthog.com/**',r=>r.abort());await page.route('**/api/judge',r=>{calls++;return r.abort()});
 await page.route('**/api/player-proposal',r=>{calls++;return r.fulfill({json:{outcome:'proposed',proposal:proposal('nutrient_bloom')}})});
 await page.goto('/play');await page.getByRole('button',{name:'Explore deterministic preset'}).click();await page.getByText('Edit world conditions',{exact:true}).click();await page.getByLabel('Environment pressure',{exact:true}).selectOption('stability');await page.getByLabel('Your question or prediction (optional)').fill('PRIVATE_QUESTION_KEEP_LOCAL');await page.getByRole('button',{name:/Seed ecosystem/}).click();await page.getByRole('button',{name:'Ask Jev to change this world'}).click();
 await page.getByRole('textbox',{name:'Request a temporary world change'}).fill('PRIVATE_PLAYER_REQUEST: temporarily increase nutrients');await page.getByRole('button',{name:'Ask Jev for a proposal'}).click();await page.getByRole('button',{name:'Accept this change'}).click();
 await page.getByLabel('Playback speed',{exact:true}).selectOption('fast');await page.getByRole('button',{name:'Resume',exact:true}).click();
 const result=page.getByRole('region',{name:'Run results',exact:true});await expect(result).toBeVisible({timeout:45000});await expect(result.getByRole('region',{name:'Player-directed changes'})).toContainText('player requests');
 await page.getByLabel('Optional world name (stored locally)').fill('Player intervention test');await page.getByRole('button',{name:'Save completed world'}).click();
 const shelf=page.getByRole('region',{name:'My Worlds — browser-local saves'});await expect(shelf.getByRole('status')).toHaveText('World saved in this browser.');
 const download=page.waitForEvent('download');await shelf.getByRole('button',{name:'Export',exact:true}).click();const exported=await download,path=testInfo.outputPath('player-world.lifepot.json');await exported.saveAs(path);const text=await readFile(path,'utf8');expect(text).not.toContain('PRIVATE_QUESTION_KEEP_LOCAL');expect(text).not.toContain('PRIVATE_PLAYER_REQUEST');
 const record=JSON.parse(text),replay=decodeReplay(record.replay);expect(replay.version).toBe(4);const canonical=await playReplay(replay);expect(canonical.state.generation).toBe(record.evidence.samples.at(-1).generation);
 const before=calls;await result.getByRole('button',{name:'Replay this run',exact:true}).click();await expect(result).toHaveCount(0);await page.getByLabel('Playback speed',{exact:true}).selectOption('fast');await expect(result).toBeVisible({timeout:45000});expect(calls).toBe(before);
 await expect(page.getByTestId('generation')).toHaveText(`${canonical.state.generation} / 180`);await expect(result).toContainText(`cumulative births: ${canonical.state.stats.births}; deaths: ${canonical.state.stats.deaths}; kills: ${canonical.state.stats.kills}`);expect(errors).toEqual([]);
});
