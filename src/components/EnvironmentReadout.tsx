import type { SimulationState } from "@/game/world";
import styles from "./EnvironmentReadout.module.css";

const interval = 6;
const format = (n: number) => n.toLocaleString("en-US");

export function EnvironmentReadout({ state, showHazards, placement = "compact" }: { state: SimulationState; showHazards: boolean; placement?: "beside" | "compact" }) {
  // Hold a completed comparison still long enough to read at normal speed.
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
    <span>More green grain means more food in that patch. {showHazards ? "Coral stripes mark local hazards." : "Hazard stripes are off."}</span>
  </aside>;
}
