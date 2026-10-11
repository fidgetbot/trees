const ANIMAL_ASSET_REVISION='wildlife-browser-sprites-v1';
const FAUNA_ASSET_REVISION='final-fauna-rollout-v1';
export const ANIMAL_ASSET_URLS=Object.freeze({
  woodpecker:new URL(`../assets/animals/woodpecker-v1.png?rev=${ANIMAL_ASSET_REVISION}`,import.meta.url).href,
  beaver:new URL(`../assets/animals/beaver-v1.png?rev=${ANIMAL_ASSET_REVISION}`,import.meta.url).href,
  'browser-deer':new URL(`../assets/animals/browser-deer-v1.png?rev=${ANIMAL_ASSET_REVISION}`,import.meta.url).href,
  'browser-rabbit':new URL(`../assets/animals/browser-rabbit-v1.png?rev=${ANIMAL_ASSET_REVISION}`,import.meta.url).href,
  'fruit-robin':new URL(`../assets/animals/fruit-robin-v1.png?rev=${FAUNA_ASSET_REVISION}`,import.meta.url).href,
  'fruit-squirrel':new URL(`../assets/animals/fruit-squirrel-v1.png?rev=${FAUNA_ASSET_REVISION}`,import.meta.url).href,
});
export const INSECT_ASSET_URLS=Object.freeze({
  'pollinator-bumblebee':new URL(`../assets/insects/pollinator-bumblebee-v1.png?rev=${FAUNA_ASSET_REVISION}`,import.meta.url).href,
  'pollinator-honeybee':new URL(`../assets/insects/pollinator-honeybee-v1.png?rev=${FAUNA_ASSET_REVISION}`,import.meta.url).href,
  'pollinator-mason-bee':new URL(`../assets/insects/pollinator-mason-bee-v1.png?rev=${FAUNA_ASSET_REVISION}`,import.meta.url).href,
  'pollinator-hoverfly':new URL(`../assets/insects/pollinator-hoverfly-v1.png?rev=${FAUNA_ASSET_REVISION}`,import.meta.url).href,
  'pollinator-butterfly':new URL(`../assets/insects/pollinator-butterfly-v1.png?rev=${FAUNA_ASSET_REVISION}`,import.meta.url).href,
  'pollinator-beetle':new URL(`../assets/insects/pollinator-beetle-v1.png?rev=${FAUNA_ASSET_REVISION}`,import.meta.url).href,
  aphids:new URL(`../assets/insects/pest-aphids-v1.png?rev=${FAUNA_ASSET_REVISION}`,import.meta.url).href,
  'surface-crawlers':new URL(`../assets/insects/pest-surface-crawlers-v1.png?rev=${FAUNA_ASSET_REVISION}`,import.meta.url).href,
  mites:new URL(`../assets/insects/pest-mites-v1.png?rev=${FAUNA_ASSET_REVISION}`,import.meta.url).href,
});

const LABELS = {
  woodpecker: 'Woodpecker', beaver: 'Beaver', 'browser-deer': 'Browsing deer',
  'browser-rabbit': 'Browsing rabbit', 'fruit-robin': 'Robin', 'fruit-squirrel': 'Squirrel',
  aphids: 'Aphids', 'surface-crawlers': 'Surface crawlers', mites: 'Mites',
  'pollinator-bumblebee': 'Bumblebee', 'pollinator-honeybee': 'Honeybee',
  'pollinator-mason-bee': 'Solitary bee', 'pollinator-hoverfly': 'Hoverfly',
  'pollinator-butterfly': 'Butterfly', 'pollinator-beetle': 'Pollinating beetle',
};

// Use the event's explicit identity, never guesses from its title or prose.
export function renderEncounterArt(sceneArt) {
  const kinds = [...new Set([sceneArt].flat().flatMap(kind => kind === 'browsers'
    ? ['browser-deer', 'browser-rabbit'] : [kind]))].filter(kind => Object.hasOwn(LABELS, kind));
  if (!kinds.length) return '';
  return `<span class="encounter-art">${kinds.map(kind => `<img src="${ANIMAL_ASSET_URLS[kind] || INSECT_ASSET_URLS[kind]}" alt="${LABELS[kind]}" width="96" height="88" />`).join('')}</span>`;
}
