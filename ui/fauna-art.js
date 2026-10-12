const ANIMAL_ASSET_REVISION='wildlife-browser-sprites-v1';
const FAUNA_ASSET_REVISION='final-fauna-rollout-v1';
const EVENT_ASSET_REVISION='night-field-journal-v1';
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
export const EVENT_ASSET_URLS=Object.freeze({
  'event-drought':new URL(`../assets/botanical/plum-foliage-airy.png?rev=${EVENT_ASSET_REVISION}`,import.meta.url).href,
  'event-storm':new URL(`../assets/trees/plum-ancient-v1.png?rev=${EVENT_ASSET_REVISION}`,import.meta.url).href,
  'event-winter-gale':new URL(`../assets/trees/plum-ancient-v1.png?rev=${EVENT_ASSET_REVISION}`,import.meta.url).href,
  'event-wildfire':new URL(`../assets/trees/plum-ancient-v1.png?rev=${EVENT_ASSET_REVISION}`,import.meta.url).href,
  'event-late-frost':new URL(`../assets/botanical/plum-blossoms-airy.png?rev=${EVENT_ASSET_REVISION}`,import.meta.url).href,
  'event-fungal-blight':new URL(`../assets/events/fungal-blight-v1.png?rev=${EVENT_ASSET_REVISION}`,import.meta.url).href,
  'event-mycorrhizal-bloom':new URL(`../assets/trees/plum-rooted-seed-v1.png?rev=${EVENT_ASSET_REVISION}`,import.meta.url).href,
  'damp-rot':new URL(`../assets/events/damp-rot-v1.png?rev=${EVENT_ASSET_REVISION}`,import.meta.url).href,
  'airborne-spores':new URL(`../assets/events/airborne-spores-v1.png?rev=${EVENT_ASSET_REVISION}`,import.meta.url).href,
});

export const ANIMAL_SCENE_PLACEMENT=Object.freeze({
  woodpecker:Object.freeze({anchor:'trunk',contactX:.27}),
  beaver:Object.freeze({anchor:'ground',contactY:.93}),
  'browser-deer':Object.freeze({anchor:'ground',contactY:.94}),
  'browser-rabbit':Object.freeze({anchor:'ground',contactY:.94}),
  'fruit-robin':Object.freeze({anchor:'ground',contactY:.89}),
  'fruit-squirrel':Object.freeze({anchor:'ground',contactY:.92}),
});

// Baseline CSS-pixel sizes at the neutral viewport scale. These are tuned as
// one family so large mammals remain convincingly larger than small mammals,
// birds, and insects while camera focus changes independently.
export const FAUNA_SCENE_SIZES=Object.freeze({
  woodpecker:Object.freeze({height:72}),
  beaver:Object.freeze({width:104}),
  'browser-deer':Object.freeze({width:132}),
  'browser-rabbit':Object.freeze({width:58}),
  'fruit-robin':Object.freeze({width:76}),
  'fruit-squirrel':Object.freeze({width:66}),
  'pollinator-bumblebee':Object.freeze({width:42}),
  'pollinator-honeybee':Object.freeze({width:42}),
  'pollinator-mason-bee':Object.freeze({width:42}),
  'pollinator-hoverfly':Object.freeze({width:42}),
  'pollinator-butterfly':Object.freeze({width:48}),
  'pollinator-beetle':Object.freeze({width:42}),
});

export function getFaunaSceneSize(kind){
  return FAUNA_SCENE_SIZES[kind]||Object.freeze({width:42});
}

export function getAnimalScenePlacement(kind){
  return ANIMAL_SCENE_PLACEMENT[kind]||Object.freeze({anchor:'air'});
}

const LABELS = {
  woodpecker: 'Woodpecker', beaver: 'Beaver', 'browser-deer': 'Browsing deer',
  'browser-rabbit': 'Browsing rabbit', 'fruit-robin': 'Robin', 'fruit-squirrel': 'Squirrel',
  aphids: 'Aphids', 'surface-crawlers': 'Surface crawlers', mites: 'Mites',
  'pollinator-bumblebee': 'Bumblebee', 'pollinator-honeybee': 'Honeybee',
  'pollinator-mason-bee': 'Solitary bee', 'pollinator-hoverfly': 'Hoverfly',
  'pollinator-butterfly': 'Butterfly', 'pollinator-beetle': 'Pollinating beetle',
  'event-drought': 'Leaves under drought stress', 'event-storm': 'Tree in an autumn storm',
  'event-winter-gale': 'Tree in a winter gale', 'event-wildfire': 'Tree facing wildfire',
  'event-late-frost': 'Blossoms touched by late frost', 'event-fungal-blight': 'Fungal blight',
  'event-mycorrhizal-bloom': 'Flourishing roots and fungal network',
  'damp-rot': 'Damp rot on a young stem', 'airborne-spores': 'Spores settling on a wounded leaf',
};

// Use the event's explicit identity, never guesses from its title or prose.
export function renderEncounterArt(sceneArt) {
  const kinds = [...new Set([sceneArt].flat().flatMap(kind => kind === 'browsers'
    ? ['browser-deer', 'browser-rabbit'] : [kind]))].filter(kind => Object.hasOwn(LABELS, kind));
  if (!kinds.length) return '';
  return `<span class="encounter-art">${kinds.map(kind => `<img data-scene-art="${kind}" src="${ANIMAL_ASSET_URLS[kind] || INSECT_ASSET_URLS[kind] || EVENT_ASSET_URLS[kind]}" alt="${LABELS[kind]}" width="96" height="88" />`).join('')}</span>`;
}
