// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReplayData } from "@/game/replay";
import example from "../../public/example-world.json";

// Holds the link decode open so a test can act while it is pending, then release it.
const held = vi.hoisted(() => ({ release: null as null | (() => void), fail: null as null | (() => void) }));
vi.mock("@/game/replay", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/game/replay")>();
  return {
    ...actual,
    decodeReplayLink: (payload: string) =>
      new Promise<ReplayData>((resolve, reject) => {
        held.release = () => resolve(actual.decodeReplay(payload));
        held.fail = () => reject(new Error("Invalid or unsupported LifePot replay"));
      }),
  };
});
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));
Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", { configurable: true, value: () => "data:image/png;base64,test" });
HTMLCanvasElement.prototype.getContext = (() =>
  new Proxy(
    {},
    {
      get(_target, key) {
        if (key === "createImageData" || key === "getImageData")
          return (...args: number[]) => {
            const [width, height] = args.slice(-2);
            return { width, height, data: new Uint8ClampedArray(width * height * 4) };
          };
        if (key === "measureText") return () => ({ width: 0 });
        if (key === "createLinearGradient" || key === "createRadialGradient" || key === "createPattern")
          return () => ({ addColorStop() {} });
        return () => {};
      },
      set: () => true,
    },
  )) as unknown as typeof HTMLCanvasElement.prototype.getContext;

import { GameCanvas } from "./GameCanvas";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("scrollTo", vi.fn());
  held.release = held.fail = null;
  location.hash = `#replay=${example.replay}`;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  location.hash = "";
});
const settle = (how: "release" | "fail") =>
  act(async () => {
    held[how]!();
    await Promise.resolve();
  });

it("opens the linked replay when the player does nothing while it decodes", async () => {
  render(<GameCanvas />);
  expect(held.release).not.toBeNull();
  await settle("release");
  expect(screen.queryByRole("button", { name: /Seed ecosystem/ })).not.toBeInTheDocument();
  expect(screen.getByRole("img", { name: /^Ecosystem generation 0;/ })).toBeInTheDocument();
});

it("keeps the starter review when the link finishes decoding after the player chose a starter", async () => {
  render(<GameCanvas />);
  expect(held.release).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Use a starter world instead" }));
  fireEvent.click(screen.getByRole("button", { name: "Preview Hunters and prey" }));
  fireEvent.click(screen.getByRole("button", { name: "Review this world" }));
  expect(screen.getByRole("button", { name: /Seed ecosystem/ })).toBeEnabled();
  await settle("release");
  expect(screen.getByRole("button", { name: /Seed ecosystem/ })).toBeEnabled();
  expect(screen.getByTestId("interpreter-source")).toHaveTextContent("Designed starter");
});

it("does not replace the player's setup when only a starter was previewed", async () => {
  render(<GameCanvas />);
  fireEvent.click(screen.getByRole("button", { name: "Use a starter world instead" }));
  fireEvent.click(screen.getByRole("button", { name: "Preview Hunters and prey" }));
  await settle("release");
  expect(screen.getByRole("button", { name: "Review this world" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Preview Hunters and prey" })).toHaveAttribute("aria-pressed", "true");
});

it("does not report a failed link over a setup the player has already started", async () => {
  render(<GameCanvas />);
  fireEvent.click(screen.getByRole("button", { name: "Use a starter world instead" }));
  fireEvent.click(screen.getByRole("button", { name: "Preview Hunters and prey" }));
  fireEvent.click(screen.getByRole("button", { name: "Review this world" }));
  await settle("fail");
  expect(screen.getByRole("button", { name: /Seed ecosystem/ })).toBeEnabled();
  expect(screen.queryByText("This replay link could not be opened. You can still create your own world.")).not.toBeInTheDocument();
});

it("leaves setup in place when the link is invalid", async () => {
  render(<GameCanvas />);
  await settle("fail");
  expect(screen.getByRole("textbox")).toBeInTheDocument();
  expect(screen.queryByRole("img", { name: /^Ecosystem generation/ })).not.toBeInTheDocument();
});
