import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { TURNS_PER_SEASON } from '../core/constants.js';
import { renderEncounterArt } from '../ui/fauna-art.js';
import { renderSeasonChangeBody, seasonChangePresentation, seasonProgress } from '../ui/seasons.js';

test('season progress covers the four-turn season and clamps invalid values', () => {
  assert.equal(TURNS_PER_SEASON, 4);
  assert.deepEqual(seasonProgress(1), { turn: 1, total: 4, degrees: 90, label: 'Turn 1 of 4' });
  assert.deepEqual(seasonProgress(2), { turn: 2, total: 4, degrees: 180, label: 'Turn 2 of 4' });
  assert.deepEqual(seasonProgress(3), { turn: 3, total: 4, degrees: 270, label: 'Turn 3 of 4' });
  assert.deepEqual(seasonProgress(4), { turn: 4, total: 4, degrees: 360, label: 'Turn 4 of 4' });
  assert.equal(seasonProgress(99).turn, 4);
  assert.equal(seasonProgress(0).turn, 1);
});

test('opening screen uses Put down roots as its only subtitle', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<span class="botanical-kicker">Put down roots\.<\/span>/);
  assert.doesNotMatch(html, /A life in the grove/);
  assert.doesNotMatch(html, /class="intro-footnote"/);
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
