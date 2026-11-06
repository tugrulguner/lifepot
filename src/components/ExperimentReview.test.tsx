// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ExperimentReview } from "./ExperimentReview";
import { createRunEvidence } from "@/game/run-evidence";
import { defaultConfig } from "@/game/setup";
import { createSimulation } from "@/game/world";
afterEach(cleanup);
it("stages a new trial from starting conditions and keeps the previous focus readable", () => {
 const state = createSimulation({ seed: 7, config: defaultConfig() }), evidence = createRunEvidence(state);
 const reference = { config: state.config, evidence, seed: 7, policy: "fixed" as const, focus: { id: "population", reference: "population", generation: 0, description: "Population: 26 at generation 0; 26 at generation 0.", kind: "end" as const }, question: "What changed?" };
 const onChange = vi.fn();
 render(<ExperimentReview reference={reference} config={state.config} seed={7} policy="fixed" onChange={onChange} />);
 expect(screen.getByText(reference.focus.description)).toBeInTheDocument(); expect(screen.getByText(/Earlier question: What changed\?/)).toBeInTheDocument();
 expect(screen.getByText(/new trial from initial conditions, not a continuation/i)).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText("Condition to explore"), { target: { value: "abundance" } });
 fireEvent.change(screen.getByLabelText("Value to review"), { target: { value: "scarce" } });
 expect(onChange).toHaveBeenCalledTimes(1); expect(JSON.stringify(reference.config)).toBe(JSON.stringify(state.config));
});
