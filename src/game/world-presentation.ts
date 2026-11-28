import { speciesColor } from "./species-colors";

const roleAccents: Record<string, string[]> = {
  hunter: ["#af3044", "#be342b", "#a73656", "#b64426"],
  omnivore: ["#e87643", "#be6547", "#db8a37", "#a84c38"],
  producer: ["#347b55", "#56823d", "#277b68", "#7a7b35"],
  grazer: ["#153f67", "#234f71", "#244675", "#245566"],
  scavenger: ["#538b9b", "#687aa5", "#4e806f", "#80779b"],
};
export function roleColor(role: string | undefined, speciesId: string): string {
  const accents = role ? roleAccents[role] : undefined;
  if (!accents) return speciesColor(speciesId);
  const index = Math.max(0, ["A", "B", "C", "D"].indexOf(speciesId));
  return accents[index % accents.length] ?? speciesColor(speciesId);
}
