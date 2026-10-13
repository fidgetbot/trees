import assert from 'node:assert/strict';
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
