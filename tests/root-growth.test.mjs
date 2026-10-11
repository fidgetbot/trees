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
 const calls=[],ctx={drawImage:(...args)=>calls.push(args)},image={width:600,height:900};
 const geometry={width:40,height:60,groundRatio:.5,rootStart:.7};
 drawRootGrowth(ctx,image,null,geometry,{presentationStage:'Seedling',rootZones:3});
 assert.ok(calls.every(c=>c[0]===image));
 assert.deepEqual(calls[0].slice(5),[-20,-30,40,42]);
 const first=calls[1],last=calls.at(-1);
 assert.equal(first[6],12,'root collar stays fixed');
 assert.ok(last[6]+last[8]>30,'root tips extend below original image');
 assert.ok(last[7]>first[7],'spread increases smoothly below collar');
});
