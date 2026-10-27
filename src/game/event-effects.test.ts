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
 it('retains a followed family death cue after its last member is gone',()=>{
  const incoming:TimedOrganismEvent[]=[{kind:'death',generation:10,organismId:42,at:5,energy:0,expiresAt:700},...Array.from({length:40},(_,i)=>({kind:'death' as const,generation:10,organismId:i+100,at:i+10,energy:0,expiresAt:700}))];
  const unchanged=JSON.stringify(incoming);
  const timed=updateEventEffects([],incoming,0,false,new Map([[42,7]]));
  const chosen=effects.selectEventEffects(timed,new Set(),7);
  expect(chosen.some(event=>event.organismId===42)).toBe(true);
  expect(effects.selectEventEffects(timed,new Set(),null).some(event=>event.organismId===42)).toBe(false);
  expect(effects.selectEventEffects(timed,new Set(),99).some(event=>event.organismId===42)).toBe(false);
  expect(chosen.length).toBeLessThanOrEqual(effects.EVENT_EFFECT_LIMIT);
  expect(JSON.stringify(incoming)).toBe(unchanged);
 });
 it('does not let family feeding crowd out a family death cue',()=>{
  const death:TimedOrganismEvent={kind:'death',generation:10,organismId:42,at:5,energy:0,expiresAt:700,lineage:7};
  const busy:TimedOrganismEvent[]=[death,...Array.from({length:40},(_,i)=>({kind:'feeding' as const,generation:10,organismId:i+100,at:i+10,energy:5,expiresAt:700,lineage:7})),...Array.from({length:10},(_,i)=>({kind:'death' as const,generation:10,organismId:i+200,at:i+100,energy:0,expiresAt:700,lineage:99}))];
  expect(effects.selectEventEffects(busy,new Set(),7)).toContain(death);
 });
 it('keeps a birth pulse across fast ticks then expires it',()=>{
  const events=updateEventEffects([],[{kind:'birth',generation:1,organismId:2,parentId:1,at:10,energy:40}],0);
  expect(updateEventEffects(events,[],35)).toHaveLength(1);
  expect(updateEventEffects(events,[],EVENT_LIFETIME)).toHaveLength(0);
  expect(updateEventEffects(events,[],35,true)).toHaveLength(0);
 });
 it('draws resource feeding as a circle and prey capture as a distinct closed diamond',()=>{
  expect(effects.traceEventMark).toBeTypeOf('function');
  const paths:string[]=[];
  const context={beginPath(){},arc(){paths.push('arc');},moveTo(){paths.push('move');},lineTo(){paths.push('line');},closePath(){paths.push('close');}} as unknown as CanvasRenderingContext2D;
  effects.traceEventMark(context,{kind:'feeding',source:'resource'},0,0,6,0);
  expect(paths).toEqual(['arc']);
  paths.length=0;
  effects.traceEventMark(context,{kind:'feeding',source:'prey'},0,0,6,0);
  expect(paths).toEqual(['move','line','line','line','close']);
 });
 it('retains factual birth-family metadata without inventing unknown ancestry',()=>{
  const birth={kind:'birth' as const,generation:1,organismId:9,parentId:2,at:3,energy:5};
  const before=JSON.stringify(birth);
  const timed=updateEventEffects([],[birth],0,false,new Map([[2,7]]));
  expect(timed[0].lineage).toBe(7);
  expect(updateEventEffects(timed,[],100)[0].lineage).toBe(7);
  expect(updateEventEffects([],[birth],0)[0].lineage).toBeUndefined();
  expect(JSON.stringify(birth)).toBe(before);
 });
 for(const pitch of [2.88,4.08,5.64,11.28]) for(const kind of ['birth','feeding','death'] as const) for(const source of ['prey','resource'] as const) it(`${kind}/${source} event marks including contrast stroke fit ${pitch}px cells`,()=>{
  const points:number[][]=[];
  const context={beginPath(){},moveTo(x:number,y:number){points.push([x,y]);},lineTo(x:number,y:number){points.push([x,y]);},closePath(){},arc(x:number,y:number,r:number){points.push([x-r,y-r],[x+r,y+r]);}} as unknown as CanvasRenderingContext2D;
  for(const progress of [0,.5,1]){
   points.length=0;
   effects.traceEventMark(context,{kind,source},0,0,pitch,progress);
   expect(points.length).toBeGreaterThan(0);
   for(const point of points) for(const coordinate of point) expect(Math.abs(coordinate)+pitch*.16/2).toBeLessThan(pitch/2);
  }
 });
 it('does not turn unchanged rules into new graph versions',()=>{
  const g=defaultRuleGraph();const pair=g.interactions[0];
  expect(applyRulePatch(g,{kind:'pair',pair:pair.pair,mode:pair.mode})).toEqual(g);
  expect(applyRulePatch(g,{kind:'self',species:'A',value:g.species[0].selfInteraction})).toEqual(g);
 });
});
