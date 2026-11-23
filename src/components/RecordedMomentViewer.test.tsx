// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { inspectReplayAtGeneration } from "@/game/replay";
import { RecordedMomentViewer } from "./RecordedMomentViewer";
vi.mock("@/game/replay", () => ({ inspectReplayAtGeneration: vi.fn() }));
const replay = {} as never, state = { generation: 4 } as never, evidence = {} as never;
beforeEach(() => { vi.mocked(inspectReplayAtGeneration).mockReturnValue({ state, evidence } as never); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("reconstructs asynchronously and labels the scene as historical", async () => {
 render(<RecordedMomentViewer replay={replay} generation={4} label="Peak population" onClose={vi.fn()} renderScene={() => <span>Recorded scene</span>} />);
 expect(screen.getByRole("status")).toHaveTextContent(/reconstructing/i);
 await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
 expect(inspectReplayAtGeneration).toHaveBeenCalledWith(replay, 4);
 expect(screen.getByText("Recorded scene")).toBeInTheDocument();
 expect(screen.getByText(/historical reconstruction, not the live/i)).toBeInTheDocument();
});
it("closes on Escape and restores focus to its connected opener", async () => {
 const opener = document.createElement("button"); document.body.append(opener); opener.focus(); const onClose = vi.fn();
 render(<RecordedMomentViewer replay={replay} generation={4} label="Peak" onClose={onClose} renderScene={() => null} />);
 const dialog = screen.getByRole("dialog", { name: "Recorded moment" });
 fireEvent(dialog, new Event("cancel", { cancelable: true }));
 expect(document.activeElement).toBe(opener); expect(onClose).toHaveBeenCalledOnce();
});
it("clears stale scene while the next generation is reconstructed", async () => {
 const { rerender } = render(<RecordedMomentViewer replay={replay} generation={4} label="Old" onClose={vi.fn()} renderScene={() => <span>Old scene</span>} />);
 await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
 vi.mocked(inspectReplayAtGeneration).mockImplementation(() => new Promise(() => {}) as never);
 rerender(<RecordedMomentViewer replay={replay} generation={9} label="New" onClose={vi.fn()} renderScene={() => <span>New scene</span>} />);
 expect(screen.queryByText("Old scene")).not.toBeInTheDocument(); expect(screen.getByRole("status")).toBeInTheDocument();
});
it("does not restore the old opener when the viewer is unmounted", () => {
 const opener = document.createElement("button"); document.body.append(opener); opener.focus();
 const { unmount } = render(<RecordedMomentViewer replay={replay} generation={4} label="Peak" onClose={vi.fn()} renderScene={() => null} />);
 const replacement = document.createElement("button"); document.body.append(replacement); replacement.focus();
 unmount();
 expect(document.activeElement).toBe(replacement);
});
