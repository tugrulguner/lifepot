// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("next/dynamic", () => ({ default: () => () => <p>Legacy game</p> }));
vi.mock("./HomeOverview", () => ({ HomeOverview: () => <p>Public overview</p> }));
import Home from "@/app/page";
import { HomeRoute } from "./HomeRoute";
afterEach(() => { cleanup(); history.replaceState(null, "", "/"); });

it("renders the public shell without reading request search parameters", async () => {
  const read = vi.fn();
  const page = Home as unknown as (props: { searchParams: Promise<Record<string, string>> }) => ReactNode | Promise<ReactNode>;
  const content = await page({ get searchParams() { read(); return Promise.resolve({}); } });
  render(content);
  expect(screen.getByText("Public overview")).toBeInTheDocument();
  expect(read).not.toHaveBeenCalled();
});
it("recognizes a legacy replay query in the browser", () => {
  history.replaceState(null, "", "/?replay=recorded");
  render(<HomeRoute />);
  expect(screen.getByText("Legacy game")).toBeInTheDocument();
});
it("retains legacy hash replay and ordinary overview entry", () => {
  history.replaceState(null, "", "/#replay=recorded");
  const view = render(<HomeRoute />);
  expect(screen.getByText("Legacy game")).toBeInTheDocument();
  view.unmount();
  history.replaceState(null, "", "/");
  render(<HomeRoute />);
  expect(screen.getByText("Public overview")).toBeInTheDocument();
});
