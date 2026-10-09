import { councilApplicable, type CouncilRecord } from "@/game/council";
import type { EvolutionDecision, EvolutionLedger } from "@/game/decisions";
import type { WorldRuleGraph } from "@/game/rules";
import type { SimulationState } from "@/game/world";
import { ruleTimingLabel, selectedChangeLabel } from "@/game/council-display";

const label = (text: string) => text.replaceAll("_", " ");

function RecordEvidence({ record, history }: { record: CouncilRecord; history?: EvolutionLedger }) {
  const totals = history?.flatMap(item => item.council ? [item.council.orchestrator, ...item.council.members] : []).filter(item => item.id === record.id).reduce((sum, item) => ({ input: sum.input + item.usage.input_tokens, output: sum.output + item.usage.output_tokens }), { input: 0, output: 0 });
  return <article className="lineage-card" style={{ overflowWrap: "anywhere" }}>
    <strong>{record.id}</strong>
    <p>{label(record.responsibility)} · scope {record.scope}</p>
    <p>Source: Jev · {record.model}<br/>{record.usage.input_tokens} input / {record.usage.output_tokens} output tokens</p>
    {totals && <p>Member cumulative: {totals.input} input / {totals.output} output tokens</p>}
    {Object.entries(record.evidence).map(([key, answer]) => <details key={key}>
      <summary>{label(key)}: {label(answer.choice)} · confidence {Math.round(answer.confidence * 100)}%</summary>
      <p>{Object.entries(answer.probabilities).map(([option, probability]) => `${label(option)} ${Math.round(probability * 100)}%`).join(" · ")}</p>
    </details>)}
  </article>;
}

export function SetupCouncil({ rules }: { rules: WorldRuleGraph }) {
  return <section className="observatory-section" aria-label="Setup council">
    <h3>Setup council · {rules.council?.members.length ?? 0} specialists</h3>
    <p>{rules.councilSetup ? "Orchestrator-selected responsibilities" : rules.council ? "Recorded manifest · selection provenance unavailable" : "No council configured · deterministic observations abstain"}</p>
    {rules.council?.members.map(member => <p key={member.id}><strong>{member.id}</strong> · {label(member.responsibility)} · scope {member.scope} · eligible on {label(member.activation)}</p>)}
    {rules.councilSetup && <details><summary>Setup orchestrator provenance</summary><RecordEvidence record={rules.councilSetup}/></details>}
  </section>;
}

export function RuntimeCouncil({ decision, state, ledger, replay }: { decision?: EvolutionDecision; state: SimulationState; ledger: EvolutionLedger; replay: boolean }) {
  const council = decision?.council;
  const recorded = ledger.filter(item => item.generation <= state.generation);
  const usage = recorded.reduce((sum, item) => ({ input: sum.input + (item.usage?.input_tokens ?? 0), output: sum.output + (item.usage?.output_tokens ?? 0), calls: sum.calls + (item.council?.calls ?? 0) }), { input: 0, output: 0, calls: 0 });
  return <section className="observatory-section" aria-label="Runtime council" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
    <h3>Runtime council</h3>
    <p>{replay ? "Recorded evidence · zero live API calls" : "Source: " + (decision?.source === "jev" ? "Jev" : decision ? "deterministic fallback" : "awaiting observation")}</p>
    {!decision ? <p>No runtime judgment yet.</p> : decision.source === "fallback" ? <p>Council abstained · no new birth policies or graph patch. Inherited strategies continue; no partial specialist output applied.</p> : !council ? <p>Legacy decision · no council provenance recorded.</p> : <>
      <p>Generation {decision.generation} · observation {decision.observationHash} · graph v{decision.ruleGraphVersion}</p>
      <p><strong>Reconciled patch owner: {council.selectedPatch}</strong> · {council.calls} provider calls</p>
      {council.correction && <p>Protocol correction: {council.correction.stage} · one fresh model response. Rejected attempt: {council.correction.rejectedUsage.input_tokens} input / {council.correction.rejectedUsage.output_tokens} output tokens, included in total usage. Invalid evidence was not applied.</p>}
      {council.batching && <p>Grouped specialist inference: scoped answers share one provider request. Batch usage: {council.batchUsage?.input_tokens ?? 0} input / {council.batchUsage?.output_tokens ?? 0} output tokens, counted once; specialist records do not have separately attributable token usage.</p>}
      <p>{selectedChangeLabel(decision)}</p>
      {decision.scheduledRuleChange && <p>{ruleTimingLabel(decision, state)} · {label(decision.scheduledRuleChange.duration)} duration · {label(decision.scheduledRuleChange.transition)} transition</p>}
      <details open><summary>Runtime orchestrator</summary><RecordEvidence record={council.orchestrator} history={recorded}/></details>
      {council.manifest.members.map(member => {
        const record = council.members.find(item => item.id === member.id);
        const status = !councilApplicable(member, decision.trigger) ? "not eligible" : council.orchestrator.evidence[`activate_${member.id}`]?.choice ?? "not recorded";
        return <details key={member.id}>
          <summary>{member.id} · {status}{record ? ` · ${Object.entries(record.evidence).map(([key, answer]) => `${label(key)}: ${label(answer.choice)}`).join(" / ")}` : ""}</summary>
          <p>{label(member.responsibility)} · scope {member.scope} · eligible on {label(member.activation)}</p>
          {record ? <><p>{member.responsibility === "birth_policy" ? "Selected for subsequent births" : member.id === council.selectedPatch ? "Selected graph proposal · engine controls activation" : "Advisory only · not applied"}</p><RecordEvidence record={record} history={recorded}/></> : <p>No specialist call or output for this observation.</p>}
        </details>;
      })}
    </>}
    <p>Cumulative recorded runtime usage: {usage.input} input / {usage.output} output tokens · {usage.calls} council provider calls. Setup usage excluded; corrected rejected attempts included. Unrecovered failed-call usage is unavailable.</p>
  </section>;
}
