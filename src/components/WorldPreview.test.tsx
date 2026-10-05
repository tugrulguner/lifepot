// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
afterEach(cleanup);
import WorldPreview from "./WorldPreview";
import { defaultConfig } from "@/game/setup";

describe("WorldPreview", () => {
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
