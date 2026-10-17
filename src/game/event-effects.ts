import type { OrganismEvent } from './world';
export type TimedOrganismEvent=OrganismEvent & {expiresAt:number};
export const EVENT_LIFETIME=700;
export const EVENT_EFFECT_LIMIT = 24;

// Only visual cues are sampled. Engine events, history and measured totals stay intact.
export function selectEventEffects(events: readonly TimedOrganismEvent[], importantActors: ReadonlySet<number>): TimedOrganismEvent[] {
 const newest = [...events].reverse();
 const chosen: TimedOrganismEvent[] = [], used = new Set<TimedOrganismEvent>();
 const take = (count: number, accepts: (event: TimedOrganismEvent) => boolean) => {
  let added = 0;
  for (const event of newest) {
   if (chosen.length >= EVENT_EFFECT_LIMIT || added >= count) break;
   if (!used.has(event) && accepts(event)) { chosen.push(event); used.add(event); added++; }
  }
 };
 take(12, event => importantActors.has(event.organismId));
 // Feeding volume must not crowd every birth/death cue out of the display.
 for (const kind of ['death', 'birth', 'feeding'] as const) take(4, event => event.kind === kind);
 take(EVENT_EFFECT_LIMIT, () => true);
 return chosen;
}
export function updateEventEffects(previous:TimedOrganismEvent[],incoming:OrganismEvent[],now:number,reducedMotion=false):TimedOrganismEvent[]{
 if(reducedMotion)return [];
 const feeding=new Set(incoming.filter(e=>e.kind==='feeding').map(e=>e.organismId));
 return [...previous.filter(e=>e.expiresAt>now&&!(e.kind==='feeding'&&feeding.has(e.organismId))),...incoming.map(e=>({...e,expiresAt:now+EVENT_LIFETIME}))].slice(-7500);
}
