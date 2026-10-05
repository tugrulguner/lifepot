"use client";
import { buildWorldReport } from "@/game/observatory";
import type { SimulationState } from "@/game/world";
import type { SpeciesId } from "@/game/rules";
import { speciesColor } from "@/game/species-colors";
import { relationshipLabel } from "@/game/visuals";

export function SpeciesFocus({ state, selected, onSelect }: { state: SimulationState; selected: SpeciesId | null; onSelect: (id: SpeciesId | null) => void }) {
  const report = buildWorldReport(state, []);
  const focused = report.species.find(row => row.id === selected);
  const edges = state.config.rules!.interactions.filter(edge => edge.pair.split(":").includes(selected ?? ""));
  return <section className="species-focus" aria-label="Species focus">
    <div className="species-focus-buttons">
      <button aria-pressed={!selected} onClick={() => onSelect(null)}>All life</button>
      {report.species.map(row => <button key={row.id} aria-label={`Focus species ${row.id}`} aria-pressed={selected === row.id} onClick={() => onSelect(row.id as SpeciesId)}><i style={{ background: speciesColor(row.id) }}/>{row.id} · {row.population}</button>)}
    </div>
    {focused ? <div className="species-focus-description"><strong>Species {focused.id} · {focused.role} · {focused.population} alive</strong><p>{edges.map(edge => relationshipLabel(edge.pair, edge.mode)).join(" · ")}. {focused.population ? `${focused.lineages} living founder lineages. Select a highlighted organism to inspect its energy and recent feeding.` : "No organisms of this species remain. Extinct species are not automatically restored."}</p></div> : <p>Choose a species to highlight its organisms and relationships. Tap a creature to pause and inspect; step through one generation at a time.</p>}
  </section>;
}
