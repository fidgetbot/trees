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

The renderer treats these as the stage's base seed/root/stem/trunk/branch structure, not the complete result of every growth action. Species-specific painted foliage, blossoms, and fruit from `assets/botanical/` are layered separately so game state and season can change them without replacing the structural artwork.

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

The early sheets are not perfectly aligned to equal cells: some Seed and rooted-Seed files retain a fragment of the next row. `getTreeStructureSourceRect` in `ui/canvas.js` defines the reviewed source rectangle for each of those twelve sprites, retaining the complete seed/radicle and transparent margin while excluding the next plant. Canvas rendering and growth-chapter portraits use the same bounds. The original PNGs remain unchanged, and destination aspect ratios follow the isolated source bounds rather than stretching the contaminated cell.

## Action-driven growth

### Juvenile specimens

`juvenile/` adds eighteen independently generated transparent PNGs: `first-leaves`, `unfurling`, and `juvenile` for each of the six species. These replace the old woody Sprout and Seedling composites during early play. Runtime copies are 512×768, resized without repainting from the full-size masters. `juvenile/manifest.json` records source and runtime SHA-256 hashes; `juvenile/prompts.json` preserves the generation specifications. The normal built-in image generator was used, following Nicolas's explicit permission to allow its previews for this task. Full-size originals remain in `~/.openclaw/playground/trees-juvenile-assets/masters/`.

`ui/juvenile-growth.js` defines reviewed collar anchors and increasing above-ground heights, derives seasonal leaf/stem layers without changing the masters, and supplies a juvenile leaf for additional actions. The first three pictured leaf investments are subtracted from additional modules. Existing root IDs remain intact, new roots attach to the actual radicle, and full leaf loss preserves the green shoot rather than reverting to seed framing. All early specimens preload while the seed is displayed. The later mature module system below continues from Sapling onward.

`ui/painted-growth.js` adds persistent player root, taproot, branch, and leaf modules around these bases. Attachments are located on opaque pixels of the actual source image; roots and branches carry a straightened strip of that same painted wood along a tapered curve. No original PNG is modified and no new generated artwork is required. Leaves use the existing species-specific botanical PNGs, with a connecting petiole ending inside the painted cluster.

The visual ledger keeps each existing leaf on its original host when later branches are added; new branch foliage attaches to its new branch. Module IDs follow structural counts across stage changes, and roots/leaves no longer silently stop responding at the former coarse foliage cap. New parts reveal over 650 ms unless reduced motion is requested. Gameplay costs, resource accounting, progression, and event rules are unchanged.
