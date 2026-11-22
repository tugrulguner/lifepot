// Presentation only: approved HTML uses separate movement and event clocks.
export function visualProgress(elapsed: number) {
  const clamp = (duration: number) => Math.max(0, Math.min(1, elapsed / duration));
  return { movement: clamp(350), event: clamp(450) };
}

// A rotated square's half diagonal, including the largest feeding pulse.
export function spriteCullExtent(size: number, zoom: number) {
  return size * zoom * Math.SQRT1_2 * 1.09;
}

export function crossedWorldEdge(from: readonly [number, number], to: readonly [number, number]) {
  return Math.abs(to[0] - from[0]) > 25 || Math.abs(to[1] - from[1]) > 25;
}
