import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { getJuvenileStageKey, getJuvenileGeometry, getJuvenileLayerResolution, getDormantShootMaxWidthRatio } from '../ui/juvenile-growth.js';
import { getTreeStructureAssetUrl } from '../ui/canvas.js';
import { getPaintedGrowthPlan, syncGrowthAttachments } from '../ui/painted-growth.js';
import { renderGrowthChapter } from '../ui/modal.js';

test('first leaf actions select infant plants independently of root count',()=>{
  for(const roots of [1,2,20])for(const stage of ['Sprout','Seedling']) {
    assert.equal(getJuvenileStageKey({rootZones:roots,leafClusters:0},stage),null);
    for(const [leaves,key]of [[1,'first-leaves'],[2,'unfurling'],[3,'juvenile'],[20,'juvenile']])
      assert.equal(getJuvenileStageKey({rootZones:roots,leafClusters:leaves},stage),key);
  }
  assert.equal(getJuvenileStageKey({leafClusters:1},'Sapling'),null);
});

test('juvenile layer extraction stays within the phone-safe working surface',()=>{
  assert.deepEqual(getJuvenileLayerResolution(512,768),{width:256,height:384});
  assert.deepEqual(getJuvenileLayerResolution(180,270),{width:180,height:270});
});

test('winter juvenile shoots retain the terminal bud without wide petiole shards',()=>{
  assert.equal(getDormantShootMaxWidthRatio(20,384),.085);
  assert.equal(getDormantShootMaxWidthRatio(100,384),.035);
});

test('all juvenile states resolve to existing species assets and grow above a collar',()=>{
  for(const species of ['Cherry','Apricot','Citrus','Peach','Pear','Plum']) {
    let previousHeight=0;
    for(const key of ['first-leaves','unfurling','juvenile']) {
      const url=new URL(getTreeStructureAssetUrl(species,key));url.search='';assert.ok(existsSync(url));
      const g=getJuvenileGeometry(species,key);assert.ok(g.height*g.groundRatio>previousHeight);
      previousHeight=g.height*g.groundRatio;
      assert.ok(Math.abs(g.width/g.height-2/3)<1e-12);
    }
  }
});

test('pictured leaf actions are not double counted and extra leaves retain IDs',()=>{
  const s={selectedSpecies:'Cherry',rootZones:2,leafClusters:2,branches:0};syncGrowthAttachments(s);
  const early=getPaintedGrowthPlan(s,'Sprout',getJuvenileGeometry('Cherry','unfurling'));
  assert.equal(early.leaves.length,0);assert.equal(early.roots.length,0);
  s.rootZones++;s.leafClusters=5;syncGrowthAttachments(s);
  const grown=getPaintedGrowthPlan(s,'Seedling',getJuvenileGeometry('Cherry','juvenile'));
  assert.deepEqual(grown.leaves.map(l=>l.id),['leaf-3','leaf-4']);
  assert.deepEqual(grown.roots.map(r=>[r.id,r.spriteVariant]),[['root-2','radicle']]);
});

test('extra juvenile leaves attach to the foliage-free stem surface',()=>{
  const juvenile={selectedSpecies:'Apricot',rootZones:2,leafClusters:6,branches:0};syncGrowthAttachments(juvenile);
  const juvenileLeaves=getPaintedGrowthPlan(juvenile,'Seedling',getJuvenileGeometry('Apricot','juvenile')).leaves;
  assert.ok(juvenileLeaves.length>0);
  assert.ok(juvenileLeaves.every(leaf=>leaf.attachmentSurface==='stem'));
  const established=getPaintedGrowthPlan(juvenile,'Sapling',{width:80,height:120,groundRatio:.56}).leaves;
  assert.ok(established.every(leaf=>leaf.attachmentSurface==='plant'));
});

test('total leaf loss retains a juvenile stem instead of reverting to a seed',()=>{
  const s={selectedSpecies:'Cherry',leafClusters:3,branches:0};syncGrowthAttachments(s);
  s.leafClusters=0;syncGrowthAttachments(s);
  assert.equal(getJuvenileStageKey(s,'Sprout'),'juvenile');
  assert.equal(s.visualGrowth.leafHosts.length,0);
  s.selectedSpecies='Pear';syncGrowthAttachments(s);
  assert.equal(getJuvenileStageKey(s,'Sprout'),null);
});

test('early growth chapters use the same juvenile asset as the scene',()=>{
  const stage={name:'Seedling',rank:2,popup:'A young plant.'};
  assert.match(renderGrowthChapter(stage,'Cherry',[stage],'',{leafClusters:2}),/juvenile\/cherry-unfurling-v1\.png/);
  assert.match(renderGrowthChapter({...stage,name:'Sprout'},'Cherry',[stage],'',{rootedSeed:true}),/cherry-rooted-seed-v1\.png/);
});
