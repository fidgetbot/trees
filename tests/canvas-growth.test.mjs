import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';

import { EVENT_ASSET_URLS, SCENE_PIXELS_PER_METER, getAnimalScenePlacement, getFaunaSceneSize, getHumanSceneHeight } from '../ui/fauna-art.js';

import { fitGroundedArtwork, getBotanicalModuleCount, getBotanicalVariantCount, getBotanicalVariantIndex, getCanopyArrangement, getCanopyShadowGeometry, getDeadTreePresentation, getDrawableGroveTrees, getFoliagePalette, getFungalNetworkSegments, getJoinedLimbWidth, getLoggerVariantIndex, getPaintedFoliageModuleCount, getPlayerVisualProfile, getSceneArtworkScale, getSceneArtKinds, getSceneHumanPresentation, getSeasonalHedgeLayout, getSeasonalHedgeTileDraws, getStageArtProfile, getSurveyorVariantIndex, getTreeGrowthAssetUrl, getTreeLabelText, getTreeStructureAssetUrl, getTreeStructureFallbackKeys, getTreeStructureGeometry, getTreeStructureStageKey, getWinterSnowSurface, getWoodPalette, isTreeShaded, LEAFLESS_SPROUT_OCCUPANCY_RATIO, paintedCanopyEntries, projectSceneWorldX, shouldDrawPlayerBlossoms, shouldDrawSeedRadicle } from '../ui/canvas.js';
import { getJuvenileGeometry } from '../ui/juvenile-growth.js';
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

test('Forest Gift and Mycorrhizal Bloom use dedicated event artwork', () => {
  const forestGift = new URL(EVENT_ASSET_URLS['event-nutrients']);
  const fungalBloom = new URL(EVENT_ASSET_URLS['event-mycorrhizal-bloom']);
  forestGift.search = '';
  fungalBloom.search = '';
  assert.ok(existsSync(forestGift));
  assert.ok(existsSync(fungalBloom));
  assert.match(forestGift.pathname, /\/assets\/events\/forest-gift-v1\.png$/);
  assert.match(fungalBloom.pathname, /\/assets\/events\/mycorrhizal-bloom-v1\.png$/);
  assert.notEqual(forestGift.href, fungalBloom.href);
});

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

test('later growth stages use larger foliage modules and trunks', () => {
  const stages=['Seedling','Sapling','Young Tree','Mature Tree','Ancient'];
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
      const url = new URL(getTreeStructureAssetUrl(species, stageKey));
      url.search = '';
      assert.ok(existsSync(url), `${species} ${stage}: ${url}`);
    }
    assert.match(getTreeStructureAssetUrl(species,getTreeStructureStageKey('Seed',{rootedSeed:true})),/rooted-seed-v1\.png/);
  }
});

test('rooted seed retains the seed painting while its new structure decodes',()=>{
  assert.deepEqual(getTreeStructureFallbackKeys('rooted-seed'),['rooted-seed','seed']);
  assert.deepEqual(getTreeStructureFallbackKeys('sapling'),['sapling']);
});

test('leafless Sprouts use a species-normalized size between Seed and established Sprout framing',()=>{
  const species=['Plum','Peach','Apricot','Pear','Cherry','Citrus'];
  for(const name of species){
    const leafless=getTreeStructureGeometry('rooted-seed',{selectedSpecies:name,presentationStage:'Sprout'});
    const established=getJuvenileGeometry(name,'unfurling');
    assert.ok(Math.abs(leafless.height/established.height-LEAFLESS_SPROUT_OCCUPANCY_RATIO)<1e-12,name);
  }
});

test('dead trees retain their painted life-stage structure before becoming low painted stumps', () => {
  assert.deepEqual(getDeadTreePresentation('Young Tree',3,{rootZones:5,leafClusters:8}),{kind:'snag',stageKey:'young-tree'});
  const stump=getDeadTreePresentation('Young Tree',4,{rootZones:5,leafClusters:8});
  assert.equal(stump.kind,'stump');
  assert.equal(stump.stageKey,'young-tree');
  assert.ok(stump.width>stump.height);
  assert.ok(stump.height<60);
  assert.ok(existsSync(new URL('../assets/trees/remains/dead-fruit-tree-stump-v1.png',import.meta.url)));
});

