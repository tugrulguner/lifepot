// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { listWorlds } from "@/game/my-worlds";
import { stepSimulation, type SimulationState } from "@/game/world";
import { defaultConfig } from "@/game/setup";
import { GameCanvas } from "./GameCanvas";
import example from "../../public/example-world.json";

const { captured, advanced } = vi.hoisted(() => ({ captured: [] as SimulationState[], advanced: [] as SimulationState[] }));
vi.mock("@/game/runtime", async importOriginal => {
  const actual = await importOriginal<typeof import("@/game/runtime")>();
  return { ...actual, advanceUntilDecisionTrigger: (...args: Parameters<typeof actual.advanceUntilDecisionTrigger>) => {
    const state = actual.advanceUntilDecisionTrigger(...args);
    advanced.push(state);
    return state;
  } };
});
const analyticsCapture = vi.hoisted(() => vi.fn());
vi.mock("@/app/gameplay-analytics", async importOriginal => {
  const actual = await importOriginal<typeof import("@/app/gameplay-analytics")>();
  return { gameplayAnalytics: actual.createGameplayAnalytics((event, properties) => analyticsCapture(event, properties)) };
});
vi.mock("@/game/world", async importOriginal => {
  const actual = await importOriginal<typeof import("@/game/world")>();
  return { ...actual, createSimulation: (...args: Parameters<typeof actual.createSimulation>) => {
    const state = actual.createSimulation(...args);
    captured.push(state);
    return state;
  } };
});
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); captured.length = 0; advanced.length = 0; analyticsCapture.mockReset(); });

function renderPresetForPlayback() {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("scrollTo", vi.fn());
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  render(<GameCanvas />);
  fireEvent.click(screen.getByRole("button", { name: "Explore deterministic preset" }));
  fireEvent.change(screen.getByLabelText("World policy"), { target: { value: "fixed" } });
  fireEvent.click(screen.getByRole("button", { name: /Seed ecosystem/ }));
}

test("camera zoom, follow and reset leave the paused engine unchanged", () => {
  renderPresetForPlayback();
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  const engine = captured.at(-1)!;
  const before = JSON.stringify(engine), next = JSON.stringify(stepSimulation(engine));
  fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
  expect(document.querySelector(".life-canvas")).toHaveAttribute("data-camera-zoom", "1.5");
  fireEvent.click(screen.getByRole("button", { name: "Inspect a living organism" }));
  fireEvent.click(screen.getByRole("button", { name: "Follow organism with camera" }));
  expect(document.querySelector(".life-canvas")).toHaveAttribute("data-camera-follow", "organism");
  fireEvent.click(screen.getByRole("button", { name: "Full world" }));
  expect(document.querySelector(".life-canvas")).toHaveAttribute("data-camera-zoom", "1");
  expect(document.querySelector(".life-canvas")).toHaveAttribute("data-camera-follow", "none");
  expect(JSON.stringify(engine)).toBe(before);
  expect(JSON.stringify(stepSimulation(engine))).toBe(next);
});

