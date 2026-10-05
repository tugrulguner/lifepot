// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createSimulation } from "@/game/world";
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
