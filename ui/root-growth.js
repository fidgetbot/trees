// Persistent botanical root growth. Seed, Sprout, and Seedling retain their
// approved painted presentation. Sapling and later stages share one connected
// deterministic network whose geometry depends on earned growth, never stage.
let stagePixels=new WeakMap();
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
  const outwardClock=3+Math.max(0,roots-2)*2.35+deep*.55;
  const deepClock=3+Math.max(0,roots-2)*.7+deep*3.15;
  const spread=156,depth=177,nodes=[];
  function branch(curve,birth,duration,targetWidth,clock,parent=null,at=0,order=0,seed=1){
    const visible=clamp((clock-birth)/duration);if(visible<=0)return;
    const age=clamp((clock-birth)/18);let width=1.1+targetWidth*Math.pow(age,.82);
    if(parent)width=Math.min(width,parent.width*Math.pow(Math.max(0,1-at/Math.max(.001,parent.progress)),.72)*.56);
    const node={id:`root-${seed}`,curve,width,progress:visible,parent:parent?.id||null,at,order,birth};nodes.push(node);
    if(order>=3)return;
    const slots=order===0?5:3;
    for(let j=0;j<slots;j++){
      const t=.24+j*(order===0?.14:.23),childBirth=birth+duration*t+2.2+order;if(clock<=childBirth||visible<=t)continue;
      const origin=curvePoint(curve,t),ahead=curvePoint(curve,Math.min(1,t+.01)),angle=Math.atan2(ahead.y-origin.y,ahead.x-origin.x),side=(j+seed)%2?1:-1;
      let theta=angle+side*(.55+hashRandom(seed+j)*.44);if(Math.sin(theta)<-.3)theta=angle-side*.5;
      const parentLength=Math.hypot(curve[3].x-curve[0].x,curve[3].y-curve[0].y),length=parentLength*(.27+hashRandom(seed*3+j)*.14);
      const end={x:origin.x+Math.cos(theta)*length,y:Math.max(5,origin.y+Math.sin(theta)*length+length*.15)};
      branch([origin,{x:origin.x+Math.cos(theta)*length*.32,y:origin.y+Math.sin(theta)*length*.32},{x:end.x-Math.cos(theta+.24*side)*length*.25,y:end.y-Math.sin(theta+.24*side)*length*.25},end],childBirth,5.5+order*1.8,targetWidth*.42,clock,node,t,order+1,seed*7+j+1);
    }
  }
  for(let i=0;i<5;i++){
    const side=i<2?-1:i>2?1:0,outer=i===0||i===4,x=side*spread*(outer?.92:.55),y=side?(outer?depth*.52:depth*.72):depth,origin={x:(i-2)*2.4,y:-1};
    const axisClock=side?outwardClock:deepClock;
    branch([origin,{x:origin.x+side*30,y:17},{x:x*.7+(side?0:-8),y:y*.66},{x:x+(side?0:5),y}],-2,14,side?7.5:9.5,axisClock,null,0,0,i+1);
  }
  return{nodes,roots,deep,outwardClock,deepClock,spread,depth};
}

function rgba(color,factor=1,alpha=1){return`rgba(${color.map(v=>Math.max(0,Math.min(255,Math.round(v*factor)))).join(',')},${alpha})`}
function drawRoot(ctx,node,color){
  const samples=[];
  for(let i=0;i<=30;i++){
    const u=i/30,t=u*node.progress,p=curvePoint(node.curve,t),a=curvePoint(node.curve,Math.max(0,t-.004)),b=curvePoint(node.curve,Math.min(1,t+.004)),length=Math.hypot(b.x-a.x,b.y-a.y)||1,w=node.width*Math.pow(1-u,.72)*(1+.025*Math.sin(t*31+node.birth));
    samples.push({p,n:{x:-(b.y-a.y)/length,y:(b.x-a.x)/length},w});
  }
  ctx.beginPath();samples.forEach((s,i)=>{const x=s.p.x-s.n.x*s.w/2,y=s.p.y-s.n.y*s.w/2;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});[...samples].reverse().forEach(s=>ctx.lineTo(s.p.x+s.n.x*s.w/2,s.p.y+s.n.y*s.w/2));ctx.closePath();ctx.fillStyle=rgba(color,node.width<1.5?1.18:.88);ctx.fill();
  if(node.width>2){ctx.save();ctx.clip();ctx.strokeStyle=rgba(color,1.18,.22);ctx.lineWidth=Math.max(.35,node.width*.12);ctx.beginPath();samples.forEach((s,i)=>i?ctx.lineTo(s.p.x-s.n.x*s.w*.15,s.p.y-s.n.y*s.w*.15):ctx.moveTo(s.p.x-s.n.x*s.w*.15,s.p.y-s.n.y*s.w*.15));ctx.stroke();ctx.restore()}
}

function drawBotanicalRoots(ctx,image,source,geometry,state,reveal){
  const pixel=pixels(image,source),join=collar(pixel,geometry.groundRatio),color=sampleBark(pixel,join),graph=buildBotanicalRootGraph(state,reveal),scale=Math.max(.42,Math.min(1.22,geometry.width/230,geometry.height/320));
  ctx.save();ctx.scale(scale,scale);for(let i=graph.nodes.length-1;i>=0;i--)drawRoot(ctx,graph.nodes[i],color);
  const collarWidth=Math.max(7,join.width/pixel.width*geometry.width/scale);ctx.fillStyle=rgba(color,.92);ctx.beginPath();ctx.moveTo(-collarWidth/2,-2);ctx.bezierCurveTo(-collarWidth*.5,4,-collarWidth*.38,9,-collarWidth*.3,12);ctx.quadraticCurveTo(0,6,collarWidth*.3,12);ctx.bezierCurveTo(collarWidth*.38,9,collarWidth*.5,4,collarWidth/2,-2);ctx.closePath();ctx.fill();ctx.restore();
  const sw=source?.width||image.naturalWidth||image.width,sh=source?.height||image.naturalHeight||image.height,sx=source?.x||0,sy=source?.y||0,cut=Math.max(1,Math.min(sh,join.y)),destinationHeight=geometry.height*(cut/sh);
  ctx.drawImage(image,sx,sy,sw,cut,-geometry.width*(geometry.anchorX??.5),-geometry.height*geometry.groundRatio,geometry.width,destinationHeight);
}

export function resetRootGrowthCache(){stagePixels=new WeakMap()}

export function drawRootGrowth(ctx,image,source,geometry,state={},reveal=null){
  const stage=state.lifeStage?.name||state.presentationStage;
  if(rootExtensionFamily(stage)==='botanical'&&typeof document!=='undefined'){drawBotanicalRoots(ctx,image,source,geometry,state,reveal);return}
  // Approved Seed/Sprout/Seedling artwork remains byte-for-byte unchanged.
  const sw=source?.width||image.naturalWidth||image.width,sh=source?.height||image.naturalHeight||image.height,sx=source?.x||0,sy=source?.y||0,{width,height,groundRatio}=geometry,anchor=geometry.anchorX??.5;
  ctx.drawImage(image,sx,sy,sw,sh,-width*anchor,-height*groundRatio,width,height);
}