test.each(["clear", "switch"])("family camera stays released after %s then re-pinning the old family", (mode) => {
  renderPresetForPlayback();
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  fireEvent.click(screen.getByRole("button", { name: "Inspect a living organism" }));
  const originalPin = screen.getByRole("button", { name: /Follow founder lineage/ }).textContent!;
  const engine = captured.at(-1)!;
  const before = JSON.stringify(engine), continuation = JSON.stringify(stepSimulation(engine));
  fireEvent.click(screen.getByRole("button", { name: originalPin }));
  fireEvent.click(screen.getByRole("button", { name: "Follow pinned family with camera" }));
  const board = document.querySelector(".life-canvas")!;
  expect(board).toHaveAttribute("data-camera-follow", "family");
  if (mode === "clear") fireEvent.click(screen.getByRole("button", { name: "Stop following" }));
  else {
    const state = captured.at(-1)!;
    const first = state.guild.findIndex(Boolean), family = state.lineage[first];
    const second = state.guild.findIndex((alive, i) => !!alive && state.lineage[i] !== family);
    fireEvent.keyDown(board, { key: "ArrowRight" });
    // Select a different existing founder through the actual arrow handler.
    for (let i = first + 1; i < second; i++) fireEvent.keyDown(board, { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("button", { name: /Follow founder lineage/ }));
  }
  expect(board).toHaveAttribute("data-camera-follow", "none");
  fireEvent.click(screen.getByRole("button", { name: "Inspect a living organism" }));
  fireEvent.click(screen.getByRole("button", { name: originalPin }));
  expect(board).toHaveAttribute("data-camera-follow", "none");
  expect(board).toHaveAttribute("data-camera-zoom", "1");
  expect(JSON.stringify(engine)).toBe(before);
  expect(JSON.stringify(stepSimulation(engine))).toBe(continuation);
});

test("camera releases a dead organism and allows a new manual view", () => {
  renderPresetForPlayback();
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  fireEvent.click(screen.getByRole("button", { name: "Inspect a living organism" }));
  fireEvent.click(screen.getByRole("button", { name: "Follow organism with camera" }));
  const step = screen.getByRole("button", { name: "Step one generation" });
  const board = document.querySelector(".life-canvas")!;
  for (let i = 0; i < 180 && board.getAttribute("data-camera-follow") === "organism"; i++) fireEvent.click(step);
  expect(screen.getByRole("status", { name: "Camera update" })).toHaveTextContent(/Organism #\d+ is no longer living/);
  expect(board).toHaveAttribute("data-camera-zoom", "1");
  fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
  expect(board).toHaveAttribute("data-camera-zoom", "1.5");
});

test("default playback leaves a full second to observe each generation", () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  renderPresetForPlayback();
  act(() => vi.advanceTimersByTime(999));
  expect(screen.getByTestId("generation")).toHaveTextContent(/^0 \/ 180$/);
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByTestId("generation")).toHaveTextContent(/^1 \/ 180$/);
  act(() => vi.advanceTimersByTime(999));
  expect(screen.getByTestId("generation")).toHaveTextContent(/^1 \/ 180$/);
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByTestId("generation")).toHaveTextContent(/^2 \/ 180$/);
});

test("explicit playback choices change pacing while paused state and single-step stay invariant", () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  renderPresetForPlayback();
  const speed = screen.getByRole("combobox", { name: "Playback speed" });
  expect(speed).toHaveValue("slow");
  expect([...speed.querySelectorAll("option")].map(option => option.textContent)).toEqual(["Slow", "Normal", "Fast"]);
  act(() => vi.advanceTimersByTime(1000));
  fireEvent.change(speed, { target: { value: "normal" } });
  act(() => vi.advanceTimersByTime(219));
  expect(screen.getByTestId("generation")).toHaveTextContent(/^1 \/ 180$/);
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByTestId("generation")).toHaveTextContent(/^2 \/ 180$/);
  fireEvent.change(speed, { target: { value: "fast" } });
  act(() => vi.advanceTimersByTime(34));
  expect(screen.getByTestId("generation")).toHaveTextContent(/^2 \/ 180$/);
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByTestId("generation")).toHaveTextContent(/^5 \/ 180$/);
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  const state = advanced.at(-1)!;
  const snapshot = JSON.stringify(state);
  const expectedNext = JSON.stringify(stepSimulation(state));
  for (const choice of ["slow", "normal", "fast"]) {
    fireEvent.change(speed, { target: { value: choice } });
    act(() => vi.advanceTimersByTime(5000));
    expect(JSON.stringify(advanced.at(-1))).toBe(snapshot);
    expect(screen.getByTestId("generation")).toHaveTextContent(/^5 \/ 180$/);
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
  }
  fireEvent.click(screen.getByRole("button", { name: "Step one generation" }));
  expect(JSON.stringify(advanced.at(-1))).toBe(expectedNext);
  expect(screen.getByTestId("generation")).toHaveTextContent(/^6 \/ 180$/);
});

test("seeds gameplay when analytics capture throws", () => {
  analyticsCapture.mockImplementation(() => { throw new Error("analytics transport failure"); });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("scrollTo", vi.fn());
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  render(<GameCanvas />);
  fireEvent.click(screen.getByRole("button", { name: "Explore deterministic preset" }));
  fireEvent.click(screen.getByRole("button", { name: /Seed ecosystem/ }));
  expect(captured).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
});

