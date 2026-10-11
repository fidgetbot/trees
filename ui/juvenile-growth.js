// Dedicated infant plants. Generated masters stay intact; seasonal layers are
// derived in memory so the living tip and seed survive leaf loss and winter.
export const JUVENILE_KEYS = ['first-leaves', 'unfurling', 'juvenile'];
const anchors = {
  Cherry: [[.56,.51],[.55,.545],[.55,.59]],
  Apricot: [[.55,.485],[.55,.485],[.55,.53]],
  Citrus: [[.55,.49],[.55,.53],[.54,.54]],
  Peach: [[.55,.49],[.56,.49],[.54,.52]],
  Pear: [[.55,.505],[.55,.52],[.55,.56]],
  Plum: [[.55,.50],[.55,.50],[.54,.53]],
};
const layers = new WeakMap();

export function getJuvenileStageKey(state, stage) {
  if (stage !== 'Sprout' && stage !== 'Seedling') return null;
  const leaves = Math.max(0, state.leafClusters || 0);
  const established = Math.max(leaves, state.visualGrowth?.juvenilePeak || 0);
  if (!established) return null;
  return JUVENILE_KEYS[Math.min(2, Math.max(0, Math.ceil(leaves || established) - 1))];
}

export function getJuvenileGeometry(species, key, state = {}) {
  const index = JUVENILE_KEYS.indexOf(key);
  const [anchorX, groundRatio] = (anchors[species] || anchors.Plum)[index];
  // Measure above-ground height, not total PNG bounds: new pictures grow up
  // from the same collar instead of being normalized to equal-height plants.
  const height = [24,28,34][index] / groundRatio * (1 + Math.min(.42, (state.heightGrowth || 0) * .075));
  return {width:height * 2/3, height, anchorX, groundRatio, juvenile:true,
    rootStart:Math.max(.72, groundRatio + .16), leafBottom:[.34,.38,.52][index], representedLeaves:index + 1};
}

function canvas(width, height) {
  const result = document.createElement('canvas');
  result.width = width; result.height = height;
  return result;
}

export function getJuvenileLayers(image, geometry) {
  if (layers.has(image)) return layers.get(image);
  const w=image.naturalWidth, h=image.naturalHeight;
  const source=canvas(w,h), context=source.getContext('2d',{willReadFrequently:true});
  context.drawImage(image,0,0);
  const full=context.getImageData(0,0,w,h), bare=context.getImageData(0,0,w,h);
  const leaf=context.getImageData(0,0,w,h);
  // Follow the central connected shoot upward. Cap wide rows at leaf nodes,
  // but preserve the natural outline of the narrow stem and terminal bud.
  let center=geometry.anchorX*w;
  const collar=Math.floor(geometry.leafBottom*h);
  for(let y=collar;y>=0;y--) {
    const runs=[];let start=-1;
    for(let x=0;x<=w;x++) {
      const opaque=x<w&&full.data[(y*w+x)*4+3]>80;
      if(opaque&&start<0)start=x;
      if(!opaque&&start>=0){runs.push([start,x-1]);start=-1;}
    }
    const run=runs.sort((a,b)=>Math.abs(Math.max(a[0],Math.min(a[1],center))-center)-Math.abs(Math.max(b[0],Math.min(b[1],center))-center))[0];
    let left=center,right=center;
    if(run&&Math.max(run[0]-center,center-run[1])<w*.09) {
      const maxWidth=w*(y<h*.17?.085:.055);
      if(run[1]-run[0]<maxWidth)center=(run[0]+run[1])/2;
      left=Math.max(run[0]-1,center-maxWidth/2);
      right=Math.min(run[1]+1,center+maxWidth/2);
    }
    for(let x=0;x<w;x++)if(x<left||x>right)bare.data[(y*w+x)*4+3]=0;
  }
  // Foliage is exactly the portion removed from the bare layer. This also
  // supplies an isolated juvenile leaf, never an adult twig, for later actions.
  let minX=w,minY=h,maxX=0,maxY=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
    const i=(y*w+x)*4;
    leaf.data[i+3]=y<collar&&bare.data[i+3]===0?full.data[i+3]:0;
    if(x<w*.48&&leaf.data[i+3]>40){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  }
  const dormant=canvas(w,h),foliage=canvas(w,h);
  dormant.getContext('2d').putImageData(bare,0,0);
  foliage.getContext('2d').putImageData(leaf,0,0);
  dormant.juvenileSource=foliage.juvenileSource=image.src;
  let singleLeaf=null;
  if(maxX>minX&&maxY>minY) {
    singleLeaf=canvas(maxX-minX+2,maxY-minY+2);
    singleLeaf.getContext('2d').drawImage(foliage,minX,minY,maxX-minX+1,maxY-minY+1,0,0,maxX-minX+1,maxY-minY+1);
    let attachmentY=0,attachmentCount=0;
    for(let y=minY;y<=maxY;y++)if(leaf.data[(y*w+maxX)*4+3]>40){attachmentY+=y-minY;attachmentCount++;}
    singleLeaf.anchorY=attachmentCount?attachmentY/attachmentCount/singleLeaf.height:.9;
  }
  const result={dormant,foliage,singleLeaf};layers.set(image,result);return result;
}

export function drawJuvenilePlant(ctx,image,geometry,season,leafCount,filter='none',alpha=1) {
  const {dormant,foliage}=getJuvenileLayers(image,geometry);
  const args=[-geometry.width*geometry.anchorX,-geometry.height*geometry.groundRatio,geometry.width,geometry.height];
  ctx.save();ctx.globalAlpha=alpha;
  ctx.drawImage(dormant,...args);
  if(season!=='Winter'&&leafCount>0){ctx.filter=filter;ctx.drawImage(foliage,...args);}
  ctx.restore();
}

export function drawJuvenileLeaves(ctx,growth,reveal,season,image,geometry,filter='none') {
  if(season==='Winter')return;
  const leaf=getJuvenileLayers(image,geometry).singleLeaf;if(!leaf)return;
  for(const part of growth.leaves) {
    const progress=!reveal||part.index<(reveal.from.leaves||0)?1:reveal.progress;
    if(progress<=0)continue;
    const width=part.width*progress,height=width*leaf.height/leaf.width;
    ctx.save();ctx.translate(part.end.x,part.end.y);ctx.scale(-part.side,1);ctx.filter=filter;
    // The source leaf's cut petiole is at its lower-right; overlap the painted
    // connector there, rather than centering a detached leaf over its endpoint.
    ctx.drawImage(leaf,-width,-height*leaf.anchorY,width,height);ctx.restore();
  }
}
