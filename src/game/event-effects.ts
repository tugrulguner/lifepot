import type { OrganismEvent } from './world';
export type TimedOrganismEvent=OrganismEvent & {expiresAt:number};
export const EVENT_LIFETIME=700;
export function updateEventEffects(previous:TimedOrganismEvent[],incoming:OrganismEvent[],now:number,reducedMotion=false):TimedOrganismEvent[]{
 if(reducedMotion)return [];
 const feeding=new Set(incoming.filter(e=>e.kind==='feeding').map(e=>e.organismId));
 return [...previous.filter(e=>e.expiresAt>now&&!(e.kind==='feeding'&&feeding.has(e.organismId))),...incoming.map(e=>({...e,expiresAt:now+EVENT_LIFETIME}))].slice(-7500);
}
