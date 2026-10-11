import test from 'node:test';
import assert from 'node:assert/strict';
import { centeredSceneOffset, interpolateSceneCamera, targetSceneZoom } from '../ui/scene-camera.js';

const viewport = { width: 390, height: 720, topInset: 126, bottomInset: 190 };

test('neighbor framing fits the subject and leaves room for controls', () => {
  assert.equal(targetSceneZoom({ width: 80, height: 160 }, viewport),2.525);
  assert.deepEqual(centeredSceneOffset({ x: 500, y: 170, width: 120, height: 260 }, viewport), { x: -365, y: 28 });
});

test('tiny subjects can grow to fill the same safe region', () => {
  assert.equal(targetSceneZoom({ width: 20, height: 40 }, viewport), 10.1);
});

test('iterative fitting adjusts the current zoom instead of resetting it',()=>{
  assert.equal(targetSceneZoom({width:240,height:404},viewport,{currentZoom:2}),2);
});

test('camera interpolation reaches both exact endpoints', () => {
  const from = { x: 0, y: 0, zoom: 1 };
  const to = { x: -240, y: 90, zoom: 1.8 };
  assert.deepEqual(interpolateSceneCamera(from, to, 0), from);
  assert.deepEqual(interpolateSceneCamera(from, to, 1), to);
});
