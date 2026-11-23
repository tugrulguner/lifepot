"use client";
import { useEffect, useRef, useState } from "react";
import type { RunEvidence } from "@/game/run-evidence";
import type { LifeConfig } from "@/game/world";
import { validateReflection, type RunReflection } from "@/game/run-reflection";
import { conditionLabel, conditionValue } from "@/game/condition-labels";
import { describeEvidenceReference } from "@/game/run-journey";
import type { SpeciesId } from "@/game/rules";
import styles from "./ObservedHistory.module.css";
type Input = { evidence: RunEvidence; config: LifeConfig };
type Settled<T> = Input & { value: T };
export function RunReflectionPanel({ evidence, config, onExperiment, onInspectReference, speciesNames = {} }: { evidence: RunEvidence; config: LifeConfig; onExperiment: (experiment: RunReflection["nextExperiment"]) => void; onInspectReference?: (reference: string) => void; speciesNames?: Partial<Record<SpeciesId, string>> }) {
 const [result, setResult] = useState<Settled<RunReflection> | null>(null), [busy, setBusy] = useState<Input | null>(null), [failure, setFailure] = useState<Settled<string> | null>(null);
 const requests = useRef({ counter: 0 });
 useEffect(() => {
  const activeRequests = requests.current;
  return () => { activeRequests.counter++; };
 }, [evidence, config]);
 const isCurrent = <T,>(entry: Settled<T> | null): entry is Settled<T> => entry?.evidence === evidence && entry.config === config;
 const isBusy = busy?.evidence === evidence && busy.config === config;
 async function ask() {
  const token = ++requests.current.counter; setBusy({ evidence, config }); setFailure(null); setResult(null);
  const isActive = () => requests.current.counter === token;
  try {
   const response = await fetch("/api/reflect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ evidence, config }) });
   if (response.status === 429) throw new Error("rate_limited");
   if (!response.ok) throw new Error("unavailable");
   const reflection = validateReflection(await response.json(), evidence, config);
   if (isActive()) setResult({ evidence, config, value: reflection });
  } catch (error) {
   if (isActive()) setFailure({ evidence, config, value: `${error instanceof Error && error.message === "rate_limited" ? "Rate limit reached. Wait a minute before asking again." : "Jev reflection unavailable."} Your recorded results remain available; no explanation or recommendation was substituted.` });
  } finally { if (isActive()) setBusy(null); }
 }
 const references = (refs: string[], context: string) => <ul className={`${styles.references} evidence-references`} aria-label={`Recorded evidence for ${context}`}>{refs.map(reference => {
  const fact = describeEvidenceReference(reference, evidence, config, speciesNames);
  return <li key={reference}><span>{fact?.description ?? "Matching recorded evidence is unavailable."}</span>{onInspectReference && fact?.generation !== undefined && <button type="button" onClick={() => onInspectReference(reference)}>Inspect recorded evidence</button>}</li>;
 })}</ul>;
 const reflection = isCurrent(result) ? result.value : null;
 return <section className={`${styles.panel} run-reflection`} aria-label="Jev run reflection"><h3>What is worth exploring next?</h3>
  <p>Ask Jev to select recorded turning points and a supported next experiment. Your private question stays in this browser. Recommendations do not change the world until you review and seed it.</p>
  <button type="button" disabled={isBusy} onClick={ask}>{isBusy ? "Jev is reviewing the evidence…" : "Ask Jev about this run"}</button>
  {isCurrent(failure) && <p role="status">{failure.value}</p>}
  {reflection && <>{reflection.metadata && <p>Jev-selected evidence and experiment · {reflection.metadata.model ?? "model not supplied"}{reflection.metadata.usage ? ` · ${reflection.metadata.usage.input_tokens} input / ${reflection.metadata.usage.output_tokens} output tokens` : ""}. The measured facts below come from the engine, not generated measurements.</p>}
   <ul>{reflection.observations.map((item, index) => <li key={index}><p>{item.text}</p>{references(item.evidenceRefs, `observation ${index + 1}`)}</li>)}</ul>
   <h4>{reflection.nextExperiment.title}</h4><p>{reflection.nextExperiment.rationale}</p>{references(reflection.nextExperiment.evidenceRefs, "next experiment")}
   <ul>{reflection.nextExperiment.changes.map(change => <li key={change.path}>{conditionLabel(change.path)}: {conditionValue(change.path, change.value)}</li>)}</ul>
   <p>{reflection.caveat}</p><button type="button" onClick={() => onExperiment(reflection.nextExperiment)}>Review suggested experiment</button>
  </>}
 </section>;
}
