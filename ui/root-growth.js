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

export function rootRevealEffect(state, reveal, geometry) {
  if(!reveal)return null;
  const target=rootGrowthAmount(state),before=rootGrowthAmount(state,{...reveal,progress:0});
  if(target<=before)return null;
  const progress=Math.max(0,Math.min(1,reveal.progress));
  const split=Math.min(.88,geometry.rootStart??(geometry.groundRatio+.035)),span=1-split;
  const bounds=amount=>({
    width:geometry.width*(1+.45*amount),
    height:geometry.height*(split+span*(1+.22*Math.sqrt(amount))),
  });
  const previous=bounds(before),current=bounds(before+(target-before)*progress);
  // A restrained pulse follows only the newly uncovered edge. It vanishes at
  // both endpoints, so the persistent specimen and stage handoff are unchanged.
  const pulse=Math.sin(Math.PI*progress);
  return {progress,pulse,previous,current};
}

function drawRootRevealEffect(ctx,mesh,drawX,drawY,state,reveal,geometry){
  if(typeof ctx.save!=='function'||typeof ctx.clip!=='function')return;
  const effect=rootRevealEffect(state,reveal,geometry);if(!effect||effect.pulse<=.001)return;
  const anchor=geometry.anchorX??.5,{previous,current,pulse,progress}=effect;
  const oldLeft=-previous.width*anchor,oldRight=oldLeft+previous.width;
  const left=-current.width*anchor,right=left+current.width,top=drawY,bottom=top+current.height,oldBottom=top+previous.height;
  ctx.save();ctx.beginPath();
  // Highlight the narrow depth and lateral bands that did not exist before
  // this investment, rather than flashing the whole plant.
  ctx.rect(left-1,oldBottom-2,current.width+2,Math.max(4,bottom-oldBottom+4));
  ctx.rect(left-1,top+geometry.height*(geometry.rootStart??geometry.groundRatio),Math.max(3,oldLeft-left+3),current.height);
  ctx.rect(oldRight-2,top+geometry.height*(geometry.rootStart??geometry.groundRatio),Math.max(3,right-oldRight+3),current.height);
  ctx.clip();ctx.globalAlpha=.34*pulse;ctx.globalCompositeOperation='screen';ctx.filter='brightness(1.55) saturate(.72)';
  ctx.drawImage(mesh,drawX,drawY,current.width,current.height);ctx.restore();

  // Fine soil marks travel with the advancing lower tips. They are deliberately
  // small and earthy: movement, not a magical glow.
  if(typeof ctx.arc==='function'){
    ctx.save();ctx.globalAlpha=.24*pulse;ctx.strokeStyle='#b99a70';ctx.lineWidth=Math.max(.35,geometry.width*.012);
    const tipY=bottom+geometry.height*.014,spread=current.width*(.16+.05*progress);
    for(const side of [-1,1]){
      const tipX=(side*spread)+(1-anchor*2)*current.width*.08;
      ctx.beginPath();ctx.arc(tipX,tipY,geometry.width*(.035+.018*progress),Math.PI*1.08,Math.PI*1.9);ctx.stroke();
    }
    ctx.restore();
  }
}

let rootMeshes=new WeakMap();
export function resetRootGrowthCache() {
  rootMeshes = new WeakMap();
}
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
  const drawX=-drawWidth*anchor;
  ctx.drawImage(cached.mesh,drawX,top,drawWidth,drawHeight);
  drawRootRevealEffect(ctx,cached.mesh,drawX,top,state,reveal,geometry);
}
