import {test,expect,type Page} from '@playwright/test';
import {ENVIRONMENT_PRESSURES} from '../src/game/rules';
import {deterministicEvolutionDecision} from '../src/game/decisions';
for(const width of [390,1280])test.describe.serial(`player-change comparison ${width}px`,()=>{
 let page:Page;
 test.beforeAll(async({browser})=>{
  page=await browser.newPage({viewport:{width,height:844}});
  await page.route('**/api/judge',r=>r.fulfill({json:deterministicEvolutionDecision(r.request().postDataJSON().summary)}));
  await page.route('**/api/player-proposal',r=>r.fulfill({json:{outcome:'proposed',proposal:{version:1,source:'jev',model:'comparison-fixture-not-live',usage:{input_tokens:1,output_tokens:1},pressure:'nutrient_bloom',duration:6,evidence:{choice:'nutrient_bloom',confidence:1,probabilities:Object.fromEntries(['unsupported',...ENVIRONMENT_PRESSURES].map(k=>[k,k==='nutrient_bloom'?1:0]))}}}}));
 });
 test.afterAll(async()=>{await page?.close()});
 test('complete the unchanged reference trial',async()=>{
  await page.goto('/play');await page.getByRole('button',{name:'Explore deterministic preset'}).click();
  await page.getByText('Edit world conditions',{exact:true}).click();await page.getByLabel('Environment pressure',{exact:true}).selectOption('stability');
  await page.getByRole('button',{name:/Seed ecosystem/}).click();await page.getByLabel('Playback speed',{exact:true}).selectOption('fast');
  await expect(page.getByRole('region',{name:'Run results',exact:true})).toBeVisible({timeout:24000});
 });
 test('compare an actually executed temporary pressure without calling it no change',async()=>{
  await page.getByRole('button',{name:'Edit this world',exact:true}).click();await page.getByRole('button',{name:/Seed ecosystem/}).click();
  await page.getByRole('button',{name:'Ask Jev to change this world'}).click();await page.getByRole('button',{name:'Nutrient bloom',exact:true}).click();
  await page.getByRole('button',{name:'Ask Jev for a proposal'}).click();await page.getByRole('button',{name:'Accept this change'}).click();
  await page.getByRole('button',{name:'Resume',exact:true}).click();await expect(page.getByRole('region',{name:'Run results',exact:true})).toBeVisible({timeout:24000});
  const comparison=page.getByRole('region',{name:'Previous trial comparison'}),changes=comparison.getByRole('region',{name:'Compared player-directed conditions'});
  await expect(changes).toContainText('Previous trial: no player changes recorded');await expect(changes).toContainText('This trial: nutrient bloom');
  await expect(changes).toContainText(/activated at \d+/);await expect(changes).toContainText(/restored at \d+/);await expect(changes).toContainText('not proof of cause');
  await expect(comparison).toContainText('No recorded starting-condition changes.');await expect(comparison).toContainText('No accepted automatic Jev decision records in either trial.');
  expect(await changes.evaluate(e=>Boolean(e.compareDocumentPosition(document.querySelector('.run-comparison figure')!)&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
 });
});
