import test from 'node:test';
import assert from 'node:assert/strict';
import { autosaveSummary, clearAutosave, loadAutosave, SAVE_KEY, saveAutosave } from '../ui/save-game.js';

function storage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
}

const stages = { Seed: { name: 'Seed', rank: 0 }, Sapling: { name: 'Sapling', rank: 3 } };
const initial = () => ({
  started: false,
  selectedSpecies: null,
  lifeStage: stages.Seed,
  eventModifiers: { drought: 1, disease: 1 },
  reproductionHistory: { flowersGrown: 0, fruitGrown: 0 },
  resourceShortageStreaks: { sunlight: 0, water: 0, nutrients: 0 },
  resourceNudgeLevels: { sunlight: 0, water: 0, nutrients: 0 },
});

test('autosave round-trips a living run and restores canonical/default state', () => {
  const store = storage();
  const state = {
    ...initial(), started: true, selectedSpecies: 'Pear', lifeStage: { name: 'Sapling', rank: 999 },
    year: 4, seasonIndex: 2, sunlight: 17, eventModifiers: { drought: .5 },
  };
  assert.equal(saveAutosave(state, store, () => 1234), true);
  const save = loadAutosave({ storage: store, createInitialState: initial, stageByName: stages, speciesNames: ['Pear'] });
  assert.equal(save.savedAt, 1234);
  assert.equal(save.state.sunlight, 17);
  assert.equal(save.state.lifeStage, stages.Sapling);
  assert.deepEqual(save.state.eventModifiers, { drought: .5, disease: 1 });
  assert.equal(autosaveSummary(save, [{ name: 'Spring' }, { name: 'Summer' }, { name: 'Autumn' }]), 'Pear · Sapling · Year 4, Autumn');
});

test('autosave is not created before play and is cleared when a run ends', () => {
  const store = storage();
  assert.equal(saveAutosave(initial(), store), false);
  store.setItem(SAVE_KEY, 'old');
  assert.equal(saveAutosave({ ...initial(), started: true, gameOver: true, selectedSpecies: 'Pear' }, store), false);
  assert.equal(store.getItem(SAVE_KEY), null);
});

test('invalid, corrupt, and explicitly cleared saves cannot be resumed', () => {
  const store = storage();
  store.setItem(SAVE_KEY, '{broken');
  assert.equal(loadAutosave({ storage: store, createInitialState: initial, stageByName: stages, speciesNames: ['Pear'] }), null);
  assert.equal(store.getItem(SAVE_KEY), null);
  store.setItem(SAVE_KEY, JSON.stringify({ version: 1, state: { started: true, selectedSpecies: 'Oak', lifeStage: { name: 'Seed' } } }));
  assert.equal(loadAutosave({ storage: store, createInitialState: initial, stageByName: stages, speciesNames: ['Pear'] }), null);
  assert.equal(store.getItem(SAVE_KEY), null);
  store.setItem(SAVE_KEY, 'anything');
  clearAutosave(store);
  assert.equal(store.getItem(SAVE_KEY), null);
});
