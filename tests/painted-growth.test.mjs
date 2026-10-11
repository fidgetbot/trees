import assert from 'node:assert/strict';
import test from 'node:test';
import {getPaintedGrowthPlan,syncGrowthAttachments,growthReveal,leafReveal,drawGrowthLeaves} from '../ui/painted-growth.js';
const geometry={width:40,height:60,groundRatio:.57};
const state=()=>({selectedSpecies:'Peach',rootZones:2,leafClusters:3,branches:0});

test('every root, leaf, and branch investment adds a persistent identified part',()=>{
 const s=state();syncGrowthAttachments(s);const before=getPaintedGrowthPlan(s,'Sprout',geometry);
 s.rootZones++;s.leafClusters++;s.branches++;syncGrowthAttachments(s);
 const after=getPaintedGrowthPlan(s,'Sprout',geometry);
 assert.equal(after.roots.length,before.roots.length+1);assert.deepEqual(after.roots.slice(0,-1),before.roots);
 assert.equal(after.leaves.length,before.leaves.length+1);assert.deepEqual(after.leaves.slice(0,-1),before.leaves);
 assert.equal(after.branches.length,before.branches.length+1);
 assert.equal(after.leaves.at(-1).host,0,'new foliage can attach to a new branch');
});

test('adding another branch does not move existing leaves to a different host',()=>{
 const s=state();s.branches=1;syncGrowthAttachments(s);const hosts=[...s.visualGrowth.leafHosts];
 s.branches=2;syncGrowthAttachments(s);assert.deepEqual(s.visualGrowth.leafHosts,hosts);
 s.leafClusters++;syncGrowthAttachments(s);assert.equal(s.visualGrowth.leafHosts.at(-1),1);
 assert.deepEqual(s.visualGrowth.leafHosts.slice(0,-1),hosts);
});

test('growth IDs and attachment ownership survive a stage transition',()=>{
 const s=state();syncGrowthAttachments(s);
 const early=getPaintedGrowthPlan(s,'Sprout',geometry),later=getPaintedGrowthPlan(s,'Seedling',{width:50,height:75,groundRatio:.56});
 for(const family of ['roots','leaves','branches'])assert.deepEqual(early[family].map(x=>x.id),later[family].map(x=>x.id));
 assert.deepEqual(early.leaves.map(x=>x.host),later.leaves.map(x=>x.host));
});

test('foliage loss removes the newest parts and dormant winter draws no foliage',()=>{
 const s=state();syncGrowthAttachments(s);s.leafClusters=1;syncGrowthAttachments(s);assert.equal(s.visualGrowth.leafHosts.length,1);
 drawGrowthLeaves({}, {leaves:[{index:0}]},null,'Winter',()=>{throw Error('winter must not draw green leaves')});
 s.leafClusters=0;syncGrowthAttachments(s);assert.equal(getPaintedGrowthPlan(s,'Sprout',geometry).leaves.length,0);
});

test('new growth animates without shrinking old parts or stopping at the old foliage cap',()=>{
 const reveal={from:{roots:2,leaves:3,branches:1},progress:.4};
 assert.equal(growthReveal(1,'roots',reveal),1);assert.equal(growthReveal(2,'roots',reveal),.4);
 assert.equal(growthReveal(2,'leaves',reveal),1);assert.equal(growthReveal(3,'leaves',reveal),.4);
 const s=state();s.leafClusters=20;syncGrowthAttachments(s);assert.equal(getPaintedGrowthPlan(s,'Sapling',geometry).leaves.length,20);
});

test('deepening the taproot extends its persistent painted module',()=>{
 const s={...state(),taprootDepth:1};const first=getPaintedGrowthPlan(s,'Sapling',geometry).roots.find(r=>r.id==='taproot');
 s.taprootDepth++;const next=getPaintedGrowthPlan(s,'Sapling',geometry).roots.find(r=>r.id==='taproot');
 assert.ok(next.dy>first.dy);assert.equal(next.u,first.u);assert.equal(next.v,first.v);
});

test('new branch leaves cannot float ahead of their growing support',()=>{
 const leaf={index:3,host:0};
 assert.equal(leafReveal(leaf,{from:{leaves:3,branches:0},progress:.4}),0);
 assert.ok(leafReveal(leaf,{from:{leaves:3,branches:0},progress:.9})>0);
 assert.equal(leafReveal(leaf,{from:{leaves:4,branches:1},progress:.4}),1);
});
