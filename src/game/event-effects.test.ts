import {describe,it,expect} from 'vitest';
import {updateEventEffects,EVENT_LIFETIME} from './event-effects';
import {applyRulePatch,defaultRuleGraph} from './rules';
describe('truthful visible events',()=>{
 it('keeps a birth pulse across fast ticks then expires it',()=>{
  const events=updateEventEffects([],[{kind:'birth',generation:1,organismId:2,parentId:1,at:10,energy:40}],0);
  expect(updateEventEffects(events,[],35)).toHaveLength(1);
  expect(updateEventEffects(events,[],EVENT_LIFETIME)).toHaveLength(0);
  expect(updateEventEffects(events,[],35,true)).toHaveLength(0);
 });
 it('does not turn unchanged rules into new graph versions',()=>{
  const g=defaultRuleGraph();const pair=g.interactions[0];
  expect(applyRulePatch(g,{kind:'pair',pair:pair.pair,mode:pair.mode})).toEqual(g);
  expect(applyRulePatch(g,{kind:'self',species:'A',value:g.species[0].selfInteraction})).toEqual(g);
 });
});
