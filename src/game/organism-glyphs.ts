// Illustrative feeding-role artwork, not measured biological anatomy.
// Body contours, internal accents and paint styles are shared by all consumers.
export type GlyphPoint = readonly [number, number];
export type OrganismRole = "producer" | "grazer" | "scavenger" | "hunter" | "omnivore";
type AccentCommand = readonly ["M", number, number] | readonly ["L", number, number] | readonly ["Q", number, number, number, number] | readonly ["Z"];

export const ORGANISM_STYLE = {
  radius: .44,
  outerWidth: .07,
  membraneWidth: .035,
  accentWidth: .09,
  outline: "#07100f",
  membrane: "rgba(241,248,237,.94)",
  accent: "rgba(7,16,15,.62)",
  surfaceStart: "rgba(255,255,255,.22)",
  surfaceEnd: "rgba(7,16,15,.2)",
  highlight: "rgba(241,248,237,.5)",
} as const;

function sample(count: number, radiusAt: (angle: number) => number): GlyphPoint[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = i * Math.PI * 2 / count, radius = radiusAt(angle);
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });
}

function flower(lobes: number, core: number, skew = 0): GlyphPoint[] {
  return sample(120, angle => core + (1 - core) * Math.pow((1 + Math.cos(lobes * (angle + Math.PI / 2) + skew)) / 2, 1.15));
}

function oval(cx: number, cy: number, rx: number, ry: number): GlyphPoint[] {
  return sample(32, () => 1).map(([x, y]) => [cx + x * rx, cy + y * ry]);
}

function roundedHull(vertices: readonly GlyphPoint[]): GlyphPoint[] {
  const result: GlyphPoint[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const previous = vertices[(i + vertices.length - 1) % vertices.length], vertex = vertices[i], next = vertices[(i + 1) % vertices.length];
    const start = [(previous[0] + vertex[0]) / 2, (previous[1] + vertex[1]) / 2];
    const end = [(vertex[0] + next[0]) / 2, (vertex[1] + next[1]) / 2];
    for (let n = 0; n < 8; n++) {
      const t = n / 8, u = 1 - t;
      result.push([u * u * start[0] + 2 * u * t * vertex[0] + t * t * end[0], u * u * start[1] + 2 * u * t * vertex[1] + t * t * end[1]]);
    }
  }
  return result;
}

const contours: Record<OrganismRole, GlyphPoint[][]> = {
  producer: [flower(6, .48, .16)],
  // A broad cytoplasm with a deep inward bite on its right flank creates a
  // kidney profile rather than a rotated near-circular oval.
  grazer: [sample(96, angle => .87 + .035 * Math.cos(angle + .55) - .38 * Math.exp(-Math.pow(Math.atan2(Math.sin(angle - .62), Math.cos(angle - .62)), 2) / .24)).map(([x, y]) => [x + .12, y])],
  scavenger: [oval(-.51, -.13, .35, .43), oval(0, .01, .37, .64), oval(.51, .15, .31, .46)],
  hunter: [roundedHull([[.99, 0], [.68, -.53], [.08, -.66], [-.43, -.25], [-.99, -.62], [-.72, 0], [-.99, .62], [-.43, .25], [.08, .66], [.68, .53]])],
  omnivore: [sample(120, angle => .55 + .31 * Math.pow((1 + Math.cos(4 * (angle + Math.PI / 2) + .30)) / 2, 1.1) + .055 * Math.sin(angle - .4))],
};

