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
export function organismContours(role: string | undefined): readonly (readonly GlyphPoint[])[] {
  return contours[role as OrganismRole] ?? contours.grazer;
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
