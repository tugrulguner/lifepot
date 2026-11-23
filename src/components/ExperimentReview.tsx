"use client";
import { useState } from "react";
import type { LifeConfig } from "@/game/world";
import { editWorldPreview, type WorldEdit } from "@/game/world-preview";
import { buildRunComparison } from "@/game/run-reflection";
import { describeEvidenceReference } from "@/game/run-journey";
import { conditionLabel, conditionValue } from "@/game/condition-labels";
import type { RunEvidence } from "@/game/run-evidence";
import type { RecordedMoment } from "@/game/recorded-moments";
import styles from "./ObservedHistory.module.css";
export type ExperimentReference = { config: LifeConfig; evidence: RunEvidence; seed: number; policy: "fixed" | "adaptive" | "recorded"; focus?: RecordedMoment; question?: string };
type Props = { reference: ExperimentReference; config: LifeConfig; seed: number; policy: "fixed" | "adaptive"; onChange: (config: LifeConfig) => void };
const fields = {
 abundance: { path: "environment.abundance", label: "Resource abundance", values: ["scarce", "balanced", "rich"] },
 pressure: { path: "rules.environment.pressure", label: "Rule pressure", values: ["stability", "drought", "toxin_wave", "heat_wave", "fragmentation", "nutrient_bloom"] },
 regeneration: { path: "rules.environment.regeneration", label: "Resource regeneration", values: ["steady", "pulsed", "depletion_feedback"] },
 intensity: { path: "rules.environment.intensity", label: "Pressure intensity", values: ["low", "medium", "high"] },
} as const;
export function ExperimentReview({ reference, config, seed, policy, onChange }: Props) {
 const [field, setField] = useState<keyof typeof fields>("abundance"), [error, setError] = useState("");
 const descriptor = fields[field], current = descriptor.path.split(".").reduce((value, key) => value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined, config as unknown);
 const focusDescription = reference.focus ? describeEvidenceReference(reference.focus.reference, reference.evidence, reference.config)?.description ?? reference.focus.description : undefined;
 const changes = buildRunComparison(reference, { evidence: reference.evidence, config }).conditionChanges;
 const update = (value: string) => {
  if (!descriptor.values.some(allowed => allowed === value)) { setError("Unsupported value; no change applied."); return; }
  if (value === current) return;
  try { onChange(editWorldPreview(config, { kind: field, value } as WorldEdit).config); setError(""); }
  catch { setError("This condition could not be changed. No new world was seeded."); }
 };
 return <section className={`${styles.panel} experiment-review`} aria-label="Review your next experiment">
  <h2>Review your next experiment</h2>
  {focusDescription && <p className={styles.focus}>{focusDescription}</p>}
  {reference.question && <p>Earlier question: {reference.question}</p>}
  <p>This is a new trial from initial conditions, not a continuation or a guaranteed rescue. Choose a condition to investigate; nothing is seeded until you confirm below.</p>
  <div className={styles.choices}>
   <label>Condition to explore<select aria-label="Condition to explore" value={field} onChange={event => { if (Object.hasOwn(fields, event.target.value)) setField(event.target.value as keyof typeof fields); }}>{Object.entries(fields).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label>
   <label>Value to review<select aria-label="Value to review" value={String(current ?? "")} onChange={event => update(event.target.value)}>{descriptor.values.map(value => <option key={value} value={value}>{conditionValue(descriptor.path, value)}</option>)}</select></label>
  </div>
  <ul aria-label="Reviewed condition changes">{changes.length ? changes.map(change => <li key={change.path}>{conditionLabel(change.path)}: {conditionValue(change.path, change.before)} → {conditionValue(change.path, change.after)}</li>) : <li>No condition changed yet. Seeding unchanged conditions repeats the initial setup.</li>}</ul>
  <p>{seed === reference.seed ? `Same initial seed: ${seed}.` : "The seed differs from the reference; initial random states are not controlled."} {reference.policy === "fixed" && policy === "fixed" ? "Both trials use fixed initial rules; no runtime AI interventions." : "Adaptive or recorded policies can differ; temporal sequence is not proof of cause."}</p>
  {changes.length > 1 && <p>Multiple conditions changed: this is exploratory, not a single-condition comparison.</p>}
  {error && <p role="alert">{error}</p>}
 </section>;
}