// Decorative cores and surface glints give the enlarged role portraits a
// coherent micro-organism style. They do not encode additional measured traits.
const coreShapes: Record<OrganismRole, GlyphPoint[][]> = {
  producer: [oval(0, 0, .24, .24), ...Array.from({ length: 5 }, (_, i) => {
    const angle = i * Math.PI * 2 / 5 - Math.PI / 2;
    return oval(Math.cos(angle) * .58, Math.sin(angle) * .58, .075, .075);
  })],
  grazer: [oval(.20, -.02, .22, .30), oval(-.35, .20, .10, .11)],
  scavenger: [-.52, 0, .52].map(x => oval(x, 0, .12, .20)),
  hunter: [oval(.38, -.02, .18, .23), oval(-.14, 0, .09, .12)],
  omnivore: [oval(0, -.28, .13, .16), oval(-.23, .14, .13, .16), oval(.23, .14, .13, .16)],
};
const glints: Record<OrganismRole, GlyphPoint[][]> = {
  producer: [oval(-.12, -.10, .07, .05), oval(0, -.62, .05, .10)],
  grazer: [oval(-.22, -.34, .19, .055)],
  scavenger: [oval(-.06, -.34, .055, .15)],
  hunter: [oval(.10, -.30, .16, .045)],
  omnivore: [oval(-.08, -.60, .07, .12)],
};
function commandsFor(shapes: readonly (readonly GlyphPoint[])[]): AccentCommand[] {
  return shapes.flatMap<AccentCommand>(points => [...points.map<AccentCommand>(([x, y], i) => [i ? "L" : "M", x, y]), ["Z"]]);
}
function commandsByRole(shapes: Record<OrganismRole, GlyphPoint[][]>): Record<OrganismRole, readonly AccentCommand[]> {
  return {
    producer: commandsFor(shapes.producer), grazer: commandsFor(shapes.grazer),
    scavenger: commandsFor(shapes.scavenger), hunter: commandsFor(shapes.hunter), omnivore: commandsFor(shapes.omnivore),
  };
}
const accents = commandsByRole(coreShapes);
const highlights = commandsByRole(glints);

const PATH_CACHE_LIMIT = 64;
const pathCache = new Map<string, Path2D>();
const SPRITE_CACHE_LIMIT = 64;
const spriteCache = new Map<string, HTMLCanvasElement>();

export function organismContours(role: string | undefined): readonly (readonly GlyphPoint[])[] {
  return contours[role as OrganismRole] ?? contours.grazer;
}

export function organismPath(role: string | undefined, cx = 50, cy = 50, radius = 36): string {
  return organismContours(role).map(points => points.map(([x, y], i) => `${i ? "L" : "M"}${cx + x * radius} ${cy + y * radius}`).join(" ") + "Z").join(" ");
}

export function traceOrganism(context: CanvasRenderingContext2D, role: string | undefined, cx: number, cy: number, radius: number): void {
  context.beginPath();
  for (const points of organismContours(role)) {
    points.forEach(([x, y], i) => {
      if (i) context.lineTo(cx + x * radius, cy + y * radius);
      else context.moveTo(cx + x * radius, cy + y * radius);
    });
    context.closePath();
  }
}

function detailPath(commands: readonly AccentCommand[], cx: number, cy: number, radius: number): string {
  return commands.map(command => {
    const [kind, ...coordinates] = command;
    return kind + coordinates.map((coordinate, i) => (i % 2 ? cy : cx) + coordinate * radius).join(" ");
  }).join(" ");
}

export function organismAccentPath(role: string | undefined, cx = 50, cy = 50, radius = 36): string {
  return detailPath(accents[role as OrganismRole] ?? accents.grazer, cx, cy, radius);
}
export function organismHighlightPath(role: string | undefined, cx = 50, cy = 50, radius = 36): string {
  return detailPath(highlights[role as OrganismRole] ?? highlights.grazer, cx, cy, radius);
}
function traceDetail(context: CanvasRenderingContext2D, commands: readonly AccentCommand[], cx: number, cy: number, radius: number): void {
  context.beginPath();
  for (const command of commands) {
    if (command[0] === "M") context.moveTo(cx + command[1] * radius, cy + command[2] * radius);
    else if (command[0] === "L") context.lineTo(cx + command[1] * radius, cy + command[2] * radius);
    else if (command[0] === "Q") context.quadraticCurveTo(cx + command[1] * radius, cy + command[2] * radius, cx + command[3] * radius, cy + command[4] * radius);
    else context.closePath();
  }
}

