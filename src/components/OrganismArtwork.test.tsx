// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import OrganismArtwork from "./OrganismArtwork";

describe("OrganismArtwork", () => {
  it("uses the same pitch-scaled membrane widths as the canvas painter", () => {
    const markup = renderToStaticMarkup(<svg><OrganismArtwork role="grazer" color="#2ca25f" radius={44} /></svg>);
    const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
    const membrane = doc.querySelector('path[stroke="rgba(241,248,237,.94)"]')!;
    expect(Number(membrane.getAttribute("stroke-width"))).toBeCloseTo(100 * .035, 10);
  });
  it("clips internal accents as well as surface shading to the body", () => {
    const markup = renderToStaticMarkup(<svg><OrganismArtwork role="scavenger" color="#2ca25f" /></svg>);
    const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
    const accents = doc.querySelector('path[data-organism-accent]') ?? doc.querySelector('g[stroke-opacity=".62"]');
    expect(accents).not.toBeNull();
    expect(accents!.closest('[clip-path]')).not.toBeNull();
  });
  it("renders shared role contour with unique clipping and semantic body color", () => {
    const pair = renderToStaticMarkup(<svg viewBox="0 0 100 100"><OrganismArtwork role="producer" color="#2ca25f" /><OrganismArtwork role="hunter" color="#d74355" /></svg>);
    expect(pair).toContain("#2ca25f");
    expect(pair).toContain("clipPath");
    expect(pair).toContain("#d74355");
    const ids = [...pair.matchAll(/id="([^"]+)"/g)].map(match => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(pair).toContain("M");
  });
});
