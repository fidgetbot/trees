// Persistent botanical root growth. Seed, Sprout, and Seedling retain their
// approved painted specimens while connected juvenile extensions make later
// root investments visible. Sapling and later stages share one connected
// deterministic network whose geometry depends on earned growth, never stage.
let stagePixels=new WeakMap();
let extensionMetrics=new WeakMap();
const clamp=value=>Math.max(0,Math.min(1,value));

export function rootExtensionFamily(stage){return ['Seed','Sprout','Seedling'].includes(stage)?'juvenile':'botanical'}

export function rootGrowthAmount(state,reveal){
  const target=Math.max(0,(state.rootZones||0)-1)+Math.max(0,state.taprootDepth||0);
  if(!reveal)return target;
  const before=Math.max(0,(reveal.from.roots||0)-1)+Math.max(0,reveal.from.taproots||0);
  return Math.min(target,before)+Math.max(0,target-before)*clamp(reveal.progress);
}

export function rootGrowthBounds(geometry,amount){
  const visible=Math.max(0,amount);
  return{width:geometry.width*(1+Math.min(.82,visible*.055)),height:geometry.height*(1+Math.min(.42,visible*.032))};
}

export function rootRevealEffect(state,reveal,geometry){
  if(!reveal)return null;
  const target=rootGrowthAmount(state),before=rootGrowthAmount(state,{...reveal,progress:0});
  if(target<=before)return null;
  const progress=clamp(reveal.progress),previous=rootGrowthBounds(geometry,before),current=rootGrowthBounds(geometry,before+(target-before)*progress);
  return{progress,pulse:Math.sin(Math.PI*progress),previous,current};
}

function pixels(image,source){
  let bySource=stagePixels.get(image);if(!bySource){bySource=new Map();stagePixels.set(image,bySource)}
  const sw=source?.width||image.naturalWidth||image.width,sh=source?.height||image.naturalHeight||image.height;
  const key=[source?.x||0,source?.y||0,sw,sh].join(':');if(bySource.has(key))return bySource.get(key);
  const canvas=document.createElement('canvas');canvas.width=sw;canvas.height=sh;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,source?.x||0,source?.y||0,sw,sh,0,0,sw,sh);
  const result={canvas,width:sw,height:sh,data:ctx.getImageData(0,0,sw,sh).data};bySource.set(key,result);return result;
}

function collar(pixel,groundRatio){
  const desired=Math.max(0,Math.min(pixel.height-1,Math.round(pixel.height*groundRatio)));
  for(let radius=0;radius<Math.ceil(pixel.height*.08);radius++)for(const y of radius?[desired-radius,desired+radius]:[desired]){
    if(y<0||y>=pixel.height)continue;const spans=[];let start=-1;
    for(let x=0;x<=pixel.width;x++){
      const opaque=x<pixel.width&&pixel.data[(y*pixel.width+x)*4+3]>150;
      if(opaque&&start<0)start=x;else if(!opaque&&start>=0){spans.push([start,x-1]);start=-1}
    }
    if(spans.length){const span=spans.sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]))[0];return{x:(span[0]+span[1])/2,y,width:span[1]-span[0]+1}}
  }
  return{x:pixel.width/2,y:desired,width:Math.max(4,pixel.width*.05)};
}

function sampleBark(pixel,join){
  const samples=[];
  for(let y=Math.max(0,join.y-18);y<=join.y;y++)for(let x=Math.max(0,Math.round(join.x-join.width/2));x<=Math.min(pixel.width-1,Math.round(join.x+join.width/2));x++){
    const i=(y*pixel.width+x)*4;if(pixel.data[i+3]>210)samples.push([pixel.data[i],pixel.data[i+1],pixel.data[i+2]]);
  }
  return samples.length?[0,1,2].map(k=>Math.round(samples.reduce((sum,c)=>sum+c[k],0)/samples.length)):[112,72,43];
}

