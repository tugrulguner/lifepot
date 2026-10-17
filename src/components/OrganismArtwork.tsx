import { useId } from "react";
import { ORGANISM_STYLE, organismAccentPath, organismHighlightPath, organismPath } from "@/game/organism-glyphs";

export interface OrganismArtworkProps {
  role?: string;
  color: string;
  cx?: number;
  cy?: number;
  radius?: number;
}

export default function OrganismArtwork({ role, color, cx = 50, cy = 50, radius = 36 }: OrganismArtworkProps) {
  const clipId = `organism-clip-${useId().replace(/:/g, "")}`, gradientId = `${clipId}-shade`;
  const body = organismPath(role, cx, cy, radius), pitch = radius / ORGANISM_STYLE.radius;
  return <g aria-hidden="true">
    <defs>
      <clipPath id={clipId}><path d={body} /></clipPath>
      <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={cx - radius} y1={cy - radius} x2={cx + radius} y2={cy + radius}>
        <stop stopColor={ORGANISM_STYLE.surfaceStart} />
        <stop offset="1" stopColor={ORGANISM_STYLE.surfaceEnd} />
      </linearGradient>
    </defs>
    <path d={body} fill={color} />
    <g clipPath={`url(#${clipId})`}>
      <path d={body} fill={`url(#${gradientId})`} />
      <path data-organism-accent="true" d={organismAccentPath(role, cx, cy, radius)} fill={ORGANISM_STYLE.accent} stroke={ORGANISM_STYLE.accent} strokeWidth={Math.max(.35, radius * ORGANISM_STYLE.accentWidth)} strokeLinecap="round" strokeLinejoin="round" />
      <path d={organismHighlightPath(role, cx, cy, radius)} fill={ORGANISM_STYLE.highlight} />
    </g>
    <path d={body} fill="none" stroke={ORGANISM_STYLE.outline} strokeWidth={pitch * ORGANISM_STYLE.outerWidth} strokeLinejoin="round" />
    <path d={body} fill="none" stroke={ORGANISM_STYLE.membrane} strokeWidth={pitch * ORGANISM_STYLE.membraneWidth} strokeLinejoin="round" />
  </g>;
}
