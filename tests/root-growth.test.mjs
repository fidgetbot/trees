import test from 'node:test';
import assert from 'node:assert/strict';
import {rootGrowthAmount,drawRootGrowth} from '../ui/root-growth.js';
test('juvenile root investments persist across leaf and stage changes',()=>{
 const s={lifeStage:{name:'Sprout'},rootZones:4,visualGrowth:{structuralBase:{roots:4,taproots:0}}};
 assert.equal(rootGrowthAmount(s),3);
 s.lifeStage={name:'Seedling'};assert.equal(rootGrowthAmount(s),3);
 const reveal={from:{roots:3,taproots:0},progress:0};
 assert.equal(rootGrowthAmount(s,reveal),2);
 reveal.progress=.5;assert.equal(rootGrowthAmount(s,reveal),2.5);
 reveal.progress=1;assert.equal(rootGrowthAmount(s,reveal),rootGrowthAmount(s));
});
test('root deformation preserves the collar and increases depth without separate stamps',()=>{
 const calls=[],rows=[],ctx={drawImage:(...args)=>calls.push(args)},image={width:600,height:900};
 const original=globalThis.document;
 globalThis.document={createElement:()=>({getContext:()=>({drawImage:(...args)=>rows.push(args)})})};
 const geometry={width:40,height:60,groundRatio:.5,rootStart:.7};
 try{
  drawRootGrowth(ctx,image,null,geometry,{presentationStage:'Seedling',rootZones:3});
  assert.equal(calls.length,1,'screen receives one connected raster');
  assert.ok(rows.every(r=>r[0]===image),'all root pixels come from the same specimen');
  assert.equal(rows[1][6],630,'first root row starts at the unchanged collar');
  assert.ok(rows.slice(1).every(r=>Number.isInteger(r[6])&&r[8]===1),'raster rows are contiguous, integral and gap-free');
  assert.ok(calls[0][4]>60,'root depth grows');
  assert.ok(calls[0][3]>40,'root spread grows');
 }finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
});
