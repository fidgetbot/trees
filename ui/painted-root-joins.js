// Approved localized join artwork + its exact five-axis attachment scaffold.
// Geometry lives in collar-relative coordinates. A stage changes biological
// scale/material, never root IDs or the earned growth clock.
import {JOIN_PROFILES} from './root-join-profiles.js?rev=painted-joins-v1';
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
export const JOIN_STAGES=['Sapling','Young Tree','Mature Tree','Ancient'];
export function getJoinProfile(species,stage){return JOIN_PROFILES[`${species}:${stage}`]||null}
export function rootLifetime(state){
 const stage=state.lifeStage?.name||state.presentationStage;
 const i=Math.max(0,JOIN_STAGES.indexOf(stage));
 return i*6+6*clamp((state.turnsInStage||0)/[32,48,48,48][i]);
}
export function joinedRootClocks(state,reveal=null){
 const p=reveal?clamp(reveal.progress):1;
 const interpolate=(target,before)=>Math.min(target,before)+(target-Math.min(target,before))*p;
 const roots=interpolate(Math.max(0,state.rootZones||0),reveal?.from?.roots??state.rootZones??0);
 const deep=interpolate(Math.max(0,state.taprootDepth||0),reveal?.from?.taproots??state.taprootDepth??0);
 const outward=Math.max(0,roots-deep),age=rootLifetime(state);
 return {spread:age+outward*1.4+deep*.4,deep:age+outward*.65+deep*2.8};
}
const AXES=[
 {p:[[-21.44396,-2],[-52,12],[-145,34],[-215,64]],w:16.67864,seed:5},
 {p:[[-10.12632,-1],[-42,40],[-85,105],[-126,174]],w:19.65697,seed:8},
 {p:[[2.38266,0],[20,38],[8,134],[43,220]],w:19.06130,seed:11},
 {p:[[12.50898,-1],[37,23],[80,94],[140,164]],w:14.89164,seed:14},
 {p:[[23.23096,-2],[60,9],[157,31],[225,72]],w:15.48731,seed:17},
];
export function rootCurvePoint(p,t){
 if(t>1){const end=p[3],a=Math.atan2(end[1]-p[2][1],end[0]-p[2][0]),d=(t-1)*180,bend=Math.sin((t-1)*2.4)*Math.min(14,d*.06);return[end[0]+Math.cos(a)*d-Math.sin(a)*bend,end[1]+Math.sin(a)*d+Math.cos(a)*bend]}
 const u=1-t;return[0,1].map(k=>u*u*u*p[0][k]+3*u*u*t*p[1][k]+3*u*t*t*p[2][k]+t*t*t*p[3][k]);
}
export function buildJoinedRootGraph(state,reveal=null){
 const clocks=joinedRootClocks(state,reveal),nodes=[];
 for(const [i,axis] of AXES.entries()){
  const clock=i===2?clocks.deep:i===1||i===3?clocks.spread*.55+clocks.deep*.45:clocks.spread;
  const end=.58+clock*.014;
  nodes.push({...axis,id:`axis-${i}`,end,order:0,clock});
  const slots=Math.min(90,Math.ceil((end-.28)/.105));
  for(let j=0;j<slots;j++){
   const t=.32+j*.105,age=clamp((end-t-.035)/.23);if(!age)continue;
   const a=rootCurvePoint(axis.p,t),b=rootCurvePoint(axis.p,t+.01),angle=Math.atan2(b[1]-a[1],b[0]-a[0])+((i+j)%2?1:-1)*(.58+.12*Math.sin(i+j));
   const len=36+12*Math.sin(i*5+j*3),target=[a[0]+Math.cos(angle)*len,a[1]+Math.sin(angle)*len+8];
   const p=[a,[a[0]+Math.cos(angle)*len*.25,a[1]+Math.sin(angle)*len*.25],[target[0]-Math.cos(angle+.3)*len*.25,target[1]-Math.sin(angle+.3)*len*.25],target];
   const w=axis.w*Math.pow(Math.max(.04,1-t/(end+.05)),.8)*.35;
   nodes.push({id:`axis-${i}-lateral-${j}`,parent:`axis-${i}`,p,w,end:age,seed:axis.seed+j,order:1,clock});
   if(age>.65)for(let k=0;k<2;k++){
    if(age<=.48+k*.25)continue;
    const q=rootCurvePoint(p,.45+k*.25),an=angle+(k?-.7:.8),l=len*.4;
    nodes.push({id:`axis-${i}-lateral-${j}-fine-${k}`,parent:`axis-${i}-lateral-${j}`,p:[q,[q[0]+Math.cos(an)*l*.3,q[1]+Math.sin(an)*l*.3],[q[0]+Math.cos(an)*l*.8,q[1]+Math.sin(an)*l*.8],[q[0]+Math.cos(an)*l,q[1]+Math.sin(an)*l]],w:w*.3,end:clamp((age-(.48+k*.25))/(1-(.48+k*.25))),seed:j+k,order:2,clock});
   }
  }
 }
 return {nodes,clocks};
}
export function joinedRootBounds(geometry,state){
 const profile=getJoinProfile(state.selectedSpecies,state.presentationStage||state.lifeStage?.name);
 if(!profile)return null;
 const unit=profile.sourceCollar*geometry.width/profile.sourceWidth/59.56656346749226;
 const vertical=geometry.height/(geometry.width*profile.sourceHeight/profile.sourceWidth);
 let side=geometry.width/2,below=0;
 for(const node of buildJoinedRootGraph(state).nodes)for(let t=0;t<=node.end+.025;t+=.025){
  const p=rootCurvePoint(node.p,Math.min(t,node.end));
  side=Math.max(side,(Math.abs(p[0])+node.w/2)*unit);
  below=Math.max(below,(p[1]+node.w/2)*unit*vertical);
 }
 return {width:side*2,height:geometry.height*geometry.groundRatio+below};
}
let mattes=new WeakMap();
const rootLayers=new Map();
export function resetJoinedRootCaches(){mattes=new WeakMap();rootLayers.clear()}
export function transparentJoin(image){
 if(mattes.has(image))return mattes.get(image);
 const c=document.createElement('canvas');c.width=image.naturalWidth||image.width;c.height=image.naturalHeight||image.height;
 const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
 const p=ctx.getImageData(0,0,c.width,c.height),d=p.data,bg=[40,29,21];
 for(let i=0;i<d.length;i+=4){
  const distance=Math.max(...bg.map((v,k)=>Math.abs(d[i+k]-v))),a=smooth((distance-5)/25);
  d[i+3]=Math.round(d[i+3]*a);
  if(a>0)for(let k=0;k<3;k++)d[i+k]=Math.max(0,Math.min(255,(d[i+k]-bg[k]*(1-a))/a));
 }
 ctx.putImageData(p,0,0);mattes.set(image,c);return c;
}
function drawWood(ctx,node,source,profile){
 const samples=[],step=.0125;
 for(let t=0;t<node.end+step;t+=step){
  const u=Math.min(t,node.end),p=rootCurvePoint(node.p,u),a=rootCurvePoint(node.p,Math.max(0,u-.002)),b=rootCurvePoint(node.p,u+.002),d=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
  // Freeze the proximal taper under the approved painting; established distal
  // wood only thickens as tips advance. No resampling of curve identity.
  const taper=node.order?Math.pow(Math.max(0,1-u),.8):Math.pow(Math.max(.025,1-u/(Math.max(1,node.end))),.8);
  const w=node.w*taper*smooth((node.end-u)/.085);
  samples.push({t:u,p,n:[-(b[1]-a[1])/d,(b[0]-a[0])/d],w});
 }
 ctx.beginPath();for(const side of [-1,1]){const list=side<0?samples:[...samples].reverse();list.forEach((s,i)=>{const x=s.p[0]+side*s.n[0]*s.w/2,y=s.p[1]+side*s.n[1]*s.w/2;side<0&&i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)});}ctx.closePath();ctx.fillStyle='#7e4935';ctx.fill();
 if(node.w>2){ctx.save();ctx.clip();for(let i=0;i<samples.length-1;i++){
  const a=samples[i],b=samples[i+1],d=Math.hypot(b.p[0]-a.p[0],b.p[1]-a.p[1]);ctx.save();ctx.translate(...a.p);ctx.rotate(Math.atan2(b.p[1]-a.p[1],b.p[0]-a.p[0])-Math.PI/2);
  const sw=profile.sourceCollar*.8,sy=profile.cutY-70+((Math.floor(a.t/.79*80)+node.seed*3)%60);
  ctx.drawImage(source,profile.cx-sw/2,sy,sw,3,-a.w*.53,-.2,a.w*1.06,d+.5);ctx.restore();
 }ctx.restore();}
}
function rootLayer(graph,source,profile){
 const key=`${profile.id}:${graph.clocks.spread.toFixed(6)}:${graph.clocks.deep.toFixed(6)}`;
 if(rootLayers.has(key)){const cached=rootLayers.get(key);rootLayers.delete(key);rootLayers.set(key,cached);return cached;}
 let left=0,right=0,top=0,bottom=0;
 for(const node of graph.nodes)for(let t=0;t<=node.end+.025;t+=.025){
  const p=rootCurvePoint(node.p,Math.min(t,node.end)),pad=node.w/2+2;
  left=Math.min(left,p[0]-pad);right=Math.max(right,p[0]+pad);top=Math.min(top,p[1]-pad);bottom=Math.max(bottom,p[1]+pad);
 }
 const width=right-left,height=bottom-top,density=Math.min(3,1536/Math.max(width,height));
 const canvas=document.createElement('canvas');canvas.width=Math.ceil(width*density);canvas.height=Math.ceil(height*density);
 const ctx=canvas.getContext('2d');ctx.scale(density,density);ctx.translate(-left,-top);
 for(const node of graph.nodes)drawWood(ctx,node,source,profile);
 const layer={canvas,x:left,y:top,width:canvas.width/density,height:canvas.height/density};
 rootLayers.set(key,layer);
 // A bounded global LRU, not a canvas for every past growth frame/species.
 while(rootLayers.size>8)rootLayers.delete(rootLayers.keys().next().value);
 return layer;
}
export function drawJoinedRootTree(ctx,image,geometry,state,reveal,patch){
 const profile=getJoinProfile(state.selectedSpecies,state.presentationStage||state.lifeStage?.name);if(!profile)return false;
 const sourceScale=geometry.width/profile.sourceWidth;
 const unit=profile.sourceCollar*sourceScale/59.56656346749226;
 const graph=buildJoinedRootGraph(state,reveal);
 ctx.save();ctx.scale(1,geometry.height/(geometry.width*profile.sourceHeight/profile.sourceWidth));
 const layer=rootLayer(graph,image,profile);
 ctx.save();ctx.scale(unit,unit);ctx.drawImage(layer.canvas,layer.x,layer.y,layer.width,layer.height);ctx.restore();
 // The gallery's opaque background hid the original roots beneath its patch.
 // With a transparent runtime patch, retaining that extra strip exposes
 // detached painted fragments. The approved flare supplies the overlap.
 const paintY=profile.cutY;
 ctx.drawImage(image,0,0,profile.sourceWidth,paintY,-profile.cx*sourceScale,-profile.cutY*sourceScale,geometry.width,paintY*sourceScale);
 if(patch)ctx.drawImage(transparentJoin(patch),-128*unit,-90*unit,256*unit,256*unit);
 ctx.restore();
 return true;
}
