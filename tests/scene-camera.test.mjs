import test from 'node:test';
import assert from 'node:assert/strict';
import { centeredSceneOffset, comparisonCameraFrame, COMPARISON_CAMERA_TIMING, interpolateSceneCamera, isValidSceneCamera, sceneSafeViewport, stageSceneOccupancy, STAGE_SCENE_OCCUPANCY, targetSceneZoom } from '../ui/scene-camera.js';

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

test('landscape action dock reserves the right side instead of collapsing scene height',()=>{
  const safe=sceneSafeViewport({
    canvasRect:{left:0,top:0,width:1200,height:448},
    minimapRect:{bottom:160,height:70},
    hudRect:{left:654,top:120,width:536,height:288},
    started:true,
    margin:8,
  });
  assert.deepEqual(safe,{width:1200,height:448,topInset:168,bottomInset:0,leftInset:0,rightInset:554,renderHeight:448});
  assert.deepEqual(centeredSceneOffset({x:500,y:180,width:60,height:80},safe),{x:-207,y:88});
  assert.ok(targetSceneZoom({width:60,height:80},safe,{stageName:'Seedling'})>1.5);
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

test('tree comparison pans at shared scale before changing zoom',()=>{
  const from={x:40,groundY:520,worldZoom:18};
  const to={x:-120,groundY:470,worldZoom:1.8};
  const panX=-300;
  const midPan=comparisonCameraFrame({from,panX,to,elapsed:COMPARISON_CAMERA_TIMING.pan/2});
  assert.equal(midPan.phase,'pan');
  assert.equal(midPan.worldZoom,from.worldZoom);
  assert.equal(midPan.groundY,from.groundY);
  assert.ok(midPan.x<from.x&&midPan.x>panX);
  const pause=comparisonCameraFrame({from,panX,to,elapsed:COMPARISON_CAMERA_TIMING.pan+COMPARISON_CAMERA_TIMING.pause/2});
  assert.deepEqual(pause,{phase:'pause',done:false,x:panX,groundY:from.groundY,worldZoom:from.worldZoom});
  const midZoom=comparisonCameraFrame({from,panX,to,elapsed:COMPARISON_CAMERA_TIMING.pan+COMPARISON_CAMERA_TIMING.pause+COMPARISON_CAMERA_TIMING.zoom/2});
  assert.equal(midZoom.phase,'zoom');
  assert.ok(midZoom.worldZoom<from.worldZoom&&midZoom.worldZoom>to.worldZoom);
  assert.ok(midZoom.groundY<from.groundY&&midZoom.groundY>to.groundY);
  const done=comparisonCameraFrame({from,panX,to,elapsed:Infinity});
  assert.deepEqual(done,{phase:'done',done:true,...to});
});
