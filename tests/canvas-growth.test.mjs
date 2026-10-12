import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';

import { getAnimalScenePlacement, getFaunaSceneSize } from '../ui/fauna-art.js';

import { clampGroundedArtwork, getBotanicalModuleCount, getBotanicalVariantCount, getBotanicalVariantIndex, getCanopyArrangement, getCanopyShadowGeometry, getDrawableGroveTrees, getFoliagePalette, getFungalNetworkSegments, getJoinedLimbWidth, getLoggerVariantIndex, getPaintedFoliageModuleCount, getPlayerVisualProfile, getSceneArtworkScale, getSceneArtKinds, getStageArtProfile, getSurveyorVariantIndex, getTreeGrowthAssetUrl, getTreeLabelText, getTreeStructureAssetUrl, getTreeStructureGeometry, getTreeStructureStageKey, getWinterSnowSurface, getWoodPalette, isTreeShaded, requestTreeGrowthAsset, requestTreeStructureAsset, RESIDENT_WORLD_POSITIONS, shouldDrawPlayerBlossoms, shouldDrawSeedRadicle } from '../ui/canvas.js';
import { getRelationshipState } from '../core/constants.js';
import { normalizePlayerShadeTarget } from '../core/growth.js';

function state(overrides = {}) {
  return {
    lifeStage: { name: 'Mature Tree' },
    rootZones: 2,
    taprootDepth: 1,
    branches: 2,
    leafClusters: 2,
    trunk: 2,
    canopySpread: 0,
    ...overrides,
  };
}

test('every structural growth stat changes its corresponding visual profile', () => {
  const baseState = state();
  const base = getPlayerVisualProfile(baseState);
  assert.ok(getPlayerVisualProfile(state({ rootZones: 3 })).rootBranches > base.rootBranches);
  assert.ok(getPlayerVisualProfile(state({ taprootDepth: 2 })).taprootDepth > base.taprootDepth);
  assert.ok(getPlayerVisualProfile(state({ branches: 3 })).branchShoots > base.branchShoots);
  assert.ok(getPlayerVisualProfile(state({ leafClusters: 3 })).foliageClusters > base.foliageClusters);
  assert.ok(getPlayerVisualProfile(state({ leafClusters: 3 })).foliageDensity > base.foliageDensity);
  assert.ok(getPlayerVisualProfile(state({ trunk: 3 })).trunkWidth > base.trunkWidth);
  assert.ok(getPlayerVisualProfile(state({ canopySpread: 1 })).canopySpreadFactor > base.canopySpreadFactor);
  assert.ok(getPlayerVisualProfile(state({ heightGrowth: 1 })).heightFactor > base.heightFactor);
});

test('a player with no leaf clusters has no generated foliage', () => {
  const profile = getPlayerVisualProfile(state({ leafClusters: 0 }));
  assert.equal(profile.foliageClusters, 0);
  assert.equal(profile.foliageDensity, 0);
});

test('growth stages use distinct silhouettes and progressively larger foliage modules', () => {
  const stages=['Seedling','Sapling','Young Tree','Mature Tree','Ancient'];
  assert.deepEqual(stages.map(stage=>getStageArtProfile(stage).silhouette),['single-leader','open-scaffold','developing-crown','rounded-crown','broad-crown']);
  const foliageScales=stages.map(stage=>getStageArtProfile(stage).foliageScale);
  assert.ok(foliageScales.every((scale,index)=>index===0||scale>foliageScales[index-1]));
  assert.ok(getPlayerVisualProfile(state({lifeStage:{name:'Seedling'}}),'Seedling').trunkWidth<getPlayerVisualProfile(state({lifeStage:{name:'Sapling'}}),'Sapling').trunkWidth);
});

test('early stages keep painted foliage sparse enough to reveal their scaffold', () => {
  assert.equal(getPaintedFoliageModuleCount('Seedling',2,8),2);
  assert.equal(getPaintedFoliageModuleCount('Sapling',4,8),3);
  assert.equal(getPaintedFoliageModuleCount('Young Tree',7,12),7);
  assert.equal(getPaintedFoliageModuleCount('Mature Tree',10,14),12);
  assert.equal(getPaintedFoliageModuleCount('Ancient',15,24),19);
});

