import test from 'node:test';
import assert from 'node:assert/strict';
import { centeredSceneOffset, interpolateSceneCamera, targetSceneZoom } from '../ui/scene-camera.js';

const viewport = { width: 390, height: 720, topInset: 126, bottomInset: 190 };

test('neighbor framing fits the subject and leaves room for controls', () => {
  assert.ok(Math.abs(targetSceneZoom({ width: 80, height: 160 }, viewport) - 2.5207843137) < .000001);
  assert.deepEqual(centeredSceneOffset({ x: 500, y: 170, width: 120, height: 260 }, viewport), { x: -365, y: 28 });
});

test('player framing always returns to the canonical zoom', () => {
  assert.equal(targetSceneZoom({ width: 20, height: 40 }, viewport, { player: true }), 1);
});

test('camera interpolation reaches both exact endpoints', () => {
  const from = { x: 0, y: 0, zoom: 1 };
  const to = { x: -240, y: 90, zoom: 1.8 };
  assert.deepEqual(interpolateSceneCamera(from, to, 0), from);
  assert.deepEqual(interpolateSceneCamera(from, to, 1), to);
});
