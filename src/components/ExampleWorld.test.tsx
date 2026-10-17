// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeOverview } from "./HomeOverview";

describe("homepage recorded example", () => {
  it("offers the explained demo on demand without replacing the example or creation flow", () => {
    const root = document.createElement("div");
    root.innerHTML = renderToStaticMarkup(<HomeOverview />);
    const demo = root.querySelector<HTMLVideoElement>('video[aria-label="LifePot explained product demo"]');
    expect(demo).not.toBeNull();
    expect(demo!.controls).toBe(true);
    expect(demo!.preload).toBe("none");
    expect(demo!.autoplay).toBe(false);
    expect(demo!.loop).toBe(false);
    expect(demo!.playsInline).toBe(true);
    expect(demo!.getAttribute("poster")).toBe("/media/lifepot-explained-demo-537cbbf6.jpg");
    expect(demo!.querySelector("source")?.getAttribute("src")).toBe("/media/lifepot-explained-demo-537cbbf6.mp4");
    expect(demo!.querySelector('track[kind="captions"]')).not.toBeNull();
    expect(root.textContent).toContain("Watch how it works");
    expect(root.textContent).toContain("Silent · on-screen explanations · 2 min 48 sec");
    expect(root.querySelector(".overview-demo details")?.textContent).toContain("Read the demo transcript");
    expect(root.querySelector(".overview-demo details")?.textContent).toContain("Fecundity shifts the energy needed to reproduce.");
    expect(root.querySelector('[data-example-video]')).not.toBeNull();
    expect(root.querySelector('a[href="/play#example"]')).not.toBeNull();
    expect(root.querySelector('a[href="/play"]')).not.toBeNull();
  });
  it("offers a labelled, explicit example replay beside the lightweight video preview", () => {
    const html = renderToStaticMarkup(<HomeOverview />);
    expect(html).toContain("Recorded example · exact replay");
    expect(html).toContain('href="/play#example"');
    expect(html).toContain('poster="/life-example-poster.jpg"');
    expect(html).toContain('data-example-video');
    expect(html).toContain("Explore this example");
    expect(html).toContain("Create your own world");
  });
});
