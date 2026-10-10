import { embeddedGuides } from "./generated-content";

type Guide = { slug: string; title: string; description: string; group: string; source: keyof typeof embeddedGuides; sections?: string[] };
export const guides: Guide[] = [
  { slug: "quick-start", title: "Quick start", description: "Play a first world, inspect it, and choose your next experiment.", group: "Start", source: "quick-start" },
  { slug: "setup-and-review", title: "Setup and review", description: "Answer the questions, inspect the proposed ecology, and review before seeding.", group: "Practical guides", source: "player-guide", sections: ["Start from the questions", "Try the recorded preset", "Review before starting"] },
  { slug: "observe-and-inspect", title: "Observe and inspect", description: "Read the board, organism inspector, outcomes and troubleshooting evidence.", group: "Practical guides", source: "player-guide", sections: ["Observe and inspect", "Read outcomes without overclaiming", "If something looks wrong"] },
  { slug: "experiments", title: "Experiments and comparisons", description: "Review Jev proposals and distinguish controlled follow-ups from exploration.", group: "Practical guides", source: "player-guide", sections: ["Jev review and next experiments"] },
  { slug: "replay", title: "Replay and compatibility", description: "Recorded choices, integrity checks and the limits of reproducibility.", group: "Practical guides", source: "developer-reference", sections: ["Replay and tamper/version compatibility"] },
  { slug: "contracts", title: "Setup and rule contracts", description: "Schema fields, normalization, fidelity review, rule graphs and validation examples.", group: "Reference", source: "developer-reference", sections: ["Setup schemas and normalization", "Rule graph reference"] },
  { slug: "simulation-contract", title: "Simulation contract", description: "Canonical execution, decision and replay invariants.", group: "Reference", source: "simulation-contract" },
  { slug: "deployment", title: "Deployment and protection", description: "Local and Cloudflare builds, server-only inference and rate limiting.", group: "Reference", source: "deployment" },
  { slug: "engine-internals", title: "Deterministic engine internals", description: "Tick ownership, resources, energy, bounded decisions and the ledger.", group: "Internals", source: "developer-reference", sections: ["Engine ownership and deterministic loop", "Bounded decisions, frozen observations, and ledger"] },
  { slug: "architecture", title: "Architecture", description: "Application modules and the boundary between model proposals and simulation.", group: "Internals", source: "architecture" },
  { slug: "player-guide", title: "Player guide", description: "The complete canonical player manual, including outcomes and replays.", group: "Complete manuals", source: "player-guide" },
  { slug: "developer-reference", title: "Developer reference", description: "The complete canonical developer manual and source map.", group: "Complete manuals", source: "developer-reference" },
];

export const guideGroups = [...new Set(guides.map(guide => guide.group))];

export function guideMarkdown(slug: string) {
  const guide = guides.find(item => item.slug === slug);
  if (!guide) return null;
  const source = embeddedGuides[guide.source];
  if (!guide.sections) return source;
  const chunks = source.split(/(?=^## )/m);
  const selected = guide.sections.map(title => {
    const chunk = chunks.find(part => part.startsWith(`## ${title}\n`));
    if (!chunk) throw new Error(`Missing canonical section: ${guide.source}: ${title}`);
    return chunk.trim();
  });
  return `# ${guide.title}\n\nThis page is derived from the [canonical ${guide.source}](/learn/${guide.source}); its content has one source of truth.\n\n${selected.join("\n\n")}\n`;
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
