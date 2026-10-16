// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ExamplePreview from "./ExamplePreview";

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  enter(isIntersecting = true) {
    this.callback([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

let motionQuery: { matches: boolean; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
let connection: EventTarget & { saveData: boolean };
let play: ReturnType<typeof vi.fn>;
let pause: ReturnType<typeof vi.fn>;

beforeEach(() => {
  MockIntersectionObserver.instances = [];
  motionQuery = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  vi.stubGlobal("matchMedia", vi.fn(() => motionQuery));
  connection = Object.assign(new EventTarget(), { saveData: false });
  Object.defineProperty(navigator, "connection", { configurable: true, value: connection });
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  let paused = true;
  Object.defineProperty(HTMLMediaElement.prototype, "paused", { configurable: true, get: () => paused });
  play = vi.fn().mockImplementation(function (this: HTMLMediaElement) { paused = false; this.dispatchEvent(new Event("play")); return Promise.resolve(); });
  pause = vi.fn().mockImplementation(function (this: HTMLMediaElement) { paused = true; this.dispatchEvent(new Event("pause")); });
  Object.defineProperty(HTMLMediaElement.prototype, "load", { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: play });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: pause });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ExamplePreview", () => {
  it("renders the poster without loading video until visible, then autoplays", async () => {
    const { container } = render(<ExamplePreview />);
    const video = container.querySelector("video")!;
    expect(video.getAttribute("poster")).toBe("/life-example-poster.jpg");
    expect(video.getAttribute("preload")).toBe("none");
    expect(video.hasAttribute("src")).toBe(false);
    expect(video.muted).toBe(true);
    expect(video.playsInline).toBe(true);
    expect(video.loop).toBe(true);
    expect(container.querySelector("[data-example-video]")).not.toBeNull();

    MockIntersectionObserver.instances[0].enter();
    await waitFor(() => expect(video.getAttribute("src")).toBe("/life-example.mp4"));
    await waitFor(() => expect(play).toHaveBeenCalled());
  });

  it("requires explicit playback under reduced motion or data saver", async () => {
    motionQuery.matches = true;
    connection.saveData = true;
    const { container } = render(<ExamplePreview />);
    const video = container.querySelector("video")!;
    MockIntersectionObserver.instances[0].enter();
    expect(video.hasAttribute("src")).toBe(false);
    expect(play).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Play preview" }));
    await waitFor(() => expect(video.getAttribute("src")).toBe("/life-example.mp4"));
    await waitFor(() => expect(play).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Pause preview" })).toBeTruthy();
  });

  it("pauses offscreen and resumes only when playback was not manually paused", async () => {
    render(<ExamplePreview />);
    const observer = MockIntersectionObserver.instances[0];
    observer.enter();
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    await act(async () => { observer.enter(false); });
    expect(pause).toHaveBeenCalled();
    await act(async () => { observer.enter(); });
    await waitFor(() => expect(play).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("button", { name: "Pause preview" }));
    observer.enter(false);
    observer.enter();
    expect(play).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Play preview" })).toBeTruthy();
  });

  it("does not autoplay when video.play rejects", async () => {
    play.mockRejectedValueOnce(new Error("blocked"));
    render(<ExamplePreview />);
    MockIntersectionObserver.instances[0].enter();
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Play preview" })).toBeTruthy());
    expect(pause).toHaveBeenCalled();
  });
});
