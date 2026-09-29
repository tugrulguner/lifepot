"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import {
  createReplay,
  decodeReplay,
  encodeReplay,
  type ReplayData,
} from "@/game/replay";
import {
  canonicalAnswers,
  deterministicSetup,
  hashSetupRequest,
  lifeConfigSchema,
  type SetupAnswers,
} from "@/game/setup";
import {
  createSimulation,
  DEFAULT_GENERATIONS,
  GRID_SIZE,
  type LifeConfig,
  type SimulationState,
} from "@/game/world";
import {
  detectEvolutionTrigger,
  deterministicEvolutionDecision,
  summarizeEcology,
  validateEvolutionDecision,
  validateSpeciesDirectives,
  type EvolutionDecision,
  type EvolutionLedger,
} from "@/game/decisions";
import {
  activeDecisionForGeneration,
  advanceUntilDecisionTrigger,
} from "@/game/runtime";
import { CreatureInspector } from "./CreatureInspector";
import { cellAtPoint } from "@/game/inspection";
import { updateEventEffects, EVENT_LIFETIME, type TimedOrganismEvent } from "@/game/event-effects";
import { WorldObservatory } from "./WorldObservatory";
import { SetupCouncil, RuntimeCouncil } from "./CouncilPanel";
import { speciesColor } from "@/game/species-colors";
import { isSurvivingNewborn, relationshipLabel, triggerLabel } from "@/game/visuals";
export type LifePotViewModel = {
  answers: SetupAnswers;
  config: LifeConfig;
  simulation: SimulationState;
};
type Stage = "questions" | "review" | "simulation";
type QuestionKey = keyof SetupAnswers;
const QUESTIONS: Array<{
  key: QuestionKey;
  title: string;
  note: string;
  examples: string[];
}> = [
  {
    key: "world",
    title: "What exists in this world?",
    note: "Describe resources and founder balance.",
    examples: [
      "Rich mineral pools with abundant prey",
      "Sparse nutrients scattered across open water",
    ],
  },
  {
    key: "threat",
    title: "What threatens life here?",
    note: "Describe environmental pressure and predation.",
    examples: [
      "Predator packs hunt through pulsing droughts",
      "Toxic waves sweep across the world",
    ],
  },
  {
    key: "reward",
    title: "What should evolution favor?",
    note: "Set the long-term evolutionary objective.",
    examples: [
      "Diversify while prey and predators coexist",
      "Favor armored swarms and efficient hunters",
    ],
  },
];
const EMPTY: SetupAnswers = { world: "", threat: "", reward: "" };
const RESPONSE = z
  .object({
    config: lifeConfigSchema,
    source: z.enum(["jev", "fallback"]),
    requestHash: z.string().regex(/^setup_[a-z0-9]+$/),
    model: z.string().optional(),
    usage: z
      .object({
        input_tokens: z.number().int(),
        output_tokens: z.number().int(),
      })
      .optional(),
    evidence: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
function seedFromHash(hash: string) {
  let s = 2166136261;
  for (const c of hash) s = Math.imul(s ^ c.charCodeAt(0), 16777619);
  return s >>> 0;
}
function title(v: string) {
  return v.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
}
function draw(canvas: HTMLCanvasElement, state: SimulationState, selected: number | null, followed: number | null, effects: TimedOrganismEvent[] = [], now = 0) {
  const rect = canvas.getBoundingClientRect(),
    dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const c = canvas.getContext("2d");
  if (!c) return;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = "#03110f";
  c.fillRect(0, 0, rect.width, rect.height);
  const pad = 18,
    cw = (rect.width - pad * 2) / GRID_SIZE,
    ch = (rect.height - pad * 2) / GRID_SIZE;
  for (let i = 0; i < state.resources.length; i++) {
    const x = i % 50,
      y = Math.floor(i / 50),
      r = state.resources[i] / 255;
    if (r > 0.08) {
      c.globalAlpha = 0.08 + r * 0.28;
      c.fillStyle = "#80d79b";
      c.fillRect(
        pad + x * cw,
        pad + y * ch,
        Math.max(1, cw * 0.35),
        Math.max(1, ch * 0.35),
      );
    }
  }
  c.globalAlpha = 1;
  for (let i = 0; i < state.guild.length; i++) {
    if (!state.guild[i]) continue;
    const x = i % 50,
      y = Math.floor(i / 50),
      role = state.config.rules?.species[state.ruleSpecies[i] - 1]?.role,
      pred = role === "hunter";
    c.fillStyle = speciesColor(
      state.config.rules?.species[state.ruleSpecies[i] - 1]?.id ?? "",
    );
    c.strokeStyle = pred ? "#ffd0c9" : "#d4fff1";
    c.lineWidth = pred ? 1.2 : 0.55;
    c.beginPath();
    if (pred) {
      c.moveTo(pad + (x + 0.85) * cw, pad + (y + 0.5) * ch);
      c.lineTo(pad + (x + 0.15) * cw, pad + (y + 0.12) * ch);
      c.lineTo(pad + (x + 0.15) * cw, pad + (y + 0.88) * ch);
      c.closePath();
    } else if (role === "omnivore") {
      c.rect(pad + (x + .18) * cw, pad + (y + .18) * ch, cw * .64, ch * .64);
    } else
      c.arc(
        pad + (x + 0.5) * cw,
        pad + (y + 0.5) * ch,
        Math.max(1.5, Math.min(cw, ch) * 0.42),
        0,
        Math.PI * 2,
      );
    c.fill();
    c.stroke();
    if (i === selected || state.lineage[i] === followed) {
      c.strokeStyle = i === selected ? "#fff" : "#ffda72"; c.lineWidth = 2;
      c.strokeRect(pad + x * cw - 1, pad + y * ch - 1, cw + 2, ch + 2);
    }
    if (isSurvivingNewborn(state.generation, state.age[i], state.organismGeneration[i], state.guild[i])) {
      c.strokeStyle = "#ffffff"; c.lineWidth = 1; c.beginPath();
      c.arc(pad + (x + .5) * cw, pad + (y + .5) * ch, Math.min(cw, ch) * .62, 0, Math.PI * 2); c.stroke();
    }
  }
  for(const event of effects){
    const remaining=Math.max(0,(event.expiresAt-now)/EVENT_LIFETIME);
    if(!remaining)continue;
    const x=pad+(event.at%GRID_SIZE+.5)*cw,y=pad+(Math.floor(event.at/GRID_SIZE)+.5)*ch;
    c.globalAlpha=remaining;c.lineWidth=1.5;c.strokeStyle=event.kind==="birth"?"#ffffff":event.kind==="death"?"#ff8877":"#ffd65c";
    c.beginPath();
    if(event.kind==="death"){const r=Math.min(cw,ch)*.7;c.moveTo(x-r,y-r);c.lineTo(x+r,y+r);c.moveTo(x+r,y-r);c.lineTo(x-r,y+r);}
    else c.arc(x,y,Math.min(cw,ch)*(event.source==="resource"?.2:(.5+(1-remaining))),0,Math.PI*2);
    c.stroke();
  }
  c.globalAlpha=1;
}
function World({ state, selected, followed, onInspect }: { state: SimulationState; selected: number | null; followed: number | null; onInspect: (index: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const effects=useRef<TimedOrganismEvent[]>([]),last=useRef<SimulationState|null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(last.current!==state){
      if(!last.current||state.generation<=last.current.generation)effects.current=[];
      effects.current=updateEventEffects(effects.current,state.recentEvents.filter(e=>e.generation>(last.current?.generation??-1)),performance.now(),reduced);
      last.current=state;
    }
    let frame=0;
    const paint=()=>{const now=performance.now();effects.current=updateEventEffects(effects.current,[],now,reduced);if(ref.current)draw(ref.current,state,selected,followed,effects.current,now);if(effects.current.length)frame=requestAnimationFrame(paint);};
    paint();
    const o = new ResizeObserver(paint);o.observe(ref.current);
    return () => {o.disconnect();cancelAnimationFrame(frame);};
  }, [state, selected, followed]);
  return (
    <canvas
      ref={ref}
      className="life-canvas"
      tabIndex={0}
      title="Click a cell to inspect and pause. Use arrow keys to select a cell; Enter inspects a living organism."
      onKeyDown={e => {
        const delta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -GRID_SIZE, ArrowDown: GRID_SIZE };
        if (e.key in delta) { e.preventDefault(); onInspect(((selected ?? 0) + delta[e.key] + state.guild.length) % state.guild.length); }
        if (e.key === "Enter") { e.preventDefault(); const index = state.guild.findIndex(Boolean); if (index >= 0) onInspect(index); }
      }}
      onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); const index = cellAtPoint(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height); if (index !== null) onInspect(index); }}
      role="img"
      aria-label={`Ecosystem generation ${state.generation}; ${state.stats.population} organisms`}
    />
  );
}
export function GameCanvas() {
  const [stage, setStage] = useState<Stage>("questions"),
    [answers, setAnswers] = useState(EMPTY),
    [qi, setQi] = useState(0),
    [config, setConfig] = useState<LifeConfig | null>(null),
    [proof, setProof] = useState<{
      source: "jev" | "fallback";
      model?: string;
      usage?: { input_tokens: number; output_tokens: number };
    } | null>(null),
    [seed, setSeed] = useState(0),
    [simulation, setSimulation] = useState<SimulationState | null>(null),
    [paused, setPaused] = useState(false),
    [selected, setSelected] = useState<number | null>(null),
    [followed, setFollowed] = useState<number | null>(null),
    [speed, setSpeed] = useState<1 | 3>(1),
    [ledger, setLedger] = useState<EvolutionLedger>([]),
    [deciding, setDeciding] = useState(false),
    [event, setEvent] = useState("Founders await selection"),
    [notice, setNotice] = useState(""),
    [replayMode, setReplayMode] = useState(false);
  const ledgerRef = useRef<EvolutionLedger>([]),
    simRef = useRef<SimulationState | null>(null),
    initialConfigRef = useRef<LifeConfig | null>(null),
    replayRef = useRef<ReplayData | null>(null),
    pending = useRef<number | null>(null),
    runId = useRef(0);
  const complete = simulation && simulation.outcome !== "running";
  const begin = useCallback(
    (a: SetupAnswers, c: LifeConfig, s: number, replay?: ReplayData) => {
      const initial = createSimulation({ seed: s, config: c }),
        l = replay?.ledger ?? [];
      runId.current++;
      ledgerRef.current = l;
      simRef.current = initial;
      initialConfigRef.current = structuredClone(c);
      replayRef.current = replay ?? null;
      setAnswers(a);
      setConfig(c);
      setSeed(s);
      setSimulation(initial);
      setLedger(l);
      setReplayMode(Boolean(replay));
      setPaused(false);
      setSelected(null);
      setFollowed(null);
      setDeciding(false);
      pending.current = null;
      setEvent(
        replay
          ? "Replay v3 loaded — zero live Jev calls"
          : `${initial.stats.population} founders seeded across ${initial.config.rules!.species.length} configured species`,
      );
      setStage("simulation");
    },
    [],
  );
  useEffect(() => {
    const p = new URLSearchParams(location.hash.slice(1)).get("replay") ?? new URL(location.href).searchParams.get("replay");
    if (p)
      try {
        const r = decodeReplay(p);
        queueMicrotask(() => begin(r.answers, r.config, r.seed, r));
      } catch {
        queueMicrotask(() => setNotice("Invalid or legacy replay rejected"));
      }
  }, [begin]);
  useEffect(() => {
    if (
      !simulation ||
      stage !== "simulation" ||
      simulation.outcome !== "running"
    )
      return;
    const trigger = detectEvolutionTrigger(simulation, ledgerRef.current);
    if (
      !trigger ||
      ledgerRef.current.some((d) => d.generation === simulation.generation)
    )
      return;
    if (replayMode) return;
    if (pending.current === simulation.generation) return;
    const id = runId.current,
      summary = summarizeEcology(simulation, answers, trigger);
    pending.current = simulation.generation;
    setDeciding(true);
    setEvent(
      `Jev evaluating ${triggerLabel(trigger)} at generation ${simulation.generation}`,
    );
    void (async () => {
      let d: EvolutionDecision;
      try {
        const r = await fetch("/api/judge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "evolution", summary }),
        });
        if (!r.ok) throw 0;
        d = validateEvolutionDecision(await r.json());
        validateSpeciesDirectives(d, simulation.config.rules!);
        if (
          d.generation !== simulation.generation ||
          d.ruleGraphVersion !== simulation.config.rules?.version ||
          d.speciesDirectives === undefined ||
          d.trigger !== trigger ||
          d.observationHash !==
            deterministicEvolutionDecision(summary).observationHash
        )
          throw 0;
      } catch {
        d = deterministicEvolutionDecision(summary);
      }
      if (
        id === runId.current &&
        simRef.current?.generation === simulation.generation
      ) {
        const l = [...ledgerRef.current, d];
        ledgerRef.current = l;
        setLedger(l);
        setEvent(
          d.source === "fallback" ? "Offline observation: no intervention; inherited strategies continue" : `Jev decision recorded: ${d.speciesDirectives?.length ?? 0} species policies${d.scheduledRuleChange ? "; rule change scheduled" : ""}`,
        );
      }
    })().finally(() => {
      if (id === runId.current) {
        pending.current = null;
        setDeciding(false);
      }
    });
  }, [answers, replayMode, simulation, stage]);
  useEffect(() => {
    if (!simulation || paused || deciding || simulation.outcome !== "running")
      return;
    const timer = setTimeout(
      () => {
        try {
          const next = advanceUntilDecisionTrigger(
            simulation,
            ledgerRef.current,
            speed,
          );
          if (next === simulation) return;
          simRef.current = next;
          setSimulation(next);
          const dk = next.stats.kills - simulation.stats.kills;
          const db = next.stats.births - simulation.stats.births;
          const dd = next.stats.deaths - simulation.stats.deaths;
          setEvent(`Generations ${simulation.generation}–${next.generation}: ${db} births · ${dd} deaths · ${dk} consumption kills. White pulses: births · gold: feeding · red crosses: deaths.`);
        } catch {
          setPaused(true);
          setEvent("Replay ledger verification failed");
        }
      },
      simulation.generation === 0 ? 450 : speed === 3 ? 35 : 220,
    );
    return () => clearTimeout(timer);
  }, [deciding, ledger, paused, simulation, speed]);
  useEffect(() => {
    if (replayMode || !simulation || simulation.outcome === "running") return;
    try {
      replayRef.current = createReplay({
        answers,
        config: initialConfigRef.current ?? simulation.config,
        seed: simulation.seed,
        requestHash: hashSetupRequest(answers),
        ledger: ledgerRef.current,
      });
    } catch {
      queueMicrotask(() =>
        setNotice("Replay validation failed; challenge link unavailable"),
      );
    }
  }, [answers, replayMode, simulation]);
  async function interpret(a: SetupAnswers) {
    const ca = canonicalAnswers(a),
      hash = hashSetupRequest(ca);
    try {
      const r = await fetch("/api/judge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: ca, requestHash: hash }),
        }),
        p = RESPONSE.parse(await r.json());
      if (p.requestHash !== hash) throw 0;
      setConfig(p.config);
      setProof({ source: p.source, model: p.model, usage: p.usage });
    } catch {
      setConfig(deterministicSetup(ca));
      setProof({ source: "fallback" });
    }
    setAnswers(ca);
    setSeed(seedFromHash(hash));
    setStage("review");
  }
  if (stage === "questions") {
    const q = QUESTIONS[qi];
    return (
      <main className="setup-shell">
        <header className="brand-bar">
          <span className="brand-orbit" />
          <Link href="/">LIFEPOT</Link>
          <span>Co-evolution laboratory</span>
        </header>
        <section className="question-panel">
          <div className="step-label">QUESTION {qi + 1} / 3</div>
          <div className="progress-track">
            <i style={{ width: `${((qi + 1) / 3) * 100}%` }} />
          </div>
          <p className="eyebrow">Define ecology</p>
          <h1>{q.title}</h1>
          <p className="question-note">{q.note}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (qi < 2) setQi(qi + 1);
              else void interpret(answers);
            }}
          >
            <div className="answer-field">
              <input
                autoFocus
                aria-label={q.title}
                maxLength={140}
                value={answers[q.key]}
                onChange={(e) =>
                  setAnswers({ ...answers, [q.key]: e.target.value })
                }
              />
              <span>{answers[q.key].length}/140</span>
            </div>
            <div className="chips">
              {q.examples.map((x) => (
                <button
                  type="button"
                  key={x}
                  onClick={() => setAnswers({ ...answers, [q.key]: x })}
                >
                  {x}
                </button>
              ))}
            </div>
            <div className="question-footer">
              <span>Press Enter to continue</span>
              <div>
                {qi > 0 && (
                  <button
                    type="button"
                    className="back-button"
                    onClick={() => setQi(qi - 1)}
                  >
                    Back
                  </button>
                )}
                <button
                  className="primary-button"
                  disabled={!answers[q.key].trim()}
                >
                  {qi === 2 ? "Review ecosystem" : "Continue"}
                </button>
              </div>
            </div>
          </form>
        </section>
      </main>
    );
  }
  if (stage === "review" && config)
    return (
      <main className="review-shell">
        <header className="brand-bar">
          <span className="brand-orbit" />
          <Link href="/">LIFEPOT</Link>
          <span>Interpretation complete</span>
        </header>
        <section className="review-card">
          <p className="eyebrow">Founder ecology</p>
          <h1>World conditions</h1>
          <p className="environment-code">
            Rule graph v{config.rules?.version} · {config.rules?.species.length} configured species
          </p>
          <p
            className={`interpreter-proof ${proof?.source === "jev" ? "is-jev" : "is-fallback"}`}
            data-testid="interpreter-source"
          >
            <span />
            {proof?.source === "jev"
              ? `Jev API · ${proof.model ?? "jev-latest"}`
              : "Deterministic fallback"}
          </p>
          <div className="condition-list" aria-label="Validated world rules">
            {config.rules?.species.map(species => <div key={species.id}><span>Species {species.id}</span><p>{title(species.role)} · {title(species.selfInteraction)} within species<br/>Founder strategy: {title(species.role === "hunter" || species.role === "omnivore" ? config.founders.predatorStrategy : config.founders.preyStrategy)}</p></div>)}
            {config.rules?.interactions.map(edge => <div key={edge.pair}><span>{edge.pair}</span><p>{relationshipLabel(edge.pair, edge.mode)}</p></div>)}
            {Object.entries(config.rules?.environment ?? {}).map(([key, value]) => <div key={key}><span>{title(key)}</span><p>{title(value)}</p></div>)}
            <div><span>Initial resources</span><p>{title(config.environment.abundance)} · {title(config.environment.distribution)}</p></div>
          </div>
          {config.rules && <SetupCouncil rules={config.rules}/>}
          {proof?.usage && <p>Setup total: {proof.usage.input_tokens} input / {proof.usage.output_tokens} output tokens (world interpretation + council selection).</p>}
          <p className="review-note">These are the validated mechanics, not unrestricted interpretations of your prose. Roles do not imply feeding links: consumption follows the relationship graph. Extinct species are not automatically restored.</p>
          <button
            className="primary-button seed-button"
            onClick={() => begin(answers, config, seed, replayMode ? replayRef.current ?? undefined : undefined)}
          >
            Seed ecosystem <span>→</span>
          </button>
        </section>
      </main>
    );
  if (!simulation || !config) return null;
  const active = activeDecisionForGeneration(ledger, simulation.generation),
    resources = Math.round(simulation.stats.resources / 2500);
  return (
    <main className="simulation-shell">
      <World state={simulation} selected={selected} followed={followed} onInspect={index => { setSelected(index); setPaused(true); }} />
      <CreatureInspector state={simulation} index={selected} followed={followed} onFollow={setFollowed} onClear={() => setSelected(null)} onPick={() => { const index = simulation.guild.findIndex(value => value > 0); if (index >= 0) { setSelected(index); setPaused(true); } }} />
      <header className="simulation-header">
        <div className="sim-brand">
          <span className="brand-orbit" />
          <strong>LIFEPOT</strong>
          <small>CO-EVOLUTION</small>
        </div>
        <div className="simulation-header-actions">
          <div className="environment-strip">
            {title(simulation.config.rules!.environment.pressure)} ·{" "}
            {title(simulation.config.rules!.environment.volatility)}
          </div>
        </div>
      </header>
      <WorldObservatory state={simulation} ledger={ledger.filter(item => item.generation <= simulation.generation)} replay={replayMode} />
      <section className="stats-strip" aria-label="Live ecosystem statistics">
        <Stat
          id="generation"
          label="Generation"
          value={`${simulation.generation} / ${DEFAULT_GENERATIONS}`}
        />
        <Stat id="prey" label="Other roles" value={simulation.stats.prey} />
        <Stat
          id="predators"
          label="Hunters + omnivores"
          value={simulation.stats.predators}
        />
        <Stat id="births" label="Births · total" value={simulation.stats.births} />
        <Stat id="deaths" label="Deaths · total" value={simulation.stats.deaths} />
        <Stat
          id="species"
          label="Living variants"
          value={simulation.stats.speciesRichness}
        />
        <Stat id="kills" label="Kills · total" value={simulation.stats.kills} />
        <Stat id="resources" label="Resource mean" value={resources} />
      </section>
      <aside className="decision-overlay" aria-label="Jev evolution state">
        <div className="decision-heading">
          <p>JEV EVOLUTION LAYER</p>
          <span
            className={`decision-source ${deciding ? "is-deciding" : active?.source === "jev" ? "is-jev" : "is-fallback"}`}
          >
            {deciding
              ? "Jev deciding…"
              : replayMode
                ? "Replay v3"
                : active
                  ? active.source === "fallback" ? "Offline · no intervention" : "Jev policies"
                  : "Observing ecology"}
          </span>
        </div>
        <p className="decision-brief">Observed: {active ? triggerLabel(active.trigger) : "awaiting an ecological trigger"}. Current graph pressure: {title(simulation.config.rules!.environment.pressure)}. Observations do not establish which pressure caused a population change.</p>
        <details className="council-details"><summary>Jev input, policies & council evidence</summary>
        <p>World: {answers.world}<br/>Threat: {answers.threat}<br/>Objective: {answers.reward}</p>
        <dl className="decision-meta">
          <div>
            <dt>Trigger</dt>
            <dd>{active ? triggerLabel(active.trigger) : "Await event"}</dd>
          </div>
          <div>
            <dt>Pressure</dt>
            <dd>
              {title(simulation.config.rules!.environment.pressure)}
            </dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>
              {active?.model ??
                (active?.source === "fallback" ? "Deterministic" : "—")}
            </dd>
          </div>
        </dl>
        <div className="cohort-decisions" aria-label="Species birth policies">
          {simulation.config.rules!.species.map(species => {
            const directive = active?.speciesDirectives?.find(item => item.species === species.id);
            return <div key={species.id}><span>Species {species.id} · {title(species.role)}</span>{directive ? <div><strong>Next births: {title(directive.strategy.choice)}</strong><p>Undirected variation · {directive.mutationTempo.choice} rate. Target suggestion is advisory, not gene editing.</p><details><summary>Decision probabilities</summary>{[directive.strategy, directive.mutationTarget, directive.mutationTempo].map((answer, index) => <p key={index}>{title(answer.choice)} · confidence {Math.round(answer.confidence * 100)}%<br/>{Object.entries(answer.probabilities).map(([choice, probability]) => `${title(choice)} ${Math.round(probability * 100)}%`).join(" · ")}</p>)}</details></div> : <strong>{active?.speciesDirectives === undefined && active ? "Legacy cohort policy (replay)" : "Inherited · no new policy"}</strong>}</div>;
          })}
        </div>
        <p className="decision-usage">Policies affect subsequent births, not every living organism. Offline observations do not introduce species or rescue extinct lineages.</p>
        <RuntimeCouncil decision={active} state={simulation} ledger={ledger} replay={replayMode}/>
        {active?.usage && <p className="decision-usage">Latest decision: {active.usage.input_tokens} input / {active.usage.output_tokens} output tokens</p>}
        <p className="decision-usage">
          {ledger.length} / 8 decisions · ≥12 generation cooldown
          <br />
          {replayMode ? "zero live API calls" : "event-driven observations"}
        </p>
        </details>
      </aside>
      <div className="legend">
        <span>
          <i className="resource-key" />
          Resource
        </span>
        <span>○ Producer / grazer / scavenger</span>
        <span>▷ Hunter</span><span>□ Omnivore</span>
        <span>White = birth · gold pulse = feeding · red cross = death</span>
        <span>Color = species in observatory</span>
      </div>
      <div className="ticker">
        <span>EVENT</span>
        <p>{event}</p>
      </div>
      <div className="controls">
        <button onClick={() => { if (paused) setSelected(null); setPaused(!paused); }}>
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          aria-label={speed === 1 ? "3× speed" : "1× speed"}
          onClick={() => setSpeed(speed === 1 ? 3 : 1)}
        >
          {speed}×
        </button>
        <button onClick={() => begin(answers, config, seed, replayMode ? replayRef.current ?? undefined : undefined)}>Restart</button>
      </div>
      {complete && (
        <div className="result-scrim">
          <section className="result-card" role="dialog">
            <p className="eyebrow">Experiment complete</p>
            <h1>{title(simulation.outcome)}</h1>
            <p>
              {simulation.stats.population} organisms across {simulation.stats.speciesRichness} living heritable variants;{" "}
              {simulation.stats.births} births, {simulation.stats.deaths} deaths and {simulation.stats.kills} consumption kills in total.
            </p>
            <div className="result-actions">
              <button
                onClick={() => {
                  setStage("questions");
                  setQi(2);
                }}
              >
                Change objective
              </button>
              <button onClick={() => begin(answers, config, seed, replayMode ? replayRef.current ?? undefined : undefined)}>
                Run same world
              </button>
              <button
                className="primary-button"
                onClick={async () => {
                  if (!replayRef.current) return setNotice("Replay not ready");
                  const u = new URL(location.origin + location.pathname);
                  // Council evidence can exceed server URL/header limits. Fragments stay client-side.
                  u.hash = new URLSearchParams({ replay: encodeReplay(replayRef.current) }).toString();
                  await navigator.clipboard.writeText(u.toString());
                  setNotice("Challenge link copied");
                }}
              >
                Copy challenge link
              </button>
            </div>
            {notice && <p className="copy-notice">{notice}</p>}
          </section>
        </div>
      )}
    </main>
  );
}
function Stat({
  id,
  label,
  value,
}: {
  id: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong data-testid={id}>{value}</strong>
    </div>
  );
}
