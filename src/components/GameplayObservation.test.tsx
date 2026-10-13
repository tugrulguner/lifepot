// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createRunEvidence } from "@/game/run-evidence";
import { createSimulation, ENGINE_VERSION, LEGACY_ENGINE_VERSION } from "@/game/world";
import { buildWorldReport } from "@/game/observatory";
import { deterministicSetup } from "@/game/setup";
import { GameplayObservation } from "./GameplayObservation";

const setup = deterministicSetup({ world: "pond", threat: "drought", reward: "observe" });
const state = createSimulation({ seed: 7, config: setup });

afterEach(cleanup);

describe("near-board observation summary", () => {
  it.each(["pack_hunting", "efficient_kill"] as const)("explains %s using the replay's actual engine without changing inputs", strategy => {
    const decision = { generation: 12, trigger: "stagnation", source: "jev", speciesDirectives: [{ species: "B", strategy: { choice: strategy } }], environmentPressure: { choice: "stability" }, environmentIntensity: { choice: "low" } } as never;
    const legacy = createSimulation({ seed: 7, config: setup, engineVersion: LEGACY_ENGINE_VERSION });
    const before = JSON.stringify({ legacy, decision });
    const { rerender } = render(<GameplayObservation state={legacy} evidence={null} followed={null} decision={decision} />);
    const gain = strategy === "pack_hunting" ? 62 : 72;
    const status = screen.getByLabelText("Intervention status");
    expect(status.querySelector("span")).toHaveTextContent(`${gain} energy on a catch`);
    const details = screen.getByRole("group", { name: "Policy explanation" });
    fireEvent.click(within(details).getByText("Why this policy matters"));
    expect(details).toHaveTextContent(`fixed feeding gain of ${gain} energy`);
    expect(details).not.toHaveTextContent(/share of captured prey energy/i);
    expect(buildWorldReport(legacy, [decision]).timeline[0].changes).toContain(`fixed feeding gain of ${gain} energy`);
    expect(JSON.stringify({ legacy, decision })).toBe(before);
    const current = createSimulation({ seed: 7, config: setup, engineVersion: ENGINE_VERSION });
    rerender(<GameplayObservation state={current} evidence={null} followed={null} decision={decision} />);
    expect(details).toHaveTextContent(/share of captured prey energy/i);
    expect(details).not.toHaveTextContent(/fixed feeding gain/i);
    expect(buildWorldReport(current, [decision]).timeline[0].changes).toContain("share of captured prey energy");
  });
  it("keeps the local saved-world identity beside the board", () => {
    render(<GameplayObservation state={state} evidence={null} followed={null} decision={null} worldName="Pond notebook" />);
    expect(screen.getByRole("region", {name:"Near-board observations"})).toHaveTextContent("Experiment: Pond notebook");
  });
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
    const decision = { generation: 12, trigger: "stagnation", source: "jev", speciesDirectives: [{ species: "A", strategy: { choice: "early_brood", confidence: 1, probabilities: { efficient_grazing: 0, early_brood: 1, armored: 0, swarming: 0, dispersal: 0 } }, mutationTarget: { choice: "metabolism", confidence: 1, probabilities: { metabolism: 1, fecundity: 0, mobility: 0, defense: 0, sensing: 0 } }, mutationTempo: { choice: "slow", confidence: 1, probabilities: { slow: 1, steady: 0, rapid: 0 } } }] } as never;
    const { container } = render(<GameplayObservation state={state} evidence={createRunEvidence(state)} followed={null} decision={decision} />);
    const status = container.querySelector(".intervention-status")!;
    expect(status).toHaveTextContent("Species A births: lower reproduction threshold");
    expect(status).not.toHaveTextContent("Proposed graph change");
    expect(status).not.toHaveTextContent("Decision recorded; no graph patch selected");
    expect(status).not.toHaveTextContent(/caused|resulted in|will improve|ensures/i);
    const details = screen.getByRole("group", { name: "Policy explanation" });
    expect(details).not.toHaveAttribute("open");
    fireEvent.click(within(details).getByText("Why this policy matters"));
    expect(details).toHaveAttribute("open");
    expect(details).toHaveTextContent("Future births of species A");
    expect(details).toHaveTextContent("each birth still transfers energy from the parent to the offspring");
    expect(details).not.toHaveTextContent("Proposed graph change");
  });

  it("does not claim a proposed graph change is queued or active", () => {
    const decision = { generation: 12, trigger: "stagnation", source: "jev", scheduledRuleChange: { decidedAtGeneration: 12, activation: "after_6", duration: "short", transition: "ramp", patch: { kind: "environment", field: "pressure", value: "drought" } } } as never;
    const { container } = render(<GameplayObservation state={state} evidence={createRunEvidence(state)} followed={null} decision={decision} />);
    expect(container.querySelector(".gameplay-observation")).toHaveTextContent(/Queued.*not yet applied/);
    expect(container.querySelector(".gameplay-observation")).not.toHaveTextContent(/Proposed graph change/);
    expect(container.querySelector(".intervention-status")).toHaveTextContent(/Queued · after 6 · not yet applied/);
    expect(screen.getByRole("group", { name: "Policy explanation" })).not.toHaveAttribute("open");
  });
});
