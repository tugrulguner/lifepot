"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { createReplay, decodeReplay, encodeReplay, type ReplayData } from "@/game/replay";
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
  stepSimulation,
  type FitnessKey,
  type LifeConfig,
  type SimulationState,
} from "@/game/world";
import { deathProgress, retainDeathTraces, type DeathTrace } from "@/game/visuals";

/** The public state shared by the review and simulation views. */
export type LifePotViewModel = {
  answers: SetupAnswers;
  config: LifeConfig;
  simulation: SimulationState;
};

type Stage = "questions" | "review" | "simulation";
type QuestionKey = keyof SetupAnswers;

const QUESTIONS: Array<{ key: QuestionKey; title: string; note: string; examples: string[] }> = [
  {
    key: "world",
    title: "What exists in this world?",
    note: "Describe its resources in one short sentence.",
    examples: ["Rich mineral pools clustered in a few oases", "Sparse nutrients scattered across open water"],
  },
  {
    key: "threat",
    title: "What threatens life here?",
    note: "Name the pressure and how it moves or changes.",
    examples: ["Toxic waves sweep across the world in pulses", "Predator packs hunt isolated cells", "Heat rises unpredictably around crowded colonies"],
  },
  {
    key: "reward",
    title: "What should life be rewarded for?",
    note: "Choose the behavior that should shape this population.",
    examples: ["Replicate quickly, even if individuals live shorter lives.", "Cooperate, adapt, and endure harsh conditions"],
  },
];

const EMPTY_ANSWERS: SetupAnswers = { world: "", threat: "", reward: "" };
const JUDGE_RESPONSE = z.object({
  config: lifeConfigSchema,
  source: z.enum(["jev", "fallback"]),
  requestHash: z.string().regex(/^setup_[a-z0-9]+$/),
  model: z.string().optional(),
  usage: z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative() }).strict().optional(),
}).strict();
type InterpretationProof = Pick<z.infer<typeof JUDGE_RESPONSE>, "source" | "model" | "usage">;
const FITNESS_ORDER: FitnessKey[] = ["survive", "replicate", "cooperate", "explore", "adapt"];
const LINEAGE_COLORS = ["#74f2ce", "#b6f08e", "#7ad8ff", "#e9b7ff", "#ffd37d", "#ff9e91"];

function seedFromHash(hash: string): number {
  let seed = 2166136261;
  for (let i = 0; i < hash.length; i += 1) seed = Math.imul(seed ^ hash.charCodeAt(i), 16777619);
  return seed >>> 0;
}

function environmentLabel(config: LifeConfig): string {
  const pulse = config.environment.volatility === "pulsing" ? " PULSES" : config.environment.volatility === "chaotic" ? " CHAOS" : "";
  return `${config.environment.abundance} · ${config.environment.distribution} · ${config.environment.hazard}${pulse}`.toUpperCase();
}

function plainEnvironment(config: LifeConfig): Array<[string, string]> {
  const abundance = config.environment.abundance === "rich" ? "Resources replenish quickly" : config.environment.abundance === "scarce" ? "Resources are hard to find" : "Resources replenish steadily";
  const distribution = config.environment.distribution === "clustered" ? "Food gathers in dense oases" : config.environment.distribution === "seasonal" ? "Food shifts in recurring bands" : "Food is dispersed across the dish";
  const hazard = config.environment.hazard === "toxin" ? "Toxins drain cells that feed" : config.environment.hazard === "heat" ? "Heat raises every cell’s energy cost" : config.environment.hazard === "crowding" ? "Dense colonies pay a crowding cost" : config.environment.hazard === "predator" ? "A moving hunter targets exposed, isolated cells" : "Drought slows resource recovery";
  const volatility = config.environment.volatility === "pulsing" ? "Pressure arrives in visible waves" : config.environment.volatility === "chaotic" ? "Pressure shifts unpredictably" : "Pressure remains mostly steady";
  return [["Resources", abundance], ["Pattern", distribution], ["Threat", hazard], ["Rhythm", volatility]];
}

