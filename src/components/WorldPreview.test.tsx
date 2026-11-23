// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
afterEach(cleanup);
import WorldPreview from "./WorldPreview";
import { defaultConfig } from "@/game/setup";
import { roleColor } from "@/game/world-presentation";

describe("WorldPreview", () => {
  it("colors each preview species by role and keeps same-role identities distinct", () => {
    const config = defaultConfig();
    config.rules!.species = [
      { id: "A", role: "hunter", selfInteraction: "territorial" },
      { id: "B", role: "producer", selfInteraction: "cooperative" },
      { id: "C", role: "hunter", selfInteraction: "territorial" },
    ];
    config.rules!.interactions = [
      { pair: "A:B", mode: "neutral" }, { pair: "A:C", mode: "competition" }, { pair: "B:C", mode: "a_consumes_b" },
    ];
    render(<WorldPreview config={config} answers={{ world: "world", threat: "threat", reward: "reward" }} onChange={() => {}} />);
    const swatches = [...document.querySelectorAll<HTMLLIElement>(".world-preview-species li")];
    const rendered = (row: HTMLLIElement) => row.querySelector("i")!.style.background;
    const color = (value: string) => { const probe = document.createElement("i"); probe.style.background = value; return probe.style.background; };
    expect(swatches.map(rendered)).toEqual([
      color(roleColor("hunter", "A")), color(roleColor("producer", "B")), color(roleColor("hunter", "C")),
    ]);
    expect(rendered(swatches[0]!)).not.toBe(rendered(swatches[1]!));
    expect(rendered(swatches[0]!)).not.toBe(rendered(swatches[2]!));
  });

  it("uses neutral review language for designed starter worlds", () => {
    render(<WorldPreview starter config={defaultConfig()} answers={{ world: "starter", threat: "starter", reward: "starter" }} onChange={() => {}} />);
    expect(screen.getByRole("heading", { name: "Starting habitat" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Your world, interpreted" })).toBeNull();
  });

  it("shows a fidelity warning and delegates only validated manual edits", () => {
    const config = defaultConfig(); config.rules!.interactions[0].mode = "neutral";
    const onChange = vi.fn();
    render(<WorldPreview config={config} answers={{ world: "wet forest", threat: "named hunter", reward: "survival" }} onChange={onChange} />);
    expect(screen.getByRole("alert").textContent).toMatch(/no modeled consumption link/i);
    fireEvent.click(screen.getByText("Edit world conditions"));
    fireEvent.change(screen.getByLabelText("A:B relationship"), { target: { value: "a_consumes_b" } });
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0][0].rules.interactions[0].mode).toBe("a_consumes_b");
    expect(config.rules!.interactions[0].mode).toBe("neutral");
  });
  it("keeps an invalid role change uncommitted and explains the validation", () => {
    const onChange = vi.fn();
    render(<WorldPreview config={defaultConfig()} answers={{ world: "world", threat: "threat", reward: "reward" }} onChange={onChange} />);
    fireEvent.click(screen.getByText("Edit world conditions"));
    fireEvent.change(screen.getByLabelText("Species A role"), { target: { value: "hunter" } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/Edit not applied:.*basal/i)).toBeTruthy();
  });
});
