// Presentation vocabulary only; paths remain unchanged in validated contracts.
export function conditionLabel(path: string): string {
 const labels: Record<string, string> = {
  "rules.environment.pressure": "Rule pressure", "rules.environment.intensity": "Pressure intensity",
  "rules.environment.duration": "Pressure duration", "rules.environment.volatility": "Pressure variability",
  "rules.environment.regeneration": "Resource regeneration", "environment.hazard": "Environmental hazard",
  "environment.abundance": "Resource abundance", "environment.volatility": "Environmental variability",
 };
 return labels[path] ?? path.split(".").at(-1)?.replaceAll("_", " ") ?? path;
}
export function conditionValue(path: string, value: unknown): string {
 const labels: Record<string, Record<string, string>> = { "rules.environment.intensity": { low: "Low", medium: "Medium", high: "High" } };
 return labels[path]?.[String(value)] ?? String(value).replaceAll("_", " ");
}
