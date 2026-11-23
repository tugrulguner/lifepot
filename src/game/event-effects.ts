import type { OrganismEvent } from './world';
export type TimedOrganismEvent=OrganismEvent & {expiresAt:number; lineage?:number};
export const EVENT_LIFETIME=700;
export const EVENT_EFFECT_LIMIT = 24;

// Only visual cues are sampled. Engine events, history and measured totals stay intact.
export function selectEventEffects(events: readonly TimedOrganismEvent[], importantActors: ReadonlySet<number>, followedLineage: number | null = null): TimedOrganismEvent[] {
 const newest = [...events].reverse();
 const chosen: TimedOrganismEvent[] = [], used = new Set<TimedOrganismEvent>();
 const take = (count: number, accepts: (event: TimedOrganismEvent) => boolean) => {
  let added = 0;
  for (const event of newest) {
   if (chosen.length >= EVENT_EFFECT_LIMIT || added >= count) break;
   if (!used.has(event) && accepts(event)) { chosen.push(event); used.add(event); added++; }
  }
 };
 const relevant = (event: TimedOrganismEvent) => importantActors.has(event.organismId) || (followedLineage !== null && event.lineage === followedLineage);
 // First reserve a representative of each observed event kind, then fill the
 // observer's half of the unchanged 24-mark budget. Feeding cannot erase loss.
 for (const kind of ['death', 'birth', 'feeding'] as const) take(2, event => relevant(event) && event.kind === kind);
 take(12 - chosen.length, relevant);
 // Feeding volume must not crowd every birth/death cue out of the display.
 for (const kind of ['death', 'birth', 'feeding'] as const) take(4, event => event.kind === kind);
 take(EVENT_EFFECT_LIMIT, () => true);
 return chosen;
}
// Marks describe recorded event locations, never inferred paths or anatomy.
export function traceEventMark(context: CanvasRenderingContext2D, event: Pick<OrganismEvent, 'kind' | 'source'>, x: number, y: number, pitch: number, progress: number): void {
 const radius = pitch * (.30 + Math.max(0, Math.min(1, progress)) * .08);
 context.beginPath();
 if (event.kind === 'birth') {
  for (let n = 0; n < 4; n++) {
   const angle = n * Math.PI / 2;
   context.moveTo(x + Math.cos(angle) * pitch * .23, y + Math.sin(angle) * pitch * .23);
   context.lineTo(x + Math.cos(angle) * pitch * .40, y + Math.sin(angle) * pitch * .40);
  }
 } else if (event.kind === 'death') {
  context.moveTo(x - radius, y - radius); context.lineTo(x + radius, y + radius);
  context.moveTo(x + radius, y - radius); context.lineTo(x - radius, y + radius);
 } else if (event.source === 'prey') {
  context.moveTo(x, y - radius); context.lineTo(x + radius, y);
  context.lineTo(x, y + radius); context.lineTo(x - radius, y); context.closePath();
 } else context.arc(x, y, radius * .7, 0, Math.PI * 2);
}

export function updateEventEffects(previous:TimedOrganismEvent[],incoming:OrganismEvent[],now:number,reducedMotion=false,lineages?:ReadonlyMap<number,number>):TimedOrganismEvent[]{
 if(reducedMotion)return [];
 const feeding=new Set(incoming.filter(e=>e.kind==='feeding').map(e=>e.organismId));
 return [...previous.filter(e=>e.expiresAt>now&&!(e.kind==='feeding'&&feeding.has(e.organismId))),...incoming.map(e=>({...e,lineage:lineages?.get(e.organismId)??(e.kind==='birth'&&e.parentId!==undefined?lineages?.get(e.parentId):undefined),expiresAt:now+EVENT_LIFETIME}))].slice(-7500);
}
