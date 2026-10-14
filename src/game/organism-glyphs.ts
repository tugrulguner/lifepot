// Illustrative feeding-role silhouettes, not measured biological anatomy.
// Normalized contours are shared by the live canvas, inspector and legend.
export type GlyphPoint = readonly [number, number];
export type OrganismRole = "producer" | "grazer" | "scavenger" | "hunter" | "omnivore";
function ellipse(cx: number, cy: number, rx: number, ry: number): GlyphPoint[] {
  return Array.from({ length: 48 }, (_, i) => {
    const angle = i * Math.PI * 2 / 48;
    return [cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry] as const;
  });
}
function lobes(count: number, core: number): GlyphPoint[] {
  return Array.from({ length: 96 }, (_, i) => {
    const angle = i * Math.PI * 2 / 96 - Math.PI / 2;
    const radius = core + (1 - core) * (1 + Math.cos(count * (angle + Math.PI / 2))) / 2;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius] as const;
  });
}
function hunter(): GlyphPoint[] {
  const points: GlyphPoint[] = [];
  const segments = [
    [[1, 0], [.08, -.64], [-1, -.42]],
    [[-1, -.42], [-.7, 0], [-1, .42]],
    [[-1, .42], [.08, .64], [1, 0]],
  ];
  for (const [start, control, end] of segments) for (let i = 0; i < 16; i++) {
    const t = i / 16, u = 1 - t;
    points.push([u * u * start[0] + 2 * u * t * control[0] + t * t * end[0], u * u * start[1] + 2 * u * t * control[1] + t * t * end[1]]);
  }
  return points;
}
const contours: Record<OrganismRole, GlyphPoint[][]> = {
  producer: [lobes(6, .43)],
  grazer: [ellipse(0, 0, .88, .68)],
  scavenger: [-.48, 0, .48].map(x => ellipse(x, 0, .22, .48)),
  hunter: [hunter()],
  omnivore: [lobes(3, .57)],
};
const PATH_CACHE_LIMIT = 64;
const pathCache = new Map<string, Path2D>();
const SPRITE_CACHE_LIMIT = 64;
const spriteCache = new Map<string, HTMLCanvasElement>();
export function organismContours(role: string | undefined): readonly (readonly GlyphPoint[])[] {
  return contours[role as OrganismRole] ?? contours.grazer;
}
export function organismPath2D(role: string | undefined, radius: number): Path2D | null {
  if (typeof Path2D === "undefined") return null;
  const key = `${role ?? "grazer"}:${radius}`;
  const cached = pathCache.get(key);
  if (cached) return cached;
  const path = new Path2D();
  for (const points of organismContours(role)) {
    points.forEach(([x, y], i) => { if (i) path.lineTo(x * radius, y * radius); else path.moveTo(x * radius, y * radius); });
    path.closePath();
  }
  if (pathCache.size >= PATH_CACHE_LIMIT) pathCache.delete(pathCache.keys().next().value!);
  pathCache.set(key, path);
  return path;
}
export function organismSprite(role: string | undefined, color: string, pitch: number, dpr: number): HTMLCanvasElement | null {
  if (typeof Path2D === "undefined" || typeof document === "undefined") return null;
  const key = `${role ?? "grazer"}:${color}:${pitch}:${dpr}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(pitch * dpr));
  canvas.height = Math.max(1, Math.round(pitch * dpr));
  const context = canvas.getContext("2d");
  const path = organismPath2D(role, pitch * .44);
  if (!context || !path) return null;
  // Fit logical cell coordinates to the actual rounded bitmap, so fractional
  // pitches stay centered and neither edge is clipped before drawImage scales it.
  context.setTransform(canvas.width / pitch, 0, 0, canvas.height / pitch, 0, 0);
  context.translate(pitch / 2, pitch / 2);
  context.fillStyle = color; context.fill(path);
  context.lineJoin = "round"; context.strokeStyle = "#07100f"; context.lineWidth = pitch * .07; context.stroke(path);
  context.strokeStyle = "rgba(241,248,237,.94)"; context.lineWidth = pitch * .035; context.stroke(path);
  if (spriteCache.size >= SPRITE_CACHE_LIMIT) spriteCache.delete(spriteCache.keys().next().value!);
  spriteCache.set(key, canvas);
  return canvas;
}
export function organismPath(role: string | undefined, cx = 50, cy = 50, radius = 36): string {
  return organismContours(role).map(points => points.map(([x, y], i) => `${i ? "L" : "M"}${cx + x * radius} ${cy + y * radius}`).join(" ") + "Z").join(" ");
}
export function traceOrganism(context: CanvasRenderingContext2D, role: string | undefined, cx: number, cy: number, radius: number): void {
  context.beginPath();
  for (const points of organismContours(role)) {
    points.forEach(([x, y], i) => { if (i) context.lineTo(cx + x * radius, cy + y * radius); else context.moveTo(cx + x * radius, cy + y * radius); });
    context.closePath();
  }
}
