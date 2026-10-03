import { readFile, writeFile } from "node:fs/promises";

const guides = [
  { slug: "player-guide", title: "Player guide", description: "Shape a world, inspect the ecosystem, and understand outcomes and replays." },
  { slug: "developer-reference", title: "Developer reference", description: "Schemas, deterministic mechanics, decisions, replay, and operations." },
];

const entries = await Promise.all(guides.map(async (guide) => {
  const markdown = await readFile(new URL(`../docs/learn/${guide.slug}.md`, import.meta.url), "utf8");
  return `  ${JSON.stringify(guide.slug)}: ${JSON.stringify(markdown)},`;
}));

const output = `// Generated from docs/learn/*.md by scripts/embed-learn-guides.mjs. Do not edit.\nexport const embeddedGuides = {\n${entries.join("\n")}\n} as const;\n`;
await writeFile(new URL("../src/app/learn/generated-content.ts", import.meta.url), output);
