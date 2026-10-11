import test from 'node:test';
import assert from 'node:assert/strict';
import { centeredSceneOffset, interpolateSceneCamera, isValidSceneCamera, stageSceneOccupancy, STAGE_SCENE_OCCUPANCY, targetSceneZoom } from '../ui/scene-camera.js';

const viewport = { width: 390, height: 720, topInset: 126, bottomInset: 190 };

test('stage framing occupies a monotonic share of the safe region', () => {
  assert.equal(targetSceneZoom({ width: 80, height: 160 }, viewport,{stageName:'Sapling'}),1.515);
  assert.deepEqual(Object.values(STAGE_SCENE_OCCUPANCY),[.24,.34,.46,.6,.72,.84,.92]);
  for(const [younger,older] of [['Seed','Sprout'],['Sprout','Seedling'],['Seedling','Sapling'],['Sapling','Young Tree'],['Young Tree','Mature Tree'],['Mature Tree','Ancient']])assert.ok(stageSceneOccupancy(older)>stageSceneOccupancy(younger));
  assert.deepEqual(centeredSceneOffset({ x: 500, y: 170, width: 120, height: 260 }, viewport), { x: -365, y: 28 });
});

test('tiny subjects remain readable without reaching an extreme zoom', () => {
  assert.equal(targetSceneZoom({ width: 20, height: 40 }, viewport,{stageName:'Seed'}),2.424);
  assert.equal(targetSceneZoom({ width: 1, height: 1 }, viewport,{stageName:'Seed'}),3.2);
});

test('iterative fitting adjusts the current zoom instead of resetting it',()=>{
  assert.equal(targetSceneZoom({width:240,height:404},viewport,{currentZoom:2,stageName:'Ancient'}),1.84);
});

test('invalid measurements cannot create an invalid camera',()=>{
  assert.equal(targetSceneZoom({width:NaN,height:40},viewport,{stageName:'Seed'}),1);
  assert.equal(isValidSceneCamera({x:0,y:0,zoom:1}),true);
  assert.equal(isValidSceneCamera({x:0,y:0,zoom:.04}),true);
  assert.equal(isValidSceneCamera({x:0,y:0,zoom:.03}),false);
  assert.equal(isValidSceneCamera({x:0,y:Infinity,zoom:1}),false);
  assert.equal(isValidSceneCamera({x:0,y:0,zoom:12}),false);
});

test('camera interpolation reaches both exact endpoints', () => {
  const from = { x: 0, y: 0, zoom: 1 };
  const to = { x: -240, y: 90, zoom: 1.8 };
  assert.deepEqual(interpolateSceneCamera(from, to, 0), from);
  assert.deepEqual(interpolateSceneCamera(from, to, 1), to);
});
