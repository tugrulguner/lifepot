import type { SimulationState } from "@/game/world";
import { inspectCell, lineageCells } from "@/game/inspection";
import OrganismArtwork from "./OrganismArtwork";
import { speciesColor } from "@/game/species-colors";

type Props = {
  state: SimulationState;
  index: number;
  followed: number | null;
  onFollow: (lineage: number) => void;
  onDetails: () => void;
};

// This is the paused cell's actual evidence, not a second simulation or a pet model.
export function WatchingOrganism({ state, index, followed, onFollow, onDetails }: Props) {
  const cell = inspectCell(state, index);
  const family = cell.occupied ? lineageCells(state, cell.lineage).length : 0;
  return <section className="watching-organism" aria-label="Watching organism">
    <div className="watching-organism-subject">
      {cell.occupied && <svg viewBox="0 0 100 100" aria-hidden="true">
        <OrganismArtwork role={cell.species?.role} color={speciesColor(cell.species?.id ?? "")} />
      </svg>}
      <div>
        <strong>{cell.occupied ? `Species ${cell.species?.id ?? "?"} · ${cell.species?.role ?? "organism"}` : "Empty cell"}</strong>
        {cell.occupied ? <>
          <span>Organism #{state.organismId[index]} · Energy {cell.energy.toFixed(1)} · Age {cell.age}</span>
          <span aria-live="polite">{followed === cell.lineage ? "Following lineage" : "Family"} #{cell.lineage} · {family} living {family === 1 ? "member" : "members"}{followed !== null && followed !== cell.lineage ? ` · Following lineage #${followed}: ${lineageCells(state, followed).length} living` : ""}</span>
        </> : <><span>Resources {cell.resources} / 255 · Hazard {cell.hazard} / 255</span>{followed !== null && <span>Following lineage #{followed} · {lineageCells(state, followed).length} living</span>}</>}
      </div>
    </div>
    <div className="watching-organism-actions">
      {cell.occupied && <button aria-pressed={followed === cell.lineage} onClick={() => onFollow(cell.lineage)}>Pin this family</button>}
      <button onClick={onDetails}>More organism details</button>
    </div>
  </section>;
}