test.each([false, true])("theme repaint preserves every engine field and continuation (sprites: %s)", async (sprites) => {
  vi.stubGlobal("scrollTo", vi.fn());
  if (sprites) vi.stubGlobal("Path2D", class { moveTo() {} lineTo() {} closePath() {} });
  const context = { clip: vi.fn(), setTransform: vi.fn(), translate: vi.fn(), drawImage: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), quadraticCurveTo: vi.fn(), ellipse: vi.fn(), closePath: vi.fn(), rect: vi.fn(), arc: vi.fn(), fill: vi.fn(), stroke: vi.fn(), save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(), createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })), globalAlpha: 1, fillStyle: "", strokeStyle: "", lineWidth: 1 };
  const contextCalls = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  // jsdom has no layout; provide a drawable board for repaint assertions.
  vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, top: 0, left: 0, right: 400, bottom: 400, width: 400, height: 400, toJSON() {} });
  class TestResizeObserver { observe() {} disconnect() {} }
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  render(<GameCanvas />);
  fireEvent.click(screen.getByRole("button", { name: "Explore deterministic preset" }));
  fireEvent.click(screen.getByRole("button", { name: /Seed ecosystem/ }));
  expect(captured).toHaveLength(1);
  expect(context.createRadialGradient.mock.calls.length).toBeLessThanOrEqual(contextCalls.mock.calls.length * 100);
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  const engine = captured[0];
  const fullState = (state: SimulationState) => JSON.stringify(state);
  const before = fullState(engine);
  const expectedNext = fullState(stepSimulation(engine));
  const board = document.querySelector("canvas.life-canvas")!;
  for (const action of [
    () => fireEvent.click(screen.getByRole("button", { name: "Zoom in" })),
    () => fireEvent.keyDown(board, { key: "ArrowRight", shiftKey: true }),
    () => { fireEvent.click(screen.getByRole("button", { name: "Inspect a living organism" })); fireEvent.click(screen.getByRole("button", { name: "Follow organism with camera" })); },
  ]) {
    const draws = context.fillRect.mock.calls.length;
    action();
    expect(context.fillRect.mock.calls.length).toBeGreaterThan(draws);
    expect(fullState(engine)).toBe(before);
    expect(fullState(stepSimulation(engine))).toBe(expectedNext);
  }
  expect(context.clip).toHaveBeenCalled();

  const theme = screen.getByRole("combobox", { name: "Color theme" });
  for (const choice of ["light", "dark", "auto"]) {
    const paintsBeforeThemeMutation = contextCalls.mock.calls.length;
    const paintedCells = context.fillRect.mock.calls.length;
    const paintedSprites = context.drawImage.mock.calls.length;
    fireEvent.change(theme, { target: { value: choice } });
    await waitFor(() => expect(contextCalls.mock.calls.length).toBeGreaterThan(paintsBeforeThemeMutation));
    expect(context.fillRect.mock.calls.length).toBeGreaterThan(paintedCells);
    if (sprites) expect(context.drawImage.mock.calls.length).toBeGreaterThan(paintedSprites);
    else expect(context.drawImage).not.toHaveBeenCalled();
    expect(context.arc).toHaveBeenCalled();
    expect(context.createRadialGradient).toHaveBeenCalled();
    expect(context.lineTo).toHaveBeenCalled();
    expect(fullState(engine), `engine state changed on ${choice} repaint`).toBe(before);
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
  }
  expect(fullState(stepSimulation(engine))).toBe(expectedNext);
});

test("reuses DPR-sized role sprites for populated organism cells", () => {
  vi.stubGlobal("scrollTo", vi.fn());
  class TestPath2D {
    moveTo() {} lineTo() {} closePath() {}
  }
  vi.stubGlobal("Path2D", TestPath2D);
  const context = { clip: vi.fn(), rect: vi.fn(), setTransform: vi.fn(), translate: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), arc: vi.fn(), fill: vi.fn(), drawImage: vi.fn(), stroke: vi.fn(), save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(), createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })), globalAlpha: 1, fillStyle: "", strokeStyle: "", lineWidth: 1, lineJoin: "miter" };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, top: 0, left: 0, right: 400, bottom: 400, width: 400, height: 400, toJSON() {} });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  render(<GameCanvas />);
  fireEvent.click(screen.getByRole("button", { name: "Explore deterministic preset" }));
  fireEvent.click(screen.getByRole("button", { name: /Seed ecosystem/ }));

  const population = captured.at(-1)!.guild.reduce((count, guild) => count + Number(Boolean(guild)), 0);
  expect(population).toBeGreaterThan(1);
  const drawnSprites = context.drawImage.mock.calls.map(call => call[0]);
  expect(drawnSprites).toHaveLength(population);
  expect(new Set(drawnSprites).size).toBeLessThan(population);
  expect(drawnSprites.every(sprite => sprite instanceof HTMLCanvasElement)).toBe(true);
  const originalSize = (drawnSprites[0] as HTMLCanvasElement).width;
  context.drawImage.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
  expect((context.drawImage.mock.calls[0][0] as HTMLCanvasElement).width).toBeGreaterThan(originalSize);
});

