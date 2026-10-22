import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBotanicalRootGraph,rootExtensionFamily,rootGrowthAmount,rootGrowthBounds,rootRevealEffect,drawRootGrowth,resetRootGrowthCache} from '../ui/root-growth.js';
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
test('later stages share one persistent botanical graph with no stage reset',()=>{
 const state={rootZones:7,taprootDepth:2};
 const sapling=buildBotanicalRootGraph({...state,lifeStage:{name:'Sapling'}});
 const ancient=buildBotanicalRootGraph({...state,lifeStage:{name:'Ancient'}});
 assert.deepEqual(ancient,sapling);
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