test('every species and life stage resolves to a dedicated painted structure asset', () => {
  const stages=['Seed','Sprout','Seedling','Sapling','Young Tree','Mature Tree','Ancient'];
  for(const species of ['Plum','Peach','Apricot','Pear','Cherry','Citrus']){
    for(const stage of stages){
      const stageKey=getTreeStructureStageKey(stage);
      assert.match(getTreeStructureAssetUrl(species,stageKey),new RegExp(`${species.toLowerCase()}-${stageKey}-v1\\.png`));
    }
    assert.match(getTreeStructureAssetUrl(species,getTreeStructureStageKey('Seed',{rootedSeed:true})),/rooted-seed-v1\.png/);
  }
});

test('every species resolves to painted terminal shoot and root progression assets',()=>{
  for(const species of ['Plum','Peach','Apricot','Pear','Cherry','Citrus']){
    for(const key of ['shoot','root-radicle','root-forked','root-fan']){
      const url=new URL(getTreeGrowthAssetUrl(species,key));url.search='';
      assert.ok(existsSync(url),`${species} ${key}`);
    }
  }
});

test('painted growth assets load independently and notify after success',async()=>{
  const originalImage=globalThis.Image;
  class MockImage{set src(value){queueMicrotask(()=>value.includes('pear-root-fan-v1.png')?this.onerror():this.onload())}}
  globalThis.Image=MockImage;
  try{
    const isolated=await import(`../ui/canvas.js?growth-asset-load-test=${Date.now()}`),loaded=[];
    isolated.requestTreeGrowthAsset('Plum','shoot',asset=>loaded.push(asset));
    isolated.requestTreeGrowthAsset('Pear','root-fan',asset=>loaded.push(asset));
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.deepEqual(loaded.map(asset=>[asset.species,asset.assetKey]),[['Plum','shoot']]);
    assert.ok(isolated.requestTreeGrowthAsset('Plum','shoot'));
    assert.equal(isolated.requestTreeGrowthAsset('Pear','root-fan'),null);
  }finally{
    if(originalImage===undefined)delete globalThis.Image;else globalThis.Image=originalImage;
  }
});

test('painted structure geometry still reflects structural growth within a stage', () => {
  const base=getTreeStructureGeometry('sapling',{branches:0,trunk:0,canopySpread:0,heightGrowth:0});
  const grown=getTreeStructureGeometry('sapling',{branches:5,trunk:4,canopySpread:3,heightGrowth:2});
  assert.ok(grown.width>base.width);
  assert.ok(grown.height>base.height);
  assert.equal(getTreeStructureGeometry('seed',{branches:9,heightGrowth:9}).width,getTreeStructureGeometry('seed').width);
});

test('painted structure assets load independently and notify after success', async () => {
  const originalImage=globalThis.Image;
  let pearAttempts=0;
  class MockImage{
    set src(value){queueMicrotask(()=>value.includes('pear-seedling-v1.png')&&pearAttempts++===0?this.onerror():this.onload())}
  }
  globalThis.Image=MockImage;
  try{
    const isolated=await import(`../ui/canvas.js?tree-structure-load-test=${Date.now()}`),loaded=[];
    isolated.requestTreeStructureAsset('Plum','seedling',asset=>loaded.push(asset));
    isolated.requestTreeStructureAsset('Pear','seedling',asset=>loaded.push(asset));
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.deepEqual(loaded.map(asset=>[asset.species,asset.stageKey]),[['Plum','seedling']]);
    assert.ok(isolated.requestTreeStructureAsset('Plum','seedling'));
    await new Promise(resolve=>setTimeout(resolve,160));
    assert.ok(isolated.requestTreeStructureAsset('Pear','seedling'));
    assert.deepEqual(loaded.map(asset=>[asset.species,asset.stageKey]),[['Plum','seedling'],['Pear','seedling']]);
    assert.equal(pearAttempts,2);
  }finally{
    if(originalImage===undefined)delete globalThis.Image;
    else globalThis.Image=originalImage;
  }
});

