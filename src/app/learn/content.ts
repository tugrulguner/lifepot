import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const guides = [
  { slug: "player-guide", title: "Player guide", description: "Shape a world, inspect the ecosystem, and understand outcomes and replays." },
  { slug: "developer-reference", title: "Developer reference", description: "Schemas, deterministic mechanics, decisions, replay, and operations." },
] as const;

export async function guideMarkdown(slug: string) {
  if (!guides.some((guide) => guide.slug === slug)) return null;
  return readFile(join(process.cwd(), "docs", "learn", `${slug}.md`), "utf8");
}

export function renderMarkdown(source: string) {
  const lines = source.split("\n");
  const blocks: Array<{ kind: string; text: string; lang?: string }> = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim(); const code: string[] = [];
      while (++i < lines.length && !lines[i].startsWith("```")) code.push(lines[i]);
      blocks.push({ kind: "code", text: code.join("\n"), lang });
    } else if (/^#{1,4} /.test(line)) {
      const depth = line.match(/^#+/)![0].length; const text = line.slice(depth + 1);
      blocks.push({ kind: `h${depth}`, text });
    } else if (/^[-*] /.test(line)) {
      const items = [line.slice(2)];
      while (i + 1 < lines.length && /^[-*] /.test(lines[i + 1])) items.push(lines[++i].slice(2));
      blocks.push({ kind: "ul", text: JSON.stringify(items) });
    } else if (/^\|/.test(line)) {
      const rows = [line];
      while (i + 1 < lines.length && /^\|/.test(lines[i + 1])) rows.push(lines[++i]);
      blocks.push({ kind: "table", text: JSON.stringify(rows) });
    } else if (/^> /.test(line)) blocks.push({ kind: "quote", text: line.slice(2) });
    else blocks.push({ kind: "p", text: line });
  }
  return blocks;
}
