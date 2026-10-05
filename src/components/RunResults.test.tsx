// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RunResults } from "./RunResults";
import { createRunEvidence } from "@/game/run-evidence";
import { createSimulation } from "@/game/world";
import { defaultConfig } from "@/game/setup";

afterEach(cleanup);

it("renders an accessible, compact observation summary without treating survivors as a win", () => {
  const state = createSimulation({ seed: 7, config: defaultConfig() });
  const evidence = createRunEvidence(state);
  render(<RunResults state={{ ...state, outcome: "surviving" }} evidence={evidence} question="What changes?" onEdit={vi.fn()} onNew={vi.fn()} onReplay={vi.fn()} onInspect={vi.fn()} />);
  expect(screen.getByRole("region", { name: "Run results" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Run results" })).toHaveAttribute("id", "run-results");
  expect(screen.getByRole("region", { name: "Run results" })).toHaveAttribute("tabindex", "-1");
  expect(screen.getByRole("heading", { name: "Observation complete" })).toBeInTheDocument();
  expect(screen.getByText(/toy model, not biological proof/i)).toBeInTheDocument();
  expect(screen.getByText(/Your question:/)).toBeInTheDocument();
  expect(screen.getByLabelText("Whole-run population history").tagName.toLowerCase()).toBe("svg");
  expect(screen.getByText("Generation measurements")).toBeInTheDocument();
  expect(screen.getByRole("table").closest("details")).not.toHaveAttribute("open");
  expect(screen.getByRole("navigation", { name: "Run actions" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Inspect final world" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Edit this world" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "New world" })).toBeInTheDocument();
});

it("distinguishes empty worlds and wires replay and inspection actions", () => {
  const base = createSimulation({ seed: 8, config: defaultConfig(), initialPopulation: [], initialResources: [] });
  const onReplay = vi.fn(), onInspect = vi.fn();
  render(<RunResults state={base} evidence={createRunEvidence(base)} question="" onEdit={vi.fn()} onNew={vi.fn()} onReplay={onReplay} onInspect={onInspect} />);
  expect(screen.getByRole("heading", { name: "No organisms remain" })).toBeInTheDocument();
  expect(screen.getAllByText(/not seeded/i)).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Replay this run" }));
  fireEvent.click(screen.getByRole("button", { name: "Inspect final world" }));
  expect(onReplay).toHaveBeenCalledOnce();
  expect(onInspect).toHaveBeenCalledOnce();
});