test('connected limbs preserve most of the parent width before tapering', () => {
  const parentWidth=8;
  assert.equal(getJoinedLimbWidth(parentWidth,'continuation'),7.52);
  assert.equal(getJoinedLimbWidth(parentWidth,'lateral'),5.12);
  assert.ok(getJoinedLimbWidth(parentWidth,'continuation')>getJoinedLimbWidth(parentWidth,'lateral'));
  assert.ok(getJoinedLimbWidth(parentWidth,'continuation')<parentWidth);
});

test('flowers appear only after the player produces them in Spring', () => {
  assert.equal(shouldDrawPlayerBlossoms({ flowers: 0 }, 'Spring'), false);
  assert.equal(shouldDrawPlayerBlossoms({ flowers: 1 }, 'Spring'), true);
  assert.equal(shouldDrawPlayerBlossoms({ flowers: 2 }, 'Summer'), false);
});

test('painted botanical module counts remain sparse and follow game state', () => {
  assert.equal(getBotanicalModuleCount('foliage', 0, 20), 0);
  assert.equal(getBotanicalModuleCount('foliage', 4, 20), 4);
  assert.equal(getBotanicalModuleCount('blossoms', 1, 20), 1);
  assert.equal(getBotanicalModuleCount('blossoms', 5, 20), 3);
  assert.equal(getBotanicalModuleCount('fruit', 1, 20), 1);
  assert.equal(getBotanicalModuleCount('fruit', 9, 20), 3);
  assert.equal(getBotanicalModuleCount('fruit', 100, 4), 4);
});

test('every fruiting species exposes its approved botanical family', () => {
  for (const species of ['Plum', 'Peach', 'Apricot', 'Pear', 'Cherry', 'Citrus']) {
    assert.equal(getBotanicalVariantCount(species, 'foliage'), 4, `${species} foliage`);
    assert.equal(getBotanicalVariantCount(species, 'blossoms'), 3, `${species} blossoms`);
    assert.equal(getBotanicalVariantCount(species, 'fruit'), 3, `${species} fruit`);
  }
});

test('botanical variant selection is stable per tree and placement', () => {
  for (const species of ['Plum', 'Peach', 'Apricot', 'Pear', 'Cherry', 'Citrus']) {
    const selections = Array.from({ length: 12 }, (_, placement) => getBotanicalVariantIndex(species, 'foliage', 7319, placement));
    assert.deepEqual(selections, Array.from({ length: 12 }, (_, placement) => getBotanicalVariantIndex(species, 'foliage', 7319, placement)));
    assert.ok(selections.every(index => index >= 0 && index < 4));
    assert.ok(new Set(selections).size > 1);
  }
});

test('botanical assets report each successful load without one failure suppressing the family', async () => {
  const originalImage = globalThis.Image;
  class MockImage {
    set src(value) {
      queueMicrotask(() => value.includes('plum-fruit-variant-3.png') ? this.onerror() : this.onload());
    }
  }
  globalThis.Image = MockImage;
  try {
    const isolated = await import(`../ui/canvas.js?asset-load-test=${Date.now()}`);
    const loaded = [];
    assert.equal(await isolated.loadBotanicalAssets(asset => loaded.push(asset)), true);
    assert.equal(loaded.length, 59);
    assert.ok(loaded.some(asset => asset.family === 'Plum:foliage' && asset.index === 3));
    assert.ok(loaded.some(asset => asset.family === 'Plum:fruit' && asset.index === 1));
    assert.ok(loaded.some(asset => asset.family === 'Citrus:fruit' && asset.index === 2));
  } finally {
    if(originalImage===undefined)delete globalThis.Image;
    else globalThis.Image=originalImage;
  }
});

test('human sprite variants remain stable by encounter placement', () => {
  assert.deepEqual(Array.from({ length: 6 }, (_, index) => getSurveyorVariantIndex(index)), [0, 1, 0, 1, 0, 1]);
  assert.equal(getSurveyorVariantIndex(0, 0), -1);
  assert.deepEqual(Array.from({ length: 6 }, (_, index) => getLoggerVariantIndex(index)), [0, 1, 0, 1, 0, 1]);
  assert.equal(getLoggerVariantIndex(0, 0), -1);
});

