// Anchor feeding mouths to opaque painted tissue, in the tree's own coordinates.
// The masters remain untouched; individual insects are isolated in memory.
import { getJuvenileLayers } from './juvenile-growth.js?rev=juvenile-growth-v1';
import { leafReveal } from './painted-growth.js?rev=juvenile-growth-v1';
const pixels = new WeakMap(), specimens = new WeakMap();
export const PEST_KINDS = ['surface-crawlers', 'aphids', 'mites'];
const SPECIMENS = {
  'surface-crawlers': {seed:[300,200],mouth:[401,278],title:'Surface crawlers'},
  aphids: {seed:[160,170],mouth:[252,184],title:'Aphid cluster'},
  mites: {seed:[180,170],mouth:[185,194],title:'Mite surge'},
};
function readPixels(image, source) {
  if (pixels.has(image)) return pixels.get(image);
  const canvas=document.createElement('canvas');
  canvas.width=source?.width||image.naturalWidth||image.width;
  canvas.height=source?.height||image.naturalHeight||image.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(image,source?.x||0,source?.y||0,canvas.width,canvas.height,0,0,canvas.width,canvas.height);
  const result={width:canvas.width,height:canvas.height,data:ctx.getImageData(0,0,canvas.width,canvas.height).data,points:new Map()};
  pixels.set(image,result);return result;
}
export function nearestPaintedPoint(pixel,u,v) {
  const key=`${u}:${v}`;
  if(pixel.points?.has(key))return pixel.points.get(key);
  const x=u*pixel.width,y=v*pixel.height;let best=null,distance=Infinity;
  for(let py=0;py<pixel.height;py++)for(let px=0;px<pixel.width;px++) {
    if(pixel.data[(py*pixel.width+px)*4+3]<210)continue;
    const d=(px-x)**2+(py-y)**2;
    if(d<distance){distance=d;best={x:px/pixel.width,y:py/pixel.height};}
  }
  pixel.points?.set(key,best);return best;
}
function localPoint(image,source,geometry,u,v) {
  const p=nearestPaintedPoint(readPixels(image,source),u,v);
  return p&&{x:(p.x-(geometry.anchorX||.5))*geometry.width,y:(p.y-geometry.groundRatio)*geometry.height};
}
function specimen(image,kind) {
  if(specimens.has(image))return specimens.get(image);
  const pixel=readPixels(image),{width:w,height:h,data}=pixel,config=SPECIMENS[kind];
  const mask=new Uint8Array(w*h),queue=[config.seed[1]*w+config.seed[0]];
  mask[queue[0]]=1;let left=w,right=0,top=h,bottom=0;
  for(let i=0;i<queue.length;i++) {
    const at=queue[i],x=at%w,y=Math.floor(at/w);
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    for(const next of [x?at-1:-1,x<w-1?at+1:-1,at-w,at+w])if(next>=0&&next<w*h&&!mask[next]&&data[next*4+3]>70){mask[next]=1;queue.push(next);}
  }
  left=Math.max(0,left-2);top=Math.max(0,top-2);right=Math.min(w-1,right+2);bottom=Math.min(h-1,bottom+2);
  const canvas=document.createElement('canvas');canvas.width=right-left+1;canvas.height=bottom-top+1;
  const ctx=canvas.getContext('2d'),out=ctx.createImageData(canvas.width,canvas.height);
  for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++) {
    const at=y*w+x;
    // Keep antialiasing around this component, without neighboring insects.
    if(![at,at-1,at+1,at-w,at+w].some(n=>mask[n]))continue;
    out.data.set(data.subarray(at*4,at*4+4),((y-top)*canvas.width+x-left)*4);
  }
  ctx.putImageData(out,0,0);
  const result={image:canvas,mouth:{x:(config.mouth[0]-left)/canvas.width,y:(config.mouth[1]-top)/canvas.height}};
  specimens.set(image,result);return result;
}
function feedingSites(kind,image,source,geometry,growth,season,state,getLeafImage,reveal) {
  const center=geometry.anchorX||.5;
  const tissue=geometry.juvenile?getJuvenileLayers(image,geometry).dormant:image;
  const tissueSource=geometry.juvenile?null:source;
  if(kind==='surface-crawlers')return [.015,.15,.26].map(d=>localPoint(tissue,tissueSource,geometry,center,geometry.groundRatio+d)).filter(Boolean);
  if(kind==='mites'&&season!=='Winter'&&state.leafClusters>0) {
    if(geometry.juvenile) {
      const foliage=getJuvenileLayers(image,geometry).foliage;
      return [[.25,.22],[.72,.30],[.3,.40]].map(([u,v])=>localPoint(foliage,null,geometry,u,v)).filter(Boolean);
    }
    const sites=growth.leaves.filter(leaf=>leafReveal(leaf,reveal)>=.99).slice(0,3).flatMap(leaf=>{
      const art=getLeafImage(leaf.index);if(!art)return[];
      const p=nearestPaintedPoint(readPixels(art),.35,.4);if(!p)return[];
      const width=leaf.width,height=width*art.naturalHeight/art.naturalWidth;
      const x=(p.x-.48)*width,y=(p.y-.56)*height,angle=leaf.side*.12;
      return [{x:leaf.end.x+leaf.side*(Math.cos(angle)*x-Math.sin(angle)*y),y:leaf.end.y+Math.sin(angle)*x+Math.cos(angle)*y}];
    });
    if(sites.length)return sites;
  }
  // Sap feeders stay on the stem; leafless/winter mites use bark, not empty sky.
  return [.4,.62,.84].map(v=>localPoint(tissue,tissueSource,geometry,center,geometry.groundRatio*v)).filter(Boolean);
}
export function drawAttachedPests({ctx,state,kinds,image,source,geometry,growth,season,getImage,getLeafImage,reveal,toScreen,scale}) {
  const targets=[];
  for(const kind of kinds.filter(kind=>PEST_KINDS.includes(kind))) {
    const art=getImage(kind);if(!art)continue;
    const sprite=specimen(art,kind),sites=feedingSites(kind,image,source,geometry,growth,season,state,getLeafImage,reveal);
    const width=geometry.width*(geometry.juvenile?.105:.055),height=width*sprite.image.height/sprite.image.width;
    const boxes=[],feedingPoints=[];
    sites.forEach((point,index)=>{
      const flip=index%2?-1:1,angle=(index-1)*.3;
      ctx.save();ctx.translate(point.x,point.y);ctx.rotate(angle);ctx.scale(flip,1);
      ctx.drawImage(sprite.image,-width*sprite.mouth.x,-height*sprite.mouth.y,width,height);ctx.restore();
      const contact=toScreen(point);feedingPoints.push(contact);
      const corners=[[0,0],[1,0],[0,1],[1,1]].map(([u,v])=>{
        const dx=flip*(u-sprite.mouth.x)*width,dy=(v-sprite.mouth.y)*height;
        return toScreen({x:point.x+Math.cos(angle)*dx-Math.sin(angle)*dy,y:point.y+Math.sin(angle)*dx+Math.cos(angle)*dy});
      });boxes.push(...corners);
    });
    if(boxes.length){const xs=boxes.map(p=>p.x),ys=boxes.map(p=>p.y),pad=Math.min(8,3*scale);
      targets.push({id:`wildlife-${kind}`,type:'wildlife',kind,title:SPECIMENS[kind].title,feedingPoints,
        bounds:{x:Math.min(...xs)-pad,y:Math.min(...ys)-pad,width:Math.max(...xs)-Math.min(...xs)+2*pad,height:Math.max(...ys)-Math.min(...ys)+2*pad}});
    }
  }
  return targets;
}
