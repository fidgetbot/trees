import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBotanicalRootGraph,rootExtensionFamily,rootGrowthAmount,rootGrowthBounds,rootRevealEffect,drawRootGrowth,resetRootGrowthCache} from '../ui/root-growth.js';
import {rootLifetime} from '../ui/painted-root-joins.js';
import {growthRevealDuration} from '../ui/painted-growth.js';
test('root development survives every life-stage illustration handoff',()=>{
 const s={lifeStage:{name:'Sprout'},rootZones:4};
 assert.equal(rootGrowthAmount(s),3);
 s.lifeStage={name:'Seedling'};assert.equal(rootGrowthAmount(s),3);
 s.lifeStage={name:'Sapling'};assert.equal(rootGrowthAmount(s),3);
 s.lifeStage={name:'Young Tree'};assert.equal(rootGrowthAmount(s),3);
 assert.equal(rootExtensionFamily('Seedling'),'juvenile');
 assert.equal(rootExtensionFamily('Sapling'),'botanical');
 const reveal={from:{roots:3,taproots:0},progress:0};
 assert.equal(rootGrowthAmount(s,reveal),2);
 reveal.progress=.5;assert.equal(rootGrowthAmount(s,reveal),2.5);
 reveal.progress=1;assert.equal(rootGrowthAmount(s,reveal),rootGrowthAmount(s));
});
test('stage handoff sizes roots from the artwork currently being presented',()=>{
 const state={lifeStage:{name:'Young Tree'},presentationStage:'Sapling',turnsInStage:0};
 assert.equal(rootLifetime(state),rootLifetime({lifeStage:{name:'Sapling'},turnsInStage:0}));
});
test('dense repeated root and crown growth skips imperceptible per-action reveals',()=>{
 assert.equal(growthRevealDuration({roots:9,taproots:1,leaves:8,branches:4},{roots:8,taproots:1,leaves:8,branches:4}),0);
 assert.equal(growthRevealDuration({roots:4,taproots:1,leaves:11,branches:7},{roots:4,taproots:1,leaves:10,branches:7}),0);
 assert.equal(growthRevealDuration({roots:2,taproots:0,leaves:2,branches:0},{roots:1,taproots:0,leaves:2,branches:0}),900);
});
test('later stages inherit the same botanical graph without root regression',()=>{
 const state={rootZones:7,taprootDepth:2};
 const sapling=buildBotanicalRootGraph({...state,lifeStage:{name:'Sapling'}});
 const ancient=buildBotanicalRootGraph({...state,lifeStage:{name:'Ancient'}});
 for(const node of sapling.nodes){
   const inherited=ancient.nodes.find(candidate=>candidate.id===node.id);
   assert.ok(inherited,`${node.id} survives the stage handoff`);
   assert.deepEqual(inherited.curve,node.curve,'persistent paths do not move');
   assert.ok(inherited.progress>=node.progress,'existing paths never shorten');
   assert.ok(inherited.width>=node.width,'existing paths never thin');
 }
 assert.ok(ancient.nodes.length>sapling.nodes.length,'later-stage baseline adds the prototype’s inherited fine branching');
 assert.ok(sapling.nodes.some(node=>node.order>=2),'the network contains successively finer branches');
 for(const node of sapling.nodes.filter(node=>node.parent)){
   const parent=sapling.nodes.find(candidate=>candidate.id===node.parent);
   assert.ok(node.width<parent.width,'every child is thinner than its parent');
 }
});
test('Deepen Roots advances the central axes more than the spreading axes',()=>{
 const before=buildBotanicalRootGraph({rootZones:5,taprootDepth:0});
 const after=buildBotanicalRootGraph({rootZones:6,taprootDepth:1});
 assert.ok(after.deepClock-before.deepClock>after.outwardClock-before.outwardClock);
 assert.ok(after.nodes.find(node=>node.id==='root-3').progress>=before.nodes.find(node=>node.id==='root-3').progress);
});
test('the first Sapling root investment visibly advances the approved lifetime scaffold',()=>{
 const before=buildBotanicalRootGraph({rootZones:2,taprootDepth:0});
 const after=buildBotanicalRootGraph({rootZones:3,taprootDepth:0});
 assert.ok(after.outwardClock>before.outwardClock);
 for(const id of ['root-1','root-2','root-4','root-5']){
  assert.ok(after.nodes.find(node=>node.id===id).progress>before.nodes.find(node=>node.id===id).progress,`${id} extends`);
 }
});
test('root emphasis follows only new bounds and disappears at the endpoint',()=>{
 const state={presentationStage:'Seedling',rootZones:3};
 const geometry={width:40,height:60,groundRatio:.5,rootStart:.7};
 const from={roots:2,taproots:0};
 const middle=rootRevealEffect(state,{from,progress:.5},geometry);
 assert.ok(middle.current.width>middle.previous.width);
 assert.ok(middle.current.height>middle.previous.height);
 assert.equal(middle.pulse,1);
 assert.equal(rootRevealEffect(state,{from,progress:0},geometry).pulse,0);
 assert.ok(rootRevealEffect(state,{from,progress:1},geometry).pulse<1e-12);
 assert.equal(rootRevealEffect(state,{from:{roots:3,taproots:0},progress:.5},geometry),null,'leaf-only reveals do not flash roots');
});
test('the stage painting remains unchanged while extension bounds grow monotonically',()=>{
 const calls=[],ctx={drawImage:(...args)=>calls.push(args)},image={width:600,height:900};
 const geometry={width:40,height:60,groundRatio:.5,rootStart:.7};
 drawRootGrowth(ctx,image,null,geometry,{presentationStage:'Seedling',rootZones:3});
 assert.deepEqual(calls[0],[image,0,0,600,900,-20,-30,40,60]);
 const one=rootGrowthBounds(geometry,1),four=rootGrowthBounds(geometry,4);
 assert.ok(four.width>one.width&&four.height>one.height);
 resetRootGrowthCache();
});
