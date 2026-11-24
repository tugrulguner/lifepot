# Nutrient grain material

`src/game/nutrient-grain.json` is a 32 × 32 scalar material mask in row-major order. It is artwork, not measured sediment or a map of the habitat. Only the simulation decides where resources and hazards exist; generation is offline, not a per-world service.

Source: GPT Image 2 (medium model), request `1de228c5-71d4-43cc-a192-8ec57b8ff5fd`. Source PNG SHA-256: `eedb10159aa1c1bd843d230c5a03d92e23db52a0dc45571651f3355deaa8ba49`.

Art direction: a flat, evenly lit transmitted-light sample of fine, irregular mineral grains in small aggregates on a pale substrate. No cells, organisms, labels, vignette, or depicted event.

Derivation: center-crop the 1536 × 1024 PNG to a square, convert to grayscale, downsample to 32 × 32 using Lanczos, invert, and apply 1% autocontrast. Higher mask values denote stronger grain. The shipped mask requires neither an image download nor image inference during play.
