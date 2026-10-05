// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import ResultImageShare from "./ResultImageShare";
import { createSimulation } from "@/game/world";
import { defaultConfig } from "@/game/setup";

const state = createSimulation({ seed: 8, config: defaultConfig() });
function mockPng() {
  const blob = new Blob(["png"], { type: "image/png" });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    fillStyle: "", font: "", fillRect: vi.fn(), fillText: vi.fn(), measureText: (s: string) => ({ width: s.length * 8 }),
    beginPath: vi.fn(), arc: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), fill: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => callback(blob));
  return blob;
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("ResultImageShare", () => {
  it("discards an in-flight private image when question consent is revoked", async () => {
    mockPng();
    let complete!: BlobCallback;
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => { complete = callback; });
    render(<ResultImageShare state={state} question="Private prediction" />);
    fireEvent.click(screen.getByLabelText(/include my question/i));
    fireEvent.click(screen.getByRole("button", { name: /prepare result image/i }));
    fireEvent.click(screen.getByLabelText(/include my question/i));
    await import("@testing-library/react").then(async ({ act }) => { await act(async () => complete(new Blob(["png"], { type: "image/png" }))); });
    expect(screen.queryByRole("img", { name: "Final world share preview" })).toBeNull();
    expect(screen.queryByRole("button", { name: /download image/i })).toBeNull();
    expect(screen.getByRole("button", { name: /prepare result image/i }).hasAttribute("disabled")).toBe(false);
  });
  it("prepares a real PNG preview/download after explicit request, omitting question by default", async () => {
    const blob = mockPng();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<ResultImageShare state={state} question="Private question" />);
    expect((screen.getByLabelText(/include my question/i) as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /prepare result image/i }));
    expect(await screen.findByRole("img", { name: "Final world share preview" })).toBeTruthy();
    expect(screen.getByText("Preview ready")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /download image/i }));
    expect(click).toHaveBeenCalled();
    expect(blob.type).toBe("image/png");
  });
  it("offers file share only when canShare accepts the prepared PNG and reports handoff honestly", async () => {
    const blob = mockPng();
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "canShare", { configurable: true, value: vi.fn().mockReturnValue(true) });
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    vi.stubGlobal("File", class extends Blob { name: string; constructor(parts: BlobPart[], name: string, opts: FilePropertyBag) { super(parts, opts); this.name = name; } lastModified = Date.now(); });
    render(<ResultImageShare state={state} question="Question" />);
    fireEvent.click(screen.getByRole("button", { name: /prepare result image/i }));
    await screen.findByRole("button", { name: /share image/i });
    fireEvent.click(screen.getByRole("button", { name: /share image/i }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(await screen.findByText(/share sheet opened/i)).toBeTruthy();
    expect(blob.type).toBe("image/png");
  });
});
