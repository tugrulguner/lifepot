import { speciesColor } from "./species-colors";

const roleAccents: Record<string, string[]> = {
  hunter: ["#c94038", "#e87643", "#a73656", "#d35c26"],
  omnivore: ["#e87643", "#be6547", "#db8a37", "#a84c38"],
  producer: ["#347b55", "#56823d", "#277b68", "#7a7b35"],
  grazer: ["#1b8b78", "#438c62", "#287da0", "#6b8050"],
  scavenger: ["#538b9b", "#687aa5", "#4e806f", "#80779b"],
};
export function roleColor(role: string | undefined, speciesId: string): string {
  const accents = role ? roleAccents[role] : undefined;
  if (!accents) return speciesColor(speciesId);
  const index = Math.max(0, ["A", "B", "C", "D"].indexOf(speciesId));
  return accents[index % accents.length] ?? speciesColor(speciesId);
}
