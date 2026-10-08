import assert from 'node:assert/strict';
import test from 'node:test';

import { getBotanicalModuleCount, getBotanicalVariantCount, getBotanicalVariantIndex, getCanopyArrangement, getCanopyShadowGeometry, getFoliagePalette, getPlayerVisualProfile, getTreeLabelText, getWoodPalette, isTreeShaded, RESIDENT_WORLD_POSITIONS, shouldDrawPlayerBlossoms, shouldDrawSeedRadicle } from '../ui/canvas.js';
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

test('Plum botanical families expose every approved source variant', () => {
  assert.equal(getBotanicalVariantCount('Plum', 'foliage'), 4);
  assert.equal(getBotanicalVariantCount('Plum', 'blossoms'), 3);
  assert.equal(getBotanicalVariantCount('Plum', 'fruit'), 3);
  assert.equal(getBotanicalVariantCount('Peach', 'foliage'), 0);
});

test('botanical variant selection is stable per tree and placement', () => {
  const selections = Array.from({ length: 12 }, (_, placement) => getBotanicalVariantIndex('Plum', 'foliage', 7319, placement));
  assert.deepEqual(selections, Array.from({ length: 12 }, (_, placement) => getBotanicalVariantIndex('Plum', 'foliage', 7319, placement)));
  assert.ok(selections.every(index => index >= 0 && index < 4));
  assert.ok(new Set(selections).size > 1);
  assert.equal(getBotanicalVariantIndex('Peach', 'foliage', 7319, 0), -1);
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
    assert.equal(loaded.length, 9);
    assert.ok(loaded.some(asset => asset.family === 'Plum:foliage' && asset.index === 3));
    assert.ok(loaded.some(asset => asset.family === 'Plum:fruit' && asset.index === 1));
  } finally {
    if(originalImage===undefined)delete globalThis.Image;
    else globalThis.Image=originalImage;
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

test('map labels show health for allies without cluttering non-allies', () => {
  const state = { selectedSpecies: 'Plum' };
  const ally = getTreeLabelText(false, { species: 'Pear', stageName: 'Sapling', relation: 70, health: 6, maxHealth: 10 }, state, 'Seed', getRelationshipState);
  const neutral = getTreeLabelText(false, { species: 'Cherry', stageName: 'Sapling', relation: 0, health: 8, maxHealth: 10 }, state, 'Seed', getRelationshipState);
  assert.match(ally.secondary, /Ally.*♥ 6\/10/);
  assert.doesNotMatch(neutral.secondary, /♥|8\/10/);
});
