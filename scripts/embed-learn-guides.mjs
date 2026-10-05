import { readFile, writeFile } from "node:fs/promises";

const guides = [
  { slug: "player-guide", title: "Player guide", description: "Shape a world, inspect the ecosystem, and understand outcomes and replays." },
  { slug: "developer-reference", title: "Developer reference", description: "Schemas, deterministic mechanics, decisions, replay, and operations." },
];

const entries = await Promise.all(guides.map(async (guide) => {
  const markdown = await readFile(new URL(`../docs/learn/${guide.slug}.md`, import.meta.url), "utf8");
  return `  ${JSON.stringify(guide.slug)}: ${JSON.stringify(markdown)},`;
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
