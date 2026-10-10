import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { guideMarkdown, guides } from "./app/learn/content";
import sitemap from "./app/sitemap";

describe("task-first LifePot documentation", () => {
  it("publishes quick start, practical guides, reference and internals with substantial content", () => {
    for (const slug of ["quick-start", "setup-and-review", "observe-and-inspect", "experiments", "replay", "contracts", "engine-internals", "architecture", "simulation-contract", "deployment"]) {
      expect(guides.some(guide => guide.slug === slug), slug).toBe(true);
      const markdown = guideMarkdown(slug);
      expect(markdown, slug).toMatch(/^# /);
      expect(markdown!.length, slug).toBeGreaterThan(400);
      expect(sitemap().some(entry => entry.url === `https://lifepot.modepot.io/learn/${slug}`), slug).toBe(true);
    }
  });
  it("derives the setup guide from canonical player content without a competing manual", () => {
    const source = readFileSync("docs/learn/player-guide.md", "utf8");
    const selected = source.slice(source.indexOf("## Start from the questions"), source.indexOf("## Observe and inspect"));
    expect(guideMarkdown("setup-and-review")).toContain(selected.trim());
  });
});