test('every species resolves to painted terminal shoot and root progression assets',()=>{
  for(const species of ['Plum','Peach','Apricot','Pear','Cherry','Citrus']){
    for(const key of ['shoot','root-radicle','root-forked','root-fan']){
      const url=new URL(getTreeGrowthAssetUrl(species,key));url.search='';
      assert.ok(existsSync(url),`${species} ${key}`);
    }
  }
  for(const family of ['juvenile','woody']){
    const url=new URL(getTreeGrowthAssetUrl('Cherry',`root-extension-${family}`));url.search='';
    assert.ok(existsSync(url),`shared ${family} root extension`);
  }
});

test('painted structure geometry still reflects structural growth within a stage', () => {
  const base=getTreeStructureGeometry('sapling',{branches:0,trunk:0,canopySpread:0,heightGrowth:0});
  const grown=getTreeStructureGeometry('sapling',{branches:5,trunk:4,canopySpread:3,heightGrowth:2});
  assert.ok(grown.width>base.width);
  assert.ok(grown.height>base.height);
  assert.equal(getTreeStructureGeometry('seed',{branches:9,heightGrowth:9}).width,getTreeStructureGeometry('seed').width);
});

test('connected limbs preserve most of the parent width before tapering', () => {
  const parentWidth=8;
  assert.ok(getJoinedLimbWidth(parentWidth,'continuation')>getJoinedLimbWidth(parentWidth,'lateral'));
  assert.ok(getJoinedLimbWidth(parentWidth,'continuation')<parentWidth);
});

test('flowers appear only after the player produces them in Spring', () => {
  assert.equal(shouldDrawPlayerBlossoms({ flowers: 0 }, 'Spring'), false);
  assert.equal(shouldDrawPlayerBlossoms({ flowers: 1 }, 'Spring'), true);
  assert.equal(shouldDrawPlayerBlossoms({ flowers: 2 }, 'Summer'), false);
});

test('pollinated spring blossoms remain visible until they become fruit', () => {
  assert.equal(shouldDrawPlayerBlossoms({ flowers: 0, pollinated: 2 }, 'Spring'), true);
  assert.equal(shouldDrawPlayerBlossoms({ flowers: 0, pollinated: 2 }, 'Summer'), false);
});

test('painted botanical module counts remain sparse and follow game state', () => {
  assert.equal(getBotanicalModuleCount('foliage', 0, 20), 0);
  assert.equal(getBotanicalModuleCount('foliage', 4, 20), 4);
  assert.equal(getBotanicalModuleCount('blossoms', 1, 20), 1);
  assert.equal(getBotanicalModuleCount('blossoms', 5, 20), 5);
  assert.equal(getBotanicalModuleCount('fruit', 1, 20), 1);
  assert.equal(getBotanicalModuleCount('fruit', 9, 20), 3);
  assert.equal(getBotanicalModuleCount('fruit', 100, 4), 4);
});

test('blossoms and fruit reuse the exact painted foliage attachment map',()=>{
  const growth={leaves:[
    {end:{x:-30,y:-42},width:40},
    {end:{x:-8,y:-58},width:48},
    {end:{x:16,y:-51},width:44},
    {end:{x:38,y:-39},width:36},
  ]};
  for(const kind of ['fruit']){
    const entries=paintedCanopyEntries(growth,7319,kind,5);
    assert.equal(entries.length,getBotanicalModuleCount(kind,5,growth.leaves.length));
    for(const entry of entries){
      assert.ok(growth.leaves.includes(entry.leaf));
      assert.deepEqual({x:entry.cluster.x,y:entry.cluster.y},entry.leaf.end);
      assert.equal(entry.cluster.size,entry.leaf.width/4.8);
    }
    assert.ok(entries[0].cluster.x<entries.at(-1).cluster.x,'modules remain spread across the painted canopy');
  }
});

test('botanical variant selection is stable per tree and placement', () => {
  for (const species of ['Plum', 'Peach', 'Apricot', 'Pear', 'Cherry', 'Citrus']) {
    const selections = Array.from({ length: 12 }, (_, placement) => getBotanicalVariantIndex(species, 'foliage', 7319, placement));
    assert.deepEqual(selections, Array.from({ length: 12 }, (_, placement) => getBotanicalVariantIndex(species, 'foliage', 7319, placement)));
    assert.ok(selections.every(index => index >= 0 && index < getBotanicalVariantCount(species, 'foliage')));
    assert.ok(new Set(selections).size > 1);
  }
});

