import { createSimulation, stepSimulation } from "../game/world";
import { createStarterWorld } from "../game/starter-worlds";
import { project, unproject, lerp, delta } from "./view.mjs";
import art from "./artwork.json";
import { drawOverview, drawEventSymbols, boundaryCrossings, subjectLocation, viewportRects } from "./orientation.mjs";
import { paintMicroscopic, cellPortrait } from "./renderer.mjs";
const $ = (id) => document.getElementById(id);
const canvas = $("world"), ctx = canvas.getContext("2d");
const images = {};
for (const [k, url] of Object.entries(art)) {
  const im = new Image();
  im.src = url;
  images[k] = im;
}
let state, initial, previous = /* @__PURE__ */ new Map(), selected = 0, following = false, playing = false, timer, lastTime = 0, transition = false, camera = { x: 25, y: 25, span: 50 }, manualSpan = 50, manualX = 25, manualY = 25, positions = [], applied = { seed: 241, regeneration: "steady" }, lost = "", substrate;
function role(i) {
  return state.config.rules.species[state.ruleSpecies[i] - 1]?.role || "grazer";
}
function kind(i) {
  const r = role(i);
  return r === "hunter" || r === "omnivore" ? "predator" : r === "producer" ? "producer" : "grazer";
}
let crossings = [], overviewKey = "", showHazards = false;
const colours = { grazer: "#168f89", predator: "#d94f4f", producer: "#a4b77b" };
function stop() {
  clearInterval(timer);
  playing = false;
  $("play").textContent = "Play";
}
function fresh(config = applied) {
  stop();
  applied = { ...config };
  const w = createStarterWorld("hunters-and-prey");
  w.config.rules.environment.regeneration = applied.regeneration;
  state = createSimulation({ seed: applied.seed, config: w.config });
  initial = structuredClone(state);
  previous = /* @__PURE__ */ new Map();
  crossings = [];
  overviewKey = "";
  selected = 0;
  following = false;
  manualSpan = 50;
  manualX = 25;
  manualY = 25;
  lost = "";
  transition = false;
  update();
  paint(performance.now());
}
function advance() {
  if (state.outcome !== "running") return;
  previous = /* @__PURE__ */ new Map();
  for (let i = 0; i < 2500; i++) if (state.guild[i]) previous.set(state.organismId[i], [i % 50 + 0.5, Math.floor(i / 50) + 0.5]);
  state = stepSimulation(state);
  crossings = boundaryCrossings(state, previous);
  lastTime = performance.now();
  transition = true;
  if (selected && !state.organismId.includes(selected)) {
    if (following) {
      manualX = camera.x;
      manualY = camera.y;
      manualSpan = camera.span;
    }
    lost = "Organism " + selected + " is no longer alive. Its selection is retained; choose another organism to follow.";
    following = false;
  }
  if (state.outcome !== "running") stop();
  update();
}
function review() {
  const seed = Number($("seed").value), regeneration = $("regeneration").value;
  $("review").textContent = "Proposed new world: seed " + seed + ", " + (regeneration === "steady" ? "steady food replenishment." : "food replenishment responds to local depletion.") + " Creating it replaces this view with generation 0. Current world is unchanged until you choose Create new world.";
}
function update() {
  $("location").textContent = subjectLocation(state, selected, camera);
  $("phase").textContent = (playing ? "Observing" : "Paused") + " \xB7 generation " + state.generation + (state.outcome === "running" ? "" : " \xB7 " + state.outcome);
  $("applied").textContent = "Hunters & prey \xB7 seed " + applied.seed + " \xB7 " + applied.regeneration.replace("_", " ");
  $("population").textContent = state.stats.population;
  $("species").textContent = "Grazers " + state.stats.prey + " \xB7 hunters " + state.stats.predators;
  $("food").textContent = state.stats.resources.toLocaleString() + " units \xB7 " + (state.stats.resources / 2500).toFixed(1) + " per cell";
  $("food-note").textContent = "Food stock now \xB7 change since start " + (state.stats.resources - initial.stats.resources >= 0 ? "+" : "") + (state.stats.resources - initial.stats.resources).toLocaleString() + " units \xB7 " + applied.regeneration.replace("_", " ");
  $("hazards").textContent = showHazards ? "Hide hazard intensity" : "Show hazard intensity";
  $("hazard-note").textContent = "Baseline: " + state.config.environment.hazard + " \xB7 configured pressure: " + state.config.rules.environment.pressure + " \xB7 hazard intensity " + Math.min(...state.hazards) + "\u2013" + Math.max(...state.hazards) + " engine units. Overlay is not weather.";
  $("play").disabled = state.outcome !== "running";
  $("step").disabled = state.outcome !== "running";
  const i = selected ? Array.from(state.organismId).indexOf(selected) : -1;
  $("follow").disabled = i < 0;
  $("follow").textContent = following ? "Whole world" : "Follow closely";
  $("clear").disabled = !selected;
  $("portrait").hidden = i < 0;
  if (i >= 0) {
    $("portrait").src = cellPortrait(state, i);
    $("portrait").alt = kind(i) + " cosmetic role illustration";
    $("inspect").textContent = role(i) + " \xB7 organism " + selected + "\nEnergy " + Math.round(state.energy[i]) + " \xB7 age " + state.age[i] + "\nFamily " + state.lineage[i] + " \xB7 inherited generation " + state.organismGeneration[i];
  } else $("inspect").textContent = lost || "Select a living mark to see its identity and follow its movement.";
  const feed = state.events.filter((e) => e.kind === "feeding").length, birth = state.events.filter((e) => e.kind === "birth").length, death = state.events.filter((e) => e.kind === "death").length;
  $("events").textContent = state.generation ? "Last transition: " + feed + " feeding events, " + birth + " births, " + death + " deaths." : "The world is paused at its starting state. Press Play to observe it.";
  $("record").textContent = state.events.slice(-8).map((e) => "g" + e.generation + " " + e.kind + " at " + e.at % 50 + "," + Math.floor(e.at / 50) + (e.cause ? " (" + e.cause + ")" : "")).join("\n");
}
function paint(now) {
  if (!state) return;
  const rect = canvas.getBoundingClientRect(), dpr = devicePixelRatio || 1, w = Math.round(rect.width * dpr);
  if (canvas.width !== w) {
    canvas.width = w;
    canvas.height = w;
  }
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches, t = transition ? reduceMotion ? 1 : Math.min(1, (now - lastTime) / 350) : 1;
  positions = [];
  for (let i = 0; i < 2500; i++) if (state.guild[i]) {
    const old = previous.get(state.organismId[i]);
    positions.push({ i, id: state.organismId[i], x: old ? lerp(old[0], i % 50 + 0.5, t) : i % 50 + 0.5, y: old ? lerp(old[1], Math.floor(i / 50) + 0.5, t) : Math.floor(i / 50) + 0.5 });
  }
  const subject = positions.find((p) => p.id === selected);
  camera = following && subject ? { x: subject.x, y: subject.y, span: 10 } : { x: manualX, y: manualY, span: manualSpan };
  $("coords").textContent = (camera.span === 50 ? "WHOLE WORLD OVERVIEW \xB7 " : "Microscopic view \xB7 ") + camera.span + " cells \xB7 toroidal edges";
  paintMicroscopic(ctx, canvas, state, positions, camera, selected, previous, now, lastTime, transition, showHazards);
  const key = [state.seed, state.generation, camera.x, camera.y, camera.span, selected].join(":");
  if (key !== overviewKey) {
    drawOverview($("overview"), state, camera, selected);
    overviewKey = key;
  }
  drawEventSymbols(ctx, canvas, state, camera, now, lastTime, transition, crossings);
  $("location").textContent = subjectLocation(state, selected, camera);
  $("coords").textContent = camera.span === 50 ? "Whole world \xB7 fixed view" : following ? "Following organism " + selected : "Zoomed region \xB7 fixed view";
  $("wraps").textContent = "Last transition: " + crossings.length + " organism" + (crossings.length === 1 ? "" : "s") + " crossed a world edge. Opposite edges connect.";
}
let drag = null;
canvas.onpointerdown = (e) => {
  if (e.button !== 0) return;
  const r = canvas.getBoundingClientRect();
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, cx: camera.x, cy: camera.y, span: camera.span, w: r.width, h: r.height, moved: false };
  canvas.setPointerCapture(e.pointerId);
};
canvas.onpointermove = (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.hypot(dx, dy) > 3) drag.moved = true;
  if (drag.moved) {
    following = false;
    manualSpan = drag.span;
    manualX = ((drag.cx - dx / drag.w * manualSpan) % 50 + 50) % 50;
    manualY = ((drag.cy - dy / drag.h * manualSpan) % 50 + 50) % 50;
    paint(performance.now());
    update();
  }
};
canvas.onpointerup = (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  const d = drag;
  drag = null;
  if (d.moved) return;
  const r = canvas.getBoundingClientRect(), [x, y] = unproject((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, camera);
  let best = null, dist = 1;
  for (const p of positions) {
    const n = Math.hypot(delta(x, p.x), delta(y, p.y));
    if (n < dist) {
      best = p;
      dist = n;
    }
  }
  if (best) {
    selected = best.id;
    lost = "";
    update();
    paint(performance.now());
  }
};
canvas.onpointercancel = () => {
  drag = null;
};
$("follow").onclick = () => {
  following = !following;
  if (!following) {
    manualSpan = 50;
    manualX = 25;
    manualY = 25;
  }
  update();
  paint(performance.now());
};
$("clear").onclick = () => {
  selected = 0;
  following = false;
  lost = "";
  update();
  paint(performance.now());
};
for (const [id, span] of [["zoom-out", 50], ["zoom-wide", 25], ["zoom-mid", 10], ["zoom-in", 5]]) {
  $(id).onclick = () => {
    const subject = positions.find((p) => p.id === selected);
    manualX = span === 50 ? 25 : subject?.x ?? camera.x;
    manualY = span === 50 ? 25 : subject?.y ?? camera.y;
    following = false;
    manualSpan = span;
    paint(performance.now());
    update();
  };
}
$("play").onclick = () => {
  if (playing) {
    stop();
    update();
  } else if (state.outcome === "running") {
    playing = true;
    $("play").textContent = "Pause";
    update();
    timer = setInterval(advance, 500);
  }
};
$("hazards").onclick = () => {
  showHazards = !showHazards;
  update();
  paint(performance.now());
};
$("step").onclick = () => {
  stop();
  advance();
};
$("restart").onclick = () => fresh();
$("create").onclick = () => fresh({ seed: Number($("seed").value), regeneration: $("regeneration").value });
$("seed").onchange = review;
$("regeneration").onchange = review;
const serialize = (s) => JSON.parse(JSON.stringify(s, (k, v) => ArrayBuffer.isView(v) ? { arrayType: v.constructor.name, values: Array.from(v) } : v));
substrate = new Image();
substrate.onload = () => {
  const c = document.createElement("canvas"), s = substrate.naturalWidth;
  c.width = s * 2;
  c.height = s * 2;
  const x = c.getContext("2d");
  x.drawImage(substrate, 0, 0);
  x.save();
  x.translate(s * 2, 0);
  x.scale(-1, 1);
  x.drawImage(substrate, 0, 0);
  x.restore();
  x.save();
  x.translate(0, s * 2);
  x.scale(1, -1);
  x.drawImage(substrate, 0, 0);
  x.restore();
  x.save();
  x.translate(s * 2, s * 2);
  x.scale(-1, -1);
  x.drawImage(substrate, 0, 0);
  x.restore();
  substrate = c;
};
substrate.src = art.substrate;
window.worldProbe = { snapshot: () => state, full: () => serialize(state), canonical: () => {
  let q = structuredClone(initial);
  while (q.generation < state.generation && q.outcome === "running") q = stepSimulation(q);
  return serialize(q);
}, selected: () => selected, following: () => following, playing: () => playing, camera: () => camera, viewportRects: () => viewportRects(camera), crossings: () => crossings, textureReady: () => substrate instanceof HTMLCanvasElement, applied: () => ({ ...applied }), point: (id) => {
  const p = positions.find((p2) => p2.id === id);
  return p ? project(p.x, p.y, camera) : null;
} };
const mapObserver = new IntersectionObserver((entries) => {
  const visible = entries[0]?.intersectionRatio > 0.1;
  $("overview").parentElement.classList.toggle("map-offscreen", !visible);
}, { threshold: [0, 0.1] });
mapObserver.observe(canvas);
fresh();
review();
function frame(now) {
  paint(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
