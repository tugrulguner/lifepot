// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createSimulation } from "@/game/world";
import { createRunEvidence } from "@/game/run-evidence";
import { defaultConfig } from "@/game/setup";
import { CreatureInspector } from "./CreatureInspector";

describe("creature inspector summary", () => {
  afterEach(cleanup);
  it("shows compact organism and founder-family context without removing detailed inspection", () => {
    const state = createSimulation({ seed: 17, config: defaultConfig() });
    const index = state.guild.findIndex(Boolean);
    render(<CreatureInspector state={state} index={index} followed={null} onFollow={() => {}} onClear={() => {}} onPick={() => {}} />);
    expect(screen.getByRole("region", { name: "Organism and family summary" })).toBeInTheDocument();
    expect(screen.getByText(/Species [AB] · .* · founder lineage #/)).toBeInTheDocument();
    expect(screen.getByText("Detailed organism inspection")).toBeInTheDocument();
    expect(screen.getByText("Heritable variant")).toBeInTheDocument();
  });

  it("retains a followed-family extinction milestone after every member disappears", () => {
    const state = createSimulation({ seed: 19, config: defaultConfig() });
    const founder = state.guild.findIndex(Boolean);
    const lineage = state.lineage[founder];
    const extinct = { ...state, guild: state.guild.slice() };
    extinct.guild.fill(0);
    render(<CreatureInspector state={extinct} index={null} followed={lineage} onFollow={() => {}} onClear={() => {}} onPick={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent(`Following founder lineage #${lineage}`);
    expect(screen.getByRole("status")).toHaveTextContent("No living family members remain. This lineage is extinct");
    expect(screen.getByRole("button", { name: "Stop following" })).toBeInTheDocument();
  });

  it("shows a compact live family count for the inspected founder lineage", () => {
    const state = createSimulation({ seed: 21, config: defaultConfig() });
    const index = state.guild.findIndex(Boolean);
    render(<CreatureInspector state={state} index={index} followed={null} onFollow={() => {}} onClear={() => {}} onPick={() => {}} />);
    const summary = screen.getByRole("region", { name: "Organism and family summary" });
    expect(summary).toHaveTextContent(`${state.guild.reduce((n, alive, i) => n + Number(Boolean(alive && state.lineage[i] === state.lineage[index])), 0)} living family`);
  });
});

it("shows retained configured-species and followed-family milestones live, after clearing inspection and unpinning", () => {
  const state = createSimulation({ seed: 42, config: defaultConfig() });
  const evidence = {
    ...createRunEvidence(state),
    firstExtinction: [{ speciesId: "A", generation: 7 }],
    lineageExtinction: [{ lineage: 12, generation: 9 }],
  };
  const { rerender } = render(<CreatureInspector state={{ ...state, generation: 9 }} evidence={evidence} index={null} followed={12} onFollow={() => {}} onClear={() => {}} onPick={() => {}} />);
  const milestones = screen.getByRole("region", { name: "Observed extinction milestones" });
  expect(milestones).toHaveAttribute("aria-live", "polite");
  expect(milestones).toHaveTextContent("Species A first observed extinct at generation 7");
  expect(milestones).toHaveTextContent("Founder lineage #12 first observed extinct at generation 9");
  rerender(<CreatureInspector state={{ ...state, generation: 15 }} evidence={evidence} index={null} followed={null} onFollow={() => {}} onClear={() => {}} onPick={() => {}} />);
  expect(milestones).toHaveTextContent("Founder lineage #12 first observed extinct at generation 9");
  rerender(<CreatureInspector state={{ ...state, generation: 16 }} evidence={evidence} index={state.guild.findIndex(Boolean)} followed={null} onFollow={() => {}} onClear={() => {}} onPick={() => {}} />);
  expect(milestones.compareDocumentPosition(screen.getByText("Detailed organism inspection")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