test('surveyor assets load independently so one failure does not suppress the other', async () => {
  const originalImage = globalThis.Image;
  class MockImage {
    set src(value) {
      queueMicrotask(() => value.includes('surveyor-v2.png') ? this.onerror() : this.onload());
    }
  }
  globalThis.Image = MockImage;
  try {
    const isolated = await import(`../ui/canvas.js?surveyor-load-test=${Date.now()}`);
    const loaded = [];
    assert.equal(await isolated.loadSurveyorAssets(asset => loaded.push(asset)), true);
    assert.deepEqual(loaded.map(asset => [asset.family, asset.index]), [['humans:surveyors', 0]]);
  } finally {
    if(originalImage===undefined)delete globalThis.Image;
    else globalThis.Image=originalImage;
  }
});

test('logger assets load independently so one failure does not suppress the other', async () => {
  const originalImage = globalThis.Image;
  class MockImage {
    set src(value) {
      queueMicrotask(() => value.includes('logger-v2-bow-saw.png') ? this.onerror() : this.onload());
    }
  }
  globalThis.Image = MockImage;
  try {
    const isolated = await import(`../ui/canvas.js?logger-load-test=${Date.now()}`);
    const loaded = [];
    assert.equal(await isolated.loadLoggerAssets(asset => loaded.push(asset)), true);
    assert.deepEqual(loaded.map(asset => [asset.family, asset.index]), [['humans:loggers', 0]]);
  } finally {
    if(originalImage===undefined)delete globalThis.Image;
    else globalThis.Image=originalImage;
  }
});

test('animal assets load independently so one failure does not suppress the wildlife set', async () => {
  const originalImage = globalThis.Image;
  class MockImage {
    set src(value) {
      queueMicrotask(() => value.includes('browser-rabbit-v1.png') ? this.onerror() : this.onload());
    }
  }
  globalThis.Image = MockImage;
  try {
    const isolated = await import(`../ui/canvas.js?animal-load-test=${Date.now()}`);
    const loaded = [];
    assert.equal(await isolated.loadAnimalAssets(asset => loaded.push(asset)), true);
    assert.deepEqual(loaded.map(asset => asset.kind).sort(), ['beaver', 'browser-deer', 'fruit-robin', 'fruit-squirrel', 'woodpecker']);
  } finally {
    if(originalImage===undefined)delete globalThis.Image;
    else globalThis.Image=originalImage;
  }
});

test('insect assets load independently so one failure does not suppress other visitors', async () => {
  const originalImage = globalThis.Image;
  class MockImage {
    set src(value) {
      queueMicrotask(() => value.includes('pollinator-hoverfly-v1.png') ? this.onerror() : this.onload());
    }
  }
  globalThis.Image = MockImage;
  try {
    const isolated = await import(`../ui/canvas.js?insect-load-test=${Date.now()}`);
    const loaded = [];
    assert.equal(await isolated.loadInsectAssets(asset => loaded.push(asset)), true);
    assert.equal(loaded.length, 8);
    assert.ok(loaded.some(asset => asset.kind === 'pollinator-bumblebee'));
    assert.ok(loaded.some(asset => asset.kind === 'aphids'));
    assert.ok(loaded.some(asset => asset.kind === 'mites'));
  } finally {
    if(originalImage===undefined)delete globalThis.Image;
    else globalThis.Image=originalImage;
  }
});

test('scene art keeps named wildlife and expands browser groups without duplicate markers', () => {
  assert.deepEqual(
    getSceneArtKinds({ activeSceneArt: ['woodpecker', 'browsers', 'fruit-robin', 'pollinator-hoverfly', 'aphids', 'woodpecker', 'unknown'] }),
    ['woodpecker', 'browsers', 'fruit-robin', 'pollinator-hoverfly', 'aphids'],
  );
  assert.deepEqual(getSceneArtKinds({}), []);
});

test('animal artwork uses pose-appropriate scene anchors', () => {
  for (const kind of ['fruit-robin', 'fruit-squirrel', 'beaver', 'browser-deer', 'browser-rabbit']) {
    assert.equal(getAnimalScenePlacement(kind).anchor, 'ground', `${kind} should stand on the ground`);
    assert.ok(getAnimalScenePlacement(kind).contactY > 0.85, `${kind} feet should meet the ground`);
  }
  assert.equal(getAnimalScenePlacement('woodpecker').anchor, 'trunk');
  assert.equal(getAnimalScenePlacement('pollinator-butterfly').anchor, 'air');
});

