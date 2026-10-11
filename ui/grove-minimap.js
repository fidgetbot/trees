const FRUIT_ASSET_REVISION = 'fruit-minimap-v3';

export const MINIMAP_FRUIT_ASSETS = Object.freeze({
  Apricot: `assets/botanical/apricot-fruit-v1.png?rev=${FRUIT_ASSET_REVISION}`,
  Cherry: `assets/botanical/cherry-fruit-v1.png?rev=${FRUIT_ASSET_REVISION}`,
  Citrus: `assets/botanical/citrus-fruit-v1.png?rev=${FRUIT_ASSET_REVISION}`,
  Peach: `assets/botanical/peach-fruit-v1.png?rev=${FRUIT_ASSET_REVISION}`,
  Pear: `assets/botanical/pear-fruit-v1.png?rev=${FRUIT_ASSET_REVISION}`,
  Plum: `assets/botanical/plum-fruit-airy.png?rev=${FRUIT_ASSET_REVISION}`,
});

export function minimapFruitMarkup(species) {
  const src = MINIMAP_FRUIT_ASSETS[species];
  return src
    ? `<img src="${src}" alt="" aria-hidden="true" />`
    : '<span aria-hidden="true">🌳</span>';
}

export function layoutMinimapTargets(targets) {
  const ordered = [...targets].sort((a, b) => (a.mapPosition || 0) - (b.mapPosition || 0));
  const playerIndex = ordered.findIndex(target => target.id === 'player');
  const centerIndex = playerIndex >= 0 ? playerIndex : (ordered.length - 1) / 2;
  const furthestSteps = Math.max(1, centerIndex, ordered.length - 1 - centerIndex);
  const step = 44 / furthestSteps;
  return ordered.map((target, index) => ({
    target,
    leftPercent: 50 + (index - centerIndex) * step,
  }));
}
