import test from 'node:test';
import assert from 'node:assert/strict';
import {JOIN_STAGES,buildJoinedRootGraph,joinedRootClocks,joinedRootBounds,getJoinProfile,compressedRootInvestment} from '../ui/painted-root-joins.js';
import {getTreeStructureGeometry} from '../ui/canvas.js';
import {JOIN_PROFILES} from '../ui/root-join-profiles.js';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const state=(name='Sapling',extra={})=>({selectedSpecies:'Cherry',lifeStage:{name},rootZones:12,taprootDepth:3,turnsInStage:0,...extra});
const graph=s=>buildJoinedRootGraph(s);
test('painted joins preserve the complete canonical graph at actual woody age thresholds',()=>{
 for(let i=0;i<3;i++){
  const before=state(JOIN_STAGES[i],{turnsInStage:[32,48,48][i]});
  const after={...before,lifeStage:{name:JOIN_STAGES[i+1]},turnsInStage:0};
  assert.deepEqual(graph(after),graph(before));
 }
});
test('every root investment extends existing paths without moving or deleting them',()=>{
 for(const stage of JOIN_STAGES)for(const roots of [2,12,40,100])for(const deepen of [false,true]){
  const s=state(stage,{rootZones:roots,taprootDepth:1});
  const before=graph(s),after=graph({...s,rootZones:roots+1,taprootDepth:1+Number(deepen)});
  const byId=new Map(after.nodes.map(n=>[n.id,n]));
  for(const n of before.nodes){const a=byId.get(n.id);assert.ok(a);assert.deepEqual(a.p,n.p);assert.ok(a.end>=n.end);assert.ok(a.w>=n.w);}
  assert.ok(after.nodes[0].end>before.nodes[0].end);
  const center=nodes=>nodes.find(n=>n.id==='axis-2').end;
  assert.ok(center(after.nodes)>center(before.nodes));
  if(deepen)assert.ok(center(after.nodes)-center(before.nodes)>after.nodes[0].end-before.nodes[0].end);
 }
});
test('new branches are attached only to reached parent tissue and are thinner',()=>{
 for(let roots=1;roots<=50;roots++){
  const nodes=graph(state('Young Tree',{rootZones:roots})).nodes,byId=new Map(nodes.map(n=>[n.id,n]));
  for(const n of nodes.filter(n=>n.parent)){
   const parent=byId.get(n.parent);assert.ok(n.w<parent.w);
   const index=Number(n.id.split('-').at(-1));
   assert.ok(parent.end>(n.order===2?.45+index*.25:.32+index*.105));
  }
 }
});
test('late root investments stay visible while their rendered complexity grows sublinearly',()=>{
 assert.equal(compressedRootInvestment(12),12);
 assert.equal(compressedRootInvestment(13),13);
 assert.ok(compressedRootInvestment(100)<22);
 const ordinary=graph(state('Ancient',{rootZones:20,taprootDepth:5}));
 const extreme=graph(state('Ancient',{rootZones:200,taprootDepth:50}));
 assert.ok(extreme.nodes.length>ordinary.nodes.length);
 assert.ok(extreme.nodes.length<ordinary.nodes.length*3);
});
test('reveal uses authoritative state, reaches exact final graph, and survives JSON/older state shapes',()=>{
 const s=state('Mature Tree'),next={...s,rootZones:13,taprootDepth:4},from={roots:12,taproots:3};
 assert.deepEqual(buildJoinedRootGraph(next,{from,progress:0}),graph(s));
 assert.deepEqual(buildJoinedRootGraph(next,{from,progress:1}),graph(next));
 assert.deepEqual(graph(JSON.parse(JSON.stringify(next))),graph(next));
 const old={selectedSpecies:'Cherry',presentationStage:'Sapling',rootZones:5};
 assert.ok(Number.isFinite(joinedRootClocks(old).deep));
 assert.ok(graph(old).nodes.every(n=>Number.isFinite(n.end)));
});
test('joined geometry, bounds and juvenile exclusion share the correct source measurements',()=>{
 for(const stage of JOIN_STAGES){
  const s=state(stage),key=stage.toLowerCase().replaceAll(' ','-'),p=getJoinProfile('Cherry',stage),g=getTreeStructureGeometry(key,s);
  assert.equal(g.anchorX,p.cx/p.sourceWidth);
  assert.equal(g.groundRatio,p.cutY/p.sourceHeight);
  assert.ok(Math.abs(g.width/g.height-p.sourceWidth/p.sourceHeight)<1e-10);
  const before=joinedRootBounds(g,s),after=joinedRootBounds(g,{...s,rootZones:100});
  assert.ok(after.width>=before.width);assert.ok(after.height>before.height);
 }
 for(const stage of ['Seed','Sprout','Seedling'])assert.equal(getJoinProfile('Cherry',stage),null);
});
test('all 24 approved patches and original paintings retain their exact hashes',()=>{
 const provenance=JSON.parse(readFileSync(new URL('../assets/trees/joins/provenance.json',import.meta.url)));
 assert.equal(provenance.patches.length,24);assert.equal(Object.keys(JOIN_PROFILES).length,24);
 const hash=file=>createHash('sha256').update(readFileSync(new URL(file,import.meta.url))).digest('hex');
 for(const p of provenance.patches){
  assert.equal(hash(`../assets/trees/joins/${p.id}.png`),p.sha256);
  assert.equal(hash(`../assets/trees/${p.id}-v1.png`),p.masterSha256);
 }
});
test('every species keeps a nonshrinking biological collar through the woody lifecycle',()=>{
 const scales=[.5,.82,1.45,1.75];
 for(const species of ['Cherry','Plum','Apricot','Peach','Pear','Citrus']){
  let previous=0;
  for(const [i,stage] of JOIN_STAGES.entries()){
   const p=getJoinProfile(species,stage);assert.ok(p);
   const g=getTreeStructureGeometry(stage.toLowerCase().replaceAll(' ','-'),{selectedSpecies:species,lifeStage:{name:stage}});
   const width=p.sourceCollar*g.width/p.sourceWidth*scales[i];
   assert.ok(width>previous,`${species} ${stage} collar does not regress`);previous=width;
  }
 }
});
