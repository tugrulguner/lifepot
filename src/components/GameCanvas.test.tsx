// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { stepSimulation, type SimulationState } from "@/game/world";
import { GameCanvas } from "./GameCanvas";

const { captured } = vi.hoisted(() => ({ captured: [] as SimulationState[] }));
vi.mock("@/game/world", async importOriginal => {
  const actual = await importOriginal<typeof import("@/game/world")>();
  return { ...actual, createSimulation: (...args: Parameters<typeof actual.createSimulation>) => {
    const state = actual.createSimulation(...args);
    captured.push(state);
    return state;
  } };
});
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); captured.length = 0; });

test("theme repaint while paused preserves every engine field and deterministic continuation", async () => {
  vi.stubGlobal("scrollTo", vi.fn());
  const context = { setTransform: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), rect: vi.fn(), arc: vi.fn(), fill: vi.fn(), stroke: vi.fn(), save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(), createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })), globalAlpha: 1, fillStyle: "", strokeStyle: "", lineWidth: 1 };
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
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  const engine = captured[0];
  const fullState = (state: SimulationState) => JSON.stringify(state);
  const before = fullState(engine);
  const expectedNext = fullState(stepSimulation(engine));

  const theme = screen.getByRole("combobox", { name: "Color theme" });
  for (const choice of ["light", "dark", "auto"]) {
    const paintsBeforeThemeMutation = contextCalls.mock.calls.length;
    const paintedCells = context.fillRect.mock.calls.length;
    fireEvent.change(theme, { target: { value: choice } });
    await waitFor(() => expect(contextCalls.mock.calls.length).toBeGreaterThan(paintsBeforeThemeMutation));
    expect(context.fillRect.mock.calls.length).toBeGreaterThan(paintedCells);
    expect(context.arc).toHaveBeenCalled();
    expect(context.createRadialGradient).toHaveBeenCalled();
    expect(context.lineTo).toHaveBeenCalled();
    expect(fullState(engine), `engine state changed on ${choice} repaint`).toBe(before);
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
  }
  expect(fullState(stepSimulation(engine))).toBe(expectedNext);
});

test("reviews a separate fixed-rule baseline without auto-seeding or losing private context", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver",class { observe() {} disconnect() {} });
  vi.stubGlobal("scrollTo", vi.fn());
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  Object.defineProperty(HTMLElement.prototype,"scrollIntoView",{configurable:true,value:vi.fn()});
  const fetch=vi.fn();vi.stubGlobal("fetch",fetch);
  render(<GameCanvas />);
  fireEvent.click(screen.getByRole("button", { name: "Explore deterministic preset" }));
  fireEvent.change(screen.getByLabelText("World policy"),{target:{value:"fixed"}});
  fireEvent.change(screen.getByLabelText("Your question or prediction (optional)"),{target:{value:"PRIVATE test question"}});
  fireEvent.click(screen.getByRole("button", { name: /Seed ecosystem/ }));
  fireEvent.click(screen.getByRole("button",{name:"Pause"}));
  for(let i=0;i<180 && screen.queryByRole("button",{name:"Step one generation"});i++) await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Step one generation"}));});
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
}, 30_000);

test("offers a no-model preset through the existing guided setup", () => {
  render(<GameCanvas />);
  fireEvent.click(screen.getByRole("button", { name: "Explore deterministic preset" }));
  expect(screen.getByTestId("interpreter-source")).toHaveTextContent("Deterministic fallback");
  expect(screen.getByRole("button", { name: /Seed ecosystem/ })).toBeInTheDocument();
  expect(screen.getByText(/configured species/)).toBeInTheDocument();
});
