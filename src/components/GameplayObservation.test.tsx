// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createRunEvidence } from "@/game/run-evidence";
import { createSimulation } from "@/game/world";
import { deterministicSetup } from "@/game/setup";
import { GameplayObservation } from "./GameplayObservation";

const setup = deterministicSetup({ world: "pond", threat: "drought", reward: "observe" });
const state = createSimulation({ seed: 7, config: setup });

afterEach(cleanup);

describe("near-board observation summary", () => {
  it("keeps source-backed names beside canonical species IDs", () => {
    render(<GameplayObservation state={state} evidence={null} followed={null} decision={null} names={{ A: "algae" }} />);
    expect(screen.getByLabelText("Species A count")).toHaveTextContent("algae · A");
    expect(screen.getByLabelText("Species B count")).toHaveTextContent(`${state.config.rules!.species[1].role} · B`);
  });
  it("puts recorded tick events beside the world without inventing causes", () => {
    const observed = { ...state, generation: 7, events: [
      { kind: "birth" as const, generation: 7, organismId: 12, at: 1, energy: 20 },
      { kind: "feeding" as const, generation: 7, organismId: 12, at: 1, energy: 4, source: "resource" as const },
      { kind: "death" as const, generation: 7, organismId: 8, at: 2, energy: 0, cause: "starvation" as const },
    ] };
    render(<GameplayObservation state={observed} evidence={null} followed={null} decision={null} />);
    const events = screen.getByRole("region", { name: "Recorded activity" });
    expect(events).toHaveTextContent("Generation 7");
    expect(events).toHaveTextContent("1 birth");
    expect(events).toHaveTextContent("1 feeding");
    expect(events).toHaveTextContent("1 death");
    expect(events).not.toHaveTextContent("caused");
  });
  it("shows every configured species, including extinct configured species with zero", () => {
    const species = state.config.rules!.species;
    state.guild.fill(0);
    state.guild[10] = 1;
    state.ruleSpecies[10] = 1;
    render(<GameplayObservation state={state} evidence={createRunEvidence(state)} followed={null} decision={null} />);
    for (const item of species) expect(screen.getByLabelText(`Species ${item.id} count`)).toHaveTextContent(item.id === species[0].id ? "1" : "0");
  });

  it("keeps followed family context and the latest factual extinction milestone visible", () => {
    const evidence = { ...createRunEvidence(state), firstExtinction: [{ speciesId: "A", generation: 18 }], lineageExtinction: [{ lineage: 24, generation: 18 }] };
    const { container } = render(<GameplayObservation state={state} evidence={evidence} followed={24} decision={null} />);
    expect(container.querySelector(".gameplay-observation")).toHaveTextContent("Following lineage #24");
    expect(container.querySelector(".gameplay-observation")).toHaveTextContent("No living members");
    expect(screen.getByRole("status", { name: "Latest retained extinction" })).toHaveTextContent("Generation 18: Species A first observed extinct");
    expect(screen.getByRole("status", { name: "Latest retained extinction" })).toHaveTextContent("Founder lineage #24 first observed extinct");
  });

  it("retains the latest species and family turning points independently", () => {
    const evidence = { ...createRunEvidence(state), firstExtinction: [{ speciesId: "B", generation: 109 }], lineageExtinction: [{ lineage: 24, generation: 91 }] };
    render(<GameplayObservation state={state} evidence={evidence} followed={null} decision={null} />);
    const notice = screen.getByRole("status", { name: "Latest retained extinction" });
    expect(notice).toHaveTextContent("Generation 109: Species B first observed extinct");
    expect(notice).toHaveTextContent("Generation 91: Founder lineage #24 first observed extinct");
  });

  it("labels an engine-activated patch active rather than queued", () => {
    const decision = { generation: 12, trigger: "stagnation", source: "jev", scheduledRuleChange: { decidedAtGeneration: 12, activation: "after_6", duration: "short", transition: "ramp", patch: { kind: "environment", field: "pressure", value: "drought" } } } as never;
    const activeState = { ...state, activeRuleChange: { sourceGeneration: 12, activatedAt: 18, revertAt: 23, previousRules: state.config.rules! }, appliedRuleChanges: [12] };
    const { container } = render(<GameplayObservation state={activeState} evidence={createRunEvidence(state)} followed={null} decision={decision} />);
    expect(container.querySelector(".intervention-status")).toHaveTextContent("Active since generation 18");
    expect(container.querySelector(".intervention-status")).not.toHaveTextContent("Queued");
  });

  it("describes per-species birth policy separately from a graph patch", () => {
    const decision = { generation: 12, trigger: "stagnation", source: "jev", speciesDirectives: [{ species: "A", strategy: { choice: "forage", confidence: 1, probabilities: { forage: 1 } }, mutationTarget: { choice: "metabolism", confidence: 1, probabilities: { metabolism: 1 } }, mutationTempo: { choice: "low", confidence: 1, probabilities: { low: 1 } } }] } as never;
    const { container } = render(<GameplayObservation state={state} evidence={createRunEvidence(state)} followed={null} decision={decision} />);
    expect(container.querySelector(".intervention-status")).toHaveTextContent("Birth policies");
    expect(container.querySelector(".intervention-status")).not.toHaveTextContent("Proposed graph change");
  });

  it("does not claim a proposed graph change is queued or active", () => {
    const decision = { generation: 12, trigger: "stagnation", source: "jev", scheduledRuleChange: { decidedAtGeneration: 12, activation: "after_6", duration: "short", transition: "ramp", patch: { kind: "environment", field: "pressure", value: "drought" } } } as never;
    const { container } = render(<GameplayObservation state={state} evidence={createRunEvidence(state)} followed={null} decision={decision} />);
    expect(container.querySelector(".gameplay-observation")).toHaveTextContent(/Queued.*not yet applied/);
    expect(container.querySelector(".gameplay-observation")).toHaveTextContent(/Proposed graph change/);
  });
});
