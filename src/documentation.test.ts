import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { guideMarkdown, guides, renderMarkdown } from "./app/learn/content";
import { renderInline } from "./app/learn/inline";
import { Fragment, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultRuleGraph, validateRuleGraph } from "./game/rules";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

function localTargets(markdown: string): string[] {
  const markdownLinks = [...markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1]);
  const htmlSources = [...markdown.matchAll(/<(?:img|a)\b[^>]*(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  return [...markdownLinks, ...htmlSources]
    .map((target) => target.split("#", 1)[0])
    .filter((target) => target && !/^(?:https?:|mailto:)/.test(target));
}

function pngDimensions(path: string): [number, number] {
  const bytes = readFileSync(resolve(root, path));
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

describe("project presentation", () => {
  it("publishes README and an optional roadmap from the repository sources with provenance", async () => {
    const { publicDocuments } = await import("./app/project-docs/content");
    const readme = publicDocuments.find((document) => document.slug === "readme");
    const roadmap = publicDocuments.find((document) => document.slug === "roadmap");
    expect(readme?.sourcePath).toBe("README.md");
    expect(readme?.markdown).toBe(read("README.md"));
    expect(readme?.sourceUrl).toContain("/blob/");
    expect(roadmap?.sourcePath).toBe("ROADMAP.md");
    expect(roadmap?.markdown).toBe(read("ROADMAP.md"));
  });

  it("omits the roadmap public page when no roadmap source is present", async () => {
    const { documentsFromSources } = await import("./app/project-docs/content");
    expect(documentsFromSources({ "README.md": "# source" }).map((doc) => doc.slug)).toEqual(["readme"]);
  });
  it("renders relative source links and images against the pinned repository revision without HTML injection", () => {
    const htmlMarkup = renderToStaticMarkup(createElement(Fragment, null, ...renderInline('<p><img src="lifepot.png" alt="Hero" width="600"></p>', "https://github.com/tugrulguner/lifepot/blob/abc123/README.md")));
    expect(htmlMarkup).toContain('src="https://raw.githubusercontent.com/tugrulguner/lifepot/abc123/lifepot.png"');
    const html = renderToStaticMarkup(createElement(Fragment, null, ...renderInline("[Guide](docs/guide.md) ![Hero](lifepot.png) [bad](javascript:alert(1))", "https://github.com/tugrulguner/lifepot/blob/abc123/README.md")));
    expect(html).toContain("https://github.com/tugrulguner/lifepot/blob/abc123/docs/guide.md");
    expect(html).toContain("https://raw.githubusercontent.com/tugrulguner/lifepot/abc123/lifepot.png");
    expect(html).not.toContain('href="javascript:');
  });

  it("renders and downloads both guides from the same canonical Markdown sources", async () => {
    expect(guides.map((guide) => guide.slug)).toEqual(["player-guide", "developer-reference"]);
    for (const guide of guides) {
      const source = readFileSync(resolve(root, "docs/learn", `${guide.slug}.md`), "utf8");
      expect(await guideMarkdown(guide.slug)).toBe(source);
      const blocks = renderMarkdown(source);
      expect(blocks[0]).toMatchObject({ kind: "h1" });
      expect(blocks.some((block) => block.kind === "code")).toBe(true);
      expect(source.endsWith("\n")).toBe(true);
    }
    expect(await guideMarkdown("missing")).toBeNull();
  });

  it("redeploys the public documentation when source files or its generator change", () => {
    const workflow = read(".github/workflows/deploy-website.yml");
    for (const path of ['"README.md"', '"ROADMAP.md"', '"scripts/embed-learn-guides.mjs"']) expect(workflow).toContain(path);
  });

  it("adds only available source documents to sitemap", async () => {
    const sitemap = (await import("./app/sitemap")).default;
    const entries = sitemap().map((entry) => entry.url);
    expect(entries).toContain("https://lifepot.modepot.io/project-docs/readme");
    expect(entries).toContain("https://lifepot.modepot.io/project-docs/roadmap");
  });

  it("keeps deep guides linked, anchored, and truthful to executable rule validation", () => {
    const player = read("docs/learn/player-guide.md");
    const developer = read("docs/learn/developer-reference.md");
    const llms = read("public/llms.txt");
    expect(player).toContain("[Developer reference and engine internals](/learn/developer-reference)");
    expect(developer).toContain("ENGINE_VERSION");
    expect(developer).toContain("JUDGE_RATE_LIMIT");
    expect(llms).toContain("https://lifepot.modepot.io/learn/player-guide");
    expect(llms).toContain("https://lifepot.modepot.io/learn/developer-reference/markdown");
    expect(validateRuleGraph(defaultRuleGraph()).species).toHaveLength(2);
    expect(() => validateRuleGraph({ ...defaultRuleGraph(), surprise: true })).toThrow("Invalid ecosystem rule graph");
  });

  it("keeps the family documentation set", () => {
    for (const path of [
      "README.md",
      "CONTRIBUTING.md",
      "ROADMAP.md",
      "CHANGELOG.md",
      "docs/README.md",
      "docs/architecture.md",
      "docs/simulation-contract.md",
      "docs/deployment.md",
      "docs/reviewing.md",
    ]) {
      expect(existsSync(resolve(root, path)), path).toBe(true);
    }
  });

  it("keeps README links and images resolvable", () => {
    for (const target of localTargets(read("README.md"))) {
      expect(existsSync(resolve(root, target)), target).toBe(true);
    }
  });

  it("keeps editable sources beside correctly sized rendered assets", () => {
    expect(existsSync(resolve(root, "assets/lifepot.svg"))).toBe(true);
    expect(existsSync(resolve(root, "docs/assets/lifepot-architecture.svg"))).toBe(true);
    expect(pngDimensions("lifepot.png")).toEqual([1200, 900]);
    expect(pngDimensions("docs/assets/lifepot-architecture.png")).toEqual([1600, 900]);
  });

  it("states the model and biological boundaries", () => {
    const readme = read("README.md");
    expect(readme).toContain("model decisions become validated ecosystem rules—not executable code");
    expect(readme).toContain("artificial-life toy, not a biological forecast");
    expect(readme).toContain("Extinction is a valid result");
  });
});
