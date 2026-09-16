import assert from 'node:assert/strict';
import test from 'node:test';

import { getPlayerVisualProfile } from '../ui/canvas.js';

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
});

test('a player with no leaf clusters has no generated foliage', () => {
  const profile = getPlayerVisualProfile(state({ leafClusters: 0 }));
  assert.equal(profile.foliageClusters, 0);
  assert.equal(profile.foliageDensity, 0);
});