function metrics(image){
  if(extensionMetrics.has(image))return extensionMetrics.get(image);
  const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
  const data=ctx.getImageData(0,0,width,height).data;let sx=width/2,sy=0,found=false;
  for(let y=0;y<height&&!found;y++){
    const xs=[];for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>220)xs.push(x);
    if(xs.length>3){sy=Math.min(height-1,y+6);sx=xs.reduce((a,b)=>a+b,0)/xs.length;found=true}
  }
  const row=[];for(let x=0;x<width;x++)if(data[(sy*width+x)*4+3]>160)row.push(x);
  const result={sx,sy,maxY:height-1,inletWidth:Math.max(1,row.length?row.at(-1)-row[0]+1:4),width,height};
  extensionMetrics.set(image,result);return result;
}

const JUVENILE_ATTACHMENTS=Object.freeze([
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

export function getJuvenileRootExtensionLayout(image,source,geometry,amount){
  if(!image||amount<=0||typeof document==='undefined')return[];
  const pixel=pixels(image,source),count=Math.min(JUVENILE_ATTACHMENTS.length,Math.ceil(amount));
  return JUVENILE_ATTACHMENTS.slice(0,count).map(([fraction,side,size],index)=>{
    const point=attachment(pixel,geometry.groundRatio,fraction,side);if(!point)return null;
    return{index,side,progress:clamp(amount-index),size,
      x:(point.x/pixel.width-(geometry.anchorX??.5))*geometry.width,
      y:(point.y/pixel.height-geometry.groundRatio)*geometry.height,
      parentWidth:point.parentWidth/pixel.width*geometry.width};
  }).filter(Boolean);
}

function drawJuvenileExtensions(ctx,stageImage,source,geometry,state,reveal,extensionImage){
  const amount=rootGrowthAmount(state,reveal);if(!extensionImage||amount<=0)return;
  const m=metrics(extensionImage),establishedScale=1+Math.min(.35,Math.max(0,amount-8)*.025);
  for(const part of getJuvenileRootExtensionLayout(stageImage,source,geometry,amount)){
    const desired=geometry.height*part.size*.82*establishedScale;
    const scale=Math.min(desired/Math.max(1,m.maxY-m.sy),part.parentWidth*.8/m.inletWidth);
    if(!(scale>0))continue;
    ctx.save();ctx.translate(part.x,part.y);ctx.rotate(part.side<0?.64:-.59);ctx.scale(part.side<0?-1:1,1);
    ctx.beginPath();ctx.rect(-m.sx*scale,-m.sy*scale,m.width*scale,(m.maxY-m.sy)*scale*part.progress+2);ctx.clip();
    ctx.drawImage(extensionImage,-m.sx*scale,-m.sy*scale,m.width*scale,m.height*scale);ctx.restore();
  }
}

const mix=(a,b,t)=>a+(b-a)*t;
function hashRandom(seed){const value=Math.sin(seed*127.1+19.7)*43758.5453;return value-Math.floor(value)}
function curvePoint(curve,t){
  const u=1-t,x=u*u*u*curve[0].x+3*u*u*t*curve[1].x+3*u*t*t*curve[2].x+t*t*t*curve[3].x,y=u*u*u*curve[0].y+3*u*u*t*curve[1].y+3*u*t*t*curve[2].y+t*t*t*curve[3].y;
  const dx=curve[3].x-curve[0].x,dy=curve[3].y-curve[0].y,length=Math.hypot(dx,dy)||1,bend=Math.sin(Math.PI*t)**2*Math.sin(t*8+curve[3].x*.04)*Math.min(5,length*.05);
  return{x:x-dy/length*bend,y:y+dx/length*bend};
}

// Pure geometry used by rendering, saves, and regression tests. The stage is
// deliberately absent: advancing the life-stage cannot replace this network.
export function buildBotanicalRootGraph({rootZones=0,taprootDepth=0}={},reveal=null){
  const targetRoots=Math.max(0,Number(rootZones)||0),targetDeep=Math.max(0,Number(taprootDepth)||0);
  const rootsBefore=reveal?Math.max(0,Number(reveal.from?.roots)||0):targetRoots,deepBefore=reveal?Math.max(0,Number(reveal.from?.taproots)||0):targetDeep,progress=reveal?clamp(reveal.progress):1;
  const roots=mix(Math.min(targetRoots,rootsBefore),targetRoots,progress),deep=mix(Math.min(targetDeep,deepBefore),targetDeep,progress);
  // The approved study used one five-axis lifetime scaffold. Gameplay advances
  // it far enough per investment to remain legible at the game's smaller phone
  // presentation.
  const outwardClock=3+Math.max(0,roots-2)*1.5+deep*.6;
  const deepClock=3+Math.max(0,roots-2)*.65+deep*2.5;
  const spread=235,depth=210,nodes=[];
  function branch(curve,birth,duration,targetWidth,clock,parent=null,at=0,order=0,seed=1){
    const visible=clamp((clock-birth)/duration);if(visible<=0)return;
    const age=clamp((clock-birth)/23);let width=1.3+targetWidth*Math.pow(age,.8);
    if(parent)width=Math.min(width,parent.width*Math.pow(Math.max(0,1-at/Math.max(.001,parent.progress)),.7)*.58);
    const node={id:`root-${seed}`,curve,width,progress:visible,parent:parent?.id||null,at,order,birth};nodes.push(node);
    if(order>=3)return;
    const slots=order===0?5:3;
    for(let j=0;j<slots;j++){
      const t=.25+j*(order===0?.135:.22),childBirth=birth+duration*t+2.3+order;if(clock<=childBirth||visible<=t)continue;
      const origin=curvePoint(curve,t),ahead=curvePoint(curve,Math.min(1,t+.01)),angle=Math.atan2(ahead.y-origin.y,ahead.x-origin.x),side=(j+seed)%2?1:-1;
      let theta=angle+side*(.55+hashRandom(seed+j)*.48);if(Math.sin(theta)<-.32)theta=angle-side*.55;
      const parentLength=Math.hypot(curve[3].x-curve[0].x,curve[3].y-curve[0].y),length=parentLength*(.27+hashRandom(seed*3+j)*.15);
      const end={x:origin.x+Math.cos(theta)*length,y:Math.max(12,origin.y+Math.sin(theta)*length+length*.15)};
      branch([origin,{x:origin.x+Math.cos(theta)*length*.32,y:origin.y+Math.sin(theta)*length*.32},{x:end.x-Math.cos(theta+.24*side)*length*.25,y:end.y-Math.sin(theta+.24*side)*length*.25},end],childBirth,6+order*2,targetWidth*.42,clock,node,t,order+1,seed*7+j+1);
    }
  }
  for(let i=0;i<5;i++){
    const side=i<2?-1:i>2?1:0,rank=i<2?i:i>2?4-i:0,x=side*spread*(rank===0?.83:.48),y=side?(rank===0?48:depth*.65):depth*.98,origin={x:(i-2)*2.4,y:-2};
    const axisClock=side?outwardClock:deepClock;
    branch([origin,{x:origin.x+side*42,y:20},{x:x*.72+(side?0:-18),y:y*.65},{x:x+(side?0:9),y}],-2,18,side?8.8:10.4,axisClock,null,0,0,i+1);
  }
  return{nodes,roots,deep,outwardClock,deepClock,spread,depth};
}

function rgba(color,factor=1,alpha=1){return`rgba(${color.map(v=>Math.max(0,Math.min(255,Math.round(v*factor)))).join(',')},${alpha})`}
function drawRoot(ctx,node,color,material=null){
  const samples=[];
  for(let i=0;i<=30;i++){
    const u=i/30,t=u*node.progress,p=curvePoint(node.curve,t),a=curvePoint(node.curve,Math.max(0,t-.004)),b=curvePoint(node.curve,Math.min(1,t+.004)),length=Math.hypot(b.x-a.x,b.y-a.y)||1,w=node.width*Math.pow(1-u,.72)*(1+.025*Math.sin(t*31+node.birth));
    samples.push({p,n:{x:-(b.y-a.y)/length,y:(b.x-a.x)/length},w});
  }
  ctx.beginPath();samples.forEach((s,i)=>{const x=s.p.x-s.n.x*s.w/2,y=s.p.y-s.n.y*s.w/2;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});[...samples].reverse().forEach(s=>ctx.lineTo(s.p.x+s.n.x*s.w/2,s.p.y+s.n.y*s.w/2));ctx.closePath();ctx.fillStyle=rgba(color,node.width<1.5?1.25:.85);ctx.fill();
  if(node.width>=3&&material){
    ctx.save();ctx.clip();
    for(let i=0;i<samples.length-1;i++){
      const a=samples[i],b=samples[i+1],dx=b.p.x-a.p.x,dy=b.p.y-a.p.y,length=Math.hypot(dx,dy);if(!length)continue;
      ctx.save();ctx.translate(a.p.x,a.p.y);ctx.rotate(Math.atan2(dy,dx)-Math.PI/2);
      const sw=material.join.width*.72,sy=Math.max(0,material.join.y-24+(i*3+node.birth*7)%16);
      ctx.drawImage(material.canvas,material.join.x-sw/2,sy,sw,5,-a.w*.55,-.3,a.w*1.1,length+.8);ctx.restore();
    }
    ctx.fillStyle='rgba(40,22,12,.16)';ctx.fill();ctx.restore();
  }
}

function drawBotanicalRoots(ctx,image,source,geometry,state,reveal,materialImage=null,materialSource=null,materialGroundRatio=.61){
  const pixel=pixels(image,source),join=collar(pixel,geometry.groundRatio),materialPixel=pixels(materialImage||image,materialSource),materialJoin=collar(materialPixel,materialGroundRatio),color=sampleBark(materialPixel,materialJoin),material={...materialPixel,join:materialJoin},graph=buildBotanicalRootGraph(state,reveal),scale=Math.max(.42,Math.min(1.22,geometry.width/230,geometry.height/320));
  // Root bases begin just behind the final painted trunk row. Drawing the
  // painting last gives a natural bark-to-root overlap; a separate flat collar
  // cap creates a conspicuous polygonal blob at the soil line.
  ctx.save();ctx.scale(scale,scale);for(let i=graph.nodes.length-1;i>=0;i--)drawRoot(ctx,graph.nodes[i],color,material);ctx.restore();
  const sw=source?.width||image.naturalWidth||image.width,sh=source?.height||image.naturalHeight||image.height,sx=source?.x||0,sy=source?.y||0,cut=Math.max(1,Math.min(sh,join.y)),destinationHeight=geometry.height*(cut/sh);
  ctx.drawImage(image,sx,sy,sw,cut,-geometry.width*(geometry.anchorX??.5),-geometry.height*geometry.groundRatio,geometry.width,destinationHeight);
}

export function resetRootGrowthCache(){stagePixels=new WeakMap();extensionMetrics=new WeakMap()}

export function drawRootGrowth(ctx,image,source,geometry,state={},reveal=null,extensionImage=null,materialImage=null,materialSource=null,materialGroundRatio=.61){
  const stage=state.lifeStage?.name||state.presentationStage;
  if(rootExtensionFamily(stage)==='botanical'&&typeof document!=='undefined'){drawBotanicalRoots(ctx,image,source,geometry,state,reveal,materialImage,materialSource,materialGroundRatio);return}
  // Preserve the approved juvenile specimen and grow connected pale rootlets
  // behind it, so every Sprout/Seedling investment changes visible pixels.
  const sw=source?.width||image.naturalWidth||image.width,sh=source?.height||image.naturalHeight||image.height,sx=source?.x||0,sy=source?.y||0,{width,height,groundRatio}=geometry,anchor=geometry.anchorX??.5;
  if(typeof document!=='undefined')drawJuvenileExtensions(ctx,image,source,geometry,state,reveal,extensionImage);
  ctx.drawImage(image,sx,sy,sw,sh,-width*anchor,-height*groundRatio,width,height);
}
