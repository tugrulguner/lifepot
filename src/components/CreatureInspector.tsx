import type { SimulationState } from "@/game/world";
import { inspectCell, lineageCells } from "@/game/inspection";

type Props = { state: SimulationState; index: number | null; followed: number | null; onFollow: (lineage: number | null) => void; onClear: () => void; onPick: () => void };
export function CreatureInspector({ state, index, followed, onFollow, onClear, onPick }: Props) {
  const cell = index === null ? null : inspectCell(state, index);
  const living = lineageCells(state, followed);
  return <section className="creature-inspector" aria-label="Creature inspector">
    <header><div><p className="eyebrow">FIELD NOTES</p><h2>Meet an organism</h2></div><button onClick={onPick}>Inspect a living organism</button></header>
    {!cell ? <p>Tap a creature to pause and inspect it. Pin its founder lineage, then resume to watch its family spread or disappear. Resuming clears the cell inspection; your lineage pin stays.</p> : <>
      <h3>{cell.occupied ? `Species ${cell.species?.id ?? "?"} · ${cell.species?.role ?? "unknown role"}` : "Empty cell"} <small>({index! % 50}, {Math.floor(index! / 50)})</small></h3>
      {cell.occupied ? <>
        <dl className="creature-facts"><div><dt>Organism</dt><dd>#{state.organismId[index!]}</dd></div><div><dt>Parent</dt><dd>{state.parentId[index!] ? `#${state.parentId[index!]}` : "Founder"}</dd></div><div><dt>Energy</dt><dd>{cell.energy.toFixed(1)} / 255</dd></div><div><dt>Age</dt><dd>{cell.age} ticks</dd></div><div><dt>Inherited generation</dt><dd>{cell.generation} · founders = 0</dd></div><div><dt>Founder lineage</dt><dd>#{cell.lineage}</dd></div><div><dt>Diet allowed by graph</dt><dd>{cell.diet.join("; ") || "No feeding path"}</dd></div><div><dt>Inherited strategy</dt><dd>{cell.strategy.replaceAll("_", " ")}</dd></div><div><dt>Within-species rule</dt><dd>{cell.species?.selfInteraction}</dd></div><div><dt>Heritable variant</dt><dd>#{cell.variant} · not a new species</dd></div></dl>
        <div className="creature-traits">{cell.traits.map(trait => <label key={trait.label}>{trait.label}<meter min={0} max={255} value={trait.value}/><span>{trait.value}</span></label>)}</div>
        <button onClick={() => onFollow(cell.lineage)}>Follow founder lineage #{cell.lineage}</button>
      </> : <p>No organism at this position. An empty cell alone does not tell us whether its former occupant moved or died.</p>}
      <p>Observed this tick: {state.events.filter(e=>e.organismId===state.organismId[index!]).map(e=>`${e.kind}${e.source ? ` (${e.source})` : ""}: ${e.energy.toFixed(1)} energy`).join("; ") || "No recorded feeding or birth"}</p>
      <p>Local nutrients: {cell.resources} / 255 · local hazard: {cell.hazard} / 255</p>
      <button onClick={onClear}>Clear inspection</button>
    </>}
    {followed !== null && <div className="lineage-follow" role="status"><strong>Following founder lineage #{followed}</strong><p>{living.length ? `${living.length} living family members highlighted in gold (including any surviving founder).` : "No living family members remain. This lineage is extinct; it will not be restored."}</p><button onClick={() => onFollow(null)}>Stop following</button></div>}
    <p className="inspection-note">Traits are inherited engine values on a 0–255 scale, not measured biological units. Species are graph roles; variants are bounded heritable trait changes.</p>
  </section>;
}
