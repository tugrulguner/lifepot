// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { defaultConfig } from "@/game/setup";
import { GameCanvas } from "./GameCanvas";

vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
afterAll(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
let fetchCalls = 0;

async function completeThroughControls() {
  fireEvent.click(screen.getByRole("button", { name: /Seed ecosystem/ }));
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  const step = screen.getByRole("button", { name: "Step one generation" });
  for (let i = 0; i < 180 && step.isConnected; i++) await act(async () => { fireEvent.click(step); });
  expect(screen.getByRole("region", { name: "Run results" })).toBeInTheDocument();
}

describe("interpreted names across the real completed-trial journey", () => {
beforeAll(async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("scrollTo", vi.fn());
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  const fetcher = vi.fn(async (_url: unknown, init: RequestInit) => { fetchCalls++; return new Response(JSON.stringify({
    config: defaultConfig(), source: "jev", requestHash: JSON.parse(String(init.body)).requestHash,
    evidence: { establishedIntent: { species: [
      { id: "A", name: "pond snails", role: "grazer" },
      { id: "B", name: "small minnows", role: "hunter" },
    ] } },
  }), { status: 200, headers: { "Content-Type": "application/json" } }); });
  vi.stubGlobal("fetch", fetcher);
  render(<GameCanvas />);
  for (const [index, value] of ["A pond with pond snails and small minnows", "Minnows eat snails", "Inherited variation"].entries()) {
    fireEvent.change(screen.getByRole("textbox"), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: index === 2 ? "Review ecosystem" : "Continue" }));
  }
  await waitFor(() => expect(screen.getByLabelText("World policy")).toBeInTheDocument());
  expect(screen.getByText(/Established organism intent: A — pond snails/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("World policy"), { target: { value: "fixed" } });
});
test("names reach the first real completed result", async () => {
  await completeThroughControls();
  const results = within(screen.getByRole("region", { name: "Run results" }));
  expect(results.getAllByText(/pond snails/).length).toBeGreaterThan(0);
  expect(results.getAllByText(/small minnows/).length).toBeGreaterThan(0);
});
test("names persist into the edited-trial comparison without new inference", async () => {
  fireEvent.click(screen.getByRole("button", { name: "Edit this world" }));
  fireEvent.change(screen.getByLabelText("Resource abundance"), { target: { value: "rich" } });
  await completeThroughControls();
  const comparison = within(screen.getByRole("region", { name: "Previous trial comparison" }));
  expect(comparison.getAllByText(/pond snails/).length).toBeGreaterThan(0);
  expect(comparison.getAllByText(/small minnows/).length).toBeGreaterThan(0);
  expect(fetchCalls).toBe(1);
});
});
