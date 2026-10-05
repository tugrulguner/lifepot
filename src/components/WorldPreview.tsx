"use client";
import { useState } from "react";
import { editWorldPreview, interpretWorldPreview, type WorldEdit } from "@/game/world-preview";
import type { SetupAnswers } from "@/game/setup";
import type { LifeConfig } from "@/game/world";
import { PAIR_INTERACTIONS, TROPHIC_ROLES } from "@/game/rules";
import { relationshipLabel } from "@/game/visuals";
import { speciesColor } from "@/game/species-colors";

export type WorldPreviewProps = { config: LifeConfig; answers: SetupAnswers; onChange: (config: LifeConfig) => void };
const human = (value: string) => value.replaceAll("_", " ");
export default function WorldPreview({ config, answers, onChange }: WorldPreviewProps) {
  const [error, setError] = useState("");
  const [edited, setEdited] = useState(false);
  const preview = interpretWorldPreview(config, answers);
  function update(edit: WorldEdit) { try { const result = editWorldPreview(config, edit); onChange(result.config); setEdited(true); setError(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "This edit is invalid."); } }
  return <section className="world-preview" aria-label="Interpreted world preview">
    <h2>Your world, interpreted</h2>
    <p>{preview.founders}. Each count is the configured starting estimate, not a guarantee about later populations.</p>
    <ul className="world-preview-species" aria-label="Species">{preview.species.map(item => <li key={item.id}><i style={{ background: speciesColor(item.id) }}/><strong>Species {item.id}</strong><span>{human(item.role)} · {item.count} founders</span></li>)}</ul>
    <h3>How species relate</h3><ul>{preview.relationships.map((item) => <li key={item.pair}>{item.description}</li>)}</ul>
    <h3>Conditions</h3><ul>{preview.environment.map((item) => <li key={item}>{item}</li>)}</ul>
    {preview.warnings.map((warning) => <p role="alert" key={warning}>{warning}</p>)}
    <p>{preview.stoppingRule}</p><p>{preview.policyDisclosure}</p>
    {edited && <p>Manually edited from the setup interpretation; this is your configuration, not a new AI confirmation.</p>}
    <details><summary>Edit world conditions</summary>
      {preview.relationships.map((relationship) => <label key={relationship.pair}>{relationship.pair} relationship <select aria-label={`${relationship.pair} relationship`} value={relationship.mode} onChange={(event) => update({ kind: "pair", pair: relationship.pair as import("@/game/rules").SpeciesPair, mode: event.target.value as typeof relationship.mode })}>{PAIR_INTERACTIONS.map((mode) => <option key={mode} value={mode}>{relationshipLabel(relationship.pair, mode)}</option>)}</select></label>)}
      {preview.species.map((species) => <label key={species.id}>Species {species.id} role <select aria-label={`Species ${species.id} role`} value={species.role} onChange={(event) => update({ kind: "role", species: species.id, role: event.target.value as typeof species.role })}>{TROPHIC_ROLES.map((role) => <option key={role} value={role}>{human(role)}</option>)}</select></label>)}
      <label>Resources <select aria-label="Resource abundance" value={config.environment.abundance} onChange={(event) => update({ kind: "abundance", value: event.target.value as LifeConfig["environment"]["abundance"] })}>{["scarce","balanced","rich"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label>Resource distribution <select aria-label="Resource distribution" value={config.environment.distribution} onChange={(event) => update({ kind: "distribution", value: event.target.value as LifeConfig["environment"]["distribution"] })}>{["clustered","scattered","seasonal"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label>Rule pressure <select aria-label="Environment pressure" value={config.rules?.environment.pressure ?? "stability"} onChange={(event) => update({ kind: "pressure", value: event.target.value as NonNullable<LifeConfig["rules"]>["environment"]["pressure"] })}>{["stability","drought","toxin_wave","heat_wave","fragmentation","nutrient_bloom"].map((value) => <option key={value} value={value}>{human(value)}</option>)}</select></label>
      <label>Pressure intensity <select aria-label="Pressure intensity" value={config.rules?.environment.intensity ?? "medium"} onChange={(event) => update({ kind: "intensity", value: event.target.value as NonNullable<LifeConfig["rules"]>["environment"]["intensity"] })}>{["low","medium","high"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label>Resource regeneration <select aria-label="Resource regeneration" value={config.rules?.environment.regeneration ?? "steady"} onChange={(event) => update({ kind: "regeneration", value: event.target.value as NonNullable<LifeConfig["rules"]>["environment"]["regeneration"] })}>{["steady","pulsed","depletion_feedback"].map((value) => <option key={value} value={value}>{human(value)}</option>)}</select></label>
      <label>Initial balance <select aria-label="Initial abundance balance" value={config.founders.balance} onChange={(event) => update({ kind: "balance", value: event.target.value as LifeConfig["founders"]["balance"] })}>{["prey_heavy","balanced","predator_heavy"].map((value) => <option key={value} value={value}>{human(value)}</option>)}</select></label>
      {error && <p role="alert">Edit not applied: {error}</p>}
    </details>
  </section>;
}
