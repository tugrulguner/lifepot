// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { FeedbackLink } from "./FamilyHeader";

afterEach(cleanup);

it.each(["/", "/learn", "/play"] as const)("composes a fixed privacy-safe GitHub issue for %s", path => {
  render(<FeedbackLink path={path} />);
  const link = screen.getByRole("link", { name: `Feedback / report an issue for ${path} (opens in a new tab)` });
  const url = new URL(link.getAttribute("href")!);
  expect(url.origin + url.pathname).toBe("https://github.com/tugrulguner/lifepot/issues/new");
  expect(url.searchParams.get("title")).toBe(`LifePot feedback — ${path}`);
  expect(url.searchParams.get("body")).toBe(`LifePot page: ${path}\n\nPlease describe the issue or feedback. Avoid including private questions, replay data, saved-world names, or other personal information.`);
  expect([...url.searchParams.keys()].sort()).toEqual(["body", "title"]);
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  expect(link.classList.contains("ph-no-autocapture")).toBe(true);
  expect(link.getAttribute("data-ph-no-autocapture")).toBe("true");
});