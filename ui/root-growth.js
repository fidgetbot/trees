// Stage-matched root growth. The painted stage specimen remains authoritative;
// every root investment adds a connected terminal network behind it.
let stagePixels=new WeakMap();
let extensionMetrics=new WeakMap();
const clamp=value=>Math.max(0,Math.min(1,value));

export function rootExtensionFamily(stage){
  return ['Seed','Sprout','Seedling'].includes(stage)?'juvenile':'woody';
}

export function rootGrowthAmount(state,reveal){
  const target=Math.max(0,(state.rootZones||0)-1)+Math.max(0,state.taprootDepth||0);
  if(!reveal)return target;
  const before=Math.max(0,(reveal.from.roots||0)-1)+Math.max(0,reveal.from.taproots||0);
  return Math.min(target,before)+Math.max(0,target-before)*clamp(reveal.progress);
}

export function rootGrowthBounds(geometry,amount){
  const visible=Math.min(8,Math.max(0,amount)),overflow=Math.max(0,amount-8);
  return{
    width:geometry.width*(1+Math.min(.62,visible*.075+overflow*.012)),
    height:geometry.height*(1+Math.min(.26,visible*.028+overflow*.006)),
  };
}

export function rootRevealEffect(state,reveal,geometry){
  if(!reveal)return null;
  const target=rootGrowthAmount(state),before=rootGrowthAmount(state,{...reveal,progress:0});
  if(target<=before)return null;
  const progress=clamp(reveal.progress),previous=rootGrowthBounds(geometry,before);
  const current=rootGrowthBounds(geometry,before+(target-before)*progress);
  return{progress,pulse:Math.sin(Math.PI*progress),previous,current};
}

function pixels(image,source){
  let bySource=stagePixels.get(image);if(!bySource){bySource=new Map();stagePixels.set(image,bySource)}
  const sw=source?.width||image.naturalWidth||image.width,sh=source?.height||image.naturalHeight||image.height;
  const key=[source?.x||0,source?.y||0,sw,sh].join(':');if(bySource.has(key))return bySource.get(key);
  const canvas=document.createElement('canvas');canvas.width=sw;canvas.height=sh;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,source?.x||0,source?.y||0,sw,sh,0,0,sw,sh);
  const result={width:sw,height:sh,data:ctx.getImageData(0,0,sw,sh).data};bySource.set(key,result);return result;
}

function metrics(image){
  if(extensionMetrics.has(image))return extensionMetrics.get(image);
  const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
  const data=ctx.getImageData(0,0,width,height).data;let sx=width/2,sy=0,maxY=height-1,found=false;
  for(let y=0;y<height&&!found;y++){
    const xs=[];for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>220)xs.push(x);
    if(xs.length>3){sy=Math.min(height-1,y+6);sx=xs.reduce((a,b)=>a+b,0)/xs.length;found=true}
  }
  const row=[];for(let x=0;x<width;x++)if(data[(sy*width+x)*4+3]>160)row.push(x);
  const result={sx,sy,maxY,inletWidth:Math.max(1,row.length?row.at(-1)-row[0]+1:4),width,height};
  extensionMetrics.set(image,result);return result;
}

const ATTACHMENTS=Object.freeze([
  [.38,-1,.62],[.49,1,.58],[.61,-1,.54],[.72,1,.50],
  [.80,-1,.45],[.56,1,.43],[.69,-1,.40],[.86,1,.37],
]);

function attachment(pixel,groundRatio,fraction,side){
  const desired=Math.round(pixel.height*(groundRatio+(1-groundRatio)*fraction));
  for(let radius=0;radius<pixel.height*.12;radius++)for(const y of radius?[desired-radius,desired+radius]:[desired]){
    if(y<0||y>=pixel.height)continue;const xs=[];
    for(let x=0;x<pixel.width;x++)if(pixel.data[(y*pixel.width+x)*4+3]>150)xs.push(x);
    if(!xs.length)continue;const x=side<0?xs[0]:xs.at(-1);let left=x,right=x;
    while(left>0&&pixel.data[(y*pixel.width+left-1)*4+3]>95)left--;
    while(right<pixel.width-1&&pixel.data[(y*pixel.width+right+1)*4+3]>95)right++;
    return{x,y,parentWidth:right-left+1};
  }
  return null;
}

export function getRootExtensionLayout(image,source,geometry,amount){
  if(!image||amount<=0||typeof document==='undefined')return[];
  const pixel=pixels(image,source),count=Math.min(ATTACHMENTS.length,Math.ceil(amount));
  return ATTACHMENTS.slice(0,count).map(([fraction,side,size],index)=>{
    const point=attachment(pixel,geometry.groundRatio,fraction,side);if(!point)return null;
    return{index,side,progress:clamp(amount-index),size,
      x:(point.x/pixel.width-(geometry.anchorX??.5))*geometry.width,
      y:(point.y/pixel.height-geometry.groundRatio)*geometry.height,
      parentWidth:point.parentWidth/pixel.width*geometry.width};
  }).filter(Boolean);
}

function drawExtensions(ctx,stageImage,source,geometry,state,reveal,extensionImage){
  const amount=rootGrowthAmount(state,reveal);if(!extensionImage||amount<=0)return;
  const family=rootExtensionFamily(state.lifeStage?.name||state.presentationStage),m=metrics(extensionImage);
  const establishedScale=1+Math.min(.35,Math.max(0,amount-8)*.025);
  for(const part of getRootExtensionLayout(stageImage,source,geometry,amount)){
    const desired=geometry.height*part.size*(family==='juvenile'?.82:1)*establishedScale;
    const scale=Math.min(desired/Math.max(1,m.maxY-m.sy),part.parentWidth*.8/m.inletWidth);
    if(!(scale>0))continue;
    ctx.save();ctx.translate(part.x,part.y);ctx.rotate(part.side<0?.64:-.59);ctx.scale(part.side<0?-1:1,1);
    ctx.beginPath();ctx.rect(-m.sx*scale,-m.sy*scale,m.width*scale,(m.maxY-m.sy)*scale*part.progress+2);ctx.clip();
    ctx.drawImage(extensionImage,-m.sx*scale,-m.sy*scale,m.width*scale,m.height*scale);ctx.restore();
  }
}

export function resetRootGrowthCache(){stagePixels=new WeakMap()}

export function drawRootGrowth(ctx,image,source,geometry,state={},reveal=null,extensionImage=null){
  const sw=source?.width||image.naturalWidth||image.width,sh=source?.height||image.naturalHeight||image.height;
  const sx=source?.x||0,sy=source?.y||0,{width,height,groundRatio}=geometry,anchor=geometry.anchorX??.5;
  drawExtensions(ctx,image,source,geometry,state,reveal,extensionImage);
  ctx.drawImage(image,sx,sy,sw,sh,-width*anchor,-height*groundRatio,width,height);
}