test('human sprite variants remain stable by encounter placement', () => {
  assert.deepEqual(Array.from({ length: 6 }, (_, index) => getSurveyorVariantIndex(index)), [0, 1, 0, 1, 0, 1]);
  assert.equal(getSurveyorVariantIndex(0, 0), -1);
  assert.deepEqual(Array.from({ length: 6 }, (_, index) => getLoggerVariantIndex(index)), [0, 1, 0, 1, 0, 1]);
  assert.equal(getLoggerVariantIndex(0, 0), -1);
});

test('scene art keeps named wildlife and expands browser groups without duplicate markers', () => {
  assert.deepEqual(
    getSceneArtKinds({ incidents: [
      ...['woodpecker', 'browsers', 'fruit-robin', 'pollinator-hoverfly', 'aphids', 'woodpecker', 'unknown'].map((artwork, index) => ({ id: `incident-${index}`, state: 'ongoing', scenePersistent: true, artwork })),
    ], responseQueue: [] }),
    ['woodpecker', 'browsers', 'fruit-robin', 'pollinator-hoverfly', 'aphids'],
  );
  assert.deepEqual(getSceneArtKinds({}), []);
});

test('animal artwork uses pose-appropriate scene anchors', () => {
  for (const kind of ['fruit-robin', 'fruit-squirrel', 'beaver', 'browser-deer', 'browser-rabbit']) {
    assert.equal(getAnimalScenePlacement(kind).anchor, 'ground', `${kind} should stand on the ground`);
    assert.ok(getAnimalScenePlacement(kind).contactY > 0.85, `${kind} feet should meet the ground`);
    assert.ok(Number.isFinite(getAnimalScenePlacement(kind).worldOffset), `${kind} should retain a stable grove coordinate`);
  }
  assert.equal(getAnimalScenePlacement('woodpecker').anchor, 'trunk');
  assert.equal(getAnimalScenePlacement('pollinator-butterfly').anchor, 'air');
});

test('fauna and humans share one measured biological map scale',()=>{
  assert.equal(SCENE_PIXELS_PER_METER,24);
  assert.ok(Math.abs(getHumanSceneHeight()*.863-SCENE_PIXELS_PER_METER*1.7)<.01);
  for(const kind of ['browser-deer','beaver','fruit-squirrel','browser-rabbit','fruit-robin','pollinator-butterfly']){
    const size=getFaunaSceneSize(kind);
    assert.ok(size.metres>0,`${kind} needs a real-world extent`);
  }
  assert.equal(getFaunaSceneSize('fruit-squirrel').metres,getFaunaSceneSize('browser-rabbit').metres);
  assert.ok(getFaunaSceneSize('browser-deer').metres>getFaunaSceneSize('beaver').metres);
  assert.ok(getFaunaSceneSize('beaver').metres>getFaunaSceneSize('fruit-squirrel').metres);
  assert.ok(getFaunaSceneSize('fruit-robin').metres>getFaunaSceneSize('pollinator-butterfly').metres);
});

test('grounded wildlife keeps its projected world position instead of sticking to viewport edges',()=>{
  assert.equal(projectSceneWorldX(195,-60,2),75);
  assert.equal(projectSceneWorldX(75,-60,1),15);
  assert.deepEqual(fitGroundedArtwork(-40,205,390),{width:205,centerX:-40});
  assert.deepEqual(fitGroundedArtwork(430,205,390),{width:205,centerX:430});
  assert.deepEqual(fitGroundedArtwork(195,500,390),{width:366,centerX:195});
});

test('winter snow overlaps the soil horizon and spans both viewport edges before feathering',()=>{
  const surface=getWinterSnowSurface(390,370);
  assert.equal(surface.top[0].x,0);
  assert.equal(surface.top.at(-1).x,390);
  assert.ok(surface.top.every(point=>point.y<370));
  assert.ok(surface.layerTop<Math.min(...surface.top.map(point=>point.y)));
  assert.ok(surface.fadeBottom>surface.opaqueBottom);
  assert.ok(surface.opaqueBottom-370<=5);
  assert.ok(surface.fadeBottom-surface.layerTop<=32);
});

