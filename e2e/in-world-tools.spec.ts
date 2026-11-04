import {test,expect} from '@playwright/test';
import {ENVIRONMENT_PRESSURES} from '../src/game/rules';
import {deterministicEvolutionDecision} from '../src/game/decisions';
for(const width of [320,390,768,1280])test(`shape conditions without losing the habitat at ${width}px`,async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const requests:unknown[]=[];
 await page.route('**/api/judge',r=>r.fulfill({json:deterministicEvolutionDecision(r.request().postDataJSON().summary)}));
 await page.route('**/api/player-proposal',r=>{requests.push(r.request().postDataJSON());return r.fulfill({json:{outcome:'proposed',proposal:{version:1,source:'jev',model:'shortcut-fixture',usage:{input_tokens:1,output_tokens:1},pressure:'nutrient_bloom',duration:6,evidence:{choice:'nutrient_bloom',confidence:1,probabilities:Object.fromEntries(['unsupported',...ENVIRONMENT_PRESSURES].map(k=>[k,k==='nutrient_bloom'?1:0]))}}}})});
 await page.setViewportSize({width,height:844});await page.clock.install({time:new Date('2026-11-03T12:00:00Z')});await page.clock.pauseAt(new Date('2026-11-03T12:00:01Z'));
 await page.goto('/play');await page.getByRole('button',{name:'Preview Resource competition',exact:true}).click();await page.getByRole('button',{name:'Review this world',exact:true}).click();
 await page.getByLabel('World policy',{exact:true}).selectOption('adaptive');
 await page.getByRole('button',{name:/Seed ecosystem/}).click();
 await page.getByRole('button',{name:'Ask Jev to change this world'}).click();
 const dialog=page.getByRole('dialog',{name:'Review a player-directed world change'});await expect(dialog).toBeVisible();
 const habitat=(await page.locator('canvas.life-canvas').boundingBox())!;const sheet=(await dialog.boundingBox())!;
 const overlapWidth=Math.max(0,Math.min(habitat.x+habitat.width,sheet.x+sheet.width)-Math.max(habitat.x,sheet.x));
 const overlapHeight=Math.max(0,Math.min(habitat.y+habitat.height,sheet.y+sheet.height)-Math.max(habitat.y,sheet.y));
 expect(habitat.width).toBeGreaterThanOrEqual(280);expect(habitat.y).toBeGreaterThanOrEqual(64);
 // At least 90% of the genuine habitat remains visible, not a replacement preview.
 expect(overlapWidth*overlapHeight/(habitat.width*habitat.height)).toBeLessThanOrEqual(.1);
 const drought=dialog.getByRole('button',{name:'Drought',exact:true});await drought.click();
 expect(requests).toHaveLength(0);await expect(page.getByTestId('generation')).toHaveText('0 / 180');
 await page.getByRole('button',{name:'Ask Jev for a proposal'}).click();
 const review=page.getByRole('region',{name:'Review Jev proposal'});await expect(review).toContainText('nutrient bloom');
 // A shortcut is an editable request, not a guaranteed selection; returned pressure wins.
 await expect(review).toContainText(/regeneration/i);
 await page.screenshot({path:info.outputPath('habitat-and-proposal.png')});
 await page.getByRole('button',{name:'Accept this change'}).click();
 await expect(dialog).toHaveCount(0);await expect(page.getByLabel('Player change status')).toContainText('Accepted');
 for(let i=1;i<=7;i++){await page.getByRole('button',{name:'Step one generation'}).click();await expect(page.getByTestId('generation')).toHaveText(`${i} / 180`)}
 await expect(page.getByLabel('Player change status')).toContainText('restored');
 const window=page.getByLabel('Recorded response to player change');await window.getByText('Recorded window',{exact:false}).click();
 await expect(window).toContainText('Population');await expect(window).toContainText('not proof of cause');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);expect(errors).toEqual([]);
});