test.each([180, 240, 318, 600])("organism marks stay cell-bounded on a %ipx board", (boardSize) => {
  vi.stubGlobal("scrollTo", vi.fn());
  const organismStrokes: Array<{ color: string; width: number }> = [];
  const arcRadii: number[] = [];
  const cellPitch = (boardSize - 36) / 50;
  const context = {
    setTransform: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), quadraticCurveTo: vi.fn(), ellipse: vi.fn(), closePath: vi.fn(), rect: vi.fn(), arc: vi.fn((_x: number, _y: number, radius: number) => { arcRadii.push(radius); }), fill: vi.fn(),
    stroke: vi.fn(function (this: CanvasRenderingContext2D) { organismStrokes.push({ color: this.strokeStyle as string, width: this.lineWidth }); }),
    save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(), createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })), globalAlpha: 1, fillStyle: "", strokeStyle: "", lineWidth: 1,
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, top: 0, left: 0, right: boardSize, bottom: boardSize, width: boardSize, height: boardSize, toJSON() {} });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  render(<GameCanvas />);
  fireEvent.click(screen.getByRole("button", { name: "Explore deterministic preset" }));
  fireEvent.click(screen.getByRole("button", { name: /Seed ecosystem/ }));

  const roleEdges = organismStrokes.filter(stroke => stroke.color === "#07100f");
  const speciesEdges = organismStrokes.filter(stroke => stroke.color === "rgba(241,248,237,.94)");
  expect(roleEdges.length).toBeGreaterThan(0);
  expect(speciesEdges.length).toBeGreaterThan(0);
  expect(roleEdges[0].width).toBeCloseTo(cellPitch * .07, 4);
  expect(speciesEdges[0].width).toBeCloseTo(cellPitch * .035, 4);
  expect(cellPitch * .44 + roleEdges[0].width / 2).toBeLessThan(cellPitch / 2);
  expect(cellPitch * .44 + speciesEdges[0].width / 2).toBeLessThan(cellPitch / 2);
});

test("reviews a separate fixed-rule baseline without auto-seeding or losing private context", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver",class { observe() {} disconnect() {} });
  vi.stubGlobal("scrollTo", vi.fn());
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  Object.defineProperty(HTMLElement.prototype,"scrollIntoView",{configurable:true,value:vi.fn()});
  vi.stubGlobal("indexedDB", new IDBFactory());
  const fetch=vi.fn();vi.stubGlobal("fetch",fetch);
  render(<GameCanvas />);
  fireEvent.click(screen.getByRole("button", { name: "Explore deterministic preset" }));
  fireEvent.change(screen.getByLabelText("World policy"),{target:{value:"fixed"}});
  fireEvent.change(screen.getByLabelText("Your question or prediction (optional)"),{target:{value:"PRIVATE test question"}});
  fireEvent.click(screen.getByRole("button", { name: /Seed ecosystem/ }));
  fireEvent.click(screen.getByRole("button",{name:"Pause"}));
  const originalStep = screen.getByRole("button", { name: "Step one generation" });
  for (let i = 0; i < 180 && originalStep.isConnected; i++) {
    await act(async () => { fireEvent.click(originalStep); });
  }
  expect(screen.getByRole("region",{name:"Run results"})).toBeInTheDocument();
  const original=captured.map(state=>JSON.stringify(state));
  fireEvent.click(screen.getByRole("button",{name:"Review fixed-rule baseline"}));
  expect(screen.getByLabelText("World policy")).toHaveValue("fixed");
  expect(screen.getByLabelText("Your question or prediction (optional)")).toHaveValue("PRIVATE test question");
  expect(screen.getByText(/separate fixed-rule baseline/)).toBeInTheDocument();
  expect(screen.getByRole("button",{name:/Seed ecosystem/})).toBeEnabled();
  expect(screen.queryByRole("region",{name:"Run status"})).not.toBeInTheDocument();
  expect(captured.slice(0,original.length).map(state=>JSON.stringify(state))).toEqual(original);
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /Seed ecosystem/ }));
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  const baselineStep = screen.getByRole("button", { name: "Step one generation" });
  for (let i = 0; i < 180 && baselineStep.isConnected; i++) {
    await act(async () => { fireEvent.click(baselineStep); });
  }
  expect(screen.getByRole("region", { name: "Run results" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Optional world name (stored locally)"), { target: { value: "Remember this pond" } });
  fireEvent.click(screen.getByRole("button", { name: "Save completed world" }));
  await screen.findByText("Remember this pond");
  const [saved] = await listWorlds();
  expect(JSON.stringify(saved)).not.toContain("PRIVATE test question");
  expect(saved.parentId).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /new world/i }));
  await waitFor(() => expect(document.querySelector(".question-panel .my-worlds-shortcut")).not.toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Explore deterministic preset" }));
  expect(document.querySelector(".world-identity")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Edit setup answers" }));
  fireEvent.click(await screen.findByRole("button", { name: "Review changed experiment" }));
  expect(screen.getByLabelText("World policy")).toHaveValue("fixed");
  expect(screen.getByText("Remember this pond", {selector:".world-identity strong"})).toBeInTheDocument();
  expect(screen.getByLabelText("Your question or prediction (optional)")).toHaveValue("");
  expect(screen.queryByRole("region", { name: "Run status" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Seed ecosystem/ })).toBeEnabled();
  expect(fetch).not.toHaveBeenCalled();
}, 30_000);