function eventFor(previous: SimulationState, next: SimulationState): string {
  const births = next.stats.births - previous.stats.births;
  const deaths = next.stats.deaths - previous.stats.deaths;
  if (next.stats.maxGeneration > previous.stats.maxGeneration) return `Lineage ${firstLineage(next)} reached generation ${next.stats.maxGeneration}`;
  if (births > 0) return `${births} ${births === 1 ? "cell" : "cells"} replicated`;
  if (next.config.environment.volatility === "pulsing" && next.generation % 9 === 0) return `${next.config.environment.hazard} pulse crossed the east colony`;
  if (deaths > 0) return `${deaths} ${deaths === 1 ? "cell faded" : "cells faded"} under environmental pressure`;
  return next.stats.population ? "Cells are gathering energy from the resource field" : "The final lineage disappeared";
}

function firstLineage(state: SimulationState): number {
  for (let i = 0; i < state.lineage.length; i += 1) if (state.occupied[i]) return state.lineage[i];
  return 0;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function drawWorld(
  canvas: HTMLCanvasElement,
  state: SimulationState,
  previous: SimulationState | null,
  progress: number,
  time: number,
  reducedMotion: boolean,
  deathTraces: readonly DeathTrace[],
) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = rect.width; const h = rect.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#03110f"; ctx.fillRect(0, 0, w, h);

  const pad = Math.max(12, Math.min(w, h) * 0.025);
  const cellX = (w - pad * 2) / GRID_SIZE; const cellY = (h - pad * 2) / GRID_SIZE;
  const cell = Math.min(cellX, cellY);
  const organismScale = Math.sqrt(cellX * cellY);
  const worldW = cellX * GRID_SIZE; const worldH = cellY * GRID_SIZE;
  const ox = (w - worldW) / 2; const oy = (h - worldH) / 2;

  ctx.save();
  ctx.beginPath(); ctx.roundRect(ox - 5, oy - 5, worldW + 10, worldH + 10, Math.max(12, cell * 3)); ctx.clip();
  ctx.fillStyle = "#061c19"; ctx.fillRect(ox - 5, oy - 5, worldW + 10, worldH + 10);

  // A stippled resource field reads as microscopy rather than a spreadsheet grid.
  for (let i = 0; i < state.resources.length; i += 1) {
    const amount = state.resources[i] / 255;
    if (amount < 0.055) continue;
    const x = i % GRID_SIZE; const y = Math.floor(i / GRID_SIZE);
    const jitterX = (((i * 29 + state.seed) % 19) / 19 - 0.5) * cellX * 0.7;
    const jitterY = (((i * 47 + state.seed) % 23) / 23 - 0.5) * cellY * 0.7;
    ctx.globalAlpha = 0.06 + amount * 0.28;
    ctx.fillStyle = amount > 0.55 ? "#9ee6a5" : "#4b9d83";
    ctx.beginPath();
    ctx.arc(ox + (x + 0.5) * cellX + jitterX, oy + (y + 0.5) * cellY + jitterY, Math.max(0.65, cell * (0.12 + amount * 0.23)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const env = state.config.environment;
  const motion = reducedMotion ? state.generation : state.generation + (time % 2000) / 2000;
  const phase = ((motion * (env.volatility === "chaotic" ? 1.9 : 0.78)) % (GRID_SIZE + 22)) - 11;
  ctx.save();
  if (env.hazard === "toxin") {
    ctx.fillStyle = "rgba(85, 238, 186, .12)";
    ctx.fillRect(ox + phase * cellX - cellX * 5, oy, cellX * 9, worldH);
    ctx.strokeStyle = "rgba(148, 255, 216, .36)"; ctx.lineWidth = Math.max(1, cell * 0.18);
    ctx.beginPath(); ctx.moveTo(ox + phase * cellX, oy); ctx.lineTo(ox + (phase - 4) * cellX, oy + worldH); ctx.stroke();
  } else if (env.hazard === "heat") {
    ctx.fillStyle = "rgba(255, 105, 81, .11)";
    ctx.fillRect(ox, oy + phase * cellY - cellY * 5, worldW, cellY * 10);
  } else if (env.hazard === "drought") {
    ctx.fillStyle = "rgba(211, 170, 103, .09)";
    for (let i = 0; i < 8; i += 1) { ctx.beginPath(); ctx.arc(ox + ((i * 17 + state.seed) % 50) * cellX, oy + ((i * 31 + state.seed) % 50) * cellY, cell * 4, 0, Math.PI * 2); ctx.fill(); }
  } else if (env.hazard === "predator") {
    const hunterX = (state.seed + state.generation * 3) % GRID_SIZE;
    const hunterY = (state.seed * 7 + state.generation * 2) % GRID_SIZE;
    const px = ox + (hunterX + 0.5) * cellX; const py = oy + (hunterY + 0.5) * cellY;
    ctx.fillStyle = "rgba(255, 112, 102, .9)"; ctx.strokeStyle = "rgba(255, 184, 163, .9)";
    ctx.shadowColor = "#ff7066"; ctx.shadowBlur = Math.max(8, cell * 3);
    ctx.beginPath(); ctx.moveTo(px + cell * 1.4, py); ctx.lineTo(px - cell, py - cell * .9); ctx.lineTo(px - cell * .55, py); ctx.lineTo(px - cell, py + cell * .9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
  } else {
    ctx.strokeStyle = "rgba(237, 124, 207, .17)"; ctx.lineWidth = cell * 2.4;
    ctx.beginPath(); ctx.arc(ox + worldW / 2, oy + worldH / 2, Math.max(cell * 4, (phase + 12) * cell * .45), 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();

  const source = previous ?? state;
  for (let i = 0; i < state.occupied.length; i += 1) {
    const alive = state.occupied[i] === 1; const wasAlive = source.occupied[i] === 1;
    if (!alive) continue;
    const x = i % GRID_SIZE; const y = Math.floor(i / GRID_SIZE);
    const px = ox + (x + 0.5) * cellX; const py = oy + (y + 0.5) * cellY;
    const lineage = alive ? state.lineage[i] : source.lineage[i];
    const color = LINEAGE_COLORS[lineage % LINEAGE_COLORS.length];
    const born = !wasAlive;
    const alpha = born ? 0.3 + progress * 0.7 : 1;
    const radius = Math.max(1.8, organismScale * (born ? 0.28 + progress * .2 : .48));
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color; ctx.shadowBlur = Math.max(3, cell * (born ? 2.2 : .9));
    ctx.fillStyle = "rgba(6, 26, 22, .88)"; ctx.strokeStyle = color; ctx.lineWidth = Math.max(0.75, cell * .13);
    ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = color; ctx.globalAlpha = alpha * .88;
    ctx.beginPath(); ctx.arc(px + radius * .16, py - radius * .12, Math.max(.55, radius * .22), 0, Math.PI * 2); ctx.fill();
    if (born) {
      ctx.globalAlpha = (1 - progress) * .85; ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(px, py, radius + progress * cell * 1.8, 0, Math.PI * 2); ctx.stroke();
    }
  }
  for (const trace of deathTraces) {
    const death = deathProgress(time - trace.startedAt, reducedMotion);
    if (death >= 1) continue;
    const x = trace.index % GRID_SIZE; const y = Math.floor(trace.index / GRID_SIZE);
    const px = ox + (x + 0.5) * cellX; const py = oy + (y + 0.5) * cellY;
    const color = LINEAGE_COLORS[trace.lineage % LINEAGE_COLORS.length];
    const radius = organismScale * .48 * (1 - death);
    ctx.globalAlpha = 1 - death; ctx.strokeStyle = color; ctx.lineWidth = Math.max(.6, cell * .12);
    ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = color; ctx.globalAlpha = (1 - death) * .7;
    for (let p = 0; p < 3; p += 1) { ctx.beginPath(); ctx.arc(px + (p - 1) * cell * death, py + ((p % 2) - .5) * cell * death, Math.max(.35, organismScale * .06 * (1 - death)), 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(165, 244, 217, .22)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(ox - 5, oy - 5, worldW + 10, worldH + 10, Math.max(12, cell * 3)); ctx.stroke();
}

function WorldCanvas({ state, previous }: { state: SimulationState; previous: SimulationState | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedRef = useRef(false);
  const deathTracesRef = useRef<DeathTrace[]>([]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = media.matches;
    const update = () => { reducedRef.current = media.matches; };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    let frame = 0; const started = performance.now();
    const traces = retainDeathTraces(deathTracesRef.current, started, reducedRef.current)
      .filter((trace) => !state.occupied[trace.index]);
    if (!reducedRef.current && previous) {
      for (let i = 0; i < state.occupied.length; i += 1) {
        if (previous.occupied[i] && !state.occupied[i] && !traces.some((trace) => trace.index === i)) {
          traces.push({ index: i, lineage: previous.lineage[i], startedAt: started });
        }
      }
    }
    deathTracesRef.current = traces;
    const paint = (time: number) => {
      const progress = reducedRef.current ? 1 : Math.min(1, (time - started) / 420);
      deathTracesRef.current = retainDeathTraces(deathTracesRef.current, time, reducedRef.current);
      drawWorld(canvas, state, previous, progress, time, reducedRef.current, deathTracesRef.current);
      if (progress < 1 || deathTracesRef.current.length) frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    const observer = new ResizeObserver(() => drawWorld(canvas, state, previous, 1, performance.now(), reducedRef.current, deathTracesRef.current));
    observer.observe(canvas);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [state, previous]);
  return <canvas ref={canvasRef} className="life-canvas" role="img" aria-label={`Cellular world at generation ${state.generation}; ${state.stats.population} living cells`} />;
}

export function GameCanvas() {
  const [stage, setStage] = useState<Stage>("questions");
  const [answers, setAnswers] = useState<SetupAnswers>(EMPTY_ANSWERS);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [config, setConfig] = useState<LifeConfig | null>(null);
  const [seed, setSeed] = useState(0);
  const [simulation, setSimulation] = useState<SimulationState | null>(null);
  const [previous, setPrevious] = useState<SimulationState | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<1 | 3>(1);
  const [event, setEvent] = useState("The seeded cells are waking in the resource field");
  const [loading, setLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [interpretation, setInterpretation] = useState<InterpretationProof | null>(null);
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const replayRef = useRef<ReplayData | null>(null);

  const currentQuestion = QUESTIONS[questionIndex];
  const isComplete = simulation ? simulation.outcome !== "running" : false;

  const beginSimulation = useCallback((nextAnswers: SetupAnswers, nextConfig: LifeConfig, nextSeed: number) => {
    const initial = createSimulation({ seed: nextSeed, config: nextConfig });
    replayRef.current = createReplay({ answers: nextAnswers, config: nextConfig, seed: nextSeed, requestHash: hashSetupRequest(nextAnswers) });
    setAnswers(nextAnswers); setConfig(nextConfig); setSeed(nextSeed); setPrevious(null); setSimulation(initial);
    setPaused(false); setEvent("36 seeded cells are waking in the resource field"); setStage("simulation");
  }, []);

  useEffect(() => {
    const payload = new URL(window.location.href).searchParams.get("replay");
    if (!payload) return;
    const timer = window.setTimeout(() => {
      try {
        const replay = decodeReplay(payload);
        beginSimulation(replay.answers, replay.config, replay.seed);
        window.history.replaceState(null, "", `${window.location.pathname}?replay=${payload}`);
      } catch {
        setSetupError("This challenge link is invalid or has been changed.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [beginSimulation]);

  useEffect(() => {
    if (stage === "questions") inputRef.current?.focus();
    else headingRef.current?.focus();
  }, [stage, questionIndex]);

  useEffect(() => {
    if (!simulation || paused || simulation.outcome !== "running") return;
    const delay = speed === 3 ? 30 : 245;
    const timer = window.setTimeout(() => {
      setSimulation((current) => {
        if (!current || current.outcome !== "running") return current;
        let next = current;
        const steps = speed === 3 ? 3 : 1;
        for (let i = 0; i < steps && next.outcome === "running"; i += 1) next = stepSimulation(next);
        setPrevious(current); setEvent(eventFor(current, next));
        return next;
      });
    }, simulation.generation === 0 ? 520 : delay);
    return () => window.clearTimeout(timer);
  }, [simulation, paused, speed]);

  const requestSetup = useCallback(async (nextAnswers: SetupAnswers) => {
    const canonical = canonicalAnswers(nextAnswers); const requestHash = hashSetupRequest(canonical);
    setLoading(true); setSetupError(null);
    try {
      const response = await fetch("/api/judge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: canonical, requestHash }) });
      if (!response.ok) throw new Error("request");
      const parsed = JUDGE_RESPONSE.safeParse(await response.json());
      if (!parsed.success || parsed.data.requestHash !== requestHash) throw new Error("shape");
      setAnswers(canonical); setConfig(parsed.data.config); setSeed(seedFromHash(requestHash)); setInterpretation({ source: parsed.data.source, model: parsed.data.model, usage: parsed.data.usage }); setStage("review");
    } catch {
      const fallback = deterministicSetup(canonical);
      setAnswers(canonical); setConfig(fallback); setSeed(seedFromHash(requestHash)); setInterpretation({ source: "fallback" }); setSetupError(null); setStage("review");
    } finally { setLoading(false); }
  }, []);

  const submitQuestion = (eventObject: React.FormEvent) => {
    eventObject.preventDefault();
    const value = answers[currentQuestion.key].trim();
    if (!value) return;
    if (questionIndex < QUESTIONS.length - 1) setQuestionIndex((index) => index + 1);
    else void requestSetup(answers);
  };

  const useFallback = () => {
    const canonical = canonicalAnswers(answers); const requestHash = hashSetupRequest(canonical);
    setConfig(deterministicSetup(canonical)); setSeed(seedFromHash(requestHash)); setInterpretation({ source: "fallback" }); setSetupError(null); setStage("review");
  };

  const restart = () => {
    if (config) beginSimulation(answers, config, seed);
  };

  const changeAnswer = () => {
    window.history.replaceState(null, "", window.location.pathname);
    setStage("questions"); setQuestionIndex(2); setSimulation(null); setPrevious(null); setSetupError(null); setNotice("");
  };

  const copyReplay = async () => {
    if (!replayRef.current) return;
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set("replay", encodeReplay(replayRef.current));
    try { await navigator.clipboard.writeText(url.toString()); setNotice("Challenge link copied"); }
    catch { setNotice("Copy failed — use your browser’s address controls"); }
  };

  const topFitness = useMemo(() => {
    if (!config) return null;
    return FITNESS_ORDER.reduce((best, key) => config.fitness[key] > config.fitness[best] ? key : best, FITNESS_ORDER[0]);
  }, [config]);

  if (stage === "questions") {
    return (
      <main className="setup-shell">
        <header className="brand-bar"><span className="brand-orbit" aria-hidden="true" /><Link href="/">LIFEPOT</Link><span>Cellular life experiment</span></header>
        <section className="question-panel" aria-labelledby="question-title">
          <div className="step-label">QUESTION {questionIndex + 1} / 3</div>
          <div className="progress-track" aria-hidden="true"><i style={{ width: `${((questionIndex + 1) / 3) * 100}%` }} /></div>
          <p className="eyebrow">Define selection pressure</p>
          <h1 id="question-title" ref={headingRef}>{currentQuestion.title}</h1>
          <p className="question-note">{currentQuestion.note}</p>
          <form onSubmit={submitQuestion}>
            <label className="sr-only" htmlFor="world-answer">{currentQuestion.title}</label>
            <div className="answer-field">
              <input
                ref={inputRef}
                id="world-answer"
                aria-label={currentQuestion.title}
                value={answers[currentQuestion.key]}
                maxLength={140}
                autoComplete="off"
                onChange={(e) => setAnswers((current) => ({ ...current, [currentQuestion.key]: e.target.value }))}
                placeholder="Type a short answer…"
              />
              <span>{answers[currentQuestion.key].length}/140</span>
            </div>
            <div className="chips" aria-label="Example answers">
              {currentQuestion.examples.map((example) => <button key={example} type="button" onClick={() => { setAnswers((current) => ({ ...current, [currentQuestion.key]: example })); inputRef.current?.focus(); }}>{example}</button>)}
            </div>
            {setupError && <div className="setup-error" role="alert"><p>{setupError}</p><div><button type="button" onClick={() => void requestSetup(answers)}>Retry</button><button type="button" onClick={useFallback}>Use deterministic setup</button></div></div>}
            <div className="question-footer">
              <span>Press Enter to continue</span>
              <div>{questionIndex > 0 && <button className="back-button" type="button" onClick={() => setQuestionIndex((index) => index - 1)}>Back</button>}<button className="primary-button" disabled={!answers[currentQuestion.key].trim() || loading}>{loading ? "Interpreting…" : questionIndex === 2 ? "Review world" : "Continue"}</button></div>
            </div>
          </form>
        </section>
        <aside className="setup-specimen" aria-hidden="true"><span /><i /><b /></aside>
      </main>
    );
  }

  if (stage === "review" && config) {
    return (
      <main className="review-shell">
        <header className="brand-bar"><span className="brand-orbit" aria-hidden="true" /><Link href="/">LIFEPOT</Link><span>Interpretation complete</span></header>
        <section className="review-card" aria-labelledby="review-title">
          <p className="eyebrow">Your experimental world</p>
          <h1 id="review-title" ref={headingRef} tabIndex={-1}>World conditions</h1>
          <p className="environment-code">{environmentLabel(config)}</p>
          <p className={`interpreter-proof ${interpretation?.source === "jev" ? "is-jev" : "is-fallback"}`} data-testid="interpreter-source">
            <span aria-hidden="true" />{interpretation?.source === "jev" ? `Jev API · ${interpretation.model ?? "jev-latest"}${interpretation.usage ? ` · ${interpretation.usage.input_tokens} input / ${interpretation.usage.output_tokens} output tokens` : ""}` : "Deterministic interpreter · no API usage"}
          </p>
          <div className="condition-list">{plainEnvironment(config).map(([label, text]) => <div key={label}><span>{label}</span><p>{text}</p></div>)}</div>
          <div className="fitness-review">
            <div><p className="eyebrow">Selection rewards</p><strong>{titleCase(topFitness ?? "survive")} leads</strong></div>
            <FitnessBars config={config} />
          </div>
          <p className="review-note">The same answers and seed always recreate this exact 50 × 50 world.</p>
          <button className="primary-button seed-button" onClick={() => beginSimulation(answers, config, seed)}>Seed life <span aria-hidden="true">→</span></button>
        </section>
      </main>
    );
  }

  if (!simulation || !config) return null;
  return (
    <main className="simulation-shell">
      <WorldCanvas state={simulation} previous={previous} />
      <header className="simulation-header">
        <div className="sim-brand"><span className="brand-orbit" aria-hidden="true" /><strong>LIFEPOT</strong><small>LIVE CULTURE</small></div>
        <div className="environment-strip"><span className="hazard-dot" />{environmentLabel(config)}</div>
      </header>
      <section className="stats-strip" aria-label="Live simulation statistics" aria-live="polite">
        <Stat label="Generation" value={`${simulation.generation} / ${DEFAULT_GENERATIONS}`} testId="generation" />
        <Stat label="Population" value={simulation.stats.population} testId="population" />
        <Stat label="Births" value={simulation.stats.births} testId="births" accent="birth" />
        <Stat label="Deaths" value={simulation.stats.deaths} testId="deaths" accent="death" />
        <Stat label="Max lineage gen." value={simulation.stats.maxGeneration} testId="lineage-generation" />
        <Stat label="Outcome" value={titleCase(simulation.outcome)} testId="outcome" />
      </section>
      <aside className="fitness-overlay" aria-label="Fitness weights"><p>FITNESS KEY</p><FitnessBars config={config} /></aside>
      <div className="legend"><span><i className="resource-key" />Resource</span><span><i className="birth-key" />Birth</span><span><i className="hazard-key" />{titleCase(config.environment.hazard)}</span></div>
      <div className="ticker" aria-live="polite"><span>EVENT</span><p>{event}</p></div>
      <div className="controls" aria-label="Simulation controls">
        <button onClick={() => setPaused((value) => !value)}>{paused ? "Resume" : "Pause"}</button>
        <button aria-label={speed === 1 ? "3× speed" : "1× speed"} onClick={() => setSpeed((value) => value === 1 ? 3 : 1)}>{speed}×</button>
        <button onClick={restart}>Restart</button>
      </div>
      <p className="sr-only" aria-live="polite">Generation {simulation.generation}. Population {simulation.stats.population}. {simulation.stats.births} births and {simulation.stats.deaths} deaths.</p>
      {isComplete && <ResultCard state={simulation} onChange={changeAnswer} onRestart={restart} onCopy={() => void copyReplay()} notice={notice} />}
    </main>
  );
}

function FitnessBars({ config }: { config: LifeConfig }) {
  return <div className="fitness-bars">{FITNESS_ORDER.map((key) => <div key={key}><span>{key}</span><i><b style={{ width: `${Math.max(3, config.fitness[key] * 100)}%` }} /></i></div>)}</div>;
}

function Stat({ label, value, testId, accent }: { label: string; value: string | number; testId: string; accent?: string }) {
  return <div className={accent ? `stat stat-${accent}` : "stat"}><span>{label}</span><strong data-testid={testId}>{value}</strong></div>;
}

function ResultCard({ state, onChange, onRestart, onCopy, notice }: { state: SimulationState; onChange: () => void; onRestart: () => void; onCopy: () => void; notice: string }) {
  const cardRef = useRef<HTMLElement>(null);
  useEffect(() => { cardRef.current?.focus(); }, []);
  const title = titleCase(state.outcome);
  return <div className="result-scrim"><section ref={cardRef} className="result-card" role="dialog" aria-modal="true" aria-labelledby="result-title" tabIndex={-1}><p className="eyebrow">Experiment complete · generation {state.generation}</p><h1 id="result-title">{title}</h1><p>{state.outcome === "thriving" ? "The population expanded into a resilient living field." : state.outcome === "surviving" ? "Life persists, holding a narrow foothold in this world." : "Selection pressure removed the final living lineage."}</p><dl><div><dt>Final population</dt><dd>{state.stats.population}</dd></div><div><dt>Cells born</dt><dd>{state.stats.births}</dd></div><div><dt>Cells lost</dt><dd>{state.stats.deaths}</dd></div><div><dt>Lineage generation</dt><dd>{state.stats.maxGeneration}</dd></div></dl><div className="result-actions"><button onClick={onChange}>Change one answer</button><button onClick={onRestart}>Run same world</button><button className="primary-button" onClick={onCopy}>Copy challenge link</button></div>{notice && <p className="copy-notice" role="status">{notice}</p>}</section></div>;
}
