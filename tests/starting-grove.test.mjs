import assert from 'node:assert/strict';
import test from 'node:test';

import { LIFE_STAGES } from '../core/constants.js';
import { createStartingNeighbors } from '../core/neighbors.js';

test('the player and two immediate neighbors all begin as seeds', () => {
  const neighbors = createStartingNeighbors(['Plum', 'Pear', 'Cherry', 'Citrus'], LIFE_STAGES, () => 0.25);
  assert.equal(neighbors.find(neighbor => neighbor.slot === 1).stageScore, 0);
  assert.equal(neighbors.find(neighbor => neighbor.slot === 3).stageScore, 0);
  assert.ok(neighbors.find(neighbor => neighbor.slot === 0).stageScore >= 600);
  assert.ok(neighbors.find(neighbor => neighbor.slot === 4).stageScore >= 600);
});
