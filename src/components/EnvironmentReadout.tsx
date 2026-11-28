import type { SimulationState } from "@/game/world";
import { resourceFieldColor } from "@/game/microscopic-renderer";
import styles from "./EnvironmentReadout.module.css";

const interval = 6;
const format = (n: number) => n.toLocaleString("en-US");
const rgb = (value: number) => `rgb(${resourceFieldColor(value).join(" ")})`;

type FoodSelection = { index: number; generation: number; food: number } | null;
type FoodTracker = { active: boolean; selection: FoodSelection; current: number | null; delta: number | null; toggle: () => void };
export function EnvironmentReadout({ state, showHazards, placement = "phone", trackFood }: { state: SimulationState; showHazards: boolean; placement?: "beside" | "phone"; trackFood?: FoodTracker }) {
  const end = state.outcome === "running" ? state.generation - state.generation % interval : state.generation;
  const start = Math.max(0, Math.floor((end - 1) / interval) * interval);
  const before = state.history.find(frame => frame.generation === start);
  const after = state.history.find(frame => frame.generation === end);
  let summary = "Waiting for two recorded food measurements.";
  if (before && after && start < end) {
    const change = after.resources - before.resources;
    const trend = change === 0 ? "the same at both readings" : `${change > 0 ? "up" : "down"} ${format(Math.abs(change))} units`;
    summary = `World food: ${trend} · Last interval: Gen ${start}–${end}`;
  }
  return <aside className={`${styles.readout} ${styles[placement]}`} role="note" aria-label="Habitat readout">
    <strong>{summary}</strong>
    <div className={styles.key} aria-label="Habitat visual key">
      <span className={styles.keyTitle}>Food {trackFood && <button type="button" aria-label="Track food patch" aria-pressed={trackFood.active} title="Enable tracking, then click a cell or use arrow keys; Enter selects the current cell." onClick={trackFood.toggle}>Track</button>}</span>
      {trackFood?.active && <span className={styles.tracker}><small>Click a food cell, or use arrow keys and Enter to select. Movement wraps at the board edges.</small>{trackFood.selection && trackFood.current !== null && trackFood.delta !== null && <output aria-label="Tracked food patch">Cell {trackFood.selection.index % 50 + 1}, {Math.floor(trackFood.selection.index / 50) + 1} · Since selection (Gen {trackFood.selection.generation}): {trackFood.delta > 0 ? "up" : trackFood.delta < 0 ? "down" : "unchanged"} {format(Math.abs(trackFood.delta))} units · Now (Gen {state.generation}): {format(trackFood.current)}</output>}</span>}
      <span className={styles.foodScale} aria-hidden="true"><i style={{ backgroundColor: rgb(0) }} /><i style={{ backgroundColor: rgb(64) }} /><i style={{ backgroundColor: rgb(128) }} /><i style={{ backgroundColor: rgb(192) }} /><i style={{ backgroundColor: rgb(255) }} /></span>
      <span className={styles.scaleLabels}><span>Low</span><span>Rich</span></span>
    </div>
    <details><summary>Why does food vary?</summary>
      <span>Possible mechanism, not measured here: food can regrow each generation and organisms can consume it when feeding.</span>
      <div className={styles.keyExplanation}>Pale warm sediment → green beds; greener patches contain more food.</div>
      <div className={styles.hazardKey}><i aria-hidden="true" /> Hazard · coral hatching {showHazards ? "shown" : "off"}</div>
    </details>
  </aside>;
}
