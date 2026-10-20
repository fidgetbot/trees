# Seasonal hedge assets

The Canvas uses four transparent 512 × 512 hedge tiles behind the grove at the
soil horizon:

- `spring-hedge-tile-v1.png`
- `summer-hedge-tile-v1.png`
- `autumn-hedge-tile-v1.png`
- `winter-hedge-tile-v1.png`

They are exact quadrant crops, resized with Lanczos filtering, from the
preserved 1254 × 1254 generated sheet at
`source/four-season-hedges-master-v1.png`. Runtime alternates each tile with a
horizontal mirror, making every repeated edge meet its matching edge. The
hedge is drawn in world scale rather than screen scale so it fills the close
Seed view but remains a low horizon band behind a mature tree.

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
- Spring: `91e12da7d0de4360f5d2905953c5f56b9e8dbc2ede3c77f238c66bcb9e0faa39`
- Summer: `2758c5c99b51a6227d16cd270e09f15b1bf989dc483bb906762a9889a649cc5e`
- Autumn: `ee15c80c58f9fcca181011c33b71f00cec090d4045c82147deffcdc75acf566c`
- Winter: `04cc7082541622ed70f3b45ca792ee125e0e2f30440feeb5042436b8b5659792`
