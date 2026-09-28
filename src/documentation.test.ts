import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
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
