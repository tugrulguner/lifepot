// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createSimulation } from "@/game/world";
import { defaultConfig } from "@/game/setup";
import { WatchingOrganism } from "./WatchingOrganism";

afterEach(cleanup);
it("keeps the selected cell's actual identity and energy beside the habitat", () => {
  const state = createSimulation({ seed: 17, config: defaultConfig() });
  const index = state.guild.findIndex(Boolean), before = JSON.stringify(state);
  const follow = vi.fn(), details = vi.fn();
  render(<WatchingOrganism state={state} index={index} followed={null} onFollow={follow} onDetails={details} />);
  const subject = screen.getByRole("region", { name: "Watching organism" });
  expect(subject).toHaveTextContent(`Organism #${state.organismId[index]}`);
  expect(subject).toHaveTextContent(`Energy ${state.energy[index].toFixed(1)}`);
  expect(subject).toHaveTextContent(`Age ${state.age[index]}`);
  fireEvent.click(screen.getByRole("button", { name: "Pin this family" }));
  expect(follow).toHaveBeenCalledExactlyOnceWith(state.lineage[index]);
  fireEvent.click(screen.getByRole("button", { name: "More organism details" }));
  expect(details).toHaveBeenCalledOnce();
  expect(JSON.stringify(state)).toBe(before);
});

it("distinguishes the inspected family from a different pinned family", () => {
  const state = createSimulation({ seed: 17, config: defaultConfig() });
  const index = state.guild.findIndex(Boolean);
  const other = state.guild.findIndex((alive, i) => Boolean(alive) && state.lineage[i] !== state.lineage[index]);
  expect(other).toBeGreaterThanOrEqual(0);
  const followed = state.lineage[other];
  render(<WatchingOrganism state={state} index={index} followed={followed} onFollow={() => {}} onDetails={() => {}} />);
  const subject = screen.getByRole("region", { name: "Watching organism" });
  expect(subject).toHaveTextContent(`Family #${state.lineage[index]}`);
  expect(subject).toHaveTextContent(`Following lineage #${followed}`);
  expect(screen.getByRole("button", { name: "Pin this family" })).toHaveAttribute("aria-pressed", "false");
});

it("keeps a matching family pin explicit without duplicate summaries", () => {
  const state = createSimulation({ seed: 17, config: defaultConfig() });
  const index = state.guild.findIndex(Boolean);
  render(<WatchingOrganism state={state} index={index} followed={state.lineage[index]} onFollow={() => {}} onDetails={() => {}} />);
  expect(screen.getByRole("region", { name: "Watching organism" })).toHaveTextContent(`Following lineage #${state.lineage[index]}`);
  expect(screen.getByRole("button", { name: "Pin this family" })).toHaveAttribute("aria-pressed", "true");
});

it("shows empty-cell measurements without inventing a death or allowing an empty-cell pin", () => {
  const state = createSimulation({ seed: 17, config: defaultConfig() });
  const index = state.guild.findIndex(value => value === 0);
  render(<WatchingOrganism state={state} index={index} followed={null} onFollow={() => {}} onDetails={() => {}} />);
  const subject = screen.getByRole("region", { name: "Watching organism" });
  expect(subject).toHaveTextContent("Empty cell");
  expect(subject).toHaveTextContent(`Resources ${state.resources[index]} / 255`);
  expect(screen.queryByRole("button", { name: "Pin this family" })).not.toBeInTheDocument();
  expect(subject).not.toHaveTextContent(/moved|died|extinct/i);
});
