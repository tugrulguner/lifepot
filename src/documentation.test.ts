import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { guideMarkdown, guides, renderMarkdown } from "./app/learn/content";
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
