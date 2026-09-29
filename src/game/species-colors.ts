// Rule-species identity, shared by the board and the observatory.
// Guild is encoded by shape (circle / triangle), not by overwriting species color.
const COLORS: Record<string, string> = {
  A: "#79ebc3",
  B: "#ff8d80",
  C: "#8dcaff",
  D: "#d9a3ff",
};

export function speciesColor(id: string): string {
  return COLORS[id] ?? "#b8ed86";
}
