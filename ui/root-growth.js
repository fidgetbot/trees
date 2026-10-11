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

export function drawRootGrowth(ctx,image,source,geometry,state={},reveal=null) {
  const sw=source?.width||image.naturalWidth||image.width,sh=source?.height||image.naturalHeight||image.height;
  const sx=source?.x||0,sy=source?.y||0;
  const {width,height,groundRatio}=geometry,anchor=geometry.anchorX??.5;
  const left=-width*anchor,top=-height*groundRatio;
  const amount=rootGrowthAmount(state,reveal);
  if(amount<=0){ctx.drawImage(image,sx,sy,sw,sh,left,top,width,height);return;}
  const split=Math.min(.88,geometry.rootStart??(groundRatio+.035));
  ctx.drawImage(image,sx,sy,sw,sh*split,left,top,width,height*split);
  const gain=Math.sqrt(amount),depth=1+.30*gain,spread=.38*gain;
  const strips=128,span=1-split;
  for(let i=0;i<strips;i++){
    const t=i/strips,next=(i+1)/strips;
    // At the join the horizontal scale is exactly one. Smoothly widening
    // lower rows cannot open a gap or introduce detached source fragments.
    const expansion=1+spread*((t+next)/2)**1.4;
    const y=top+height*split+height*span*t*depth;
    ctx.drawImage(image,sx,sy+sh*(split+span*t),sw,sh*span/strips,
      left*expansion,y,width*expansion,height*span/strips*depth+.008);
  }
}
