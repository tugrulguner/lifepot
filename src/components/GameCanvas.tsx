"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { publicDocuments } from "@/app/project-docs/content";
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
  validateSpeciesDirectives,
  type EvolutionDecision,
  type EvolutionLedger,
} from "@/game/decisions";
import {
  activeDecisionForGeneration,
  advanceUntilDecisionTrigger,
} from "@/game/runtime";
import { CreatureInspector } from "./CreatureInspector";
import { SpeciesFocus } from "./SpeciesFocus";
import WorldPreview from "./WorldPreview";
import { RunResults } from "./RunResults";
import { RunReflectionPanel } from "./RunReflectionPanel";
import { RunComparison } from "./RunComparison";
import { decodeDecisionResponse, failureReasonSchema, failureLabels, type FailureReason } from "@/game/decision-status";
import ResultImageShare from "./ResultImageShare";
import { createRunEvidence, followRunLineage, observeRun, type RunEvidence } from "@/game/run-evidence";
import type { SpeciesId } from "@/game/rules";
import { FamilyHeader } from "./FamilyHeader";
import { cellAtPoint } from "@/game/inspection";
import { updateEventEffects, EVENT_LIFETIME, type TimedOrganismEvent } from "@/game/event-effects";
import { WorldObservatory } from "./WorldObservatory";
import { SetupCouncil, RuntimeCouncil } from "./CouncilPanel";
import { setupFidelitySchema, setupFailureSchema, setupNamedIntentSchema, SETUP_REVIEW_QUESTIONS, type SetupFidelity, type SetupFailure, type SetupNamedIntent } from "@/game/setup-review";
import { speciesColor } from "@/game/species-colors";
import { isSurvivingNewborn, relationshipLabel, triggerLabel } from "@/game/visuals";
export type LifePotViewModel = {
  answers: SetupAnswers;
  config: LifeConfig;
  simulation: SimulationState;
};
type Stage = "questions" | "review" | "simulation";
type Theme = "light" | "dark" | "auto";
function ThemeControl({ theme, onChange }: { theme: Theme; onChange: (theme: Theme) => void }) {
  return <label className="theme-control">Theme <select aria-label="Color theme" value={theme} onChange={event => onChange(event.target.value as Theme)}><option value="auto">Auto</option><option value="light">Light</option><option value="dark">Dark</option></select></label>;
}
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
    note: "This preference influences the mechanics and adaptive policies. It is not a prediction or a success score.",
    examples: [
      "Diversify while prey and predators coexist",
      "Favor armored swarms and efficient hunters",
    ],
  },
];
const EMPTY: SetupAnswers = { world: "", threat: "", reward: "" };
const RECORDED_PRESET: SetupAnswers = {
  world: "Rich mineral pools with abundant prey",
  threat: "Predator packs hunt through pulsing droughts",
  reward: "Diversify while prey and predators coexist",
};
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
    fidelity: setupFidelitySchema.optional(),
    fallbackReason: failureReasonSchema.optional(),
    failure: setupFailureSchema.optional(),
    provenance: z.object({ outcome: z.string(), reason: z.string().optional() }).optional(),
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
function draw(canvas: HTMLCanvasElement, state: SimulationState, selected: number | null, followed: number | null, effects: TimedOrganismEvent[] = [], now = 0, focusedSpecies: SpeciesId | null = null) {
  const rect = canvas.getBoundingClientRect(),
    dpr = Math.min(devicePixelRatio || 1, 2);
  // Detached or hidden boards have no drawable interior; resize will repaint.
  if (rect.width <= 36 || rect.height <= 36) return;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const c = canvas.getContext("2d");
  if (!c) return;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = getComputedStyle(canvas).getPropertyValue("--mp-canvas").trim() || "#03110f";
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
    c.globalAlpha = focusedSpecies && state.config.rules?.species[state.ruleSpecies[i] - 1]?.id !== focusedSpecies ? .15 : 1;
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
function World({ state, selected, followed, focusedSpecies, onInspect }: { state: SimulationState; selected: number | null; followed: number | null; focusedSpecies: SpeciesId | null; onInspect: (index: number) => void }) {
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
    const paint=()=>{const now=performance.now();effects.current=updateEventEffects(effects.current,[],now,reduced);if(ref.current)draw(ref.current,state,selected,followed,effects.current,now,focusedSpecies);if(effects.current.length)frame=requestAnimationFrame(paint);};
    paint();
    const o = new ResizeObserver(paint);o.observe(ref.current);
    const themeObserver = new MutationObserver(() => paint());
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {o.disconnect();themeObserver.disconnect();cancelAnimationFrame(frame);};
  }, [state, selected, followed, focusedSpecies]);
  return (
    <canvas
      ref={ref}
      className="life-canvas"
      data-focused-species={focusedSpecies ?? "all"}
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
  const [question, setQuestion] = useState("");
  const [initialConfig, setInitialConfig] = useState<LifeConfig | null>(null);
  const [decisionReasons, setDecisionReasons] = useState<Record<number, FailureReason>>({});
  const [policy, setPolicy] = useState<"adaptive" | "fixed">("adaptive");
  const [evidence, setEvidence] = useState<RunEvidence | null>(null);
  const evidenceRef = useRef<RunEvidence | null>(null);
  const [baseline, setBaseline] = useState<{ evidence: RunEvidence; config: LifeConfig; policy: "adaptive" | "fixed" } | null>(null);
  const [showResults, setShowResults] = useState(true);
  const completionSeen = useRef(false);
  const [interpreting, setInterpreting] = useState(false);
  const [manuallyEdited, setManuallyEdited] = useState(false);
  const [focusedSpecies, setFocusedSpecies] = useState<SpeciesId | null>(null);
  const [theme, setTheme] = useState<Theme>("auto");
  useEffect(() => {
    const media = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    const sync = () => {
      const stored = localStorage.getItem("lifepot-theme");
      const choice = stored === "light" || stored === "dark" || stored === "auto" ? stored : "auto";
      setTheme(choice);
      document.documentElement.dataset.theme = choice === "auto" ? (media?.matches ? "dark" : "light") : choice;
    };
    sync();
    media?.addEventListener("change", sync);
    return () => media?.removeEventListener("change", sync);
  }, []);
  const changeTheme = (choice: Theme) => {
    setTheme(choice);
    localStorage.setItem("lifepot-theme", choice);
    const isDark = typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = choice === "dark" || (choice === "auto" && isDark);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  };
  const [stage, setStage] = useState<Stage>("questions"),
    [arrivalRevision, setArrivalRevision] = useState(0),
    [answers, setAnswers] = useState(EMPTY),
    [qi, setQi] = useState(0),
    [config, setConfig] = useState<LifeConfig | null>(null),
    [proof, setProof] = useState<{
      source: "jev" | "fallback";
      model?: string;
      usage?: { input_tokens: number; output_tokens: number };
      fidelity?: SetupFidelity;
      fallbackReason?: FailureReason;
      failure?: SetupFailure;
      namedIntent?: SetupNamedIntent;
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
    runId = useRef(0),
    pendingArrival = useRef(false);
  const complete = simulation && simulation.outcome !== "running";
  useEffect(() => {
    if (!complete || stage !== "simulation") return;
    if (!completionSeen.current) {
      completionSeen.current = true;
      document.getElementById("run-results")?.focus();
      document.getElementById("run-results")?.scrollIntoView({ block: "start" });
    }
  }, [complete, stage]);
  useLayoutEffect(() => {
    if (stage !== "simulation" || !pendingArrival.current) return;
    pendingArrival.current = false;
    window.scrollTo(0, 0);
  }, [stage, arrivalRevision]);
  const begin = useCallback(
    (a: SetupAnswers, c: LifeConfig, s: number, replay?: ReplayData) => {
      const initial = createSimulation({ seed: s, config: c, engineVersion: replay?.engineVersion }),
        l = replay?.ledger ?? [];
      runId.current++;
      ledgerRef.current = l;
      simRef.current = initial;
      initialConfigRef.current = structuredClone(c);
      replayRef.current = replay ?? null;
      setAnswers(a);
      setConfig(c);
      setInitialConfig(structuredClone(c));
      setDecisionReasons({});
      setSeed(s);
      setSimulation(initial);
      const observations = createRunEvidence(initial);
      evidenceRef.current = observations;
      setEvidence(observations);
      completionSeen.current = false;
      setShowResults(true);
      setNotice("");
      setLedger(l);
      setReplayMode(Boolean(replay));
      setPaused(false);
      setSelected(null);
      setFollowed(null);
      setFocusedSpecies(null);
      setDeciding(false);
      pending.current = null;
      setEvent(
        replay
          ? "Replay v3 loaded — zero live Jev calls"
          : `${initial.stats.population} founders seeded across ${initial.config.rules!.species.length} configured species`,
      );
      pendingArrival.current = true;
      setArrivalRevision(revision => revision + 1);
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
        if (policy === "fixed") {
          d = deterministicEvolutionDecision(summary);
        } else {
        const r = await fetch("/api/judge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "evolution", summary }),
          signal: AbortSignal.timeout(20_000),
        });
        if (!r.ok) throw 0;
        const decoded = decodeDecisionResponse(await r.json());
        d = decoded.decision;
        if (decoded.reason && id === runId.current) setDecisionReasons(previous => ({ ...previous, [simulation.generation]: decoded.reason! }));
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
        }
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
  }, [answers, replayMode, simulation, stage, policy]);
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
            step => { if (evidenceRef.current) evidenceRef.current = observeRun(evidenceRef.current, step); },
          );
          if (next === simulation) return;
          simRef.current = next;
          setSimulation(next);
          setEvidence(evidenceRef.current);
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
        engineVersion: simulation.engineVersion,
      });
    } catch {
      queueMicrotask(() =>
        setNotice("Replay validation failed; challenge link unavailable"),
      );
    }
  }, [answers, replayMode, simulation]);
  async function interpret(a: SetupAnswers) {
    if (interpreting) return;
    setInterpreting(true);
    const ca = canonicalAnswers(a),
      hash = hashSetupRequest(ca);
    try {
      const r = await fetch("/api/judge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: ca, requestHash: hash }),
          signal: AbortSignal.timeout(20_000),
        }),
        p = RESPONSE.parse(await r.json());
      if (p.requestHash !== hash) throw 0;
      const namedIntent = setupNamedIntentSchema.safeParse(p.evidence?.establishedIntent);
      setConfig(p.config);
      setProof({ source: p.source, model: p.model, usage: p.usage, fidelity: p.fidelity, fallbackReason: p.fallbackReason, failure: p.failure, namedIntent: namedIntent.success ? namedIntent.data : undefined });
    } catch {
      setConfig(deterministicSetup(ca));
      setProof({ source: "fallback" });
    }
    setAnswers(ca);
    setSeed(seedFromHash(hash));
    setInterpreting(false);
    setManuallyEdited(false);
    setStage("review");
  }
  function loadDeterministicPreset() {
    const preset = canonicalAnswers(RECORDED_PRESET), hash = hashSetupRequest(preset);
    setAnswers(preset);
    setConfig(deterministicSetup(preset));
    setProof({ source: "fallback" });
    setSeed(seedFromHash(hash));
    setReplayMode(false);
    setManuallyEdited(false);
    setStage("review");
  }
  function stepOnce() {
    if (!simulation || !paused || deciding || complete) return;
    setPaused(true);
    setSelected(null);
    const next = advanceUntilDecisionTrigger(simulation, ledgerRef.current, 1, step => { if (evidenceRef.current) evidenceRef.current = observeRun(evidenceRef.current, step); });
    simRef.current = next;
    setSimulation(next);
    setEvidence(evidenceRef.current);
    setEvent(`Generation ${next.generation}: ${next.stats.births - simulation.stats.births} births · ${next.stats.deaths - simulation.stats.deaths} deaths. Select an organism to inspect recorded feeding.`);
  }
  if (stage === "questions") {
    const q = QUESTIONS[qi];
    return (
      <main className="setup-shell">
        <FamilyHeader><span className="header-detail">Co-evolution laboratory</span><ThemeControl theme={theme} onChange={changeTheme} /></FamilyHeader>
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
                  disabled={!answers[q.key].trim() || interpreting}
                >
                  {interpreting ? "Interpreting your world…" : qi === 2 ? "Review ecosystem" : "Continue"}
                </button>
              </div>
            </div>
          </form>
          {qi === 0 && (
            <details className="setup-intro">
              <summary>How LifePot works · guides & credits</summary>
              <p>
                Three answers shape your world. Jev proposes ecology, LifePot turns
                validated rules into a deterministic artificial-life simulation
                you can inspect and replay. A deterministic fallback is available
                when Jev is not.
              </p>
              <p className="setup-boundary">
                An experimental game, not a biological forecast.{' '}
                <Link href="/learn">Player & developer guides ↗</Link>{' · '}
                {publicDocuments.some((document) => document.slug === "roadmap") && <><Link href="/project-docs/roadmap">Roadmap ↗</Link>{' · '}</>}
                <a href="https://github.com/tugrulguner/lifepot/tree/main/docs" target="_blank" rel="noopener noreferrer">About LifePot ↗</a>
              </p>
              <p className="creator-attribution">Created by <a aria-label="Created by Tugrul Guner" href="https://tugrul.modepot.io/">Tugrul Guner</a></p>
            </details>
          )}
          {qi === 0 && <button type="button" className="back-button" onClick={loadDeterministicPreset}>Explore deterministic preset</button>}
        </section>
      </main>
    );
  }
  if (stage === "review" && config)
    return (
      <main className="review-shell">
        <FamilyHeader><span className="header-detail">Interpretation complete</span><ThemeControl theme={theme} onChange={changeTheme} /></FamilyHeader>
        <section className="review-card">
          <p className="eyebrow">Founder ecology</p>
          <h1>World conditions</h1>
          {baseline && <p className="baseline-notice">Your previous run is kept as the baseline. Edit a condition below and keep the same seed to compare. {baseline.policy === "fixed" && policy === "fixed" ? "Both trials use fixed rules." : "Adaptive AI policies can differ between trials; this is not a controlled causal comparison."}</p>}
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
          {proof?.fidelity?.verdict === "approve" && proof.fidelity.repairAttempted && <p role="status">Jev corrected its proposed food web and checked it again against your original answers. Review the corrected world below before seeding.</p>}
          {proof?.fidelity && proof.fidelity.verdict !== "approve" && <section aria-label="Setup needs clarification" role="alert">
            <p>Our proposed world still needs review; your answers have been kept. {proof.fidelity.repairAttempted ? "Jev attempted one bounded correction, but this world is not yet approved for seeding." : "This world has not yet been approved for seeding."}</p>
            {proof.fidelity.repairFailure ? <p>Correction could not finish: {failureLabels[proof.fidelity.repairFailure]}. You do not need to rewrite your answers to retry.</p> : <p>Jev&apos;s suggested review focus: {SETUP_REVIEW_QUESTIONS[proof.fidelity.focus ?? "general"]}</p>}
            <button disabled={interpreting} onClick={() => interpret(answers)}>Ask Jev to reinterpret</button>
            <button disabled={interpreting} onClick={loadDeterministicPreset}>Explore deterministic preset instead</button>
          </section>}
          {proof?.fallbackReason && <p role="status">Setup interpretation unavailable: {failureLabels[proof.fallbackReason]}. This preview is a fallback, not a Jev-approved interpretation.</p>}
          {(proof?.failure ?? proof?.fidelity?.failure) && <p role="status">Setup failure stage: {(proof?.failure ?? proof?.fidelity?.failure)!.stage.replaceAll("_", " ")}.</p>}
          {proof?.fidelity?.mismatches?.length ? <section aria-label="Food-web contract conflicts"><p>The corrected proposal conflicts with the established food web:</p><ul>{proof.fidelity.mismatches.map((message, index) => <li key={index}>{message}</li>)}</ul></section> : null}
          {proof?.namedIntent && <p>Established organism intent: {proof.namedIntent.species.map(species => `${species.id} — ${species.name} (${species.role})`).join("; ")}.</p>}
          <WorldPreview config={config} answers={answers} onChange={next => { setConfig(next); setManuallyEdited(true); }} />
          <div className="experiment-intent">
            <label>Your question or prediction (optional)<input aria-label="Your question or prediction (optional)" value={question} maxLength={240} placeholder="What would you like to investigate?" onChange={event => setQuestion(event.target.value)}/></label>
            <p>This stays in this session. It is not sent to Jev, does not change the mechanics, and is not automatically scored.</p>
            <label>World policy<select aria-label="World policy" value={policy} onChange={event => setPolicy(event.target.value as "adaptive" | "fixed")}><option value="adaptive">Adaptive ecology — Jev may change bounded rules</option><option value="fixed">Fixed world rules — no runtime AI interventions</option></select></label>
            <p>{policy === "fixed" ? "Initial conditions still evolve through feeding, reproduction, mutation and death. No new AI policy is applied during play." : "At ecological triggers, Jev may propose birth policies or change supported world rules. Actual changes remain inspectable."}</p>
          </div>
          <details className="setup-evidence"><summary>Validated mechanics and original setup evidence</summary>
          {manuallyEdited && <p>Conditions were edited by you. Original AI evidence below is not a confirmation of those edits.</p>}
          <div className="condition-list" aria-label="Validated world rules">
            {config.rules?.species.map(species => <div key={species.id}><span>Species {species.id}</span><p>{title(species.role)} · {title(species.selfInteraction)} within species<br/>Founder strategy: {title(species.role === "hunter" || species.role === "omnivore" ? config.founders.predatorStrategy : config.founders.preyStrategy)}</p></div>)}
            {config.rules?.interactions.map(edge => <div key={edge.pair}><span>{edge.pair}</span><p>{relationshipLabel(edge.pair, edge.mode)}</p></div>)}
            {Object.entries(config.rules?.environment ?? {}).map(([key, value]) => <div key={key}><span>{title(key)}</span><p>{title(value)}</p></div>)}
            <div><span>Initial resources</span><p>{title(config.environment.abundance)} · {title(config.environment.distribution)}</p></div>
          </div>
          {config.rules && <SetupCouncil rules={config.rules}/>}
          {proof?.usage && <p>Setup total: {proof.usage.input_tokens} input / {proof.usage.output_tokens} output tokens (interpretation, fidelity review, any bounded correction, and council selection).</p>}
          </details>
          <button className="back-button" onClick={() => { setQi(0); setStage("questions"); }}>Edit setup answers</button>
          <p className="review-note">These are the validated mechanics, not unrestricted interpretations of your prose. Roles do not imply feeding links: consumption follows the relationship graph. Extinct species are not automatically restored.</p>
          <button
            className="primary-button seed-button"
            disabled={!!proof?.fidelity && proof.fidelity.verdict !== "approve"}
            onClick={() => { if (proof?.fidelity && proof.fidelity.verdict !== "approve") return; begin(answers, config, seed, replayMode ? replayRef.current ?? undefined : undefined); }}
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
      <section className="run-status" aria-label="Run status"><strong role="status">{complete ? simulation.stats.population === 0 ? "World empty" : "Observation complete" : deciding ? "Waiting for a bounded ecology decision — the world is held still" : paused ? "Paused — inspect life or step one generation" : "Running — watch, inspect, or pause"}</strong><span>{replayMode ? "Exact recorded replay · no inference" : policy === "fixed" ? "Fixed world rules" : "Adaptive ecology"}{question ? ` · Your question: ${question}` : ""}</span></section>
      {Object.keys(decisionReasons).length > 0 && <details className="decision-availability"><summary>Adaptive availability · {Object.keys(decisionReasons).length} abstentions with reported reasons</summary><ul>{Object.entries(decisionReasons).map(([generation, reason]) => <li key={generation}>Generation {generation}: {failureLabels[reason]}. No new policy was applied; inherited behavior continued.</li>)}</ul></details>}
      <World state={simulation} selected={selected} followed={followed} focusedSpecies={focusedSpecies} onInspect={index => { setSelected(index); setPaused(true); }} />
      <SpeciesFocus state={simulation} selected={focusedSpecies} onSelect={setFocusedSpecies} />
      <CreatureInspector state={simulation} evidence={evidence} index={selected} followed={followed} onFollow={lineage => {
        setFollowed(lineage);
        if (evidenceRef.current) {
          evidenceRef.current = followRunLineage(evidenceRef.current, simulation, lineage);
          setEvidence(evidenceRef.current);
        }
      }} onClear={() => setSelected(null)} onPick={() => { const index = simulation.guild.findIndex(value => value > 0); if (index >= 0) { setSelected(index); setPaused(true); } }} />
      <FamilyHeader><div className="environment-strip">{title(simulation.config.rules!.environment.pressure)} · {title(simulation.config.rules!.environment.volatility)}</div><ThemeControl theme={theme} onChange={changeTheme} /></FamilyHeader>
      <div className="observatory-boundary"><WorldObservatory state={simulation} ledger={ledger.filter(item => item.generation <= simulation.generation)} replay={replayMode} /></div>
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
        {!complete && <button onClick={() => { if (paused) setSelected(null); setPaused(!paused); }}>
          {paused ? "Resume" : "Pause"}
        </button>}
        {!complete && <button aria-label="Step one generation" disabled={!paused || deciding} onClick={stepOnce}>Step</button>}
        <button
          aria-label={speed === 1 ? "3× speed" : "1× speed"}
          onClick={() => setSpeed(speed === 1 ? 3 : 1)}
        >
          {speed}×
        </button>
        <button onClick={() => begin(answers, config, seed, replayMode ? replayRef.current ?? undefined : undefined)}>{replayMode ? "Restart replay" : "Restart trial"}</button>
        {complete && <button onClick={() => { setShowResults(true); completionSeen.current = false; queueMicrotask(() => { document.getElementById("run-results")?.scrollIntoView({ block: "start" }); document.getElementById("run-results")?.focus(); }); }}>View results</button>}
        <button onClick={() => { const index = simulation.guild.findIndex(value => value > 0); if (index >= 0) { setSelected(index); setPaused(true); document.getElementById("creature-inspector")?.scrollIntoView({ behavior: "smooth", block: "start" }); } }}>Inspect living organism</button>
        <button onClick={() => document.getElementById("world-observatory")?.scrollIntoView({ behavior: "smooth", block: "start" })}>World observatory</button>
      </div>
      {complete && showResults && evidence && <RunResults state={simulation} evidence={evidence} question={question}
        onInspect={() => { setShowResults(false); document.querySelector<HTMLCanvasElement>(".life-canvas")?.focus(); }}
        onReplay={() => { if (replayRef.current) begin(answers, initialConfigRef.current ?? config, seed, replayRef.current); else setNotice("Replay is not ready yet."); }}
        onEdit={() => { setBaseline({ evidence, config: structuredClone(initialConfigRef.current ?? config), policy }); setConfig(structuredClone(initialConfigRef.current ?? config)); setReplayMode(false); setManuallyEdited(false); setStage("review"); window.scrollTo(0, 0); }}
        onNew={() => { setBaseline(null); setAnswers(EMPTY); setQuestion(""); setQi(0); setStage("questions"); window.scrollTo(0, 0); }}>
        {baseline && <RunComparison before={baseline} after={{ evidence, config: initialConfig ?? config }} adaptive={baseline.policy === "adaptive" || policy === "adaptive"}/>}
        <RunReflectionPanel key={`reflection-${simulation.seed}-${simulation.generation}`} evidence={evidence} config={initialConfig ?? config} onExperiment={experiment => {
          const next = structuredClone(initialConfigRef.current ?? config);
          for (const change of experiment.changes) {
            const keys = change.path.split(".");
            let target: Record<string, unknown> = next as unknown as Record<string, unknown>;
            for (const key of keys.slice(0, -1)) target = target[key] as Record<string, unknown>;
            target[keys.at(-1)!] = change.value;
          }
          const validated = lifeConfigSchema.parse(next);
          setBaseline({ evidence, config: structuredClone(initialConfigRef.current ?? config), policy });
          setConfig(validated); setReplayMode(false); setManuallyEdited(true); setStage("review"); window.scrollTo(0, 0);
        }}/>

        <ResultImageShare key={`${simulation.seed}-${simulation.generation}`} state={simulation} question={question} evidence={evidence}/>
        <button className="back-button" onClick={async () => { try { if (!replayRef.current) return setNotice("Replay not ready"); const url = new URL(location.origin + location.pathname); url.hash = new URLSearchParams({ replay: encodeReplay(replayRef.current) }).toString(); await navigator.clipboard.writeText(url.toString()); setNotice("Replay link copied"); } catch { setNotice("Clipboard unavailable. Use the result image download instead."); } }}>Copy challenge link</button>
        {notice && <p role="status">{notice}</p>}
      </RunResults>}
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