test('seasonal hedge keeps world scale so seed zoom reads much larger than mature-tree zoom',()=>{
  const seed=getSeasonalHedgeLayout(390,370,10);
  const mature=getSeasonalHedgeLayout(390,370,.86);
  assert.equal(seed.tileSize,640);
  assert.equal(mature.tileSize,55.04);
  assert.ok(seed.top<20,'seed view should be almost entirely backed by hedge');
  assert.ok(mature.top>310,'mature view should leave only a low hedge band');
  assert.ok(Math.abs(seed.top+seed.drawHeight-(370+seed.groundBleed))<1e-9,'hedge baseline should extend behind the soil mask');
  assert.ok(Math.abs(mature.top+mature.drawHeight-(370+mature.groundBleed))<1e-9,'small hedge baseline should extend behind the soil mask');
  assert.ok(seed.drawHeight<seed.tileSize,'trimmed hedge should preserve its source aspect ratio without downward stretching');
  assert.deepEqual(seed.sourceRect,{x:2,y:0,width:508,height:500});
  assert.ok(seed.firstIndex<seed.lastIndex);
  assert.ok(mature.firstIndex<mature.lastIndex);
});

test('seasonal hedge tile rasterization has no fractional gaps at repeated joins',()=>{
  for(const zoom of [29.12683355939567,10,.86]){
    const layout=getSeasonalHedgeLayout(390,370,zoom,13.25),tiles=getSeasonalHedgeTileDraws(layout);
    assert.ok(tiles[0].left<=0);
    assert.ok(tiles.at(-1).right>=390);
    for(let index=1;index<tiles.length;index++)assert.equal(tiles[index-1].right,tiles[index].left);
    assert.ok(tiles.every(tile=>tile.width>0));
  }
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
  const stored = { slot: 1, dead: false, playerShading: true };
  assert.equal(isTreeShaded({ neighbors: [stored] }, { ...stored }), true);
});

test('shaded trees darken their wood as well as their foliage', () => {
  const lit = getWoodPalette('#70553f', false);
  const shaded = getWoodPalette('#70553f', true);
  assert.equal(lit.bark, '#70553f');
  assert.notEqual(shaded.bark, lit.bark);
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

test('map labels show health for allies and preserve Root Dominion state without free-floating art', () => {
  const state = { selectedSpecies: 'Plum' };
  const ally = getTreeLabelText(false, { species: 'Pear', stageName: 'Sapling', relation: 70, health: 6, maxHealth: 10 }, state, 'Seed', getRelationshipState);
  const neutral = getTreeLabelText(false, { species: 'Cherry', stageName: 'Sapling', relation: 0, health: 8, maxHealth: 10 }, state, 'Seed', getRelationshipState);
  const dominated = getTreeLabelText(false, { species: 'Apricot', stageName: 'Mature Tree', relation: -25, playerRootDominated: true }, state, 'Seed', getRelationshipState);
  assert.match(ally.secondary, /Ally.*♥ 6\/10/);
  assert.doesNotMatch(neutral.secondary, /♥|8\/10/);
  assert.match(dominated.secondary, /Root dominion/);
});


test('each additional blossom preserves earlier flowers and adds a foliage-attached placement',()=>{
  const growth={leaves:[{end:{x:-20,y:-40},width:40},{end:{x:20,y:-50},width:36}]};
  let previous=[];
  for(let count=1;count<=25;count++){
    const entries=paintedCanopyEntries(growth,7319,'blossoms',count);
    assert.equal(entries.length,count);
    assert.deepEqual(entries.slice(0,-1),previous);
    for(const entry of entries){
      assert.ok(growth.leaves.includes(entry.leaf));
      assert.ok(Math.hypot(entry.cluster.x-entry.leaf.end.x,entry.cluster.y-entry.leaf.end.y)<=entry.leaf.width*.28);
    }
    previous=entries;
  }
});

test('human map portraits include fruit gatherers and conservation visitors, and clear only on resolution',()=>{
  for(const [kind,artwork,meta] of [
    ['fruit-threat','human-surveyor',{threatType:'human'}],
    ['conservation-inspection','human-surveyor',{}],
    ['human-encounter','human-surveyor',{encounter:{phase:'survey',count:2}}],
    ['human-encounter','human-logger',{encounter:{phase:'cutting',count:4}}],
  ]){
    const human={kind,artwork,meta,state:'ongoing',scenePersistent:true};
    const robin={kind:'wildlife',artwork:'fruit-robin',state:'ongoing',scenePersistent:true};
    const state={incidents:[human,robin]};
    assert.equal(getSceneHumanPresentation(state).phase,artwork==='human-logger'?'cutting':'survey');
    assert.equal(getSceneHumanPresentation(state).count,meta.encounter?.count||2);
    human.state='resolved';
    assert.equal(getSceneHumanPresentation(state),null);
    assert.deepEqual(getSceneArtKinds(state),['fruit-robin']);
  }
});
