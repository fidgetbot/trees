import assert from 'node:assert/strict';
import test from 'node:test';

import { getNeighborStage, getRelationshipState, LIFE_STAGES } from '../core/constants.js';
import { describeGroveRelationships, renderGroveRelationships } from '../ui/grove-relationships.js';

const youngTree = LIFE_STAGES.find(stage => stage.name === 'Young Tree');

function sampleState() {
  return {
    lifeStage: youngTree,
    heightGrowth: 0,
    taprootDepth: 0,
    groveRelationshipReport: {
      allyWater: 1,
      allyNutrients: 1,
      canopySunlightLoss: 2,
      rootNutrientsLost: 1,
      rootCompetitionDefense: 0,
      hostileWaterLost: 0,
      crowdingSlots: [3],
      contestedSlots: [3],
      blockedRootSlots: [],
      hostileSlots: [],
    },
    neighbors: [
      {
        slot: 0,
        species: 'Peach',
        relation: 78,
        stageScore: youngTree.threshold,
        dead: false,
        health: 10,
        maxHealth: 10,
        reserves: { sunlight: 14, water: 13, nutrients: 5 },
        rhizosphereBonus: 1.5,
        helpGivenToThem: 4,
        helpReceivedFromThem: 3,
        timesAskedThemForHelp: 3,
      },
      {
        slot: 3,
        species: 'Pear',
        relation: -34,
        stageScore: youngTree.threshold,
        heightGrowth: 2,
        shadingPlayer: true,
        dead: false,
      },
      { slot: 1, species: 'Cherry', relation: 0, stageScore: 600, dead: false },
      { slot: 4, species: 'Plum', relation: 80, stageScore: 600, dead: true },
    ],
  };
}

test('notebook relationship view condenses exact ally support and rival pressure', () => {
  const view = describeGroveRelationships(sampleState(), { getRelationshipState, getNeighborStage });

  assert.deepEqual(view.totals, {
    allyWater: 1,
    allyNutrients: 1,
    canopySunlightLoss: 2,
    rootNutrientsLost: 1,
    hostileWaterLost: 0,
  });
  assert.equal(view.allies.length, 1);
  assert.equal(view.allies[0].relationshipText, '+78 above neutral');
  assert.equal(view.allies[0].feeling, 'warm and secure');
  assert.equal(view.allies[0].enrichments, 3);
  assert.equal(view.allies[0].rhizosphereGrowth, 6);
  assert.equal(view.allies[0].rhizosphereNutrients, 3);
  assert.equal(view.allies[0].favorBalance, 1);

  assert.equal(view.rivals.length, 1);
  assert.equal(view.rivals[0].relationshipText, '−34 below neutral');
  assert.equal(view.rivals[0].feeling, 'actively competitive');
  assert.equal(view.rivals[0].heightDifference, 2);
  assert.equal(view.rivals[0].sunlightLoss, 2);
  assert.equal(view.rivals[0].rootPressure, 1);
  assert.equal(view.rivals[0].rootBlockedTotal, 0);
  assert.equal(view.rivals[0].nutrientLossTotal, 1);
});

test('rendered notebook omits redundant paragraphs and excluded neighbors', () => {
  const html = renderGroveRelationships(sampleState(), { getRelationshipState, getNeighborStage });

  assert.match(html, /\+78 above neutral/);
  assert.match(html, /Young Tree · fungal alliance active · warm and secure/);
  assert.match(html, /3 enrichments? · <em>\+6 growth each season · \+3 nutrients each turn · protected from Lean soil<\/em>/);
  assert.match(html, /2 levels taller, resulting in <em>−2 sunlight this turn<\/em>/);
  assert.match(html, /1 pressure · 0 blocked by deep roots, resulting in <em>−1 nutrient each turn<\/em>/);
  assert.doesNotMatch(html, /recent exchange|last gathering|why numbers|78 \/ 100|Plum|Cherry/i);
});
