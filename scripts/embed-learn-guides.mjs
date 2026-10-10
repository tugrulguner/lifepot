import { readFile, writeFile } from "node:fs/promises";

// Embed canonical sources once; task-focused pages select sections at render time.
const sources = {
  "quick-start": "docs/learn/quick-start.md",
  "player-guide": "docs/learn/player-guide.md",
  "developer-reference": "docs/learn/developer-reference.md",
  architecture: "docs/architecture.md",
  "simulation-contract": "docs/simulation-contract.md",
  deployment: "docs/deployment.md",
};
const entries = await Promise.all(Object.entries(sources).map(async ([slug, path]) => {
  const markdown = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
  return `  ${JSON.stringify(slug)}: ${JSON.stringify(markdown)},`;
}));

const projectSources = ["README.md", "ROADMAP.md"];
const projectEntries = await Promise.all(projectSources.map(async (path) => {
  try {
    const markdown = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    return [path, markdown];
  } catch (error) {
    if (error?.code === "ENOENT" && path === "ROADMAP.md") return null;
    throw error;
  }
}));
const revision = process.env.GITHUB_SHA || (await import("node:child_process")).execFileSync("git", ["rev-parse", "HEAD"], { cwd: new URL("..", import.meta.url), encoding: "utf8" }).trim();
const projectOutput = `// Generated from README.md and optional ROADMAP.md by scripts/embed-learn-guides.mjs. Do not edit.\nexport const projectSourceRevision = ${JSON.stringify(revision)};\nexport const projectSourceFiles = ${JSON.stringify(Object.fromEntries(projectEntries.filter(Boolean)))} as const;\n`;
await writeFile(new URL("../src/app/project-docs/generated-content.ts", import.meta.url), projectOutput);

const output = `// Generated from docs/learn/*.md by scripts/embed-learn-guides.mjs. Do not edit.\nexport const embeddedGuides = {\n${entries.join("\n")}\n} as const;\n`;
await writeFile(new URL("../src/app/learn/generated-content.ts", import.meta.url), output);
