// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  const contextCalls = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
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
    fireEvent.change(theme, { target: { value: choice } });
    await waitFor(() => expect(contextCalls.mock.calls.length).toBeGreaterThan(paintsBeforeThemeMutation));
    expect(fullState(engine), `engine state changed on ${choice} repaint`).toBe(before);
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
  }
  expect(fullState(stepSimulation(engine))).toBe(expectedNext);
});

test("offers a no-model preset through the existing guided setup", () => {
  render(<GameCanvas />);
  fireEvent.click(screen.getByRole("button", { name: "Explore deterministic preset" }));
  expect(screen.getByTestId("interpreter-source")).toHaveTextContent("Deterministic fallback");
  expect(screen.getByRole("button", { name: /Seed ecosystem/ })).toBeInTheDocument();
  expect(screen.getByText(/configured species/)).toBeInTheDocument();
});
