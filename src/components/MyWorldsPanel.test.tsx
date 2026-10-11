// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MyWorldsPanel } from "./MyWorldsPanel";
import type { WorldRecord } from "@/game/my-worlds";
const storage = vi.hoisted(() => ({ list: vi.fn(), save: vi.fn(), remove: vi.fn(), create: vi.fn(), import: vi.fn(), export: vi.fn() }));
vi.mock("@/game/my-worlds", () => ({ listWorlds: storage.list, saveWorld: storage.save, deleteWorld: storage.remove, importWorld: storage.import, exportWorld: storage.export, MAX_WORLD_EXPORT_BYTES: 1_000_000 }));
const record = { id: "saved-world", name: "My little pond", savedAt: "2026-10-10T12:00:00.000Z", parentId: null, replay: { seed: 42, engineVersion: "ca8" }, evidence: { samples: [{ generation: 180, population: 4 }], firstExtinction: [] }, outcome: "surviving", stopReason: "Observation horizon reached" } as unknown as WorldRecord;
const current = { replay: record.replay, evidence: record.evidence, outcome: record.outcome, stopReason: record.stopReason, parentId: null };
beforeEach(() => { vi.clearAllMocks(); storage.list.mockResolvedValue([]); storage.save.mockResolvedValue(record); storage.remove.mockResolvedValue(undefined); storage.create.mockResolvedValue(record); });
afterEach(cleanup);
it("excludes world names and actions from PostHog autocapture", () => {
  const html = renderToStaticMarkup(<MyWorldsPanel current={current} onOpen={() => {}} />);
  expect(html).toContain('class="my-worlds ph-no-capture"');
  expect(html).toContain('data-ph-no-capture="true"');
});
it("makes a changed experiment an explicit review action, not an automatic replay", async () => {
  storage.list.mockResolvedValue([record]);
  const open = vi.fn(), review = vi.fn();
  render(<MyWorldsPanel onOpen={open} onReview={review} />);
  await screen.findByText("My little pond");
  fireEvent.click(screen.getByRole("button", { name: /Review changed experiment/ }));
  expect(review).toHaveBeenCalledWith(record);
  expect(open).not.toHaveBeenCalled();
});
it("disables duplicate writes and reports success only after persistence commits", async () => {
  let commit!: () => void;
  storage.save.mockImplementation(() => new Promise<WorldRecord>(resolve => { commit = () => resolve(record); }));
  const saved = vi.fn();
  render(<MyWorldsPanel current={current} onOpen={() => {}} onSaved={saved} />);
  fireEvent.click(screen.getByRole("button", { name: "Save completed world" }));
  await waitFor(() => expect(storage.save).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("button", { name: /Saving/ })).toBeDisabled();
  expect(saved).not.toHaveBeenCalled();
  commit();
  await waitFor(() => expect(saved).toHaveBeenCalledWith(record));
  expect(screen.getByRole("status")).toHaveTextContent("World saved in this browser");
});
it("shows storage failure without falsely reporting a saved world", async () => {
  storage.save.mockRejectedValue(new DOMException("Quota exceeded", "QuotaExceededError"));
  const saved = vi.fn();
  render(<MyWorldsPanel current={current} onOpen={() => {}} onSaved={saved} />);
  fireEvent.click(screen.getByRole("button", { name: "Save completed world" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/storage.*full/i);
  expect(saved).not.toHaveBeenCalled();
});
it("offers a first-screen generic saved-world shortcut and count when saves exist", async () => {
  storage.list.mockResolvedValue([record]);
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  render(<MyWorldsPanel entryShortcut onOpen={() => {}} />);
  const shortcut = await screen.findByRole("button", { name: "My Worlds (1)" });
  expect(shortcut).toBeVisible();
  expect(shortcut.closest('[data-ph-no-capture="true"]')).not.toBeNull();
  fireEvent.click(shortcut);
  expect(document.getElementById("my-worlds-shelf")).toBeInTheDocument();
});
