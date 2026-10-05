"use client";

import { useMemo, useState } from "react";
import type { EvolutionLedger } from "@/game/decisions";
import { buildWorldReport } from "@/game/observatory";
import type { SimulationState } from "@/game/world";
import { SetupCouncil, RuntimeCouncil } from "./CouncilPanel";
import { speciesColor } from "@/game/species-colors";
import { relationshipLabel, triggerLabel } from "@/game/visuals";

type Tab = "overview" | "lineages" | "environment" | "timeline";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "lineages", label: "Lineages" },
  { id: "environment", label: "Environment" },
  { id: "timeline", label: "Timeline" },
];

const title = (value: string) => value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
const signed = (value: number) => `${value > 0 ? "+" : ""}${value}`;

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="chart-collecting"><strong>Collecting history</strong><p>{values.length ? `First sample: ${values[0]} organisms. ` : ""}A trend appears after the next generation.</p></div>;
  const width = 280;
  const height = 62;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = Math.max(1, max - min);
  const points = values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * width},${height - ((value - min) / range) * height}`).join(" ");
  return <svg className="observatory-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Population history"><polyline points={points}/></svg>;
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "bad" }) {
  return <div className={`observatory-metric ${tone ? `is-${tone}` : ""}`}><span>{label}</span><strong>{value}</strong></div>;
}

export function WorldObservatory({ state, ledger, replay = false }: { state: SimulationState; ledger: EvolutionLedger; replay?: boolean }) {
  const [tab, setTab] = useState<Tab>("overview");
  const report = useMemo(() => buildWorldReport(state, ledger), [state, ledger]);
  const activeRule = state.activeRuleChange;

  return <aside id="world-observatory" className="world-observatory" aria-label="World observatory panel">
    <header className="observatory-header">
      <div><p>LIVE WORLD MODEL</p><h2>World observatory</h2></div>
      <span className="observatory-generation">GEN {state.generation}</span>
    </header>
    <div className="observatory-tabs" role="tablist" aria-label="World observatory views">
      {TABS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}>{item.label}</button>)}
    </div>

    <div className="observatory-content">
      {tab === "overview" && <>
        {state.config.rules && <details><summary>Council manifest & setup provenance</summary><SetupCouncil rules={state.config.rules}/></details>}
        <section className="observatory-section changing-summary" aria-label="What’s changing">
          <h3>What’s changing</h3>
          <p>{report.history.length < 2 ? "Founders are seeded. Waiting for another generation to measure change." : `Population ${report.population.change === 0 ? "is unchanged" : report.population.change > 0 ? `rose by ${report.population.change}` : `fell by ${Math.abs(report.population.change)}`} since generation ${report.history[0].generation}. Resources per cell changed by ${signed(report.resources.change)} over the same window.`}</p>
          <p>{activeRule ? `A rule change is active since generation ${activeRule.activatedAt}.` : "No rule change is active."} Current pressure: {title(report.environment.pressure).toLowerCase()} · {report.environment.intensity} intensity.</p>
        </section>
        <section className="observatory-metrics" aria-label="Evolution counters">
          <Metric label="Population" value={report.population.total}/>
          <Metric label="Window change" value={signed(report.population.change)} tone={report.population.change >= 0 ? "good" : "bad"}/>
          <Metric label="Births · total" value={report.population.births} tone="good"/>
          <Metric label="Deaths · total" value={report.population.deaths} tone="bad"/>
          <Metric label="Lineages" value={state.stats.lineages}/>
          <Metric label="Deepest generation" value={state.stats.maxGeneration}/>
        </section>
        <section className="observatory-section">
          <div className="observatory-section-title"><span>Population history</span><b>last {report.history.length} frames</b></div>
          <Sparkline values={report.history.map((frame) => frame.population)}/>
          <div className="chart-legend"><span><i className="chart-total"/>Total population</span><span>Other roles {report.population.prey}</span><span>Hunters + omnivores {report.population.predators}</span></div>
        </section>
        <section className="observatory-section">
          <div className="observatory-section-title"><span>Living ecology</span><b>{report.species.filter((row) => row.population).length} active</b></div>
          <div className="species-list">{report.species.map((species) => <div className="species-row" key={species.id}><i data-species={species.id} style={{ backgroundColor: speciesColor(species.id) }}/><div><strong>Species {species.id}</strong><small>{title(species.role)} · {species.lineages} lineages</small></div><b>{species.population}</b></div>)}</div>
        </section>
      </>}

      {tab === "lineages" && <section className="observatory-section is-flush">
        <div className="observatory-section-title"><span>Heritable phenotype</span><b>population means</b></div>
        {report.species.map((species) => <article className="lineage-card" key={species.id}>
          <header><div><strong><i className="species-swatch" style={{ backgroundColor: speciesColor(species.id) }}/>Species {species.id}</strong><span>{title(species.role)}</span></div><b>{species.population} alive</b></header>
          <dl><div><dt>Mean energy</dt><dd>{species.meanEnergy}</dd></div><div><dt>Descendant generation</dt><dd>{species.meanGeneration}</dd></div><div><dt>Living lineages</dt><dd>{species.lineages}</dd></div></dl>
          <div className="trait-stack">{Object.entries(species.traits).map(([trait, value]) => <div key={trait}><span>{title(trait)}</span><i><b style={{ width: `${value * 100}%` }}/></i><em>{Math.round(value * 100)}</em></div>)}</div>
        </article>)}
      </section>}

      {tab === "environment" && <>
        <section className="environment-status">
          <p>{activeRule ? "ACTIVE CHANGE" : "BASELINE REGIME"}</p>
          <strong>{title(report.environment.pressure)}</strong>
          <span>{title(report.environment.intensity)} intensity · {title(report.environment.volatility)}</span>
          {activeRule && <small>Active since generation {activeRule.activatedAt}{activeRule.revertAt === null ? " · persistent" : ` · reverts after ${activeRule.revertAt}`}</small>}
        </section>
        <section className="observatory-section is-flush"><div className="world-facts">
          <div><span>Regeneration</span><strong>{title(report.environment.regeneration)}</strong></div>
          <div><span>Resource mean</span><strong>{report.resources.mean}</strong></div>
          <div><span>Resource change</span><strong>{signed(report.resources.change)}</strong></div>
          <div><span>Rule graph</span><strong>v{state.config.rules?.version ?? 1}</strong></div>
        </div></section>
        <section className="observatory-section"><div className="observatory-section-title"><span>Interaction graph</span><b>deterministic</b></div><div className="relationship-list">{state.config.rules?.interactions.map((interaction) => <div key={interaction.pair}><span>{interaction.pair}</span><strong>{relationshipLabel(interaction.pair, interaction.mode)}</strong></div>)}</div></section>
      </>}

      {tab === "timeline" && <section className="observatory-section is-flush">
        <div className="observatory-section-title"><span>World history</span><b>{report.timeline.length} decisions</b></div>
        {report.timeline.length === 0 ? <div className="timeline-empty"><strong>No intervention yet</strong><p>The world is evolving under its initial validated rules. New entries appear when an ecological trigger is evaluated.</p></div> : <ol className="world-timeline">{[...report.timeline].reverse().map((entry) => <li key={`${entry.generation}-${entry.trigger}`}><span>GEN {entry.generation}</span><div><strong>{triggerLabel(entry.trigger)}</strong><p>{entry.changes} {entry.timing}</p><small>{title(entry.source)}{entry.duration ? ` · ${title(entry.duration)} duration` : ""}</small><details><summary>Recorded decision evidence</summary><RuntimeCouncil decision={ledger.find(item => item.generation === entry.generation)} state={state} ledger={ledger.filter(item => item.generation <= entry.generation)} replay={replay}/></details></div></li>)}</ol>}
      </section>}
    </div>
  </aside>;
}
