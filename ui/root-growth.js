// Extend the specimen's own connected roots, preserving its age, colour and
// branching topology. The collar is fixed; deformation increases below it.
export function rootGrowthAmount(state, reveal) {
  const base=state.visualGrowth?.structuralBase;
  const early=['Seed','Sprout','Seedling'].includes(state.lifeStage?.name || state.presentationStage);
  const roots=Math.max(0,(state.rootZones||0)-(early?1:(base?.roots??state.rootZones??0)));
  const taps=Math.max(0,(state.taprootDepth||0)-(base?.taproots??state.taprootDepth??0));
  const target=roots+taps;
  if(!reveal)return target;
  const beforeRoots=Math.max(0,(reveal.from.roots||0)-(early?1:(base?.roots??state.rootZones??0)));
  const beforeTaps=Math.max(0,(reveal.from.taproots||0)-(base?.taproots??state.taprootDepth??0));
  return Math.min(target,beforeRoots+beforeTaps)+(Math.max(0,target-beforeRoots-beforeTaps))*reveal.progress;
}

const rootMeshes=new WeakMap();
export function drawRootGrowth(ctx,image,source,geometry,state={},reveal=null) {
  const sw=source?.width||image.naturalWidth||image.width,sh=source?.height||image.naturalHeight||image.height;
  const sx=source?.x||0,sy=source?.y||0;
  const {width,height,groundRatio}=geometry,anchor=geometry.anchorX??.5;
  const left=-width*anchor,top=-height*groundRatio;
  const amount=rootGrowthAmount(state,reveal);
  if(amount<=0){ctx.drawImage(image,sx,sy,sw,sh,left,top,width,height);return;}
  const split=Math.min(.88,geometry.rootStart??(groundRatio+.035));
  const span=1-split;
  const depth=1+.22*Math.sqrt(amount),spread=.45*amount;
  const key=[sx,sy,sw,sh,split,anchor,amount].join(':');
  let cached=rootMeshes.get(image);
  if(cached?.key!==key){
    // Build a continuous raster at source resolution, then draw it once.
    // Integer destination rows avoid the transparent cracks produced when
    // fractional strips are independently transformed on the screen canvas.
    const mesh=document.createElement('canvas');
    mesh.width=Math.ceil(sw*(1+spread));mesh.height=Math.ceil(sh*(split+span*depth));
    const paint=mesh.getContext('2d'),pivot=mesh.width*anchor,join=Math.round(sh*split);
    paint.drawImage(image,sx,sy,sw,join,pivot-sw*anchor,0,sw,join);
    for(let y=join;y<mesh.height;y++){
      const t=(y-join)/(mesh.height-join),expansion=1+spread*t;
      const sourceY=sy+join+(y-join)/depth;
      paint.drawImage(image,sx,sourceY,sw,Math.min(1/depth,sy+sh-sourceY),
        pivot-sw*anchor*expansion,y,sw*expansion,1);
    }
    cached={key,mesh};rootMeshes.set(image,cached);
  }
  const drawWidth=cached.mesh.width/sw*width,drawHeight=cached.mesh.height/sh*height;
  ctx.drawImage(cached.mesh,-drawWidth*anchor,top,drawWidth,drawHeight);
}
