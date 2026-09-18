export const DEATH_FADE_MS = 420;

export type DeathTrace = {
  index: number;
  lineage: number;
  startedAt: number;
};

export function deathProgress(ageMs: number, reducedMotion: boolean): number {
  if (reducedMotion) return 1;
  return Math.max(0, Math.min(1, ageMs / DEATH_FADE_MS));
}

export function retainDeathTraces(
  traces: readonly DeathTrace[],
  now: number,
  reducedMotion: boolean,
): DeathTrace[] {
  if (reducedMotion) return [];
  return traces.filter((trace) => now - trace.startedAt < DEATH_FADE_MS);
}
