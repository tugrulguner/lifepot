import type { SimulationState } from "@/game/world";
import { inspectCell, lineageCells } from "@/game/inspection";
import { speciesColor } from "@/game/species-colors";

import type { RunEvidence } from "@/game/run-evidence";

type Props = { evidence?: RunEvidence | null; state: SimulationState; index: number | null; followed: number | null; onFollow: (lineage: number | null) => void; onClear: () => void; onPick: () => void };
export function CreatureInspector({ state, evidence, index, followed, onFollow, onClear, onPick }: Props) {
  const cell = index === null ? null : inspectCell(state, index);
  const living = lineageCells(state, followed);
  const family = cell?.occupied ? lineageCells(state, cell.lineage) : [];
  return <section id="creature-inspector" className="creature-inspector" aria-label="Creature inspector">
    <header><div><p className="eyebrow">FIELD NOTES</p><h2>Meet an organism</h2></div><button onClick={onPick}>Inspect a living organism</button></header>
    {evidence && <section className="extinction-milestones" aria-label="Observed extinction milestones" aria-live="polite" aria-relevant="additions">
      {(evidence.firstExtinction.length > 0 || evidence.lineageExtinction.length > 0) && <><h3>Observed extinction milestones</h3>
      <ul>
        {evidence.firstExtinction.map(item => <li key={`species-${item.speciesId}`}>Species {item.speciesId} first observed extinct at generation {item.generation}</li>)}
        {evidence.lineageExtinction.map(item => <li key={`lineage-${item.lineage}`}>Founder lineage #{item.lineage} first observed extinct at generation {item.generation}</li>)}
      </ul></>}
    </section>}
    {!cell ? <p>Tap a creature to pause and inspect it. Pin its founder lineage, then resume to watch its family spread or disappear. Resuming clears the cell inspection; your lineage pin stays.</p> : <>
      {cell.occupied && <div className="organism-portrait">
        <svg viewBox="0 0 100 100" role="img" aria-label={`${cell.species?.role ?? "unknown"} role symbol`}>
          <circle cx="50" cy="50" r="44" fill="none" stroke={followed === cell.lineage ? "#ffd36a" : "#496b57"} strokeDasharray={followed === cell.lineage ? "5 4" : undefined}/>
          <g fill={speciesColor(cell.species?.id ?? "")} stroke="#f1f8ed" strokeWidth="2" strokeLinejoin="round">
            {cell.species?.role === "hunter" ? <path d="M84 50 Q54 29 18 35 Q26 50 18 65 Q54 71 84 50Z"/> : cell.species?.role === "producer" ? <path d="M50 12 Q72 20 68 38 Q90 42 82 60 Q73 77 57 65 Q50 90 38 74 Q22 81 18 62 Q13 43 34 38 Q28 20 50 12Z"/> : cell.species?.role === "omnivore" ? <path d="M50 15 C68 15 72 30 68 39 C84 30 94 43 84 57 C78 69 66 66 60 61 C66 80 50 91 39 77 C30 68 36 58 40 52 C21 63 9 49 20 36 C29 24 40 33 45 38 C39 20 50 15 50 15Z"/> : cell.species?.role === "scavenger" ? <path d="M18 34H68 A16 16 0 0 1 68 66H18 A16 16 0 0 1 18 34Z"/> : <ellipse cx="50" cy="50" rx="39" ry="29"/>}
          </g>
        </svg>
        <div><strong>Organism #{state.organismId[index!]}</strong><p>Symbol shows feeding role, not biological anatomy.</p><meter aria-label="Organism energy" min={0} max={255} value={cell.energy}/></div>
      </div>}
      {cell.occupied && <section className="organism-family-summary" aria-label="Organism and family summary"><strong>Species {cell.species?.id ?? "?"} · {cell.species?.role ?? "unknown role"} · founder lineage #{cell.lineage}</strong><span>Energy {cell.energy.toFixed(1)} / 255 · Age {cell.age} ticks</span><span>{family.length} living family {family.length === 1 ? "member" : "members"}</span></section>}
      <h3>{cell.occupied ? `Species ${cell.species?.id ?? "?"} · ${cell.species?.role ?? "unknown role"}` : "Empty cell"} <small>({index! % 50}, {Math.floor(index! / 50)})</small></h3>
      {cell.occupied && <button onClick={() => onFollow(cell.lineage)}>Follow founder lineage #{cell.lineage}</button>}
      <details className="organism-details" key={state.organismId[index!] || `empty-${index}`}>
      <summary>Detailed organism inspection</summary>
      {cell.occupied ? <>
        <dl className="creature-facts"><div><dt>Organism</dt><dd>#{state.organismId[index!]}</dd></div><div><dt>Parent</dt><dd>{state.parentId[index!] ? `#${state.parentId[index!]}` : "Founder"}</dd></div><div><dt>Energy</dt><dd>{cell.energy.toFixed(1)} / 255</dd></div><div><dt>Age</dt><dd>{cell.age} ticks</dd></div><div><dt>Inherited generation</dt><dd>{cell.generation} · founders = 0</dd></div><div><dt>Founder lineage</dt><dd>#{cell.lineage}</dd></div><div><dt>Diet allowed by graph</dt><dd>{cell.diet.join("; ") || "No feeding path"}</dd></div><div><dt>Inherited strategy</dt><dd>{cell.strategy.replaceAll("_", " ")}</dd></div><div><dt>Within-species rule</dt><dd>{cell.species?.selfInteraction}</dd></div><div><dt>Heritable variant</dt><dd>#{cell.variant} · not a new species</dd></div></dl>
        <div className="creature-traits">{cell.traits.map(trait => <label key={trait.label}>{trait.label}<meter min={0} max={255} value={trait.value}/><span>{trait.value}</span></label>)}</div>
      </> : <p>No organism at this position. An empty cell alone does not tell us whether its former occupant moved or died.</p>}
      <p>Observed this tick: {state.events.filter(e=>e.organismId===state.organismId[index!]).map(e=>`${e.kind}${e.source ? ` (${e.source})` : ""}: ${e.energy.toFixed(1)} energy`).join("; ") || "No recorded feeding or birth"}</p>
      <p>Local nutrients: {cell.resources} / 255 · local hazard: {cell.hazard} / 255</p>
      </details>
      <button onClick={onClear}>Clear inspection</button>
    </>}
    {followed !== null && <div className="lineage-follow" role="status"><strong>Following founder lineage #{followed}</strong><p>{living.length ? `${living.length} living family members highlighted in gold (including any surviving founder).` : "No living family members remain. This lineage is extinct; it will not be restored."}</p><button onClick={() => onFollow(null)}>Stop following</button></div>}
    <p className="inspection-note">Traits are inherited engine values on a 0–255 scale, not measured biological units. Species are graph roles; variants are bounded heritable trait changes.</p>
  </section>;
}