test('fauna baselines preserve a plausible size hierarchy',()=>{
  assert.equal(getFaunaSceneSize('browser-deer').width,132);
  assert.equal(getFaunaSceneSize('browser-rabbit').width,58);
  assert.ok(getFaunaSceneSize('browser-deer').width>getFaunaSceneSize('beaver').width);
  assert.ok(getFaunaSceneSize('beaver').width>getFaunaSceneSize('fruit-squirrel').width);
  assert.ok(getFaunaSceneSize('fruit-squirrel').width>getFaunaSceneSize('browser-rabbit').width);
  assert.ok(getFaunaSceneSize('browser-rabbit').width>getFaunaSceneSize('pollinator-butterfly').width);
  assert.ok(getFaunaSceneSize('browser-deer').width/getFaunaSceneSize('browser-rabbit').width>2);
});

test('large grounded wildlife remains inside the visible scene margin',()=>{
  assert.deepEqual(clampGroundedArtwork(-40,205,390),{width:205,centerX:114.5});
  assert.deepEqual(clampGroundedArtwork(430,205,390),{width:205,centerX:275.5});
  assert.deepEqual(clampGroundedArtwork(195,500,390),{width:366,centerX:195});
});

test('winter ground painting loads independently',async()=>{
  const originalImage=globalThis.Image;
  class MockImage{set src(value){this.loadedUrl=value;queueMicrotask(()=>this.onload())}}
  globalThis.Image=MockImage;
  try{
    const isolated=await import(`../ui/canvas.js?winter-ground-test=${Date.now()}`),loaded=[];
    assert.equal(await isolated.loadWinterGroundAsset(asset=>loaded.push(asset)),true);
    assert.equal(loaded.length,1);assert.equal(loaded[0].family,'ground:winter');
    assert.match(loaded[0].url,/winter-snow-tile-v1\.png\?rev=painted-snow-v1/);
  }finally{if(originalImage===undefined)delete globalThis.Image;else globalThis.Image=originalImage;}
});

test('winter snow overlaps the soil horizon and spans both viewport edges before feathering',()=>{
  const surface=getWinterSnowSurface(390,370);
  assert.equal(surface.top[0].x,0);
  assert.equal(surface.top.at(-1).x,390);
  assert.ok(surface.top.every(point=>point.y<370));
  assert.ok(surface.layerTop<Math.min(...surface.top.map(point=>point.y)));
  assert.ok(surface.fadeBottom>surface.opaqueBottom);
});

test('shading creates a dramatic lean toward the adjacent rival', () => {
  const left = { slot: 1, dead: false, playerShading: true };
  const state = { neighbors: [left] };
  const player = getCanopyArrangement(state, 2, true);
  const rival = getCanopyArrangement(state, 1, false, left);
  assert.ok(player.canopyLean <= -1.5);
  assert.ok(rival.worldOffset <= -30);
  assert.ok(Math.abs(rival.canopyLean) >= 0.8);
});

test('legacy dual shade flags still resolve to one visible outgoing direction', () => {
  const left = { slot: 1, dead: false, playerShading: true };
  const right = { slot: 3, dead: false, playerShading: true };
  const arrangement = getCanopyArrangement({ neighbors: [left, right] }, 2, true);
  assert.ok(arrangement.canopyLean < 0);
  assert.equal(normalizePlayerShadeTarget({ neighbors: [left, right] }), left);
  assert.equal(right.playerShading, false);
});

test('resident grove positions keep immediate neighbors close enough for overlapping crowns', () => {
  assert.deepEqual(RESIDENT_WORLD_POSITIONS, [-180, -70, 0, 72, 180]);
  assert.ok(RESIDENT_WORLD_POSITIONS[2] - RESIDENT_WORLD_POSITIONS[1] <= 75);
  assert.ok(RESIDENT_WORLD_POSITIONS[3] - RESIDENT_WORLD_POSITIONS[2] <= 75);
});

