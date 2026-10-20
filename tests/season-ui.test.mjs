import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { renderEncounterArt } from '../ui/fauna-art.js';
import { renderSeasonChangeBody, seasonChangePresentation, seasonProgress } from '../ui/seasons.js';

test('season progress covers the three-turn season and clamps invalid values', () => {
  assert.deepEqual(seasonProgress(1), { turn: 1, total: 3, degrees: 120, label: 'Turn 1 of 3' });
  assert.deepEqual(seasonProgress(2), { turn: 2, total: 3, degrees: 240, label: 'Turn 2 of 3' });
  assert.deepEqual(seasonProgress(3), { turn: 3, total: 3, degrees: 360, label: 'Turn 3 of 3' });
  assert.equal(seasonProgress(99).turn, 3);
  assert.equal(seasonProgress(0).turn, 1);
});

for (const season of ['Spring', 'Summer', 'Autumn', 'Winter']) {
  test(`${season} has a dedicated season-change presentation`, () => {
    const presentation = seasonChangePresentation(season, 2);
    assert.equal(presentation.season, season);
    assert.equal(presentation.sceneArt, `season-${season.toLowerCase()}`);
    assert.equal(presentation.buttonLabel, `Begin ${season}`);
    assert.match(presentation.eyebrow, /Year 2/);
    assert.match(renderSeasonChangeBody(presentation), /season-change-summary/);
    assert.ok(existsSync(new URL(`../assets/seasons/${season.toLowerCase()}-card-art-v1.png`, import.meta.url)));
    assert.match(renderEncounterArt(presentation.sceneArt), new RegExp(`${season.toLowerCase()}-card-art-v1\\.png`));
  });
}
