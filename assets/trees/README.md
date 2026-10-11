# Painted life-stage structures

This directory contains the transparent structural artwork used by the Canvas renderer for every playable fruit-tree species.

## File contract

Each species has eight independently loadable PNG assets:

- `seed`
- `rooted-seed`
- `sprout`
- `seedling`
- `sapling`
- `young-tree`
- `mature-tree`
- `ancient`

The current species are Apricot, Cherry, Citrus, Peach, Pear, and Plum, for 48 runtime assets in total. File names follow `<species>-<stage>-v1.png`.

The renderer treats these as the complete seed/root/stem/trunk/branch structure. Species-specific painted foliage, blossoms, and fruit from `assets/botanical/` are layered separately so game state and season can change them without replacing the structural artwork.

## Artwork contract

The source sheets were generated as transparent 2x2 botanical watercolor/gouache sprite sheets, one early-stage and one established-stage sheet per species. Every subject was required to:

- remain a single isolated, fully visible plant with transparent alpha;
- preserve a continuous, naturally tapering transition from root flare through stem or trunk;
- show a distinct age-appropriate silhouette for its life stage;
- match the existing species palette and hand-painted edge treatment;
- omit soil, pots, ground shadows, text, borders, and watermarks;
- avoid polygonal, clip-art, or photorealistic rendering.

The early sheet maps top-left to Seed, top-right to rooted Seed, bottom-left to Sprout, and bottom-right to Seedling. The established sheet maps top-left to Sapling, top-right to Young Tree, bottom-left to Mature Tree, and bottom-right to Ancient.

Runtime assets are extracted from those cells, low-alpha generation wash is removed, the remaining subject is alpha-trimmed with a transparent margin, and the source pixels are otherwise preserved.
