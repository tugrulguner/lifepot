"use client";
import { CreatorSocialLinks } from "./CreatorSocialLinks";
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
import { WatchingOrganism } from "./WatchingOrganism";
import { SpeciesFocus } from "./SpeciesFocus";
import WorldPreview from "./WorldPreview";
import { RunResults } from "./RunResults";
import { MyWorldsPanel } from "./MyWorldsPanel";
import { listWorlds, type WorldRecord } from "@/game/my-worlds";
import { RunReflectionPanel } from "./RunReflectionPanel";
import { RunComparison } from "./RunComparison";
import { decodeDecisionResponse, failureReasonSchema, failureLabels, type FailureReason } from "@/game/decision-status";
import ResultImageShare from "./ResultImageShare";
import { createRunEvidence, followRunLineage, observeRun, type RunEvidence } from "@/game/run-evidence";
import type { SpeciesId } from "@/game/rules";
import { FamilyHeader } from "./FamilyHeader";
import { cellAtPoint } from "@/game/inspection";
import { boundCamera, followCamera, NEUTRAL_CAMERA, screenToWorld, type Camera, type FollowTarget } from "@/game/camera";
import { selectEventEffects, updateEventEffects, EVENT_LIFETIME, type TimedOrganismEvent } from "@/game/event-effects";
import { WorldObservatory } from "./WorldObservatory";
import { GameplayObservation } from "./GameplayObservation";
import { SetupCouncil, RuntimeCouncil } from "./CouncilPanel";
import { setupFidelitySchema, setupFailureSchema, setupNamedIntentSchema, SETUP_REVIEW_QUESTIONS, type SetupFidelity, type SetupFailure, type SetupNamedIntent } from "@/game/setup-review";
import { speciesColor } from "@/game/species-colors";
import { organismSprite, paintOrganism } from "@/game/organism-glyphs";
import OrganismArtwork from "./OrganismArtwork";
import { gameplayAnalytics } from "@/app/gameplay-analytics";
import { isSurvivingNewborn, relationshipLabel, triggerLabel } from "@/game/visuals";
export type LifePotViewModel = {
  answers: SetupAnswers;
  config: LifeConfig;
  simulation: SimulationState;
};
type Stage = "questions" | "review" | "simulation";
type Theme = "light" | "dark" | "auto";
type PlaybackSpeed = "slow" | "normal" | "fast";
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
    provenance: z.object({ outcome: z.enum(["decided", "abstained", "reselect", "reject", "needs_clarification"]), reason: failureReasonSchema.optional() }).optional(),
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
function draw(canvas: HTMLCanvasElement, state: SimulationState, selected: number | null, followed: number | null, effects: TimedOrganismEvent[] = [], now = 0, focusedSpecies: SpeciesId | null = null, camera: Camera = NEUTRAL_CAMERA) {
  const rect = canvas.getBoundingClientRect(),
    dpr = Math.min(devicePixelRatio || 1, 2);
  // Detached or hidden boards have no drawable interior; resize will repaint.
  if (rect.width <= 36 || rect.height <= 36) return;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const c = canvas.getContext("2d");
  if (!c) return;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  // The ecosystem remains a dark, low-glare observation surface in either site theme.
  c.fillStyle = getComputedStyle(canvas).getPropertyValue("--mp-canvas").trim() || "#020a09";
  c.fillRect(0, 0, rect.width, rect.height);
  if (camera.zoom !== 1) {
    c.beginPath(); c.rect(18, 18, rect.width - 36, rect.height - 36); c.clip();
    c.setTransform(dpr * camera.zoom, 0, 0, dpr * camera.zoom,
      dpr * ((1 - camera.zoom) * rect.width / 2 + camera.x * (rect.width - 36)),
      dpr * ((1 - camera.zoom) * rect.height / 2 + camera.y * (rect.height - 36)));
  }
  const pad = 18,
    cw = (rect.width - pad * 2) / GRID_SIZE,
    ch = (rect.height - pad * 2) / GRID_SIZE;
  // A quiet coordinate lattice gives the board a readable habitat map without
  // suggesting routes or terrain the simulation does not encode.
  c.save();
  c.strokeStyle = "rgba(141, 190, 163, .025)";
  c.lineWidth = 0.5;
  c.beginPath();
  for (let cell = 0; cell <= GRID_SIZE; cell += 5) {
    const x = pad + cell * cw, y = pad + cell * ch;
    c.moveTo(x, pad); c.lineTo(x, rect.height - pad);
    c.moveTo(pad, y); c.lineTo(rect.width - pad, y);
  }
  c.stroke();
  c.restore();
  // Quiet, measured 5×5 averages establish the habitat without thousands of
  // repeated symbols competing with life. These are fields, not new terrain.
  for (let row = 0; row < GRID_SIZE; row += 5) {
    for (let col = 0; col < GRID_SIZE; col += 5) {
      let resources = 0, hazards = 0;
      for (let y = row; y < row + 5; y++) for (let x = col; x < col + 5; x++) {
        resources += state.resources[y * GRID_SIZE + x];
        hazards += state.hazards[y * GRID_SIZE + x];
      }
      const resource = resources / (25 * 255), hazard = hazards / (25 * 255);
      const x = pad + (col + 2.5) * cw, y = pad + (row + 2.5) * ch;
      if (resource > .08) {
        const glow = c.createRadialGradient(x, y, 0, x, y, Math.max(cw, ch) * 4);
        glow.addColorStop(0, `rgba(117, 210, 142, ${resource * .16})`);
        glow.addColorStop(1, "rgba(117, 210, 142, 0)");
        c.fillStyle = glow;
        c.fillRect(x - cw * 4, y - ch * 4, cw * 8, ch * 8);
      }
      if (hazard > .025) {
        c.fillStyle = `rgba(255, 128, 109, ${hazard * .10})`;
        c.fillRect(pad + col * cw, pad + row * ch, cw * 5, ch * 5);
      }
    }
  }
  // Magnification reveals exact-cell cues on empty cells; organisms retain
  // priority. Exact values remain available through cell inspection at any zoom.
  if (camera.zoom >= 2) for (let i = 0; i < state.resources.length; i++) {
    if (state.guild[i]) continue;
    const x = i % GRID_SIZE, y = Math.floor(i / GRID_SIZE), r = state.resources[i] / 255;
    const cx = pad + (x + .5) * cw, cy = pad + (y + .5) * ch;
    if (r > .08) {
      c.globalAlpha = .06 + r * .14;
      c.fillStyle = "#83d99a";
      c.beginPath(); c.arc(cx, cy, Math.min(cw, ch) * (.08 + r * .12), 0, Math.PI * 2); c.fill();
    }
    const hazard = state.hazards[i] / 255;
    if (hazard > .025) {
      c.globalAlpha = .08 + hazard * .18;
      c.strokeStyle = "#ff806d"; c.lineWidth = Math.min(cw, ch) * .08;
      const d = Math.min(cw, ch) * .18;
      c.beginPath(); c.moveTo(cx - d, cy - d); c.lineTo(cx, cy + d); c.lineTo(cx + d, cy - d); c.stroke();
    }
  }
  c.globalAlpha = 1;
  const importantActors = new Set<number>();
  const focusedSlot = state.config.rules?.species.findIndex(species => species.id === focusedSpecies) ?? -1;
  const focusHasLife = !focusedSpecies || state.guild.some((alive, index) => alive > 0 && state.ruleSpecies[index] === focusedSlot + 1);
  // Keep a lost focus as the player’s choice, without making surviving life
  // look absent. Explicit selected/pinned subjects still receive full contrast.
  const contextAlpha = focusHasLife ? .15 : .45;
  for (let i = 0; i < state.guild.length; i++) {
    if (!state.guild[i]) continue;
    // Explicit observation targets remain legible across a species filter.
    // This changes paint only; the selected cell and lineage pin keep their authority.
    c.globalAlpha = focusedSpecies && state.config.rules?.species[state.ruleSpecies[i] - 1]?.id !== focusedSpecies && i !== selected && state.lineage[i] !== followed ? contextAlpha : 1;
    const x = i % GRID_SIZE, y = Math.floor(i / GRID_SIZE), species = state.config.rules?.species[state.ruleSpecies[i] - 1];
    const pitch = Math.min(cw, ch), color = speciesColor(species?.id ?? "");
    const cx = pad + (x + .5) * cw, cy = pad + (y + .5) * ch;
    const sprite = organismSprite(species?.role, color, pitch, dpr * camera.zoom);
    if (sprite) c.drawImage(sprite, cx - pitch / 2, cy - pitch / 2, pitch, pitch);
    else paintOrganism(c, species?.role, color, cx, cy, pitch);
    if (i === selected || state.lineage[i] === followed) {
      importantActors.add(state.organismId[i]);
      const isSelected = i === selected;
      c.save();
      const focusRadius = pitch * .32;
      // A dark contrast keyline keeps both the solid selection and dashed
      // family trail legible over pale habitat marks and colorful organisms.
      c.setLineDash(isSelected ? [] : [Math.max(1.2, cw * .22), Math.max(1, cw * .13)]);
      c.strokeStyle = "#07100f";
      c.lineWidth = Math.max(1, pitch * .3);
      c.beginPath(); c.arc(cx, cy, focusRadius, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = isSelected ? "#ffffff" : "#ffd36a";
      c.lineWidth = Math.max(1.5, pitch * .17);
      c.beginPath(); c.arc(cx, cy, focusRadius, 0, Math.PI * 2); c.stroke();
      c.restore();
    }
    if (isSurvivingNewborn(state.generation, state.age[i], state.organismGeneration[i], state.guild[i])) {
      // A static birth dot remains readable under reduced motion, distinct from selection.
      c.fillStyle = "#ffffff"; c.beginPath(); c.arc(cx + pitch * .3, cy - pitch * .3, pitch * .08, 0, Math.PI * 2); c.fill();
    }
  }
  for (const event of selectEventEffects(effects, importantActors)) {
    const remaining = Math.max(0, (event.expiresAt - now) / EVENT_LIFETIME);
    if (!remaining) continue;
    const x = pad + (event.at % GRID_SIZE + .5) * cw, y = pad + (Math.floor(event.at / GRID_SIZE) + .5) * ch;
    const pitch = Math.min(cw, ch), radius = pitch * (.24 + (1 - remaining) * .12);
    c.globalAlpha = remaining * .85; c.lineWidth = Math.max(.6, pitch * .1);
    c.strokeStyle = event.kind === "birth" ? "#ffffff" : event.kind === "death" ? "#ff8877" : "#ffd65c";
    c.beginPath();
    if (event.kind === "death") {
      c.moveTo(x - radius, y - radius); c.lineTo(x + radius, y + radius);
      c.moveTo(x + radius, y - radius); c.lineTo(x - radius, y + radius);
    } else if (event.kind === "birth") {
      // Four short rays differ from selection rings and gold feeding circles.
      for (let n = 0; n < 4; n++) {
        const a = n * Math.PI / 2, inner = pitch * .28, outer = pitch * .46;
        c.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner);
        c.lineTo(x + Math.cos(a) * outer, y + Math.sin(a) * outer);
      }
    } else c.arc(x, y, event.source === "resource" ? radius * .65 : radius, 0, Math.PI * 2);
    c.stroke();
  }
  c.globalAlpha=1;
}
function World({ state, selected, followed, focusedSpecies, onInspect, onCameraUpdate }: { state: SimulationState; selected: number | null; followed: number | null; focusedSpecies: SpeciesId | null; onInspect: (index: number) => void; onCameraUpdate: (message: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [camera, setCamera] = useState<Camera>(NEUTRAL_CAMERA);
  const [target, setTarget] = useState<FollowTarget | null>(null);
  const [releasedNotice, setReleasedNotice] = useState("");
  // A changed pin revokes camera authority, rather than temporarily masking it.
  // Guarded local render adjustment prevents a re-pin from reviving the target.
  if (target?.kind === "family" && target.id !== followed) {
    setTarget(null);
    setCamera(NEUTRAL_CAMERA);
    setReleasedNotice("Family pin changed. Full world restored.");
  }
  const [dragEnabled, setDragEnabled] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number; start: Camera; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const validTarget = target?.kind === "family" && target.id !== followed ? null : target;
  const tracked = validTarget ? followCamera(camera, state, validTarget) : null;
  const view = target ? tracked ?? NEUTRAL_CAMERA : camera;
  const lost = !!target && !tracked;
  const cameraUpdate = lost ? validTarget ? `${target!.kind === "organism" ? "Organism" : "Family"} #${target!.id} is no longer living. Full world restored.` : "Family pin changed. Full world restored." : releasedNotice;
  useEffect(() => onCameraUpdate(cameraUpdate), [cameraUpdate, onCameraUpdate]);
  // Only deliberate panel actions return to the watching view. Engine ticks,
  // target loss, resize and theme changes must preserve later user scrolling.
  const returnToWorld = () => { window.scrollTo(0, 0); ref.current?.focus({ preventScroll: true }); };
  const zoom = (delta: number) => { setReleasedNotice(""); if (lost) setTarget(null); setCamera(boundCamera({ ...view, zoom: view.zoom + delta })); };
  const pan = (x: number, y: number) => { setReleasedNotice(""); setTarget(null); setCamera(boundCamera({ ...view, x: view.x + x, y: view.y + y })); };
  const reset = () => { setReleasedNotice(""); setTarget(null); setCamera(NEUTRAL_CAMERA); setDragEnabled(false); };
  const follow = (next: FollowTarget) => { setReleasedNotice(""); setCamera({ ...view, zoom: Math.max(2, view.zoom) }); setTarget(next); };
  const effects=useRef<TimedOrganismEvent[]>([]),last=useRef<SimulationState|null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas?.parentElement) return;
    // Fit the watching view from actual content height, including retained notices.
    // Document coordinates keep later deliberate scrolling from resizing the world.
    const fit = () => {
      // A queued ResizeObserver callback can outlive the canvas on replay/review.
      if (!canvas.isConnected || !canvas.parentElement) return;
      const top = canvas.getBoundingClientRect().top + window.scrollY;
      // Short windows cannot contain every surface above the fold. Preserve a
      // drawable habitat and allow normal page scrolling instead of collapsing it.
      const minimum = Math.min(300, canvas.parentElement.clientWidth);
      const available = window.innerHeight - top - 12;
      // Keep fitting legitimate smaller boards after notices grow. Fall back to
      // vertical scrolling only when less than half a readable habitat fits.
      const height = available >= minimum / 2 ? available : minimum;
      canvas.style.setProperty("--board-available-height", `${height}px`);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(canvas.parentElement);
    for (const sibling of canvas.parentElement.children) {
      if (sibling !== canvas) observer.observe(sibling);
    }
    window.addEventListener("resize", fit);
    fit();
    return () => { observer.disconnect(); window.removeEventListener("resize", fit); };
  }, []);
  useEffect(() => {
    if (!ref.current) return;
    const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(last.current!==state){
      if(!last.current||state.generation<=last.current.generation)effects.current=[];
      effects.current=updateEventEffects(effects.current,state.recentEvents.filter(e=>e.generation>(last.current?.generation??-1)),performance.now(),reduced);
      last.current=state;
    }
    let frame=0;
    const paint=()=>{const now=performance.now();effects.current=updateEventEffects(effects.current,[],now,reduced);if(ref.current)draw(ref.current,state,validTarget?.kind === "organism" && tracked ? state.organismId.findIndex(id => id === validTarget.id) : selected,followed,effects.current,now,focusedSpecies,view);if(effects.current.length)frame=requestAnimationFrame(paint);};
    paint();
    const o = new ResizeObserver(paint);o.observe(ref.current);
    const themeObserver = new MutationObserver(() => paint());
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {o.disconnect();themeObserver.disconnect();cancelAnimationFrame(frame);};
  }, [state, selected, followed, focusedSpecies, view, validTarget, tracked]);
  return (
    <>
    <canvas
      ref={ref}
      className="life-canvas"
      data-camera-zoom={view.zoom}
      data-camera-x={view.x}
      data-camera-y={view.y}
      data-camera-follow={tracked ? validTarget?.kind : "none"}
      style={{ touchAction: dragEnabled && view.zoom > 1 ? "none" : "pan-y", cursor: view.zoom > 1 ? "grab" : "crosshair" }}
      data-focused-species={focusedSpecies ?? "all"}
      tabIndex={0}
      title="Tap to inspect. Zoom with +/−; Shift+arrows pan; 0 resets. Enable Drag to pan on touch screens."
      onKeyDown={e => {
        const moves: Record<string, [number, number]> = { ArrowLeft: [.1, 0], ArrowRight: [-.1, 0], ArrowUp: [0, .1], ArrowDown: [0, -.1] };
        if (e.shiftKey && e.key in moves) { e.preventDefault(); pan(...moves[e.key]); return; }
        if (e.key === "+" || e.key === "=") { e.preventDefault(); zoom(.5); return; }
        if (e.key === "-") { e.preventDefault(); zoom(-.5); return; }
        if (e.key === "0") { e.preventDefault(); reset(); return; }
        const delta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -GRID_SIZE, ArrowDown: GRID_SIZE };
        if (e.key in delta) { e.preventDefault(); onInspect(((selected ?? 0) + delta[e.key] + state.guild.length) % state.guild.length); }
        if (e.key === "Enter") { e.preventDefault(); const index = state.guild.findIndex(Boolean); if (index >= 0) onInspect(index); }
      }}
      onPointerDown={e => {
        suppressClick.current = false;
        if (view.zoom <= 1 || e.button !== 0 || (e.pointerType === "touch" && !dragEnabled)) return;
        drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, start: view, moved: false };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={e => {
        const start = drag.current;
        if (!start || start.id !== e.pointerId) return;
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (!start.moved && Math.hypot(dx, dy) < 6) return;
        start.moved = true; suppressClick.current = true;
        const rect = e.currentTarget.getBoundingClientRect();
        if (rect.width <= 36 || rect.height <= 36) return;
        setTarget(null);
        setCamera(boundCamera({ ...start.start, x: start.start.x + dx / (rect.width - 36), y: start.start.y + dy / (rect.height - 36) }));
      }}
      onPointerUp={e => { if (drag.current?.id === e.pointerId) { drag.current = null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); } }}
      onPointerCancel={() => { drag.current = null; suppressClick.current = true; }}
      onLostPointerCapture={() => { drag.current = null; }}
      onClick={e => {
        if (suppressClick.current) { suppressClick.current = false; return; }
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left, y = e.clientY - rect.top;
        if (x < 18 || y < 18 || x >= rect.width - 18 || y >= rect.height - 18) return;
        const point = screenToWorld({ x, y }, { ...view, x: view.x * (rect.width - 36), y: view.y * (rect.height - 36) }, rect);
        const index = cellAtPoint(point.x, point.y, rect.width, rect.height);
        if (index !== null) onInspect(index);
      }}
      role="img"
      aria-label={`Ecosystem generation ${state.generation}; ${state.stats.population} organisms`}
    />
    <section className="camera-tools" aria-label="World camera">
      <div className="camera-buttons">
        <button aria-label="Zoom out" disabled={view.zoom <= 1} onClick={() => { zoom(-.5); returnToWorld(); }}>−</button>
        <output aria-label="Camera zoom">{view.zoom}×</output>
        <button aria-label="Zoom in" disabled={view.zoom >= 3} onClick={() => { zoom(.5); returnToWorld(); }}>+</button>
        <button onClick={() => { reset(); returnToWorld(); }}>Full world</button>
        <button aria-pressed={dragEnabled} disabled={view.zoom <= 1} onClick={() => { setDragEnabled(!dragEnabled); returnToWorld(); }}>Drag to pan</button>
      </div>
      <div className="camera-buttons">
        <button aria-label="Follow organism with camera" disabled={selected === null || !state.guild[selected]} onClick={() => { if (selected !== null && state.guild[selected]) { follow({ kind: "organism", id: state.organismId[selected] }); returnToWorld(); } }}>Follow organism</button>
        <button aria-label="Follow pinned family with camera" disabled={followed === null || !state.lineage.some((id, i) => id === followed && !!state.guild[i])} onClick={() => { if (followed !== null) { follow({ kind: "family", id: followed }); returnToWorld(); } }}>Follow pinned family</button>
        {target && <button onClick={() => { setReleasedNotice(""); setCamera(view); setTarget(null); returnToWorld(); }}>Stop camera follow</button>}
      </div>
      <p role="status">{lost ? validTarget ? `${target!.kind === "organism" ? "Organism" : "Family"} #${target!.id} is no longer living. Full world restored.` : "Family pin changed. Full world restored." : tracked ? `Camera follows ${validTarget!.kind} #${validTarget!.id}${validTarget!.kind === "family" ? " through its oldest living member" : ""}.` : releasedNotice || "Camera is free. Zoom and drag to explore; the simulation is unchanged."}</p>
      <details><summary>Camera controls</summary><p>Mouse: drag while zoomed. Touch: enable Drag to pan; turn it off to scroll the page over the board. Tap without dragging to inspect. Keyboard on the board: +/− zoom, Shift+arrows pan, 0 restores the full world. Following tracks identity through movement. At a wrapping edge the camera moves to the other side; family following switches to the oldest surviving member.</p></details>
    </section>
    </>
  );
}
export function GameCanvas() {
  const [cameraUpdate, setCameraUpdate] = useState("");
  const [isExample, setIsExample] = useState(false);
  const exampleJourney = useRef(0);
  const exampleRequest = useRef<AbortController | null>(null);
  const cancelExample = useCallback(() => {
    exampleJourney.current++;
    exampleRequest.current?.abort();
    exampleRequest.current = null;
  }, []);
  const [exampleTips, setExampleTips] = useState(true);
  const [question, setQuestion] = useState("");
  const [initialConfig, setInitialConfig] = useState<LifeConfig | null>(null);
  const [decisionReasons, setDecisionReasons] = useState<Record<number, FailureReason>>({});
  const [policy, setPolicy] = useState<"adaptive" | "fixed">("adaptive");
  const [fixedBaselineReview, setFixedBaselineReview] = useState(false);
  const [evidence, setEvidence] = useState<RunEvidence | null>(null);
  const evidenceRef = useRef<RunEvidence | null>(null);
  const [baseline, setBaseline] = useState<{ evidence: RunEvidence; config: LifeConfig; seed: number; decisions: EvolutionLedger; policy: "adaptive" | "fixed" | "recorded" } | null>(null);
  const [showResults, setShowResults] = useState(true);
  const [parentWorldId, setParentWorldId] = useState<string | null>(null);
  const [originWorldId, setOriginWorldId] = useState<string | null>(null);
  const [localWorldName, setLocalWorldName] = useState("");
  const [archivedEvidence, setArchivedEvidence] = useState<RunEvidence | null>(null);
  const [recordedPolicy, setRecordedPolicy] = useState<"adaptive" | "fixed" | "recorded">("recorded");
  const [currentReplay, setCurrentReplay] = useState<ReplayData | null>(null);
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
      requestFailed?: boolean;
    } | null>(null),
    [seed, setSeed] = useState(0),
    [simulation, setSimulation] = useState<SimulationState | null>(null),
    [paused, setPaused] = useState(false),
    [selected, setSelected] = useState<number | null>(null),
    [followed, setFollowed] = useState<number | null>(null),
    [speed, setSpeed] = useState<PlaybackSpeed>("slow"),
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
    pendingArrival = useRef(false),
    analyticsProof = useRef<typeof proof>(null),
    analyticsBaseline = useRef(false),
    acceptedFollowup = useRef(false);
  useEffect(() => { analyticsProof.current = proof; analyticsBaseline.current = Boolean(baseline); }, [proof, baseline]);
  const complete = simulation && simulation.outcome !== "running";
  const completedReplay = currentReplay;
  useEffect(() => {
    if (!complete || stage !== "simulation") return;
    if (!completionSeen.current) {
    completionSeen.current = true;
    if (!replayMode && simulation) gameplayAnalytics.runCompleted(`run-${runId.current}`, { reason: simulation.outcome, generations: simulation.generation, interpretation: analyticsProof.current?.source ?? "fallback" });
    document.getElementById("run-results")?.focus();
      document.getElementById("run-results")?.scrollIntoView({ block: "start" });
    }
  }, [complete, stage, replayMode, simulation]);
  useLayoutEffect(() => {
    if (stage !== "simulation" || !pendingArrival.current) return;
    pendingArrival.current = false;
    window.scrollTo(0, 0);
  }, [stage, arrivalRevision]);
  const begin = useCallback(
    (a: SetupAnswers, c: LifeConfig, s: number, replay?: ReplayData) => {
      cancelExample();
      const initial = createSimulation({ seed: s, config: c, engineVersion: replay?.engineVersion }),
        l = replay?.ledger ?? [];
      runId.current++;
      ledgerRef.current = l;
      simRef.current = initial;
      initialConfigRef.current = structuredClone(c);
      replayRef.current = replay ?? null;
      setCurrentReplay(replay ?? null);
      if (!replay) { setIsExample(false); setOriginWorldId(null); setArchivedEvidence(null); }
      const analyticsRunId = `run-${runId.current}`;
      if (replay) gameplayAnalytics.replayStarted(analyticsRunId, "local", replay.engineVersion);
      else {
        gameplayAnalytics.runStarted(analyticsRunId, { mode: "fresh", interpretation: analyticsProof.current?.source ?? "fallback", engine: initial.engineVersion });
        if (acceptedFollowup.current) { gameplayAnalytics.followUpAccepted(analyticsRunId, "changed_conditions"); acceptedFollowup.current = false; }
      }
      setAnswers(a);
      setCameraUpdate("");
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
      setFixedBaselineReview(false);
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
    [cancelExample],
  );
  async function openSavedWorld(record: WorldRecord) {
    cancelExample();
    setIsExample(false);
    setOriginWorldId(record.id); setParentWorldId(record.parentId);
    setLocalWorldName(record.name); setArchivedEvidence(record.evidence);
    setBaseline(null);
    let missingParent = false;
    if (record.parentId) {
      try {
        const parent = (await listWorlds()).find(item => item.id === record.parentId);
        if (parent) setBaseline({ evidence: parent.evidence, config: parent.replay.config, seed: parent.replay.seed, decisions: parent.replay.ledger, policy: parent.policy ?? "recorded" });
        else missingParent = true;
      } catch { missingParent = true; }
    }
    setRecordedPolicy(record.policy ?? "recorded");
    setQuestion(""); setProof(record.setup ?? null);
    setPolicy(record.policy === "fixed" ? "fixed" : "adaptive");
    begin(record.replay.answers, record.replay.config, record.replay.seed, record.replay);
    if (missingParent) setNotice("Saved follow-up parent is missing; its original comparison is unavailable.");
  }
  function reviewSavedWorld(record: WorldRecord) {
    cancelExample();
    setLocalWorldName(record.name); setArchivedEvidence(null);
    const original = structuredClone(record.replay.config);
    setParentWorldId(record.id); setOriginWorldId(null);
    setAnswers(record.replay.answers); setConfig(original); setSeed(record.replay.seed);
    setProof(record.setup ?? null); setQuestion(""); setSimulation(null);
    setBaseline({ evidence: record.evidence, config: original, seed: record.replay.seed, decisions: record.replay.ledger, policy: "recorded" });
    setPolicy(record.policy === "fixed" ? "fixed" : "adaptive");
    setReplayMode(false); setFixedBaselineReview(false); setManuallyEdited(false);
    setNotice("Review the saved conditions and choose a change before seeding a new experiment. This is not a replay.");
    setStage("review"); window.scrollTo(0, 0);
  }
  useEffect(() => {
    let cancelled = false;
    if (location.hash === "#example") {
      const journey = exampleJourney.current;
      const controller = new AbortController();
      exampleRequest.current = controller;
      const current = () => !cancelled && !controller.signal.aborted && exampleJourney.current === journey && location.hash === "#example";
      const navigate = () => { if (location.hash !== "#example") cancelExample(); };
      window.addEventListener("hashchange", navigate);
      void fetch("/example-world.json", { signal: controller.signal }).then(response => {
        if (!response.ok) throw new Error("Example unavailable");
        return response.json();
      }).then(example => {
        if (!current()) return;
        const r = decodeReplay(example.replay);
        if (!current()) return;
        exampleRequest.current = null;
        begin(r.answers, r.config, r.seed, r);
        setIsExample(true); setSpeed("normal"); setExampleTips(true);
      }).catch(() => { if (current()) setNotice("The example could not be loaded. You can still create your own world."); });
      return () => {
        cancelled = true; controller.abort();
        if (exampleRequest.current === controller) exampleRequest.current = null;
        window.removeEventListener("hashchange", navigate);
      };
    }
    const p = new URLSearchParams(location.hash.slice(1)).get("replay") ?? new URL(location.href).searchParams.get("replay");
    if (p)
      try {
        const r = decodeReplay(p);
        queueMicrotask(() => begin(r.answers, r.config, r.seed, r));
      } catch {
        queueMicrotask(() => setNotice("Invalid or legacy replay rejected"));
      }
  }, [begin, cancelExample]);
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
            speed === "fast" ? 3 : 1,
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
      speed === "slow" ? 1000 : simulation.generation === 0 ? 450 : speed === "fast" ? 35 : 220,
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
      const completed = replayRef.current;
      queueMicrotask(() => setCurrentReplay(completed));
    } catch {
      queueMicrotask(() =>
        setNotice("Replay validation failed; challenge link unavailable"),
      );
    }
  }, [answers, replayMode, simulation]);
  async function interpret(a: SetupAnswers) {
    cancelExample();
    if (interpreting) return;
    setInterpreting(true);
    const ca = canonicalAnswers(a),
      hash = hashSetupRequest(ca);
    let failureCategory: "rate_limited" | "provider_unavailable" | "invalid_response" | "unknown" = "unknown";
    try {
      const r = await fetch("/api/judge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: ca, requestHash: hash }),
          signal: AbortSignal.timeout(20_000),
        });
      if (!r.ok) {
        if (r.status === 429) failureCategory = "rate_limited";
        else if (r.status >= 500) failureCategory = "provider_unavailable";
        throw new Error("Setup request failed");
      }
      let payload: unknown;
      try {
        payload = await r.json();
      } catch {
        failureCategory = "invalid_response";
        throw new Error("Setup response was not valid JSON");
      }
      let p: z.infer<typeof RESPONSE>;
      try {
        p = RESPONSE.parse(payload);
      } catch {
        failureCategory = "invalid_response";
        throw new Error("Setup response did not match its schema");
      }
      if (p.requestHash !== hash) {
        failureCategory = "invalid_response";
        throw new Error("Setup response did not match its request");
      }
      const namedIntent = setupNamedIntentSchema.safeParse(p.evidence?.establishedIntent);
      setConfig(p.config);
      setProof({ source: p.source, model: p.model, usage: p.usage, fidelity: p.fidelity, fallbackReason: p.fallbackReason, failure: p.failure, namedIntent: namedIntent.success ? namedIntent.data : undefined });
      if (p.fidelity && p.fidelity.verdict !== "approve") gameplayAnalytics.setupFailed("setup_rejected");
      if (p.source === "fallback") {
        const reason = p.fallbackReason ?? p.failure?.code ?? p.fidelity?.failure?.code ?? p.provenance?.reason;
        setProof(current => current ? { ...current, requestFailed: true, fallbackReason: reason ?? "unknown" } : current);
        if (reason) {
          const category = reason === "rate_limited" ? "rate_limited"
            : reason === "unavailable" || reason === "missing_credentials" ? "provider_unavailable"
            : reason === "invalid_response" ? "invalid_response" : "unknown";
          gameplayAnalytics.setupFailed(category);
        }
      }
    } catch {
      gameplayAnalytics.setupFailed(failureCategory);
      setConfig(deterministicSetup(ca));
      setProof({ source: "fallback", requestFailed: true, fallbackReason: failureCategory === "provider_unavailable" ? "unavailable" : failureCategory === "rate_limited" ? "rate_limited" : failureCategory === "invalid_response" ? "invalid_response" : "unknown" });
    }
    setAnswers(ca);
    setSeed(seedFromHash(hash));
    setInterpreting(false);
    setManuallyEdited(false);
    setStage("review");
  }
  function loadDeterministicPreset() {
    cancelExample();
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
        <FamilyHeader feedbackPath="/play"><span className="header-detail">Co-evolution laboratory</span><ThemeControl theme={theme} onChange={changeTheme} /></FamilyHeader>
        <section className="question-panel" onInputCapture={cancelExample} onClickCapture={cancelExample} onSubmitCapture={cancelExample}>
          <div id="my-worlds-entry" />
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
              <div className="creator-row"><p className="creator-attribution">Created by <a aria-label="Created by Tugrul Guner" href="https://tugrul.modepot.io/">Tugrul Guner</a></p><CreatorSocialLinks /></div>
            </details>
          )}
          {qi === 0 && <button type="button" className="back-button" onClick={loadDeterministicPreset}>Explore deterministic preset</button>}
        </section>
        <MyWorldsPanel entryShortcut onOpen={openSavedWorld} onReview={reviewSavedWorld} />
      </main>
    );
  }
  if (stage === "review" && config)
    return (
      <main className={`review-shell${parentWorldId ? " ph-no-capture" : ""}`} data-ph-no-capture={parentWorldId ? true : undefined}>
        <FamilyHeader feedbackPath="/play"><span className="header-detail">Interpretation complete</span><ThemeControl theme={theme} onChange={changeTheme} /></FamilyHeader>
        <section className="review-card">
          <p className="eyebrow">Founder ecology</p>
          {localWorldName && <p className="world-identity">Experiment: <strong>{localWorldName}</strong></p>}
          <h1>World conditions</h1>
          {fixedBaselineReview && <p className="baseline-notice" role="status">Review a separate fixed-rule baseline. Your prior run is retained with its original policy. Seed the unchanged conditions, then edit one condition for a fixed-rule follow-up; an earlier adaptive run is not a fixed-rule control.</p>}
          {baseline && !fixedBaselineReview && <p className="baseline-notice">Your previous run is kept as the baseline. Edit a condition below and keep the same seed to compare. {baseline.policy === "fixed" && policy === "fixed" ? "Both trials use fixed rules." : "Adaptive AI policies can differ between trials; this is not a controlled causal comparison."}</p>}
          <p className="environment-code">
            Rule graph v{config.rules?.version} · {config.rules?.species.length} configured species
          </p>
          <p
            className={`interpreter-proof ${proof?.source === "jev" ? "is-jev" : "is-fallback"}`}
            data-testid="interpreter-source"
          >
            <span />
            {parentWorldId ? "Saved setup provenance · " : ""}{proof?.source === "jev"
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
          {proof?.requestFailed && <section className="setup-error" role="alert"><p>Jev could not interpret this setup ({failureLabels[proof.fallbackReason ?? "unknown"]}). Your answers are preserved, but this preview is not approved to seed.</p><div><button disabled={interpreting} onClick={() => interpret(answers)}>Retry interpretation</button><a className="setup-report" href="https://github.com/tugrulguner/lifepot/issues/new?title=LifePot%20setup%20interpretation%20issue&body=Page%3A%20%2Fplay%0A%0APlease%20describe%20what%20happened.%20Avoid%20including%20private%20answers%2C%20replay%20data%2C%20saved-world%20names%2C%20or%20personal%20information.">Report setup issue ↗</a></div></section>}
          {(proof?.failure ?? proof?.fidelity?.failure) && <p role="status">Setup failure stage: {(proof?.failure ?? proof?.fidelity?.failure)!.stage.replaceAll("_", " ")}.</p>}
          {proof?.fidelity?.mismatches?.length ? <section aria-label="Food-web contract conflicts"><p>The corrected proposal conflicts with the established food web:</p><ul>{proof.fidelity.mismatches.map((message, index) => <li key={index}>{message}</li>)}</ul></section> : null}
          {proof?.namedIntent && <p>Established organism intent: {proof.namedIntent.species.map(species => `${species.id} — ${species.name} (${species.role})`).join("; ")}.</p>}
          {parentWorldId && <p role="status">Review these saved conditions and choose your changes before seeding a new experiment. Recorded setup provenance is not a new Jev approval.</p>}
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
            disabled={!!proof?.requestFailed || (!!proof?.fidelity && proof.fidelity.verdict !== "approve")}
            onClick={() => { if (proof?.requestFailed || (proof?.fidelity && proof.fidelity.verdict !== "approve")) { gameplayAnalytics.setupFailed("setup_rejected"); return; } acceptedFollowup.current = Boolean(baseline); begin(answers, config, seed, replayMode ? replayRef.current ?? undefined : undefined); }}
          >
            Seed ecosystem <span>→</span>
          </button>
        </section>
      </main>
    );
  if (!simulation || !config) return null;
  const followLineage = (lineage: number | null) => {
    setFollowed(lineage);
    if (evidenceRef.current) {
      evidenceRef.current = followRunLineage(evidenceRef.current, simulation, lineage);
      setEvidence(evidenceRef.current);
    }
  };
  const inspectLiving = () => {
    const index = simulation.guild.findIndex(value => value > 0);
    if (index < 0) return;
    setSelected(index); setPaused(true);
    window.scrollTo(0, 0);
    document.querySelector<HTMLCanvasElement>(".life-canvas")?.focus({ preventScroll: true });
  };
  const inspectDetails = () => document.getElementById("creature-inspector")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const active = activeDecisionForGeneration(ledger, simulation.generation),
    resources = Math.round(simulation.stats.resources / 2500);
  return (
    <main className={`simulation-shell${originWorldId || parentWorldId ? " ph-no-capture" : ""}`} data-ph-no-capture={originWorldId || parentWorldId ? true : undefined}>
      <section className="run-status" aria-label="Run status"><strong role="status">{complete ? simulation.stats.population === 0 ? "World empty" : "Observation complete" : deciding ? "Waiting for a bounded ecology decision — the world is held still" : paused ? "Paused — inspect life or step one generation" : "Running — watch, inspect, or pause"}</strong><div className="run-context">{isExample ? "Recorded example · The little pond · " : ""}{localWorldName ? `Experiment: ${localWorldName} · ` : ""}{replayMode ? "Exact recorded replay · no inference" : policy === "fixed" ? "Fixed world rules" : "Adaptive ecology"}{question ? ` · Your question: ${question}` : ""}{isExample && <><a href="/play">Create your own world</a>{exampleTips && <><details className="example-tips"><summary>Three ways to explore</summary><ol><li>Pause to look closer.</li><li>Use “Inspect a living organism” to see its age and energy.</li><li>Choose “Follow founder lineage” to highlight its family.</li></ol></details><button type="button" className="example-dismiss" aria-label="Dismiss example tips" onClick={() => setExampleTips(false)}>Dismiss tips</button></>}</>}</div></section>
      {notice && <p className="run-notice" role="status">{notice}</p>}
      {archivedEvidence && <section className="archived-highlights" aria-label="Recorded highlights"><h2>Recorded highlights</h2><p>Validated from this saved replay; these are archived observations, not newly observed replay events.</p>{archivedEvidence.lineageExtinction.length ? <ul>{archivedEvidence.lineageExtinction.map((item, index) => <li key={`${item.lineage}-${item.generation}-${index}`}>Founder family {item.lineage} disappeared at generation {item.generation} (recorded).</li>)}</ul> : <p>No followed-family extinction milestone was recorded in this save.</p>}</section>}
      {Object.keys(decisionReasons).length > 0 && <details className="decision-availability"><summary>Adaptive availability · {Object.keys(decisionReasons).length} abstentions with reported reasons</summary><ul>{Object.entries(decisionReasons).map(([generation, reason]) => <li key={generation}>Generation {generation}: {failureLabels[reason]}. No new policy was applied; inherited behavior continued.</li>)}</ul></details>}
      <World key={arrivalRevision} state={simulation} selected={selected} followed={followed} focusedSpecies={focusedSpecies} onCameraUpdate={setCameraUpdate} onInspect={index => { setSelected(index); setPaused(true); }} />
      <SpeciesFocus state={simulation} selected={focusedSpecies} onSelect={setFocusedSpecies} />
      <GameplayObservation inspection={selected === null ? undefined : <WatchingOrganism state={simulation} index={selected} followed={followed} onFollow={followLineage} onDetails={inspectDetails} />} cameraUpdate={cameraUpdate} worldName={localWorldName} state={simulation} evidence={evidence} followed={followed} decision={active ?? null} names={Object.fromEntries(proof?.namedIntent?.species.map(species => [species.id, species.name]) ?? [])} />
      <CreatureInspector state={simulation} evidence={evidence} index={selected} followed={followed} onFollow={followLineage} onClear={() => setSelected(null)} onPick={inspectLiving} />
      <FamilyHeader feedbackPath="/play"><div className="environment-strip">{title(simulation.config.rules!.environment.pressure)} · {title(simulation.config.rules!.environment.volatility)}</div><ThemeControl theme={theme} onChange={changeTheme} /></FamilyHeader>
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
        <span><i className="resource-key" />Resource field</span>
        {simulation.config.rules!.species.map(species => <span key={species.id}><svg className="role-glyph" viewBox="0 0 100 100" aria-hidden="true"><OrganismArtwork role={species.role} color={speciesColor(species.id)} /></svg><i style={{ backgroundColor: speciesColor(species.id) }} />Species {species.id} · {title(species.role)}</span>)}
        <span>Green field = resources · coral shading = hazards · cell detail at 2× zoom</span>
        <span>White ring = selected · dashed gold ring = followed family</span>
        <span>White rays/dot = birth · gold circle = feeding · red cross = death · pulses are sampled</span>
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
        <label className="playback-speed">Speed
          <select aria-label="Playback speed" value={speed} onChange={event => setSpeed(event.target.value as PlaybackSpeed)}>
            <option value="slow">Slow</option>
            <option value="normal">Normal</option>
            <option value="fast">Fast</option>
          </select>
        </label>
        <button onClick={() => begin(answers, config, seed, replayMode ? replayRef.current ?? undefined : undefined)}>{replayMode ? "Restart replay" : "Restart trial"}</button>
        {complete && <button onClick={() => { setShowResults(true); completionSeen.current = false; queueMicrotask(() => { document.getElementById("run-results")?.scrollIntoView({ block: "start" }); document.getElementById("run-results")?.focus(); }); }}>View results</button>}
        <button onClick={inspectLiving}>Inspect living organism</button>
        <button onClick={() => document.getElementById("world-observatory")?.scrollIntoView({ behavior: "smooth", block: "start" })}>World observatory</button>
      </div>
      {complete && showResults && evidence && <RunResults state={simulation} evidence={evidence} question={question}
        onInspect={() => { setShowResults(false); document.querySelector<HTMLCanvasElement>(".life-canvas")?.focus(); }}
        onReplay={() => { if (replayRef.current) begin(answers, initialConfigRef.current ?? config, seed, replayRef.current); else setNotice("Replay is not ready yet."); }}
        onEdit={() => { setParentWorldId(originWorldId ?? parentWorldId); setBaseline({ evidence, config: structuredClone(initialConfigRef.current ?? config), seed: simulation.seed, decisions: structuredClone(ledger), policy: replayMode ? "recorded" : policy }); setConfig(structuredClone(initialConfigRef.current ?? config)); setReplayMode(false); setManuallyEdited(false); setStage("review"); window.scrollTo(0, 0); }}
        onNew={() => { setLocalWorldName(""); setArchivedEvidence(null); setOriginWorldId(null); setParentWorldId(null); setBaseline(null); setAnswers(EMPTY); setQuestion(""); setQi(0); setStage("questions"); window.scrollTo(0, 0); }}>
        <button type="button" onClick={() => {
          setParentWorldId(originWorldId ?? parentWorldId);
          setBaseline({ evidence, config: structuredClone(initialConfigRef.current ?? config), seed: simulation.seed, decisions: structuredClone(ledger), policy: replayMode ? "recorded" : policy });
          setConfig(structuredClone(initialConfigRef.current ?? config));
          setSeed(simulation.seed); setPolicy("fixed"); setReplayMode(false);
          setFixedBaselineReview(true); setStage("review"); window.scrollTo(0, 0);
        }}>Review fixed-rule baseline</button>
        {baseline && <RunComparison before={baseline} after={{ evidence, config: initialConfig ?? config, seed: simulation.seed, decisions: structuredClone(ledger), policy: replayMode ? "recorded" : policy }} />}
        <RunReflectionPanel key={`reflection-${simulation.seed}-${simulation.generation}`} evidence={evidence} config={initialConfig ?? config} onExperiment={experiment => {
          setParentWorldId(originWorldId ?? parentWorldId);
          const next = structuredClone(initialConfigRef.current ?? config);
          for (const change of experiment.changes) {
            const keys = change.path.split(".");
            let target: Record<string, unknown> = next as unknown as Record<string, unknown>;
            for (const key of keys.slice(0, -1)) target = target[key] as Record<string, unknown>;
            target[keys.at(-1)!] = change.value;
          }
          const validated = lifeConfigSchema.parse(next);
          setBaseline({ evidence, config: structuredClone(initialConfigRef.current ?? config), seed: simulation.seed, decisions: structuredClone(ledger), policy: replayMode ? "recorded" : policy });
          setConfig(validated); setReplayMode(false); setManuallyEdited(true); setStage("review"); window.scrollTo(0, 0);
        }}/>

        <ResultImageShare key={`${simulation.seed}-${simulation.generation}`} state={simulation} question={question} evidence={evidence}/>
        <button className="back-button" onClick={async () => { try { if (!replayRef.current) return setNotice("Replay not ready"); const url = new URL(location.origin + location.pathname); url.hash = new URLSearchParams({ replay: encodeReplay(replayRef.current) }).toString(); await navigator.clipboard.writeText(url.toString()); setNotice("Replay link copied"); } catch { setNotice("Clipboard unavailable. Use the result image download instead."); } }}>Copy challenge link</button>
      </RunResults>}
      {complete && simulation.outcome !== "running" && showResults && evidence && completedReplay && <MyWorldsPanel current={{ replay: completedReplay, evidence, outcome: simulation.outcome, stopReason: simulation.stats.population === 0 ? "World empty" : "Observation horizon reached", parentId: parentWorldId, policy: replayMode ? recordedPolicy : policy, setup: proof ? { source: proof.source, model: proof.model, namedIntent: proof.namedIntent } : undefined }} onOpen={openSavedWorld} onReview={reviewSavedWorld} onSaved={record => { setOriginWorldId(record.id); setLocalWorldName(record.name); }} />}
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
