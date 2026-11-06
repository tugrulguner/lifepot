// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { encodeHabitatCheckpoint } from "@/game/habitat-checkpoint";
import type { HabitatCheckpoint } from "@/game/habitat-checkpoint";
import { HabitatLibrary } from "./HabitatLibrary";

const storage = vi.hoisted(() => ({ list: vi.fn(), load: vi.fn(), import: vi.fn(), remove: vi.fn() }));
vi.mock("@/game/habitat-storage", () => ({ listHabitats: storage.list, loadHabitat: storage.load, importHabitat: storage.import, deleteHabitat: storage.remove }));
vi.mock("@/game/habitat-checkpoint", async () => {
  const actual = await vi.importActual<typeof import("@/game/habitat-checkpoint")>("@/game/habitat-checkpoint");
  return { ...actual, encodeHabitatCheckpoint: vi.fn(() => "encoded-checkpoint"), MAX_HABITAT_CHECKPOINT_BYTES: 8 * 1024 * 1024 };
});
const habitat = { id: "habitat-1", name: "Reed marsh", createdAt: 1, savedAt: 2, parentId: null, format: "lifepot-habitat", version: 1, state: { generation: 42, fixedHabitat: { version: 1, observationLimit: 120 }, outcome: "surviving", stats: { population: 9 }, config: { window: 120 } }, evidence: { samples: [{ generation: 42, population: 9 }], followedFamily: { lineage: 4, population: 3 }, lineageExtinction: [{ lineage: 7, generation: 35 }], firstExtinction: [{ speciesId: "reedling", generation: 30 }], peakPopulation: 12, ruleEvents: [], observedRuleVersion: 1 } } as unknown as HabitatCheckpoint;
const fresh = { ...habitat, savedAt: 3, state: { ...habitat.state, generation: 44 } } as HabitatCheckpoint;
beforeEach(() => { vi.clearAllMocks(); storage.list.mockResolvedValue([]); storage.load.mockResolvedValue(fresh); storage.import.mockResolvedValue(habitat); storage.remove.mockResolvedValue(undefined); vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:habitat"), revokeObjectURL: vi.fn() }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("renders as a distinct private saved-habitat library with local-storage and fixed-rule disclosure", async () => {
  storage.list.mockResolvedValue([habitat]);
  const { container } = render(<HabitatLibrary onOpen={vi.fn()} />);
  expect(await screen.findByText("Reed marsh")).toBeVisible();
  expect(screen.getByRole("region", { name: /Saved habitats/ })).toHaveAttribute("data-ph-no-capture", "true");
  expect(screen.getByText(/saved only on this device/i)).toBeVisible();
  expect(screen.getByText(/fixed-rule habitats/i)).toBeVisible();
  expect(screen.getByText(/no offline advance/i)).toBeVisible();
  expect(screen.getByText(/generation 42/i)).toBeVisible();
  expect(screen.getByText(/window 120/i)).toBeVisible();
  expect(screen.getByText(/population 9/i)).toBeVisible();
  expect(screen.getByText(/followed family 4.*3/i)).toBeVisible();
  expect(screen.getByText(/lineage 7.*generation 35/i)).toBeVisible();
  expect(screen.getByText(/reedling.*generation 30/i)).toBeVisible();
  expect(container.innerHTML).toContain("ph-no-capture");
});

it("shows a visible summary/count and opens the freshly reread paused checkpoint", async () => {
  storage.list.mockResolvedValue([habitat]);
  const onOpen = vi.fn();
  render(<HabitatLibrary onOpen={onOpen} />);
  await screen.findByText("Reed marsh");
  const summary = screen.getByText("Saved habitats").closest("summary");
  expect(summary).toBeVisible();
  expect(summary).toHaveAttribute("aria-label", "Saved habitats (1)");
  fireEvent.click(screen.getByRole("button", { name: "Open paused habitat: Reed marsh" }));
  await waitFor(() => expect(onOpen).toHaveBeenCalledWith(fresh));
  expect(storage.load).toHaveBeenCalledWith(habitat.id);
});

it("does not auto-open imported habitats and reports same-ID conflicts", async () => {
  storage.list.mockResolvedValue([habitat]);
  storage.import.mockRejectedValue(new Error("A habitat with this ID already exists"));
  const onOpen = vi.fn();
  const { container } = render(<HabitatLibrary onOpen={onOpen} />);
  await screen.findByText("Reed marsh");
  const input = screen.getByLabelText(/Import a habitat backup/i) as HTMLInputElement;
  const file = new File(["valid-looking"], "habitat.json", { type: "application/json" });
  Object.defineProperty(file, "text", { value: vi.fn().mockResolvedValue("valid-looking") });
  fireEvent.change(input, { target: { files: [file] } });
  expect(await screen.findByRole("alert")).toHaveTextContent(/already exists/i);
  expect(onOpen).not.toHaveBeenCalled();
  expect(input.value).toBe("");
  expect(container.querySelector("[aria-busy='true']")).toBeNull();
});

it("checks the import file size before storage and clears the input on rejection", async () => {
  const onOpen = vi.fn();
  render(<HabitatLibrary onOpen={onOpen} />);
  const input = screen.getByLabelText(/Import a habitat backup/i) as HTMLInputElement;
  const file = new File(["small"], "too-large.json", { type: "application/json" });
  Object.defineProperty(file, "size", { value: 8 * 1024 * 1024 + 1 });
  fireEvent.change(input, { target: { files: [file] } });
  expect(await screen.findByRole("alert")).toHaveTextContent(/8 MiB/i);
  expect(storage.import).not.toHaveBeenCalled();
  expect(input.value).toBe("");
  expect(onOpen).not.toHaveBeenCalled();
});

