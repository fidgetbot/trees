# Seasonal hedge assets

The Canvas uses four transparent 512 × 512 hedge tiles behind the grove at the
soil horizon:

- `spring-hedge-tile-v2.png`
- `summer-hedge-tile-v2.png`
- `autumn-hedge-tile-v2.png`
- `winter-hedge-tile-v2.png`

The preserved v1 files are exact quadrant crops, resized with Lanczos filtering, from the
preserved 1254 × 1254 generated sheet at
`source/four-season-hedges-master-v1.png`. The v2 runtime files retain the
exact v1 alpha and geometry while mapping every RGB channel with
`166 + 0.35 × source`, mixing the painting 65% toward white. The nominal
source floor is therefore `#A6A6A6`, about 35% gray; browser-decoded painted
pixels above a practical alpha threshold remain `#999999` (40% gray) or
lighter. Runtime
alternates each tile with a horizontal mirror, making every repeated edge meet
its matching edge. The hedge is drawn in world scale rather than screen scale
so it fills the close Seed view but remains a low horizon band behind a mature
tree.

Generated with the built-in image-generation tool on 2026-10-19, using the
existing Plum foliage and winter snow assets as style-only references.

Prompt: “Create one clean 2×2 source sheet containing four separate low
hedgerow paintings: spring in the top-left, summer top-right, autumn
bottom-left, winter bottom-right. Each is a continuous softly irregular row of
small countryside hedge bushes, painted in refined natural-history watercolor
and colored pencil, lower contrast and less detailed than the foreground tree.
Use sparse light yellow-green spring leaves, muted deep green summer foliage,
restrained ochre/russet/dull-gold autumn leaves, and fine bare brown-gray
winter twigs with soft snow caps. Each hedge occupies the lower 55–65% of its
quadrant and touches the left, right, and bottom edges. Use a genuinely
transparent background; omit sky, ground, soil, trees, fruit, flowers,
animals, text, labels, dividers, borders, shadows, UI, and watermarks.”

SHA-256:

- Master: `00cc37745ba84e9d2bcaf3a31eca9146bdb66e5f499deab8eaed19e723785a34`
- Spring v2: `6fad2d2eae95780999f1ac1d3405eb5e68c82c2761b7d0035852ead9aba0bbcc`
- Summer v2: `611b6ca8bbf691ad6086c940e75beedef8444197f891b29fecc9b6907f916246`
- Autumn v2: `6b705927932bdcd73fb1831d16f4f5230131802c5bb4664a61f6b4b6cbfc6ce1`
- Winter v2: `d3a37104670167cfaa5852fc1f92b4e695b098fdeba92e02d64c97186387d6fd`
