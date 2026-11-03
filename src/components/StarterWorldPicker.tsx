"use client";

import { useMemo, useState } from "react";
import { createSimulation, GRID_SIZE } from "@/game/world";
import { createStarterWorld, STARTER_WORLDS, type StarterId, type StarterWorld } from "@/game/starter-worlds";
import { speciesColor } from "@/game/species-colors";
import OrganismArtwork from "./OrganismArtwork";
import styles from "./StarterWorldPicker.module.css";

type Props = {
  customMode?: boolean;
  onChoose: (world: StarterWorld) => void;
  onDescribeOwn: () => void;
  onReturnToStarters?: () => void;
};

function relationshipName(mode: string): string {
  return mode.split("_").map((word) => word === "a" || word === "b" ? word.toUpperCase() : word).join(" ").replace(/^./, (letter) => letter.toUpperCase());
}

export default function StarterWorldPicker({ customMode = false, onChoose, onDescribeOwn, onReturnToStarters }: Props) {
  const [selectedId, setSelectedId] = useState<StarterId>("resource-competition");
  const selected = useMemo(() => createStarterWorld(selectedId), [selectedId]);
  const simulation = useMemo(() => createSimulation({ seed: selected.seed, config: selected.config }), [selected]);
  const populationBySpecies = selected.config.rules!.species.map((species, slot) => ({
    species,
    population: simulation.ruleSpecies.reduce((count, ruleSpecies, index) => count + (simulation.guild[index] && ruleSpecies === slot + 1 ? 1 : 0), 0),
  }));
  const relation = selected.config.rules!.interactions[0];
  const resourceMean = Math.round(simulation.stats.resources / simulation.resources.length);
  const resourceCells = Array.from(simulation.resources, (value, index) => ({ value, index })).filter(({ value }) => value > 20);
  const hazardCells = Array.from(simulation.hazards, (value, index) => ({ value, index })).filter(({ value }) => value > 16);
  const organisms = Array.from(simulation.guild).flatMap((alive, index) => {
    if (!alive) return [];
    const species = selected.config.rules!.species[simulation.ruleSpecies[index] - 1];
    return [{ index, role: species?.role, color: speciesColor(species?.id ?? "") }];
  });

  function select(id: StarterId) {
    setSelectedId(id);
  }

  return (
    <section className={styles.picker} aria-labelledby="starter-world-heading">
      <p className={styles.eyebrow}>Start with a designed ecology</p>
      <h2 id="starter-world-heading">Choose a living world</h2>
      <p className={styles.boundary}>Explore authored starting conditions without AI calls. Review or edit the ecology before starting your run.</p>
      {customMode ? <button type="button" className={styles.secondary} onClick={onReturnToStarters}>Back to starter worlds</button> : <>
        <div className={styles.habitat}>
          <svg className={styles.canvas} role="img" aria-label={`Starter habitat preview: ${selected.title}`} data-starter-id={selected.id} viewBox="0 0 500 500">
            <rect width="500" height="500" fill="var(--mp-canvas)" />
            {resourceCells.map(({ value, index }) => <circle key={`resource-${index}`} cx={(index % GRID_SIZE + .5) * 10} cy={(Math.floor(index / GRID_SIZE) + .5) * 10} r={.6 + value / 255} fill="#71ca8b" opacity={.2 + value / 255 * .5} />)}
            {hazardCells.map(({ value, index }) => <rect key={`hazard-${index}`} x={index % GRID_SIZE * 10} y={Math.floor(index / GRID_SIZE) * 10} width="10" height="10" fill="#ee856b" opacity={.06 + value / 255 * .22} />)}
            {organisms.map(({ index, role, color }) => <svg key={`organism-${index}`} x={(index % GRID_SIZE + .12) * 10} y={(Math.floor(index / GRID_SIZE) + .12) * 10} width="7.6" height="7.6" viewBox="0 0 100 100" aria-hidden="true"><OrganismArtwork role={role} color={color} /></svg>)}
          </svg>
          <details className={styles.summary} aria-label={`${selected.title} habitat summary`}>
            <summary><strong>Generation 0 · {simulation.stats.population} organisms</strong> · details</summary>
            <p>Starting population: {simulation.stats.population} organisms · mean resources: {resourceMean} units per cell</p>
            <p>Resources: {selected.config.environment.abundance}, {selected.config.environment.distribution}; pressure: {selected.config.rules!.environment.pressure}</p>
            {relation && <p>Relationship: {relationshipName(relation.mode)}</p>}
            <ul aria-label="Starter species populations">{populationBySpecies.map(({ species, population }) => <li key={species.id}>Species {species.id} · {species.role}: {population}</li>)}</ul>
          </details>
        </div>
        <p className={styles.question}>Explore question: {selectedWorldQuestion(selected.id)}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => onChoose(selected)}>Review this world</button>
          <button type="button" className={styles.secondary} onClick={onDescribeOwn}>Describe your own world</button>
        </div>
      </>}
      <div className={styles.choices} aria-label="Starter worlds">
        {STARTER_WORLDS.map((world) => (
          <button key={world.id} type="button" aria-label={`Preview ${world.id === "resource-competition" ? "Resource competition" : world.id === "hunters-and-prey" ? "Hunters and prey" : "Recurring scarcity"}`} className={styles.choice} aria-pressed={selected.id === world.id} onClick={() => select(world.id)}>
            <strong>{world.title}</strong><span>{world.description}</span>
            <span className={styles.previewAction}>Preview {world.id === "resource-competition" ? "Resource competition" : world.id === "hunters-and-prey" ? "Hunters and prey" : "Recurring scarcity"}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function selectedWorldQuestion(id: StarterId) {
  return STARTER_WORLDS.find((world) => world.id === id)!.question;
}

