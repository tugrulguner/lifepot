import type {AcceptedPlayerEvent} from '@/game/player-proposal';
export function playerChangeLabel(event:AcceptedPlayerEvent,generation:number){
 const name=event.proposal.pressure.replaceAll('_',' ');
 if(generation<event.generation)return `Accepted · ${name} starts at generation ${event.generation}; still paused before execution.`;
 if(generation<event.generation+6)return `Active · player-requested ${name}, generations ${event.generation}–${event.generation+5}.`;
 return `Previous pressure restored at generation ${event.generation+6} after player-requested ${name}.`;
}
export function PlayerChangeStatus({events,generation}:{events:readonly AcceptedPlayerEvent[];generation:number}){
 const latest=events.filter(e=>e.acceptedGeneration<=generation).at(-1);
 return latest?<p className="player-change-status" aria-label="Player change status" aria-live="polite">{playerChangeLabel(latest,generation)}</p>:null;
}
export function PlayerChangeHistory({events,generation}:{events:readonly AcceptedPlayerEvent[];generation:number}){
 const observed=events.filter(e=>e.acceptedGeneration<=generation);
 return observed.length?<section aria-label="Player-directed changes"><h3>Player-directed changes</h3><p>Explicit player requests interpreted by Jev. These conditions were imposed; they are not spontaneous biological changes or proof of ecological cause.</p><ul>{observed.map(e=><li key={e.acceptedGeneration}>Accepted at generation {e.acceptedGeneration}: {playerChangeLabel(e,generation)} Jev · {e.proposal.model}.</li>)}</ul></section>:null;
}
