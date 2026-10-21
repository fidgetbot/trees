import test from 'node:test';
import assert from 'node:assert/strict';
import { centeredSceneOffset, containmentSceneOffset, containmentSceneZoom, comparisonCameraDuration, comparisonCameraFrame, COMPARISON_CAMERA_TIMING, interpolateSceneCamera, isTreeSceneTarget, isValidSceneCamera, sceneSafeViewport, stageSceneOccupancy, STAGE_SCENE_OCCUPANCY, targetSceneZoom } from '../ui/scene-camera.js';

const viewport = { width: 390, height: 720, topInset: 126, bottomInset: 190 };

test('only tree selections enter the framing camera',()=>{
  assert.equal(isTreeSceneTarget({type:'player-tree'}),true);
  assert.equal(isTreeSceneTarget({type:'neighbor-tree'}),true);
  assert.equal(isTreeSceneTarget({type:'offspring-tree'}),true);
  assert.equal(isTreeSceneTarget({type:'wildlife',kind:'woodpecker'}),false);
  assert.equal(isTreeSceneTarget({type:'human',kind:'logger'}),false);
});

test('off-center tree anchors approach their final screen position without crossing or reversing',()=>{
  for(const worldX of [-240,-120,0,120,240])for(const [startZoom,endZoom] of [[18,1.8],[1.8,18],[5,5]]){
    const from={x:35,groundY:500,worldZoom:startZoom};
    const to={x:-worldX*endZoom-20,groundY:450,worldZoom:endZoom};
    const start=worldX*startZoom+from.x,end=worldX*endZoom+to.x;
    let previous=start;
    for(let elapsed=0;elapsed<=1000;elapsed+=5){
      const frame=comparisonCameraFrame({from,panX:-worldX*startZoom,to,elapsed});
      const screenX=worldX*frame.worldZoom+frame.x;
      assert.ok(screenX>=Math.min(start,end)-1e-8&&screenX<=Math.max(start,end)+1e-8,`overshoot: world ${worldX}, zoom ${startZoom}→${endZoom}, t=${elapsed}`);
      assert.ok((screenX-previous)*Math.sign(end-start)>=-1e-8,`reversal: world ${worldX}, t=${elapsed}`);
      previous=screenX;
    }
  }
});

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

test('tree comparison interpolates pan, scale, and soil line through one eased motion',()=>{
  const from={x:40,groundY:520,worldZoom:18};
  const to={x:-120,groundY:470,worldZoom:1.8};
  const panX=-300;
  const middle=comparisonCameraFrame({from,panX,to,elapsed:400,duration:800});
  assert.equal(middle.phase,'transition');
  assert.equal(middle.worldZoom,(from.worldZoom+to.worldZoom)/2);
  assert.equal(middle.groundY,(from.groundY+to.groundY)/2);
  const early=comparisonCameraFrame({from,panX,to,elapsed:80,duration:800});
  assert.ok(early.worldZoom<from.worldZoom&&early.worldZoom>to.worldZoom);
  assert.ok(early.groundY<from.groundY&&early.groundY>to.groundY);
  const done=comparisonCameraFrame({from,panX,to,elapsed:Infinity,duration:800});
  assert.deepEqual(done,{phase:'done',done:true,...to});
});

test('comparison duration grows with grove travel while scale changes get a bounded allowance',()=>{
  const sameScale={worldZoom:4};
  const adjacent=comparisonCameraDuration({from:sameScale,to:sameScale,travelFraction:.25});
  const centerToEdge=comparisonCameraDuration({from:sameScale,to:sameScale,travelFraction:.5});
  const edgeToEdge=comparisonCameraDuration({from:sameScale,to:sameScale,travelFraction:1});
  assert.equal(adjacent,563);
  assert.equal(centerToEdge,675);
  assert.equal(edgeToEdge,900);
  assert.ok(adjacent<centerToEdge&&centerToEdge<edgeToEdge);
  assert.equal(comparisonCameraDuration({from:{worldZoom:20},to:{worldZoom:1},travelFraction:0}),593);
  assert.ok(adjacent>=COMPARISON_CAMERA_TIMING.minimumDuration);
  assert.ok(edgeToEdge<=COMPARISON_CAMERA_TIMING.maximumDuration);
});

test('comparison scale follows the same reversible linear path in both directions',()=>{
  const out=comparisonCameraFrame({from:{x:0,groundY:500,worldZoom:1},panX:-100,to:{x:-20,groundY:450,worldZoom:16},elapsed:500,duration:1000});
  const inward=comparisonCameraFrame({from:{x:0,groundY:500,worldZoom:16},panX:-100,to:{x:-20,groundY:450,worldZoom:1},elapsed:500,duration:1000});
  assert.equal(out.worldZoom,8.5);
  assert.equal(inward.worldZoom,8.5);
});

test('growth beyond stage occupancy keeps scale until the usable region is full', () => {
  const camera = { x: 0, y: 0, zoom: 1 };
  const grown = { x: 80, y: 160, width: 230, height: 330 };
  assert.equal(containmentSceneZoom(grown, viewport, camera.zoom), 1);
  assert.deepEqual(containmentSceneOffset(grown, viewport, camera), { x: 0, y: 0 });
  assert.ok(targetSceneZoom(grown, viewport, { stageName: 'Seedling' }) < 1, 'old occupancy fitting would shrink this growth');
});

test('containment moves a fitting tree minimally and shrinks oversized bounds only', () => {
  assert.deepEqual(containmentSceneOffset({ x: 80, y: 130, width: 230, height: 330 }, viewport, { x: 0, y: 0 }), { x: 0, y: 8 });
  assert.equal(containmentSceneZoom({ width: 732, height: 200 }, viewport, 2), 1);
  assert.equal(containmentSceneZoom({ width: 200, height: 760 }, viewport, 2), 1);
});
