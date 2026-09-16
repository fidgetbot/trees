import assert from 'node:assert/strict';
import test from 'node:test';

import { getCanopyArrangement, getPlayerVisualProfile, shouldDrawPlayerBlossoms } from '../ui/canvas.js';

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

test('shading creates a dramatic lean toward the adjacent rival', () => {
  const left = { slot: 1, dead: false, playerShading: true };
  const state = { neighbors: [left] };
  const player = getCanopyArrangement(state, 2, true);
  const rival = getCanopyArrangement(state, 1, false, left);
  assert.ok(player.canopyLean <= -1.5);
  assert.ok(rival.worldOffset <= -30);
  assert.ok(Math.abs(rival.canopyLean) >= 0.8);
});
