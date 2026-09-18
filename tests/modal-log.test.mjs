import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildPopupLogMessage, modalPlainText } from '../ui/modal.js';

test('popup prose such as A Quiet Urge can be recorded cleanly in the log', () => {
  const body = '<p><em>The seasons work on you in silence. Change is coming.</em></p>';
  assert.equal(modalPlainText(body), 'The seasons work on you in silence. Change is coming.');
  assert.equal(
    buildPopupLogMessage('A Quiet Urge', body),
    'A Quiet Urge: The seasons work on you in silence. Change is coming.',
  );
});

test('player-facing source does not mention renderer or map visibility', () => {
  const files = ['../core/actions.js', '../core/constants.js', '../core/events.js', '../core/humans.js'];
  const source = files.map(file => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n');
  assert.doesNotMatch(source, /remain visible|visible on (?:the )?map|shown on (?:the )?map/i);
});
