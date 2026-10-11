import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutMinimapTargets, MINIMAP_FRUIT_ASSETS, minimapFruitMarkup } from '../ui/grove-minimap.js';

test('every playable species has a painted minimap fruit', () => {
  assert.deepEqual(Object.keys(MINIMAP_FRUIT_ASSETS).sort(), ['Apricot', 'Cherry', 'Citrus', 'Peach', 'Pear', 'Plum']);
  for (const species of Object.keys(MINIMAP_FRUIT_ASSETS)) {
    assert.match(minimapFruitMarkup(species), new RegExp(`${species.toLowerCase()}-fruit`));
  }
});

test('minimap markers are equidistant while the player remains centered', () => {
  const targets = [
    { id: 'far-right', mapPosition: 180 },
    { id: 'left', mapPosition: -70 },
    { id: 'player', mapPosition: 0 },
    { id: 'right', mapPosition: 72 },
    { id: 'far-left', mapPosition: -180 },
  ];
  const layout = layoutMinimapTargets(targets);
  assert.deepEqual(layout.map(item => item.target.id), ['far-left', 'left', 'player', 'right', 'far-right']);
  assert.equal(layout[2].leftPercent, 50);
  assert.deepEqual(layout.map(item => item.leftPercent), [6, 28, 50, 72, 94]);
});

test('uneven sides keep equal spacing without moving the player', () => {
  const layout = layoutMinimapTargets([
    { id: 'player', mapPosition: 0 },
    { id: 'near-right', mapPosition: 20 },
    { id: 'far-right', mapPosition: 100 },
  ]);
  assert.deepEqual(layout.map(item => item.leftPercent), [50, 72, 94]);
});
