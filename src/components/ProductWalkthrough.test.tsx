// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ProductWalkthrough } from "./ProductWalkthrough";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("does not let a superseded play rejection obscure a later chapter", async () => {
  let rejectFirst!: (error: Error) => void;
  const firstPlay = new Promise<void>((_, reject) => { rejectFirst = reject; });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockReturnValueOnce(firstPlay).mockResolvedValue();
  render(<ProductWalkthrough />);
  fireEvent.click(screen.getByRole("button", { name: "Watch the walkthrough" }));
  fireEvent.click(screen.getByRole("button", { name: "Observe and inspect, 0:38" }));
  fireEvent.play(screen.getByLabelText("LifePot explained product demo"));
  await act(async () => { rejectFirst(new Error("Superseded playback request")); });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Watch the walkthrough" })).not.toBeInTheDocument();
});

it("keeps the native player available when pausing cancels pending playback", async () => {
  let rejectPlay!: (error: DOMException) => void;
  vi.spyOn(HTMLMediaElement.prototype, "play").mockReturnValue(new Promise<void>((_, reject) => { rejectPlay = reject; }));
  render(<ProductWalkthrough />);
  const video = screen.getByLabelText("LifePot explained product demo") as HTMLVideoElement;
  fireEvent.click(screen.getByRole("button", { name: "Watch the walkthrough" }));
  Object.defineProperty(video, "paused", { configurable: true, value: false });
  fireEvent.play(video);
  Object.defineProperty(video, "paused", { configurable: true, value: true });
  fireEvent.pause(video);
  await act(async () => { rejectPlay(new DOMException("The play() request was interrupted by a call to pause().", "AbortError")); });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Watch the walkthrough" })).not.toBeInTheDocument();
  expect(video.tabIndex).toBe(0);
  expect(video.controls).toBe(true);
});

it("offers an accessible recovery when the active playback request fails", async () => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(new Error("Unavailable"));
  render(<ProductWalkthrough />);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Watch the walkthrough" })); });
  expect(screen.getByRole("alert")).toHaveTextContent("The video could not be played.");
  expect(screen.getByRole("link", { name: "open it separately" })).toHaveAttribute("href", "/demo/lifepot-explained-demo-537cbbf6.mp4");
  expect(screen.getByRole("button", { name: "Watch the walkthrough" })).toBeInTheDocument();
});

it("loads a requested chapter only after an explicit choice and follows actual playback time", () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  render(<ProductWalkthrough />);
  const video = screen.getByLabelText("LifePot explained product demo") as HTMLVideoElement;
  Object.defineProperty(video, "readyState", { value: 0 });
  expect(screen.getByRole("navigation", { name: "Walkthrough chapters" }).querySelectorAll("button")).toHaveLength(4);
  fireEvent.click(screen.getByRole("button", { name: "Observe and inspect, 0:38" }));
  expect(play).toHaveBeenCalledOnce();
  expect(video.currentTime).toBe(0);
  fireEvent.loadedMetadata(video);
  expect(video.currentTime).toBe(38);
  video.currentTime = 118;
  fireEvent.timeUpdate(video);
  expect(screen.getByRole("button", { name: "Try another experiment, 1:46" })).toHaveAttribute("aria-current", "step");
  video.currentTime = 146;
  fireEvent.timeUpdate(video);
  expect(screen.getByRole("button", { name: "Compare and replay, 2:16" })).toHaveAttribute("aria-current", "step");
});

it("starts the unchanged on-demand video through a clear play action", () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  render(<ProductWalkthrough />);
  const video = screen.getByLabelText("LifePot explained product demo") as HTMLVideoElement;
  expect(video.preload).toBe("none");
  expect(video.autoplay).toBe(false);
  expect(video.controls).toBe(true);
  expect(video.querySelector("source")).toHaveAttribute("src", "/demo/lifepot-explained-demo-537cbbf6.mp4");
  const start = screen.getByRole("button", { name: "Watch the walkthrough" });
  expect(play).not.toHaveBeenCalled();
  fireEvent.click(start);
  expect(play).toHaveBeenCalledOnce();
  expect(start).toBeInTheDocument(); // A resolved stub is not a playback event.
  expect(start.closest(".demo-cover")).not.toBeNull();
  expect(video.tabIndex).toBe(-1);
  start.focus();
  fireEvent.play(video);
  expect(document.activeElement).toBe(video);
  expect(video.tabIndex).toBe(0);
  expect(screen.queryByRole("button", { name: "Watch the walkthrough" })).not.toBeInTheDocument();
  expect(screen.getByText("Read the demo transcript")).toBeInTheDocument();
});