export function traceOrganismAccents(context: CanvasRenderingContext2D, role: string | undefined, cx: number, cy: number, radius: number): void {
  traceDetail(context, accents[role as OrganismRole] ?? accents.grazer, cx, cy, radius);
}

export function organismPath2D(role: string | undefined, radius: number): Path2D | null {
  if (typeof Path2D === "undefined") return null;
  const key = `${role ?? "grazer"}:${radius}`, cached = pathCache.get(key);
  if (cached) return cached;
  const path = new Path2D();
  for (const points of organismContours(role)) {
    points.forEach(([x, y], i) => {
      if (i) path.lineTo(x * radius, y * radius);
      else path.moveTo(x * radius, y * radius);
    });
    path.closePath();
  }
  if (pathCache.size >= PATH_CACHE_LIMIT) pathCache.delete(pathCache.keys().next().value!);
  pathCache.set(key, path);
  return path;
}

export function paintOrganism(context: CanvasRenderingContext2D, role: string | undefined, color: string, cx: number, cy: number, pitch: number, magnification = 1): void {
  const radius = pitch * ORGANISM_STYLE.radius, path = organismPath2D(role, radius);
  context.save();
  context.translate(cx, cy);
  context.fillStyle = color;
  if (path) context.fill(path);
  else { traceOrganism(context, role, 0, 0, radius); context.fill(); }

  if (pitch * magnification >= 8) {
    context.save();
    if (path) context.clip(path);
    else { traceOrganism(context, role, 0, 0, radius); context.clip(); }
    const shade = context.createLinearGradient(-radius, -radius, radius, radius);
    shade.addColorStop(0, ORGANISM_STYLE.surfaceStart);
    shade.addColorStop(1, ORGANISM_STYLE.surfaceEnd);
    context.fillStyle = shade;
    context.fillRect(-radius, -radius, radius * 2, radius * 2);
    traceOrganismAccents(context, role, 0, 0, radius);
    context.fillStyle = ORGANISM_STYLE.accent;
    context.fill();
    context.strokeStyle = ORGANISM_STYLE.accent;
    context.lineWidth = Math.max(.35, radius * ORGANISM_STYLE.accentWidth);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke();
    traceDetail(context, highlights[role as OrganismRole] ?? highlights.grazer, 0, 0, radius);
    context.fillStyle = ORGANISM_STYLE.highlight;
    context.fill();
    context.restore();
  }

  if (!path) traceOrganism(context, role, 0, 0, radius);
  context.lineJoin = "round";
  context.strokeStyle = ORGANISM_STYLE.outline;
  context.lineWidth = pitch * ORGANISM_STYLE.outerWidth;
  if (path) context.stroke(path); else context.stroke();
  context.strokeStyle = ORGANISM_STYLE.membrane;
  context.lineWidth = pitch * ORGANISM_STYLE.membraneWidth;
  if (path) context.stroke(path); else context.stroke();
  context.restore();
}

export function organismSprite(role: string | undefined, color: string, pitch: number, dpr: number, magnification = 1): HTMLCanvasElement | null {
  if (typeof Path2D === "undefined" || typeof document === "undefined") return null;
  const key = `${role ?? "grazer"}:${color}:${pitch}:${dpr}:${pitch * magnification >= 8}`, cached = spriteCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(pitch * dpr));
  canvas.height = Math.max(1, Math.round(pitch * dpr));
  const context = canvas.getContext("2d");
  if (!context) return null;
  // Logical pitch maps to allocated pixels, including fractional pitch and DPR.
  context.setTransform(canvas.width / pitch, 0, 0, canvas.height / pitch, 0, 0);
  paintOrganism(context, role, color, pitch / 2, pitch / 2, pitch, magnification);
  if (spriteCache.size >= SPRITE_CACHE_LIMIT) spriteCache.delete(spriteCache.keys().next().value!);
  spriteCache.set(key, canvas);
  return canvas;
}
