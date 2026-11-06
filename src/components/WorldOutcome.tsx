import type { RunEvidence } from '@/game/run-evidence';
import { getRecordedMoments, type RecordedMoment } from '@/game/recorded-moments';
import type { SpeciesId } from '@/game/rules';
import type { SimulationState } from '@/game/world';
import styles from './WorldOutcome.module.css';

type Props = {
  state: SimulationState;
  evidence: RunEvidence;
  followed: number | null;
  names?: Partial<Record<SpeciesId, string>>;
  onInvestigate: () => void;
  onReview?: (moment: RecordedMoment) => void;
};

/** A factual stopping point beside the original habitat, not another simulation. */
export function WorldOutcome({ state, evidence, followed, names = {}, onInvestigate, onReview }: Props) {
  const moments = getRecordedMoments(evidence, state.config, names);
  const moment = moments.find(item => item.reference === `family:${followed}` || item.reference === `family-observation:${followed}`)
    ?? moments.find(item => item.kind === 'species') ?? moments.at(-1);
  const living = followed === null ? 0 : state.guild.reduce((count, alive, cell) => count + (alive && state.lineage[cell] === followed ? 1 : 0), 0);
  const extinction = evidence.lineageExtinction.find(item => item.lineage === followed);
  return <section id="world-outcome" className={styles.outcome} aria-label="World outcome" tabIndex={-1}>
    <p className={styles.eyebrow}>This world, observed</p>
    <h2>{state.stats.population === 0 ? 'World empty' : 'Observation complete'}</h2>
    <p>Generation {state.generation} · {state.stats.population} living. The habitat is still here to inspect.</p>
    {followed !== null && <p className={styles.family} aria-label="Near-board family outcome">Lineage #{followed} · {living ? `${living} living ${living === 1 ? 'member' : 'members'}` : extinction ? `no living members; first observed extinct at generation ${extinction.generation}` : 'no living members; extinction time not recorded'}.</p>}
    {moment && <p className={styles.fact}>{moment.description}</p>}
    <div className={styles.actions}>
      <button type="button" onClick={onInvestigate}>Investigate this outcome</button>
      {onReview && moment && <button type="button" onClick={() => onReview(moment)}>Review next trial</button>}
    </div>
    {onReview && <p className={styles.note}>Explore a different condition from the starting conditions—not a continuation or a promised rescue.</p>}
    {state.fixedHabitat && <p className={styles.note}>Use Keep this habitat below for saving and any available observation extension.</p>}
  </section>;
}
