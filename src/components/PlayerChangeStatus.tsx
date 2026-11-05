import type {AcceptedPlayerEvent} from '@/game/player-proposal';
import type {RunEvidence} from '@/game/run-evidence';
import {GRID_CELLS,type SimulationOutcome} from '@/game/world';
import styles from './PlayerChangeStatus.module.css';
export function playerChangeLabel(event:AcceptedPlayerEvent,generation:number,outcome:SimulationOutcome){
 const name=event.proposal.pressure.replaceAll('_',' ');
 if(outcome!=="running"&&generation<event.generation+6)return `World ended at generation ${generation} · player-requested ${name}; ${generation<event.generation?'activation not observed; ':''}restoration not observed.`;
 if(generation<event.generation)return `Accepted · ${name} starts at generation ${event.generation}; still paused before execution.`;
 if(generation<event.generation+6)return `Active · player-requested ${name}, generations ${event.generation}–${event.generation+5}.`;
 return `Previous pressure restored at generation ${event.generation+6} after player-requested ${name}.`;
}
function RecordedWindow({event,generation,evidence}:{event:AcceptedPlayerEvent;generation:number;evidence?:RunEvidence|null}){
 if(generation<event.generation)return null;
 // Compare actual exact-boundary observations, never interpolate missing data or
 // attribute the rest of the run to this temporary condition.
 const end=Math.min(generation,event.generation+6);
 const before=evidence?.samples.find(sample=>sample.generation===event.acceptedGeneration);
 const after=evidence?.samples.find(sample=>sample.generation===end);
 if(!before||!after)return null;
 return <details className={styles.window} aria-label="Recorded response to player change">
  <summary>Recorded window · generations {before.generation}–{after.generation}</summary>
  <p>Population {before.population} → {after.population}. Mean resources per cell {(before.resources/GRID_CELLS).toFixed(1)} → {(after.resources/GRID_CELLS).toFixed(1)}.</p>
  <ul>{before.species.map(species=><li key={species.speciesId}>Species {species.speciesId}: {species.population} → {after.species.find(item=>item.speciesId===species.speciesId)?.population??'not recorded'}.</li>)}</ul>
  <p>Recorded alongside this change, not proof of cause. Restoring the pressure does not restore organisms or earlier populations.</p>
 </details>;
}
type ObservationProps={events:readonly AcceptedPlayerEvent[];generation:number;outcome:SimulationOutcome;evidence?:RunEvidence|null};
export function PlayerChangeStatus({events,generation,outcome,evidence}:ObservationProps){
 const latest=events.filter(e=>e.acceptedGeneration<=generation).at(-1);
 return latest?<div className={styles.observation}><p className="player-change-status" aria-label="Player change status" aria-live="polite">{playerChangeLabel(latest,generation,outcome)}</p><RecordedWindow event={latest} generation={generation} evidence={evidence}/></div>:null;
}
export function PlayerChangeHistory({events,generation,outcome,evidence}:ObservationProps){
 const observed=events.filter(e=>e.acceptedGeneration<=generation);
 return observed.length?<section aria-label="Player-directed changes"><h3>Player-directed changes</h3><p>Explicit player requests interpreted by Jev. These conditions were imposed; they are not spontaneous biological changes or proof of ecological cause.</p><ul>{observed.map(e=><li key={e.acceptedGeneration}>Accepted at generation {e.acceptedGeneration}: {playerChangeLabel(e,generation,outcome)} Jev · {e.proposal.model}.<RecordedWindow event={e} generation={generation} evidence={evidence}/></li>)}</ul></section>:null;
}