test('the cast shadow begins at the shading tree and points toward its target', () => {
  const left = getCanopyShadowGeometry(450, 250, 300);
  const right = getCanopyShadowGeometry(450, 650, 300);
  assert.equal(left.sourceX, 450);
  assert.ok(left.targetX < left.sourceX);
  assert.ok(right.targetX > right.sourceX);
  assert.equal(left.targetX, 250);
  assert.equal(right.targetX, 650);
  assert.ok(left.endHalfWidth > left.startHalfWidth);
  assert.equal(left.sourceY - left.startHalfWidth, 300);
  assert.equal(left.targetY - left.endHalfWidth, 300);
  const zoomedOut = getCanopyShadowGeometry(450, 452, 300);
  assert.ok(zoomedOut.endHalfWidth < 1);
  assert.ok(zoomedOut.targetY - 300 < 1);
});

test('shaded foliage uses an unmistakably darker palette', () => {
  assert.notDeepEqual(getFoliagePalette('Spring', true), getFoliagePalette('Spring', false));
  assert.equal(getFoliagePalette('Spring', true)[0], '#587653');
  const stored = { slot: 1, dead: false, playerShading: true };
  assert.equal(isTreeShaded({ neighbors: [stored] }, { ...stored }), true);
});

test('shaded trees darken their wood as well as their foliage', () => {
  const lit = getWoodPalette('#70553f', false);
  const shaded = getWoodPalette('#70553f', true);
  assert.equal(lit.bark, '#70553f');
  assert.notEqual(shaded.bark, lit.bark);
  assert.equal(shaded.bark, '#3f3023');
});

test('offspring on the shaded side use the same darkened tree palette', () => {
  const shadeTarget = { slot: 1, dead: false, playerShading: true };
  const s = state({ neighbors: [shadeTarget] });
  assert.equal(isTreeShaded(s, { offspring: true, offspringIndex: 0, groveSide: 'left' }), true);
  assert.equal(isTreeShaded(s, { offspring: true, offspringIndex: 1, groveSide: 'right' }), false);
});

test('a rooted seed shows a radicle before its first leaf', () => {
  assert.equal(shouldDrawSeedRadicle('Seed', 1, 0), true);
  assert.equal(shouldDrawSeedRadicle('Sprout', 1, 0), true);
  assert.equal(shouldDrawSeedRadicle('Seed', 1, 1), false);
  assert.equal(shouldDrawSeedRadicle('Sprout', 1, 1), false);
});

test('fungal links retain full-grove endpoints for stationary focused views',()=>{
  const trees=[
    {x:120,index:0,neighbor:{relation:80,relationName:'Ally'}},
    {x:240,index:1,neighbor:{relation:0,relationName:'Neutral'}},
    {x:360,index:2,isPlayer:true},
  ];
  assert.deepEqual(getFungalNetworkSegments(trees,500,getRelationshipState),[
    {from:{x:360,y:530},to:{x:120,y:570}},
  ]);
});

test('trees with offscreen ground anchors cannot leak disconnected canopy fragments',()=>{
  const trees=[{x:-180,id:'far-left'},{x:12,id:'left'},{x:640,id:'player'},{x:1268,id:'right'},{x:1460,id:'far-right'}];
  assert.deepEqual(getDrawableGroveTrees(trees,1280).map(tree=>tree.id),['left','player','right']);
  assert.equal(getDrawableGroveTrees([trees[0]],1280,{preserveFocused:true})[0],trees[0]);
});

test('fauna and encounter artwork use a camera-independent responsive scale',()=>{
  assert.equal(getSceneArtworkScale(390),.78);
  assert.equal(getSceneArtworkScale(780),1);
  assert.equal(getSceneArtworkScale(1280),1.6);
  assert.equal(getSceneArtworkScale(1920),1.6);
});

test('map labels show health for allies without cluttering non-allies', () => {
  const state = { selectedSpecies: 'Plum' };
  const ally = getTreeLabelText(false, { species: 'Pear', stageName: 'Sapling', relation: 70, health: 6, maxHealth: 10 }, state, 'Seed', getRelationshipState);
  const neutral = getTreeLabelText(false, { species: 'Cherry', stageName: 'Sapling', relation: 0, health: 8, maxHealth: 10 }, state, 'Seed', getRelationshipState);
  assert.match(ally.secondary, /Ally.*♥ 6\/10/);
  assert.doesNotMatch(neutral.secondary, /♥|8\/10/);
});
