import type { RunEvidence } from "@/game/run-evidence";
import type { EvolutionDecision } from "@/game/decisions";
import type { SimulationState } from "@/game/world";
import { ruleTimingLabel, selectedChangeLabel } from "@/game/council-display";
import { speciesColor } from "@/game/species-colors";

export function GameplayObservation({ state, evidence, followed, decision, names }: { state: SimulationState; evidence: RunEvidence | null; followed: number | null; decision: EvolutionDecision | null; names?: Readonly<Record<string, string>> }) {
  const rules = state.config.rules!;
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
  const change = decision?.scheduledRuleChange;
  const timing = decision ? ruleTimingLabel(decision, state) : "";

  return <section className="gameplay-observation" aria-label="Near-board observations">
    <section className="recorded-activity" aria-label="Recorded activity">
      <strong>Generation {state.generation}</strong>
      <div>{(["birth", "feeding", "death"] as const).map(kind => {
        const count = state.events.filter(event => event.generation === state.generation && event.kind === kind).length;
        return <span key={kind} className={`activity-${kind}`}><b>{count}</b> {kind}{count === 1 ? "" : "s"}</span>;
      })}</div>
    </section>
    <div className="configured-species-counts" aria-label="Configured species counts">
      <strong>Configured species</strong>
      {counts.map(({ species, count }) => <span key={species.id} aria-label={`Species ${species.id} count`}><i className="species-color" style={{ backgroundColor: speciesColor(species.id) }} />{names?.[species.id] ?? species.role} · {species.id} <b>{count}</b></span>)}
    </div>
    <div className="followed-family-context" aria-live="polite">
      {followed === null ? <span>No founder lineage followed</span> : <span>Following lineage #{followed} · {familyCount ? `${familyCount} living ${familyCount === 1 ? "member" : "members"}` : "No living members"}</span>}
    </div>
    {latest.length > 0 && <p role="status" aria-label="Latest retained extinction">{latest.map(item => `Generation ${item.generation}: ${item.text}`).join(" · ")}</p>}
    <div className="intervention-status" aria-label="Intervention status">
      {decision ? <>
        <span>{change ? "Proposed graph change" : decision.speciesDirectives?.length ? "Birth policies" : "Intervention"}: {selectedChangeLabel(decision)}</span>
        <span>{timing || (decision.source === "fallback" ? "No intervention; inherited policies continue" : "Decision recorded; no graph patch selected")}</span>
      </> : <span>No active decision · inherited rules continue</span>}
      {state.activeRuleChange && <span>Graph change active since generation {state.activeRuleChange.activatedAt}</span>}
    </div>
  </section>;
}
