// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeOverview } from "./HomeOverview";

describe("homepage video-free entry", () => {
  it("keeps videos off the homepage while retaining direct paths into play and documentation", () => {
    const root = document.createElement("div");
    root.innerHTML = renderToStaticMarkup(<HomeOverview />);
    expect(root.querySelectorAll("video")).toHaveLength(0);
    expect(root.querySelectorAll("source[src$='.mp4']")).toHaveLength(0);
    expect(root.querySelectorAll("[data-example-video]")).toHaveLength(0);
    expect(root.querySelector('a[href="/experiment"]')?.textContent).toContain("Play LifePot");
    expect(root.querySelector('a[href="/play#example"]')?.textContent).toContain("Play example");
    expect(root.querySelector('a[href="/play#example"]')).not.toBeNull();
    expect(root.querySelector('a[href="/play"]')).not.toBeNull();
  });
  it("shows a lightweight example image and no media element", () => {
    const html = renderToStaticMarkup(<HomeOverview />);
    expect(html).toContain("Recorded example · exact replay");
    expect(html).toContain('href="/play#example"');
    const root = document.createElement("div"); root.innerHTML = html;
    expect(root.querySelector('.example-media img[src="/life-example-poster.jpg"]')).not.toBeNull();
    expect(html).not.toContain("<video");
    expect(html).not.toContain(".mp4");
  });
});
