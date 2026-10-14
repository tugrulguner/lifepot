import { GRID_SIZE, type SimulationState } from "./world";
export type FollowTarget = { kind: "organism" | "family"; id: number };
// x/y are offsets as fractions of the unzoomed drawable habitat.
export type Camera = { zoom: number; x: number; y: number };
export function boundCamera(camera: Camera): Camera {
  const zoom = clampZoom(camera.zoom), limit = (zoom - 1) / 2;
  return { zoom, x: Math.max(-limit, Math.min(limit, camera.x)) || 0, y: Math.max(-limit, Math.min(limit, camera.y)) || 0 };
}
export function followCamera(camera: Camera, state: SimulationState, target: FollowTarget): Camera | null {
  // Follow the oldest living member of a pinned family, not a misleading mean
  // across the toroidal seam. Switch only when that member disappears.
  let index = -1;
  for (let i = 0; i < state.guild.length; i++) {
    if (!state.guild[i]) continue;
    if (target.kind === "organism" ? state.organismId[i] === target.id : state.lineage[i] === target.id) {
      if (index < 0 || state.organismId[i] < state.organismId[index]) index = i;
    }
  }
  if (index < 0) return null;
  return boundCamera({ zoom: camera.zoom, x: (.5 - (index % GRID_SIZE + .5) / GRID_SIZE) * camera.zoom, y: (.5 - (Math.floor(index / GRID_SIZE) + .5) / GRID_SIZE) * camera.zoom });
}
export type Size = { width: number; height: number };
export type Point = { x: number; y: number };
export const NEUTRAL_CAMERA: Camera = { zoom: 1, x: 0, y: 0 };
export function clampZoom(zoom: number) { return Math.max(1, Math.min(3, zoom)); }
export function worldToScreen(point: Point, camera: Camera, size: Size): Point {
  return { x: size.width / 2 + camera.x + (point.x - size.width / 2) * camera.zoom, y: size.height / 2 + camera.y + (point.y - size.height / 2) * camera.zoom };
}
export function screenToWorld(point: Point, camera: Camera, size: Size): Point {
  return { x: size.width / 2 + (point.x - size.width / 2 - camera.x) / camera.zoom, y: size.height / 2 + (point.y - size.height / 2 - camera.y) / camera.zoom };
}