it("prevents duplicate async operations while an open is pending", async () => {
  let finish!: (value: HabitatCheckpoint) => void;
  storage.load.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  storage.list.mockResolvedValue([habitat]);
  const onOpen = vi.fn();
  render(<HabitatLibrary onOpen={onOpen} />);
  await screen.findByText("Reed marsh");
  const button = screen.getByRole("button", { name: "Open paused habitat: Reed marsh" });
  fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(storage.load).toHaveBeenCalledTimes(1));
  expect(button).toBeDisabled();
  finish(fresh);
  await waitFor(() => expect(onOpen).toHaveBeenCalledTimes(1));
});

it("downloads an export without changing or opening the checkpoint and revokes its object URL", async () => {
  storage.list.mockResolvedValue([habitat]);
  const onOpen = vi.fn();
  render(<HabitatLibrary onOpen={onOpen} />);
  await screen.findByText("Reed marsh");
  const create = vi.mocked(URL.createObjectURL);
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  fireEvent.click(screen.getByRole("button", { name: "Export habitat: Reed marsh" }));
  expect(create).toHaveBeenCalledTimes(1);
  expect(click).toHaveBeenCalledTimes(1);
  expect(onOpen).not.toHaveBeenCalled();
  expect(storage.load).not.toHaveBeenCalled();
  expect(encodeHabitatCheckpoint).toHaveBeenCalledWith(habitat);
  await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:habitat"));
  click.mockRestore();
});

it("requires explicit delete confirmation and refreshes after delete", async () => {
  storage.list.mockResolvedValue([habitat]);
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const { rerender } = render(<HabitatLibrary onOpen={vi.fn()} />);
  await screen.findByText("Reed marsh");
  fireEvent.click(screen.getByRole("button", { name: "Delete habitat: Reed marsh" }));
  expect(confirm).toHaveBeenCalled();
  expect(storage.remove).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole("button", { name: "Delete habitat: Reed marsh" }));
  await waitFor(() => expect(storage.remove).toHaveBeenCalledWith(habitat.id));
  await waitFor(() => expect(storage.list).toHaveBeenCalledTimes(2));
  rerender(<HabitatLibrary onOpen={vi.fn()} refreshKey={1} />);
  await waitFor(() => expect(storage.list).toHaveBeenCalledTimes(3));
  confirm.mockRestore();
});

it("reports list and open errors accessibly", async () => {
  storage.list.mockRejectedValueOnce(new Error("storage unavailable"));
  const { rerender } = render(<HabitatLibrary onOpen={vi.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/storage unavailable/i);
  storage.list.mockResolvedValue([habitat]);
  rerender(<HabitatLibrary onOpen={vi.fn()} refreshKey={1} />);
  await screen.findByText("Reed marsh");
  storage.load.mockRejectedValue(new Error("checkpoint unreadable"));
  fireEvent.click(screen.getByRole("button", { name: "Open paused habitat: Reed marsh" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/checkpoint unreadable/i);
});

it("imports a backup without opening it and refreshes the saved library", async () => {
  storage.import.mockResolvedValue(habitat);
  const onOpen = vi.fn();
  render(<HabitatLibrary onOpen={onOpen} />);
  const input = screen.getByLabelText(/Import a habitat backup/i) as HTMLInputElement;
  const file = new File(["wire"], "habitat.json", { type: "application/json" });
  Object.defineProperty(file, "text", { value: vi.fn().mockResolvedValue("wire") });
  fireEvent.change(input, { target: { files: [file] } });
  expect(await screen.findByRole("status")).toHaveTextContent(/imported on this device/i);
  expect(storage.import).toHaveBeenCalledWith("wire");
  await waitFor(() => expect(storage.list).toHaveBeenCalledTimes(2));
  expect(input.value).toBe("");
  expect(onOpen).not.toHaveBeenCalled();
});

it("labels window-complete and extinct checkpoints distinctly", async () => {
  const complete = { ...habitat, id: "complete", name: "Finished marsh", state: { ...habitat.state, generation: 120 } } as HabitatCheckpoint;
  const extinct = { ...habitat, id: "extinct", name: "Empty marsh", state: { ...habitat.state, outcome: "extinct", stats: { population: 0 } } } as HabitatCheckpoint;
  storage.list.mockResolvedValue([complete, extinct]);
  render(<HabitatLibrary onOpen={vi.fn()} />);
  expect(await screen.findByText("Finished marsh")).toBeVisible();
  expect(screen.getByText(/Observation window complete/i)).toBeVisible();
  expect(screen.getByText("Extinct · Generation 42 / window 120")).toBeVisible();
});

it("reports export encoder errors accessibly", async () => {
  storage.list.mockResolvedValue([habitat]);
  vi.mocked(encodeHabitatCheckpoint).mockImplementationOnce(() => { throw new Error("checkpoint cannot be exported"); });
  render(<HabitatLibrary onOpen={vi.fn()} />);
  await screen.findByText("Reed marsh");
  fireEvent.click(screen.getByRole("button", { name: "Export habitat: Reed marsh" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/cannot be exported/i);
});

it("ignores an outstanding list result after unmount", async () => {
  let finish!: (value: HabitatCheckpoint[]) => void;
  storage.list.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const { unmount } = render(<HabitatLibrary onOpen={vi.fn()} />);
  unmount();
  finish([habitat]);
  await Promise.resolve();
  expect(screen.queryByText("Reed marsh")).not.toBeInTheDocument();
});
