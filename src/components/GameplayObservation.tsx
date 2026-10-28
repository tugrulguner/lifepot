import type { ReactNode } from "react";
import type { RunEvidence } from "@/game/run-evidence";
import type { EvolutionDecision } from "@/game/decisions";
import type { SimulationState } from "@/game/world";
import { ruleTimingLabel, selectedChangeLabel, conciseChangeLabel } from "@/game/council-display";
import { speciesColor } from "@/game/species-colors";
import OrganismArtwork from "./OrganismArtwork";

export function GameplayObservation({ state, evidence, followed, decision, names, worldName, cameraUpdate, inspection,playerChange }: { state: SimulationState; evidence: RunEvidence | null; followed: number | null; decision: EvolutionDecision | null; names?: Readonly<Record<string, string>>; worldName?: string; cameraUpdate?: string; inspection?: ReactNode | ((context: ReactNode) => ReactNode);playerChange?:ReactNode }) {
  const rules = state.config.rules!;
  const latestSample = evidence?.samples.at(-1);
  const recentSample = latestSample?.generation === state.generation
    ? evidence?.samples.find(sample => sample.generation >= state.generation - 6 && sample.generation < state.generation)
    : undefined;
  const counts = rules.species.map((species, index) => ({
    species,
    count: Array.from(state.guild).reduce((total, alive, cell) => total + (alive && state.ruleSpecies[cell] === index + 1 ? 1 : 0), 0),
  }));
  const familyCount = followed === null ? 0 : Array.from(state.guild).reduce((total, alive, cell) => total + (alive && state.lineage[cell] === followed ? 1 : 0), 0);
  const milestones = evidence ? [
    ...evidence.firstExtinction.map(item => ({ kind: "species" as const, generation: item.generation, text: `Species ${item.speciesId} first observed extinct` })),
    ...evidence.lineageExtinction.map(item => ({ kind: "family" as const, generation: item.generation, text: `Founder lineage #${item.lineage} first observed extinct` })),
  ] : [];
  const latestFor = (kind: "species" | "family") => milestones.filter(item => item.kind === kind).reduce<typeof milestones>((latest, item) => item.generation > (latest[0]?.generation ?? -1) ? [item] : item.generation === latest[0]?.generation ? [...latest, item] : latest, []);
  const latest = [...latestFor("species"), ...latestFor("family")];
  const timing = decision ? ruleTimingLabel(decision, state) : "";

  const speciesKey = <div className="configured-species-counts" aria-label="Configured species counts">
    <strong className={worldName ? "saved-world-heading" : "world-legend-heading"} title={worldName}>{worldName ? `Experiment: ${worldName}` : "World legend"}</strong>
    {counts.map(({ species, count }) => {
      const previous = recentSample?.species.find(item => item.speciesId === species.id);
      const current = latestSample?.species.find(item => item.speciesId === species.id);
      const delta = previous && current?.population === count ? count - previous.population : null;
      const interval = recentSample ? state.generation - recentSample.generation : 0;
      return <span key={species.id} aria-label={`Species ${species.id} count`}><svg className="species-legend-glyph" viewBox="0 0 100 100" aria-hidden="true"><OrganismArtwork role={species.role} color={speciesColor(species.id)} /></svg>{names?.[species.id] ?? species.role} · {species.id} {names?.[species.id] && <small>{species.role}</small>} <b>{count}</b>
        {delta !== null && <span className="species-recent-change" role="img" aria-label={`Species ${species.id} population: ${previous!.population} to ${count}, generations ${recentSample!.generation}–${state.generation}. Recorded change, not a prediction.`} title={`Recorded population change over ${interval} ${interval === 1 ? "generation" : "generations"}; not a prediction or explanation.`}>{delta > 0 ? "↑" : delta < 0 ? "↓" : "→"}{Math.abs(delta)} /{interval}g</span>}
      </span>;
    })}
  </div>;
  const activity = <>
    <section className="recorded-activity" aria-label="Recorded activity">
      <strong>Generation {state.generation}</strong>
      <div>{(["birth", "feeding", "death"] as const).map(kind => {
        const count = state.events.filter(event => event.generation === state.generation && event.kind === kind).length;
        return <span key={kind} className={`activity-${kind}`}><b>{count}</b> {kind}{count === 1 ? "" : "s"}</span>;
      })}</div>
    </section>

    </>;
  const intervention = <div className="intervention-status" aria-label="Intervention status">
      {decision ? <>
        <span>{conciseChangeLabel(decision, state.engineVersion)}</span>
        {timing && <span>{timing}</span>}
        <details aria-label="Policy explanation">
          <summary>Why this policy matters</summary>
          <p>{selectedChangeLabel(decision, state.engineVersion)}</p>
        </details>
      </> : <span>No active decision · inherited rules continue</span>}
      {state.activeRuleChange && <span>Graph change active since generation {state.activeRuleChange.activatedAt}</span>}
    </div>;
  const context = <details className="paused-world-context"><summary aria-label="World activity & species">Activity</summary>{activity}{intervention}</details>;
  const composed = typeof inspection === "function";
  const subject = composed ? inspection(context) : inspection;
  return <section className="gameplay-observation" aria-label="Near-board observations">
    {inspection ? <div className="world-legend-row">{speciesKey}{!composed && context}</div> : speciesKey}
    {subject}
    {!inspection && activity}
    {!inspection && <div className="followed-family-context" aria-live="polite">
      {followed === null ? <span>No founder lineage followed</span> : <span>Following lineage #{followed} · {familyCount ? `${familyCount} living ${familyCount === 1 ? "member" : "members"}` : "No living members"}</span>}
    </div>}
    {latest.length > 0 && <p role="status" aria-label="Latest retained extinction">{latest.map(item => `Generation ${item.generation}: ${item.text}`).join(" · ")}</p>}
    {cameraUpdate && <p role="status" aria-label="Camera update">{cameraUpdate}</p>}
    {inspection&&playerChange}
    {!inspection && (playerChange??intervention)}
  </section>;
}
