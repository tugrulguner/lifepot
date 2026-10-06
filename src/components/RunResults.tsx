import type { ReactNode } from "react";
import type { SimulationState } from "@/game/world";
import { GRID_CELLS } from "@/game/world";
import type { RunEvidence } from "@/game/run-evidence";
import { speciesColor } from "@/game/species-colors";

export type RunResultsProps = {
  state: SimulationState;
  evidence: RunEvidence;
  question: string;
  onEdit: () => void;
  onNew: () => void;
  onReplay: () => void;
  onInspect: () => void;
  children?: ReactNode;
};

const WIDTH = 640;
const HEIGHT = 220;
const PAD = 32;

export function RunResults({ state, evidence, question, onEdit, onNew, onReplay, onInspect, children }: RunResultsProps) {
  const history = evidence.samples;
  const last = history[history.length - 1];
  const empty = state.stats.population === 0;
  const limitReached = state.generation >= 180;
  const max = Math.max(1, ...history.map(sample => Math.max(sample.population, sample.resources / GRID_CELLS)));
  const point = (value: number, index: number) => `${PAD + (history.length < 2 ? 0 : index / (history.length - 1) * (WIDTH - PAD * 2))},${HEIGHT - PAD - value / max * (HEIGHT - PAD * 2)}`;
  const populationPoints = history.map((item, index) => point(item.population, index)).join(" ");
  const resourcePoints = history.map((item, index) => point(item.resources / GRID_CELLS, index)).join(" ");
  const configured = state.config.rules!.species;
  const foundedSpecies = new Set(history[0]?.species.filter(item => item.population > 0).map(item => item.speciesId));
  return <section className="run-results" aria-label="Run results" id="run-results" tabIndex={-1}>
    <header><h2 id="run-results-title">{empty ? "No organisms remain" : "Observation complete"}</h2>
      <p>{empty ? (foundedSpecies.size ? `No organisms remain at generation ${state.generation}.` : "No organisms remain because no species were seeded in this world.") : `Observed through generation ${last?.generation ?? state.generation}: ${last?.population ?? 0} organisms remain.`}</p>
      <p>{empty ? "No organisms remain" : limitReached ? "Reached the 180-generation observation limit" : "Observation stopped before the 180-generation limit."}</p>
      <p>This is a toy model, not biological proof; it is an observation, not a universal survival score.</p>
    </header>
    {question.trim() && <p><strong>Your question:</strong> {question}</p>}
    {last && <ul aria-label="Observed outcomes">
      <li>Peak population: {evidence.peakPopulation}</li>
      {configured.map(rule => <li key={rule.id}>{rule.role} species {rule.id}: {last.species.find(item => item.speciesId === rule.id)?.population ?? 0} at final observation</li>)}
      <li>{last.resources / GRID_CELLS} mean resources per cell; cumulative births: {last.births}; deaths: {last.deaths}; kills: {last.kills}</li>
      {evidence.firstExtinction.map(item => <li key={item.speciesId}>Species {item.speciesId} first observed extinct at generation {item.generation}</li>)}
      {configured.filter(rule => !foundedSpecies.has(rule.id)).map(rule => <li key={`not-seeded-${rule.id}`}>Species {rule.id} ({rule.role}) was not seeded</li>)}
    </ul>}
    <figure className="run-results__trajectory"><figcaption>Whole-run population history</figcaption>
      <svg className="run-results__graph" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Whole-run population history">
        <line className="run-results__axis" x1={PAD} y1={HEIGHT - PAD} x2={WIDTH - PAD} y2={HEIGHT - PAD} />
        <line className="run-results__axis" x1={PAD} y1={PAD} x2={PAD} y2={HEIGHT - PAD} />
        <text x={PAD - 6} y={PAD} textAnchor="end">{max.toFixed(0)}</text><text x={PAD - 6} y={HEIGHT - PAD} textAnchor="end">0</text>
        <polyline className="run-results__population" points={populationPoints} fill="none" />
        <polyline className="run-results__resources" points={resourcePoints} fill="none" />
        <text x={PAD} y={HEIGHT - 8}>Gen {history[0]?.generation ?? 0}</text><text x={WIDTH - PAD} y={HEIGHT - 8} textAnchor="end">Gen {last?.generation ?? 0}</text>
      </svg>
      <ul className="run-results__legend"><li>Population: organisms</li><li>Resources: mean per cell</li></ul>
    </figure>
    <figure className="run-results__trajectory"><figcaption>Whole-run species population history</figcaption>
      <svg className="run-results__graph" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Whole-run species population history">
        <line className="run-results__axis" x1={PAD} y1={HEIGHT - PAD} x2={WIDTH - PAD} y2={HEIGHT - PAD} />
        <text x={PAD - 6} y={PAD} textAnchor="end">{max.toFixed(0)}</text><text x={PAD - 6} y={HEIGHT - PAD} textAnchor="end">0</text>
        {configured.map(rule => <polyline key={rule.id} aria-label={`Species ${rule.id}: ${rule.role}`} stroke={speciesColor(rule.id)} strokeWidth={2.5} points={history.map((item, index) => point(item.species.find(entry => entry.speciesId === rule.id)?.population ?? 0, index)).join(" ")} fill="none" />)}
        <text x={PAD} y={HEIGHT - 8}>Gen {history[0]?.generation ?? 0}</text><text x={WIDTH - PAD} y={HEIGHT - 8} textAnchor="end">Gen {last?.generation ?? 0}</text>
      </svg>
      <ul className="run-results__legend">{configured.map(rule => <li key={rule.id}><span style={{ color: speciesColor(rule.id) }}>●</span> Species {rule.id}: {rule.role}</li>)}</ul>
    </figure>
    <details className="run-results__measurements"><summary>Generation measurements</summary>
      <table><thead><tr><th scope="col">Generation</th><th scope="col">Population</th>{configured.map(rule => <th scope="col" key={rule.id}>{rule.role} {rule.id}</th>)}<th scope="col">Mean resources/cell</th></tr></thead>
        <tbody>{history.map(item => <tr key={item.generation}><th scope="row">{item.generation}</th><td>{item.population}</td>{configured.map(rule => <td key={rule.id}>{item.species.find(entry => entry.speciesId === rule.id)?.population ?? 0}</td>)}<td>{(item.resources / GRID_CELLS).toFixed(2)}</td></tr>)}</tbody></table>
    </details>
    {evidence.ruleEvents.length > 0 && <section aria-label="Observed rule events"><h3>Rule events</h3><ol>{evidence.ruleEvents.map((event, index) => <li key={`${event.kind}-${event.generation}-${index}`}>{event.kind === "activated" ? `Rule change activated at generation ${event.generation} (source generation ${event.sourceGeneration})${event.revertAt === null ? "; no scheduled reversion" : `; scheduled to revert at generation ${event.revertAt}`}` : `Rule change reverted at generation ${event.generation}`}</li>)}</ol></section>}
    <p>Only sampled generations are shown. This cannot establish unobserved events, explain causes, or evaluate free-text predictions.</p>
    {children}
    <nav aria-label="Run actions"><button type="button" onClick={onInspect}>Inspect final world</button><button type="button" onClick={onReplay}>Replay this run</button><button type="button" onClick={onEdit}>Edit this world</button><button type="button" onClick={onNew}>New world</button></nav>
  </section>;
}
