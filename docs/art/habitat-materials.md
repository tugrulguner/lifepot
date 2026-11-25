# Habitat materials

The source is a generated material study, not a micrograph or a map. Clockwise from the upper left it depicts clustered sediment, engraved mineral fibers, laminated wisps and frosted glass. The materials contain no organisms, events, or locations. No image generator runs during play.

GPT Image 2 (medium), request `30439ad8-6e63-48df-8a0c-a764700324b7`; source PNG 1254 × 1254, SHA-256 `25b402cef960703fd94461b66cd8c33aa1c537847900890df6cd0b1555394f9a`. Art direction: four evenly lit, edge-to-edge, grayscale transmitted-light materials; no discrete food pellets, hazard symbols, text or vignette.

The build inputs were made offline. Split the source into four equal quadrants in reading order and crop three pixels from every edge of each quadrant. Convert to luminance. For the scalar masks, downsample each square to 32 × 32 using Lanczos, invert, apply 1% autocontrast, and store row-major bytes. For the presentation atlas, downsample each cropped square to 128 × 128 using Lanczos, assemble in source order, and encode WebP at quality 88. Only the small derived files are intended for the game.


## Periodic seam repair (offline)

The shipped sediment, frost, and etch masks are 32 × 32 row-major grayscale tiles. To remove opposing-edge discontinuities without replacing the source grain, the offline repair pairs mirrored columns, then mirrored rows, blending each edge toward its opposite edge over six pixels with a cosine taper (50% blend at the boundary, zero at the inner edge). Values are rounded to byte precision. The same 32-pixel period and runtime sampler are retained; no runtime generation or image service is used. Pairwise blending preserves the neutral mask mean apart from at most byte-rounding error. The unused `lamina` mask was removed; the nutrient-grain mask and its obsolete standalone art note were removed after the renderer moved to these shared material masks.

Measured against the pre-repair masks: see the tile seam regression in `src/game/microscopic-renderer.test.ts`; it reports boundary/interior adjacent-pixel mean absolute differences and mask means/standard deviations so repeat smoothness and retained grain can be checked numerically.
