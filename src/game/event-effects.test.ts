import {describe,it,expect} from 'vitest';
import * as effects from './event-effects';
import {updateEventEffects,EVENT_LIFETIME} from './event-effects';
import type {TimedOrganismEvent} from './event-effects';
import {applyRulePatch,defaultRuleGraph} from './rules';
describe('truthful visible events',()=>{
 it('budgets visual pulses while retaining followed actors and all available event kinds',()=>{
  expect(effects.selectEventEffects, 'a dense world needs a separate bounded display selection').toBeTypeOf('function');
  const event=(kind:TimedOrganismEvent['kind'],id:number):TimedOrganismEvent=>({kind,generation:10,organismId:id,at:id%2500,energy:5,expiresAt:700});
  const input=[event('birth',1),...Array.from({length:100},(_,i)=>event('feeding',i+2)),event('death',110)];
  const before=JSON.stringify(input);
  const selected=effects.selectEventEffects(input,new Set([1]));
  expect(selected).toHaveLength(24);
  expect(selected).toContain(input[0]);
  expect(new Set(selected.map(e=>e.kind))).toEqual(new Set(['birth','feeding','death']));
  expect(selected.every(e=>input.includes(e))).toBe(true);
  expect(JSON.stringify(input)).toBe(before);
  expect(effects.selectEventEffects([],new Set())).toEqual([]);
 });
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