test("maps HTTP 200 fallback reasons to one exact setup failure event", async () => {
  const cases = [
    ["rate_limited", "rate_limited"],
    ["unavailable", "provider_unavailable"],
    ["missing_credentials", "provider_unavailable"],
    ["invalid_response", "invalid_response"],
    ["unknown", "unknown"],
  ] as const;
  for (const [reason, category] of cases) {
    cleanup(); analyticsCapture.mockClear();
    const answers = { world: "Rich mineral pools with abundant prey", threat: "Predator packs hunt through pulsing droughts", reward: "Diversify while prey and predators coexist" };
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    vi.stubGlobal("scrollTo", vi.fn());
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ config: defaultConfig(), source: "fallback", requestHash: body.requestHash, fallbackReason: reason }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetch);
    render(<GameCanvas />);
    for (const [label, value] of [["What exists in this world?", answers.world], ["What threatens life here?", answers.threat], ["What should evolution favor?", answers.reward]] as const) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
      fireEvent.click(screen.getByRole("button", { name: /Continue|Review ecosystem/ }));
    }
    await screen.findByRole("heading", { name: "World conditions" });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(analyticsCapture.mock.calls.filter(([event]) => event === "lifepot_setup_failed")).toEqual([["lifepot_setup_failed", { failure_category: category, event_schema_version: 1 }]]);
  }
});

test("offers a no-model preset through the existing guided setup", () => {
  render(<GameCanvas />);
  fireEvent.click(screen.getByRole("button", { name: "Explore deterministic preset" }));
  expect(screen.getByTestId("interpreter-source")).toHaveTextContent("Deterministic fallback");
  expect(screen.getByRole("button", { name: /Seed ecosystem/ })).toBeInTheDocument();
  expect(screen.getByText(/configured species/)).toBeInTheDocument();
  expect(analyticsCapture).not.toHaveBeenCalledWith("lifepot_setup_failed", expect.anything());
});

test("invalid HTTP 200 setup response emits one invalid_response failure", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("scrollTo", vi.fn());
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
  render(<GameCanvas />);
  for (const label of ["What exists in this world?", "What threatens life here?", "What should evolution favor?"]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value: "A sufficiently clear ecological world" } });
    fireEvent.click(screen.getByRole("button", { name: /Continue|Review ecosystem/ }));
  }
  await screen.findByRole("heading", { name: "World conditions" });
  expect(analyticsCapture.mock.calls.filter(([event]) => event === "lifepot_setup_failed")).toEqual([["lifepot_setup_failed", { failure_category: "invalid_response", event_schema_version: 1 }]]);
});

test.each(["success", "failure"])("a stale example %s cannot replace or disturb a newer paused world, even if transport ignores abort", async result => {
  history.replaceState(null, "", "/play#example");
  let resolve!: (value: Response) => void;
  let reject!: (error: Error) => void;
  const response = new Promise<Response>((yes, no) => { resolve = yes; reject = no; });
  // Deliberately ignore AbortSignal: the journey guard must protect already in-flight work too.
  const fetch = vi.fn(() => response);
  vi.stubGlobal("fetch", fetch);
  try {
    renderPresetForPlayback();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    const before = JSON.stringify(captured.at(-1));
    const count = captured.length;
    const stats = document.querySelector(".stats-strip")!.textContent;
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/example-world.json", { signal: expect.objectContaining({ aborted: true }) });
    await act(async () => {
      if (result === "success") resolve(new Response(JSON.stringify(example), { status: 200 }));
      else reject(new Error("Late failed example"));
    });
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
    expect(captured).toHaveLength(count);
    expect(JSON.stringify(captured.at(-1))).toBe(before);
    expect(document.querySelector(".stats-strip")!.textContent).toBe(stats);
    expect(screen.queryByText(/Recorded example · The little pond/)).not.toBeInTheDocument();
    expect(screen.queryByText(/The example could not be loaded/)).not.toBeInTheDocument();
  } finally { history.replaceState(null, "", "/play"); }
});
