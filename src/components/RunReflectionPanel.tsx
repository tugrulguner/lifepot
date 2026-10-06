"use client";
import { useEffect, useRef, useState } from "react";
import type { RunEvidence } from "@/game/run-evidence";
import type { LifeConfig } from "@/game/world";
import { validateReflection, type RunReflection } from "@/game/run-reflection";
import { conditionLabel, conditionValue } from "@/game/condition-labels";
export function RunReflectionPanel({evidence,config,onExperiment}:{evidence:RunEvidence;config:LifeConfig;onExperiment:(experiment:RunReflection["nextExperiment"])=>void}) {
 const [result,setResult]=useState<RunReflection|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const request=useRef(0);
 useEffect(()=>()=>{request.current++;},[evidence,config]);
 async function ask(){const token=++request.current;setBusy(true);setError("");try{
  const response=await fetch("/api/reflect",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({evidence,config})});
  if(response.status===429)throw new Error("rate_limited");
  if(!response.ok)throw new Error("unavailable");
  const reflection=validateReflection(await response.json(),evidence,config);
  if(token===request.current)setResult(reflection);
 }catch(error){if(token===request.current)setError(`${error instanceof Error && error.message === "rate_limited" ? "Rate limit reached. Wait a minute before asking again." : "Jev reflection unavailable."} Your recorded results remain available; no explanation or recommendation was substituted.`);}finally{if(token===request.current)setBusy(false);}}
 return <section className="run-reflection" aria-label="Jev run reflection"><h3>What is worth exploring next?</h3>
 <p>Ask Jev to select recorded turning points and a supported next experiment. Your private question stays in this browser. Recommendations do not change the world until you review and seed it.</p>
 <button type="button" disabled={busy} onClick={ask}>{busy?"Jev is reviewing the evidence…":"Ask Jev about this run"}</button>
 {error&&<p role="status">{error}</p>}
 {result&&<>{result.metadata && <p>Jev-selected evidence and experiment · {result.metadata.model ?? "model not supplied"}{result.metadata.usage ? ` · ${result.metadata.usage.input_tokens} input / ${result.metadata.usage.output_tokens} output tokens` : ""}. The measured facts below come from the engine, not generated measurements.</p>}<ul>{result.observations.map((item,index)=><li key={index}>{item.text}<small> Evidence: {item.evidenceRefs.join(", ")}</small></li>)}</ul><h4>{result.nextExperiment.title}</h4><p>{result.nextExperiment.rationale}</p><ul>{result.nextExperiment.changes.map(change=><li key={change.path}>{conditionLabel(change.path)}: {conditionValue(change.path,change.value)}</li>)}</ul><p>{result.caveat}</p><button type="button" onClick={()=>onExperiment(result.nextExperiment)}>Review suggested experiment</button></>}
 </section>;
}
