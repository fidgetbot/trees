import { getPlayerShadeTarget } from '../core/growth.js?rev=directional-shade-v1';

const TAU = Math.PI * 2;
const STAGE_SCALE = { Seed:.12, Sprout:.22, Seedling:.32, Sapling:.5, 'Small Tree':.82, 'Mature Tree':1.45, Ancient:1.75 };
const CAMERA_ZOOM = { Seed:10, Sprout:5.8, Seedling:3, Sapling:1.75, 'Small Tree':1.18, 'Mature Tree':.86, Ancient:.74 };
export const RESIDENT_WORLD_POSITIONS = Object.freeze([-180,-70,0,72,180]);
const WORLD_POSITIONS = RESIDENT_WORLD_POSITIONS;
const CHILD_WORLD_POSITIONS = [-84,88,-252,255];
const HABITS = {
  Plum:{spread:1.12,height:.96,bend:.58,bark:'#695740'}, Peach:{spread:1.22,height:.88,bend:.68,bark:'#735443'},
  Apricot:{spread:1.08,height:.94,bend:.6,bark:'#70553f'}, Pear:{spread:.82,height:1.12,bend:.42,bark:'#625441'},
  Citrus:{spread:.96,height:.88,bend:.48,bark:'#65513a'}, Cherry:{spread:1.18,height:.92,bend:.62,bark:'#684b45'},
};
const SEED_PALETTES = {
  Plum:['#d2a064','#7b4930','#4a2e25'], Peach:['#d9aa72','#925d3d','#55362a'], Apricot:['#d7a163','#8b5235','#513126'],
  Pear:['#c6a16a','#806044','#4a382d'], Cherry:['#c18b5d','#70452f','#452c24'], Citrus:['#ead49a','#ac8755','#675035'],
};

export function renderForestScene({ctx,canvas,state,currentSeason,playerStageName,getNeighborTree,getRelationshipState,topInset=0,zoomMultiplier=1,centerHorizon=false}) {
  const w=canvas.width,h=canvas.height;
  const camera=cameraFor(state,playerStageName);camera.zoom*=zoomMultiplier;
  const centered=centerHorizon||playerStageName==='Seed',groundY=centered?Math.round(h/2):Math.min(h*.72,Math.ceil(topInset+playerHeight(state,playerStageName,camera)*1.12+16)),positions=WORLD_POSITIONS.map(worldX=>w/2+worldX*camera.zoom),residentTrees=positions.map((baseX,index)=>{
    const neighbor=index===2?null:getNeighborTree(index),arrangement=getCanopyArrangement(state,index,index===2,neighbor);
    return{x:baseX+arrangement.worldOffset*camera.zoom,index,isPlayer:index===2,neighbor,canopyLean:arrangement.canopyLean};
  });
  const childTrees=(state.offspringRecords||[]).filter(child=>!child.dead).slice(0,CHILD_WORLD_POSITIONS.length).map((child,index)=>{
    const stageName=stageForScore(child.stageScore),rank=['Seed','Sprout','Seedling','Sapling','Small Tree','Mature Tree','Ancient'].indexOf(stageName);
    return{x:w/2+CHILD_WORLD_POSITIONS[index]*camera.zoom,index:5+index,isPlayer:false,neighbor:{species:child.species||state.selectedSpecies||'Plum',stageName,branches:Math.max(1,Math.min(6,rank+1)),roots:Math.max(2,Math.min(7,rank+2)),trunk:Math.max(1,Math.min(5,Math.floor(rank/2)+1)),health:child.health,maxHealth:child.maxHealth,healthRatio:child.maxHealth>0?child.health/child.maxHealth:0,ally:true,offspring:true,relation:100,relationName:'Ally',childId:child.id}};
  });
  const trees=[...residentTrees,...childTrees];
  canvas.dataset.groundY=String(groundY);
  ctx.clearRect(0,0,w,h); ctx.fillStyle=background(ctx,currentSeason); ctx.fillRect(0,0,w,groundY);
  ctx.fillStyle='#4a3b2f'; ctx.fillRect(0,groundY,w,h-groundY); ctx.strokeStyle='#000'; line(ctx,0,groundY,w,groundY);
  if(currentSeason.name==='Winter')drawWinterWeather(ctx,w,h,groundY);
  drawDirectionalCanopyShadows(ctx,trees,groundY);
  drawNearGround(ctx,w,h,groundY,camera.rank);
  trees.forEach(tree=>drawTree({ctx,...tree,groundY,state,season:currentSeason.name,playerStageName,getRelationshipState,camera}));
  drawHumanPressure(ctx,trees.find(tree=>tree.isPlayer)?.x||w/2,groundY,camera,state);
  if(camera.rank>=2)drawFungalNetwork(ctx,trees,groundY,getRelationshipState);
  const labelRows=[];
  trees.filter(tree=>(tree.isPlayer||tree.neighbor)&&tree.x>24&&tree.x<w-24).forEach(tree=>drawLabel(ctx,tree.x,groundY,tree.isPlayer,tree.neighbor,state,playerStageName,getRelationshipState,labelRows));
}

function stageForScore(score){
  if(score>=10200)return'Ancient';if(score>=3300)return'Mature Tree';if(score>=1000)return'Small Tree';if(score>=600)return'Sapling';if(score>=300)return'Seedling';if(score>=100)return'Sprout';return'Seed';
}

function drawHumanPressure(ctx,x,groundY,camera,state){
  const cuts=state.cuttingProgress||0,encounter=state.pendingHumanEncounter;
  if((state.humanAttention||0)>0){
    const markScale=Math.max(.7,camera.zoom);ctx.save();ctx.fillStyle='rgba(223,109,63,.92)';ctx.beginPath();ctx.roundRect(x-5*markScale,groundY-15*markScale,10*markScale,3.2*markScale,1.4*markScale);ctx.fill();ctx.restore();
  }
  if(cuts>0){
    ctx.save();ctx.strokeStyle='rgba(205,112,62,.9)';ctx.lineWidth=Math.max(2,2.4*camera.zoom);ctx.lineCap='round';
    for(let i=0;i<cuts;i++){const y=groundY-(9+i*5)*camera.zoom;ctx.beginPath();ctx.moveTo(x-5*camera.zoom,y);ctx.lineTo(x+5*camera.zoom,y+1.5*camera.zoom);ctx.stroke()}
    ctx.restore();
  }
  if(!encounter)return;
  const count=Math.max(1,encounter.count||2),scale=Math.max(.62,Math.min(2.5,camera.zoom*.88));
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  for(let i=0;i<count;i++){
    const side=i%2?1:-1,rank=Math.floor(i/2),px=x+side*(22+rank*13)*scale,py=groundY;
    ctx.strokeStyle='#493a31';ctx.lineWidth=2.1*scale;
    ctx.beginPath();ctx.moveTo(px,py-17*scale);ctx.lineTo(px,py-7*scale);ctx.moveTo(px,py-8*scale);ctx.lineTo(px-4*scale,py);ctx.moveTo(px,py-8*scale);ctx.lineTo(px+4*scale,py);ctx.stroke();
    ctx.fillStyle=i%3===0?'#b46d45':i%3===1?'#657a58':'#6b6680';ctx.beginPath();ctx.roundRect(px-4.2*scale,py-17*scale,8.4*scale,10*scale,2*scale);ctx.fill();
    ctx.fillStyle='#c99470';ctx.beginPath();ctx.arc(px,py-21*scale,3.6*scale,0,TAU);ctx.fill();
    ctx.fillStyle='#72543b';ctx.beginPath();ctx.arc(px,py-22*scale,3.8*scale,Math.PI,TAU);ctx.fill();
    ctx.strokeStyle='#7c6b55';ctx.lineWidth=1.5*scale;
    if(encounter.phase==='survey'){
      ctx.beginPath();ctx.moveTo(px+3*side*scale,py-14*scale);ctx.lineTo(x+side*7*scale,py-10*scale);ctx.stroke();
    }else{
      ctx.beginPath();ctx.moveTo(px+2*side*scale,py-14*scale);ctx.lineTo(px+10*side*scale,py-7*scale);ctx.stroke();
      ctx.strokeStyle='#adb4b0';ctx.lineWidth=2*scale;ctx.beginPath();ctx.moveTo(px+8*side*scale,py-9*scale);ctx.lineTo(px+13*side*scale,py-4*scale);ctx.stroke();
    }
  }
  if(encounter.phase==='survey'&&(state.humanAttention||0)===0){
    ctx.fillStyle='#df6d3f';ctx.beginPath();ctx.roundRect(x-5*scale,groundY-15*scale,10*scale,3.2*scale,1.4*scale);ctx.fill();
  }
  ctx.restore();
}

function playerHeight(state,stage,camera){
  if(stage==='Seed')return 2.6*camera.zoom;
  if(stage==='Sprout')return 15*camera.zoom;
  const species=state.selectedSpecies||'Plum',habit=HABITS[species]||HABITS.Plum,scale=(STAGE_SCALE[stage]||.7)*Math.min(1.18,1+(state.trunk||0)*.025)*camera.zoom;
  const tree=buildTree(hash(`${species}:2:resident`),state.branches||0,state.leafClusters||0,habit,stage,state.trunk||0,state.canopySpread||0,state.heightGrowth||0);
  let top=0;tree.wood.forEach(branch=>branch.points.forEach(point=>{top=Math.min(top,point.y)}));tree.clusters.forEach(cluster=>{top=Math.min(top,cluster.y-cluster.size*1.35)});
  return Math.max(12,-top*scale);
}

function drawNearGround(ctx,w,h,groundY,rank){
  if(rank>1)return;const r=rng(9182),alpha=rank===0?1:.48;ctx.save();ctx.globalAlpha=alpha;
  const clusters=rank===0?14:8,depth=Math.max(1,h-groundY-18);
  function pebble(x,y,size,color){
    const points=4+Math.floor(r()*3),rotation=r()*TAU;
    ctx.fillStyle=color;ctx.beginPath();
    for(let p=0;p<points;p++){const angle=rotation+p*TAU/points,radius=size*(.72+r()*.34),px=x+Math.cos(angle)*radius,py=y+Math.sin(angle)*radius*.68;p?ctx.lineTo(px,py):ctx.moveTo(px,py)}
    ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(218,196,157,.36)';ctx.beginPath();ctx.arc(x-size*.2,y-size*.2,Math.max(.18,size*.16),0,TAU);ctx.fill();
  }
  for(let c=0;c<clusters;c++){
    const cx=24+r()*(w-48),cy=groundY+16+r()*depth*.86,total=4+Math.floor(r()*5);
    for(let i=0;i<total;i++){
      const angle=r()*TAU,distance=2+r()*9,size=.55+r()*1.15;
      const colors=['rgba(148,132,108,.80)','rgba(126,110,91,.62)','rgba(168,145,108,.96)','rgba(52,43,36,.48)'];
      pebble(cx+Math.cos(angle)*distance,cy+Math.sin(angle)*distance*.55,size,colors[Math.floor(r()*colors.length)]);
    }
  }
  for(let i=0;i<(rank===0?16:8);i++){ctx.fillStyle=i%2?'rgba(151,132,105,.48)':'rgba(43,35,30,.40)';ctx.beginPath();ctx.arc(10+r()*(w-20),groundY+12+r()*depth*.9,.3+r()*.48,0,TAU);ctx.fill()}
  ctx.restore();
}

function drawWinterWeather(ctx,w,h,groundY){
  const r=rng(77213);ctx.save();
  const snow=ctx.createLinearGradient(0,groundY-4,0,groundY+18);snow.addColorStop(0,'rgba(250,253,255,.94)');snow.addColorStop(1,'rgba(218,231,240,.72)');
  ctx.fillStyle=snow;ctx.beginPath();ctx.moveTo(0,groundY+13);
  for(let x=0;x<=w;x+=24){ctx.lineTo(x,groundY+5+Math.sin(x*.035)*3+r()*2)}
  ctx.lineTo(w,groundY+18);ctx.lineTo(0,groundY+18);ctx.closePath();ctx.fill();
  for(let i=0;i<46;i++){const x=r()*w,y=8+r()*Math.max(16,groundY-18),radius=.7+r()*1.7;ctx.fillStyle=`rgba(248,252,255,${.42+r()*.42})`;ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.fill()}
  ctx.restore();
}

function cameraFor(state,stage){
  const order=['Seed','Sprout','Seedling','Sapling','Small Tree','Mature Tree','Ancient'],rank=Math.max(0,order.indexOf(stage));
  const structuralGrowth=Math.min(.14,((state.rootZones||0)+(state.leafClusters||0)+(state.branches||0))*0.006);
  return{rank,zoom:(CAMERA_ZOOM[stage]||1)*(1-structuralGrowth)};
}

function background(ctx,season){const g=ctx.createLinearGradient(0,0,0,300);g.addColorStop(0,season.top);g.addColorStop(1,season.bottom);return g}
function line(ctx,x1,y1,x2,y2){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}

function drawFungalNetwork(ctx,trees,groundY,getRelationshipState){
  const player=trees.find(tree=>tree.isPlayer),linked=trees.filter(tree=>{
    const neighbor=tree.neighbor;
    if(!neighbor||neighbor.dead)return false;
    return neighbor.offspring||neighbor.relationName==='Ally'||getRelationshipState(neighbor.relation).name==='Ally';
  });
  if(!player||!linked.length)return;
  ctx.strokeStyle='rgba(180,220,255,.6)';ctx.lineWidth=1.5;ctx.setLineDash([4,4]);
  linked.forEach(tree=>{const x=tree.x,y=groundY+70+tree.index*5;ctx.beginPath();ctx.moveTo(player.x,groundY+30);ctx.bezierCurveTo(player.x-(player.x-x)*.3,groundY+70,x+(player.x-x)*.3,y-20,x,y);ctx.stroke();ctx.fillStyle='rgba(180,220,255,.4)';ctx.beginPath();ctx.arc(x,y,3,0,TAU);ctx.fill()});ctx.setLineDash([]);
}

export function getCanopyArrangement(state,slot,isPlayer=false,neighbor=null){
  if(isPlayer){
    const target=getPlayerShadeTarget(state),direction=target?(target.slot<2?-1:1):0;
    return{worldOffset:direction*7,canopyLean:direction*1.55};
  }
  if(!neighbor)return{worldOffset:0,canopyLean:0};
  const side=slot<2?-1:1;
  if(neighbor.shadingPlayer)return{worldOffset:-side*32,canopyLean:-side*1.25};
  if(neighbor.playerShading)return{worldOffset:side*34,canopyLean:side*.85};
  return{worldOffset:0,canopyLean:0};
}

export function getCanopyShadowGeometry(sourceX,targetX,groundY){
  const direction=targetX<sourceX?-1:1,distance=Math.abs(targetX-sourceX),startHalfWidth=Math.max(.12,distance*.01),endHalfWidth=Math.min(36,Math.max(.4,distance*.18));
  return{sourceX,sourceY:groundY+startHalfWidth,targetX,targetY:groundY+endHalfWidth,startHalfWidth,endHalfWidth,direction,distance};
}

function drawCanopyShadow(ctx,source,target,groundY,seed){
  const geometry=getCanopyShadowGeometry(source.x,target.x,groundY),{sourceX,sourceY,targetX,targetY,startHalfWidth,endHalfWidth,distance}=geometry,visualScale=Math.min(1,distance/180);
  const gradient=ctx.createLinearGradient(sourceX,sourceY,targetX,targetY);
  gradient.addColorStop(0,'rgba(28,40,31,.08)');gradient.addColorStop(.34,'rgba(25,39,30,.30)');gradient.addColorStop(1,'rgba(18,31,25,.48)');
  const margin=endHalfWidth*1.8+2,minX=Math.min(sourceX,targetX)-margin,maxX=Math.max(sourceX,targetX)+margin;
  ctx.save();ctx.beginPath();ctx.rect(minX,groundY,maxX-minX,Math.max(1,endHalfWidth*2.8+4));ctx.clip();
  ctx.save();ctx.filter=`blur(${Math.max(.1,Math.min(2.5,distance*.0125))}px)`;ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(sourceX,sourceY-startHalfWidth);ctx.lineTo(targetX,targetY-endHalfWidth);ctx.quadraticCurveTo(targetX+geometry.direction*distance*.04,targetY,targetX,targetY+endHalfWidth);ctx.lineTo(sourceX,sourceY+startHalfWidth);ctx.closePath();ctx.fill();ctx.restore();
  const random=rng(seed);ctx.save();ctx.fillStyle='rgba(19,35,27,.25)';
  for(let i=0;i<14;i++){const progress=.22+random()*.76,x=sourceX+(targetX-sourceX)*progress+(random()-.5)*endHalfWidth*.55,y=sourceY+(targetY-sourceY)*progress+(random()-.5)*endHalfWidth*1.05,size=Math.max(.08,(2+random()*5)*visualScale);ctx.beginPath();ctx.ellipse(x,y,size,size*.48,random()*Math.PI,0,TAU);ctx.fill()}
  ctx.restore();ctx.restore();
}

function drawDirectionalCanopyShadows(ctx,trees,groundY){
  const player=trees.find(tree=>tree.isPlayer),shadeTarget=getPlayerShadeTarget({neighbors:trees.map(tree=>tree.neighbor).filter(Boolean)});if(!player)return;
  const outgoing=trees.find(tree=>tree.neighbor===shadeTarget);if(outgoing)drawCanopyShadow(ctx,player,outgoing,groundY,7100+outgoing.index);
  trees.filter(tree=>tree.neighbor?.shadingPlayer).forEach(tree=>drawCanopyShadow(ctx,tree,player,groundY,7900+tree.index));
}

function drawTree({ctx,x,groundY,isPlayer,neighbor,state,season,playerStageName,getRelationshipState,index,camera,canopyLean=0}){
  const stage=isPlayer?playerStageName:(neighbor?.stageName||'Sapling');
  const species=isPlayer?(state.selectedSpecies||'Plum'):(neighbor?.species||'Plum'); const habit=HABITS[species]||HABITS.Plum;
  const leaves=isPlayer?state.leafClusters:(neighbor?.leafClusters??neighbor?.branches??2), branches=isPlayer?state.branches:(neighbor?.branches??2), trunk=isPlayer?state.trunk:(neighbor?.trunk??1), roots=isPlayer?state.rootZones:(neighbor?.roots??2),taproot=isPlayer?(state.taprootDepth||0):0;
  const heightGrowth=isPlayer?(state.heightGrowth||0):(neighbor?.heightGrowth||0),scale=(STAGE_SCALE[stage]||.7)*Math.min(1.18,1+trunk*.025)*camera.zoom,seed=hash(`${species}:${index}:${neighbor?.offspring?'offspring':'resident'}`),shaded=!isPlayer&&isTreeShaded(state,neighbor),wood=getWoodPalette(habit.bark,shaded);
  const rootedSeed=shouldDrawSeedRadicle(stage,roots,leaves);
  if(stage!=='Seed'&&!rootedSeed)drawRoots(ctx,x,groundY,roots,taproot,scale,wood.bark,seed,isPlayer,wood.highlight);
  if(stage==='Seed'||rootedSeed){
    if(rootedSeed)drawSeedRadicle(ctx,x,groundY,camera.zoom,wood.bark,seed,roots);
    drawSeed(ctx,x,groundY,species,camera.zoom,seed);
  }
  else if(stage==='Sprout')drawSprout(ctx,x,groundY,wood.bark,seed,camera.zoom,leaves,trunk);
  else {
    const tree=buildTree(seed,branches,leaves,habit,stage,trunk,isPlayer?(state.canopySpread||0):0,heightGrowth);
    ctx.save();ctx.translate(x,groundY);ctx.scale(scale,scale);ctx.transform(1,0,-canopyLean*.28,1,0,0);
    drawFoliage(ctx,tree,season,seed,isPlayer,false,shaded);drawWood(ctx,tree,wood.bark,wood.highlight);drawFoliage(ctx,tree,season,seed,isPlayer,true,shaded);
    if(isPlayer&&(state.thornDefense>0||state.toxicLeaves>0))drawPlayerDefenses(ctx,tree,state,seed);
    if(isPlayer&&shouldDrawPlayerBlossoms(state,season))drawBlossoms(ctx,tree,seed,state.flowers);
    if(isPlayer&&season==='Summer'&&state.developing>0)drawFruit(ctx,tree,seed,state.developing,species);
    ctx.restore();
  }
}

export function shouldDrawPlayerBlossoms(state,season){return season==='Spring'&&(state.flowers||0)>0}
export function shouldDrawSeedRadicle(stage,roots,leaves){return(stage==='Seed'||stage==='Sprout')&&roots>0&&leaves===0}
export function isTreeShaded(state,neighbor){return Boolean(neighbor&&neighbor.slot===getPlayerShadeTarget(state)?.slot)}

function drawPlayerDefenses(ctx,tree,state,seed){
  const r=rng(seed+7117),thornCount=Math.min(28,(state.thornDefense||0)*8),toxicCount=Math.min(34,(state.toxicLeaves||0)*9);
  ctx.save();ctx.lineCap='round';
  ctx.strokeStyle='rgba(89,73,46,.92)';ctx.lineWidth=.7;
  for(let i=0;i<thornCount;i++){
    const branch=tree.wood[Math.floor(r()*tree.wood.length)],point=branch.points[4+Math.floor(r()*Math.max(1,branch.points.length-8))],side=r()<.5?-1:1;
    ctx.beginPath();ctx.moveTo(point.x,point.y);ctx.lineTo(point.x+side*(2.5+r()*2),point.y-(1+r()*2));ctx.stroke();
  }
  ctx.fillStyle='rgba(82,67,109,.72)';
  for(let i=0;i<toxicCount;i++){
    const cluster=tree.clusters[Math.floor(r()*tree.clusters.length)],angle=r()*TAU,distance=Math.sqrt(r())*cluster.size*.72;
    ctx.beginPath();ctx.ellipse(cluster.x+Math.cos(angle)*distance,cluster.y+Math.sin(angle)*distance*.7,1.8+r()*1.2,.85+r()*.65,angle,0,TAU);ctx.fill();
  }
  ctx.restore();
}

function drawSeed(ctx,x,y,species,zoom,seed){
  const colors=SEED_PALETTES[species]||SEED_PALETTES.Plum,r=rng(seed+8317);
  ctx.save();ctx.translate(x,y);ctx.scale(zoom,zoom);ctx.rotate(-.12);
  ctx.fillStyle='rgba(18,14,10,.28)';ctx.beginPath();ctx.ellipse(.05,.12,2.15,.34,0,0,TAU);ctx.fill();
  const shell=ctx.createRadialGradient(-.65,-1.9,.08,.15,-1.18,2.3);shell.addColorStop(0,colors[0]);shell.addColorStop(.58,colors[1]);shell.addColorStop(1,colors[2]);
  ctx.fillStyle=shell;ctx.strokeStyle='rgba(55,34,24,.85)';ctx.lineWidth=.13;ctx.beginPath();ctx.moveTo(-2,-.88);ctx.bezierCurveTo(-1.68,-1.95,-.72,-2.62,.45,-2.48);ctx.bezierCurveTo(1.5,-2.36,2.07,-1.5,1.82,-.72);ctx.bezierCurveTo(1.53,.08,.46,.23,-.58,.08);ctx.bezierCurveTo(-1.37,.04,-1.83,-.4,-2,-.88);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.strokeStyle='rgba(66,39,27,.64)';ctx.lineWidth=.16;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(1.25,-1.86);ctx.bezierCurveTo(.72,-1.26,.2,-.72,-.93,-.38);ctx.stroke();
  ctx.strokeStyle='rgba(255,235,190,.48)';ctx.lineWidth=.18;ctx.beginPath();ctx.moveTo(-1.18,-1.55);ctx.quadraticCurveTo(-.72,-2.02,-.15,-2.08);ctx.stroke();
  ctx.fillStyle='rgba(63,38,26,.42)';for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(-.8+r()*1.9,-.45-r()*1.55,.035+r()*.055,0,TAU);ctx.fill()}
  ctx.restore();
}

function drawSeedRadicle(ctx,x,y,zoom,color,seed,rootCount){
  const random=rng(seed+9471),length=(2.8+Math.min(3,rootCount)*.65)*zoom,bend=(random()-.5)*1.2*zoom;
  ctx.save();ctx.strokeStyle=color;ctx.lineCap='round';ctx.lineWidth=Math.max(1,.52*zoom);ctx.beginPath();ctx.moveTo(x,y-.1*zoom);ctx.bezierCurveTo(x+bend*.15,y+length*.28,x+bend,y+length*.7,x+bend*.72,y+length);ctx.stroke();
  if(rootCount>1){ctx.lineWidth=Math.max(.7,.25*zoom);ctx.beginPath();ctx.moveTo(x+bend*.55,y+length*.7);ctx.lineTo(x+bend*.55+(random()<.5?-1:1)*1.15*zoom,y+length*.9);ctx.stroke()}
  ctx.restore();
}

function drawRoots(ctx,x,y,count,taproot,scale,color,seed,player,highlight='rgba(197,169,117,.2)'){
  const r=rng(seed+4409),rootCount=Math.max(1,Math.min(count+(player&&count>0?2:0),8)),paths=[];
  function root(sx,sy,angle,length,width,depth){
    const bend=(r()-.5)*.62,wave=(r()-.5)*.28,points=[];
    for(let i=0;i<=16;i++){const t=i/16,curve=angle+bend*t+Math.sin(t*Math.PI)*wave;points.push({x:sx+Math.cos(curve)*length*t,y:sy+Math.sin(curve)*length*t+length*.12*t*t,width:width*(1-.76*t)})}
    paths.push(points);if(depth>0){const attach=points[9],previous=points[8],heading=Math.atan2(attach.y-previous.y,attach.x-previous.x),side=Math.cos(angle)>=0?1:-1;root(attach.x,attach.y,heading+side*(.45+r()*.38),length*(.4+r()*.16),attach.width*.58,depth-1)}
  }
  for(let i=0;i<rootCount;i++){const side=i%2?1:-1,rank=Math.floor(i/2),angle=side>0?.2+r()*.3:Math.PI-(.2+r()*.3),length=(26+rank*7+r()*10)*scale,width=Math.max(1.4,(7.5-rank*.6)*scale),depth=player?(count>=6?2:count>=1?1:0):0;root(x+side*2*scale,y+2*scale,angle,length,width,depth)}
  if(taproot>0){const length=Math.min(105,30+taproot*13)*scale;root(x,y+2*scale,Math.PI/2+(r()-.5)*.08,length,Math.max(2.5,(8+taproot*.6)*scale),taproot>=3?1:0)}
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.globalAlpha=player ? .92 : .62;
  paths.forEach(points=>{for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];ctx.strokeStyle=color;ctx.lineWidth=Math.max(.55,a.width);line(ctx,a.x,a.y,b.x,b.y);ctx.strokeStyle=highlight;ctx.lineWidth=Math.max(.35,a.width*.16);line(ctx,a.x-a.width*.12,a.y,b.x-b.width*.12,b.y)}});
  const flare=11*scale;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x-flare*.55,y-4*scale);ctx.quadraticCurveTo(x-flare*.7,y+3*scale,x-flare*1.45,y+9*scale);ctx.quadraticCurveTo(x-flare*.45,y+7*scale,x,y+5*scale);ctx.quadraticCurveTo(x+flare*.55,y+8*scale,x+flare*1.45,y+9*scale);ctx.quadraticCurveTo(x+flare*.65,y+2*scale,x+flare*.55,y-4*scale);ctx.closePath();ctx.fill();ctx.restore();
}
function drawSprout(ctx,x,y,bark,seed,zoom,leafCount=0,trunkLevel=1){
  const r=rng(seed),stemHeight=13+Math.min(5,leafCount)*1.2;
  ctx.save();ctx.translate(x,y);ctx.scale(zoom,zoom);ctx.strokeStyle=bark;ctx.lineWidth=1.45+Math.min(4,trunkLevel)*.32;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo((r()-.5)*4,-stemHeight*.54,0,-stemHeight);ctx.stroke();
  [-1,1].forEach(side=>{ctx.save();ctx.translate(side*3.7,-11.5);ctx.rotate(side*.45);ctx.fillStyle=side<0?'#7fa65c':'#98ba68';ctx.beginPath();ctx.ellipse(0,0,4.8,2.4,0,0,TAU);ctx.fill();ctx.restore()});
  for(let i=0;i<Math.min(6,leafCount);i+=1){const side=i%2?1:-1,py=-13-i*1.7,px=side*(2.5+(i%3)*.45);ctx.save();ctx.translate(px,py);ctx.rotate(side*(.32+(i%2)*.1));ctx.fillStyle=i%2?'#88ae63':'#a4c878';ctx.beginPath();ctx.ellipse(0,0,3.2,1.6,0,0,TAU);ctx.fill();ctx.restore()}
  ctx.restore();
}

export function getPlayerVisualProfile(state,stage=state.lifeStage?.name||'Seed'){
  const branchCount=Math.max(0,state.branches||0),leafCount=Math.max(0,state.leafClusters||0),trunkLevel=Math.max(0,state.trunk||0),canopySpread=Math.max(0,state.canopySpread||0);
  return{
    stage,
    branchShoots:Math.min(10,branchCount),
    foliageClusters:leafCount===0?0:Math.max(1,leafCount+Math.floor(leafCount/2)),
    foliageDensity:leafCount===0?0:Math.min(30,5+leafCount*2),
    trunkWidth:(stage==='Seedling'?6:10)+Math.min(8,trunkLevel*1.2)+Math.min(6,branchCount*.55),
    canopySpreadFactor:1+Math.min(.38,canopySpread*.07),
    heightFactor:1+Math.min(.5,Math.max(0,state.heightGrowth||0)*.075),
    rootBranches:Math.max(1,Math.min((state.rootZones||0)+((state.rootZones||0)>0?2:0),8)),
    taprootDepth:Math.max(0,state.taprootDepth||0),
  };
}

function buildTree(seed,branchCount,leafCount,habit,stage,trunkLevel=1,canopySpread=0,heightGrowth=0){
  const r=rng(seed),wood=[],clusters=[],depth=stage==='Seedling'?2:stage==='Sapling'?3:4,structure=Math.max(.72,Math.min(1.32,.78+branchCount*.055)),profile=getPlayerVisualProfile({branches:branchCount,leafClusters:leafCount,trunk:trunkLevel,canopySpread,heightGrowth,rootZones:0,taprootDepth:0,lifeStage:{name:stage}},stage);
  function limb(x,y,angle,length,width,remaining,turn=0,z=r()){
    const bend=(r()-.5)*habit.bend,endAngle=angle+turn+bend,p0={x,y},p1={x:x+Math.cos(angle)*length*.38,y:y+Math.sin(angle)*length*.38},p3={x:x+Math.cos(angle+turn*.65+bend*.45)*length*habit.spread*profile.canopySpreadFactor,y:y+Math.sin(angle+turn*.65+bend*.45)*length},p2={x:p3.x-Math.cos(endAngle)*length*.32,y:p3.y-Math.sin(endAngle)*length*.32},points=[];
    for(let i=0;i<=18;i++){const t=i/18,u=1-t;points.push({x:u**3*p0.x+3*u*u*t*p1.x+3*u*t*t*p2.x+t**3*p3.x,y:u**3*p0.y+3*u*u*t*p1.y+3*u*t*t*p2.y+t**3*p3.y,width:width*(1-.52*t)})}wood.push({points,z});
    if(!remaining){clusters.push({x:p3.x,y:p3.y,size:8+r()*5+Math.min(5,leafCount*.12),z});return}
    const end=points.at(-1),prev=points.at(-2),tangent=Math.atan2(end.y-prev.y,end.x-prev.x);limb(end.x,end.y,tangent,length*(.65+r()*.08),end.width*.58,remaining-1,(r()-.5)*.2,z+.01);
    [-1,1].forEach(side=>{const k=9+(side>0?3:0),p=points[k],q=points[k-1],a=Math.atan2(p.y-q.y,p.x-q.x);limb(p.x,p.y,a,length*(.48+r()*.15),p.width*.54,remaining-1,side*(.62+r()*.42),z+side*.08)})
  }
  limb(0,0,-Math.PI/2,62*habit.height*structure*profile.heightFactor,profile.trunkWidth,depth);
  const establishedWood=[...wood];
  for(let i=0;i<profile.branchShoots;i+=1){const host=establishedWood[(i*7+3)%establishedWood.length],attachIndex=5+((i*3)%8),attach=host.points[Math.min(attachIndex,host.points.length-2)],previous=host.points[Math.max(0,attachIndex-1)],heading=Math.atan2(attach.y-previous.y,attach.x-previous.x),side=i%2?1:-1;limb(attach.x,attach.y,heading,15+(i%4)*2.5,Math.max(1.4,attach.width*.52),0,side*(.58+(i%3)*.12),host.z+side*.11)}
  return{wood,clusters,leafCount,profile};
}

function drawWood(ctx,tree,bark,highlight='rgba(201,177,127,.28)'){ctx.lineCap='round';ctx.lineJoin='round';[...tree.wood].sort((a,b)=>a.z-b.z).forEach(branch=>{const p=branch.points;ctx.strokeStyle=bark;ctx.lineWidth=p[0].width;stroke(ctx,p);ctx.strokeStyle=highlight;ctx.lineWidth=Math.max(.45,p[0].width*.13);ctx.save();ctx.translate(-p[0].width*.13,0);stroke(ctx,p);ctx.restore()});const base=Math.max(7,(tree.profile?.trunkWidth||13)*.56);ctx.fillStyle=bark;ctx.beginPath();ctx.moveTo(-base,-14);ctx.quadraticCurveTo(-base,-2,-base*2.3,4);ctx.quadraticCurveTo(-base*.85,2,0,1);ctx.quadraticCurveTo(base*.85,3,base*2.2,4);ctx.quadraticCurveTo(base,-3,base,-14);ctx.fill()}
function stroke(ctx,points){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke()}

function drawFoliage(ctx,tree,season,seed,player,front,shaded=false){if(season==='Winter')return;const colors=getFoliagePalette(season,shaded),ordered=player?[...tree.clusters].map((cluster,index)=>({cluster,index,priority:hash(`${seed}:leaf:${index}`)})).sort((a,b)=>a.priority-b.priority).slice(0,Math.min(tree.clusters.length,tree.profile?.foliageClusters||0)):tree.clusters.map((cluster,index)=>({cluster,index}));ordered.forEach(({cluster:c,index:k})=>{if((c.z>.48)!==front)return;const r=rng(seed+k*701+91),density=player?(tree.profile?.foliageDensity||0):14;for(let i=0;i<density;i++){const a=r()*TAU,d=Math.sqrt(r()),x=c.x+Math.cos(a)*d*c.size,y=c.y+Math.sin(a)*d*c.size*.72;ctx.fillStyle=colors[Math.floor(r()*colors.length)];ctx.globalAlpha=(shaded ? .84 : .72)+r()*(shaded ? .13 : .25);ctx.beginPath();ctx.ellipse(x,y,2.1+r()*2.5,1.2+r()*1.5,r()*Math.PI,0,TAU);ctx.fill()}});ctx.globalAlpha=1}
export function getFoliagePalette(season,shaded=false){if(shaded){if(season==='Spring')return['#587653','#476746','#39573d','#668059','#304b37'];if(season==='Autumn')return['#87662c','#744827','#63372c','#917332','#51352d'];return['#506d49','#405f41','#334f3a','#5d7650','#294333']}if(season==='Spring')return['#bdd58b','#9fc276','#7eaa68','#d5df9a','#6e985f'];if(season==='Autumn')return['#d4a334','#c4812f','#a95d32','#e0b744','#8d5034'];return['#9fbd68','#7fa65b','#668f54','#b6cc79','#4f784a']}
export function getWoodPalette(bark,shaded=false){if(!shaded)return{bark,highlight:'rgba(201,177,127,.28)'};const hex=bark.replace('#',''),parts=[0,2,4].map(offset=>Math.round(parseInt(hex.slice(offset,offset+2),16)*.56).toString(16).padStart(2,'0'));return{bark:`#${parts.join('')}`,highlight:'rgba(113,105,82,.18)'}}

function drawBlossoms(ctx,tree,seed,count){if(count<=0||!tree.clusters.length)return;const r=rng(seed+1907),total=Math.min(78,7+count*12);for(let i=0;i<total;i++){const c=tree.clusters[Math.floor(r()*tree.clusters.length)],a=r()*TAU,d=Math.sqrt(r())*c.size*.72,x=c.x+Math.cos(a)*d,y=c.y+Math.sin(a)*d*.65,size=1.8+r()*2.1,open=.3+r()*.7;ctx.save();ctx.translate(x,y);ctx.rotate(r()*TAU);ctx.scale(1,open);ctx.shadowColor='rgba(255,236,224,.92)';ctx.shadowBlur=2.2;if(open<.4){ctx.fillStyle='#cf718b';ctx.beginPath();ctx.ellipse(0,0,size*.7,size*1.25,0,0,TAU);ctx.fill()}else{for(let p=0;p<5;p++){const pa=p*TAU/5;ctx.fillStyle=p%2?'#fffaf0':'#e99aac';ctx.beginPath();ctx.ellipse(Math.cos(pa)*size*.75,Math.sin(pa)*size*.75,size*.72,size*.5,pa,0,TAU);ctx.fill()}ctx.fillStyle='#9d6227';ctx.beginPath();ctx.arc(0,0,size*.36,0,TAU);ctx.fill()}ctx.restore()}}
function drawFruit(ctx,tree,seed,count,species){const r=rng(seed+2701),colors={Plum:['#704a78','#573c67'],Peach:['#df8054','#ca664c'],Apricot:['#e39a48','#cf7d39'],Pear:['#a9aa4d','#879345'],Citrus:['#e0a62f','#cf8325'],Cherry:['#a93f45','#792f3b']}[species]||['#704a78','#573c67'];for(let i=0;i<Math.min(42,7+count*5);i++){const c=tree.clusters[Math.floor(r()*tree.clusters.length)],x=c.x+(r()-.5)*c.size*1.15,y=c.y+(r()-.15)*c.size*.72,size=1.5+r()*1.8;ctx.strokeStyle='#66583e';ctx.lineWidth=.55;ctx.beginPath();ctx.moveTo(x,y-size*1.5);ctx.quadraticCurveTo(x+1,y-size,x,y-size*.65);ctx.stroke();const g=ctx.createRadialGradient(x-size*.35,y-size*.35,.1,x,y,size*1.2);g.addColorStop(0,colors[0]);g.addColorStop(1,colors[1]);ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,y,size*.8,size,(r()-.5)*.35,0,TAU);ctx.fill()}}

export function getTreeLabelText(isPlayer,neighbor,state,stage,getRelationshipState){
  const relationName=isPlayer?'You':neighbor?.offspring?'Offspring — Ally':(neighbor?.relationName||getRelationshipState(neighbor?.relation).name||(neighbor?.ally?'Ally':'Neutral')),
        species=isPlayer?(state.selectedSpecies||'Tree'):(neighbor?.species||'Tree'),
        stageName=isPlayer?stage:(neighbor?.stageName||'Sapling'),
        allied=!isPlayer&&(neighbor?.offspring||getRelationshipState(neighbor?.relation).name==='Ally'),
        hasHealth=allied&&Number.isFinite(neighbor?.health)&&Number.isFinite(neighbor?.maxHealth),
        healthText=hasHealth?` · ♥ ${Math.max(0,neighbor.health)}/${neighbor.maxHealth}`:'';
  return{relationName,allied,primary:isPlayer?`${species} — ${stageName}`:species,secondary:isPlayer?'(You)':`${stageName} · ${relationName}${healthText}`};
}

function drawLabel(ctx,x,y,isPlayer,neighbor,state,stage,getRelationshipState,rows){
  if(!isPlayer&&!neighbor)return;
  const label=getTreeLabelText(isPlayer,neighbor,state,stage,getRelationshipState),
        displayWidth=ctx.canvas.clientWidth||ctx.canvas.width,
        phoneScale=Math.max(1,Math.min(2.2,ctx.canvas.width/Math.max(1,displayWidth))),
        primary=label.primary,
        secondary=label.secondary,
        primarySize=(isPlayer?13:12.5)*phoneScale,secondarySize=11*phoneScale,padX=7*phoneScale,
        boxHeight=35*phoneScale,rowStep=40*phoneScale,gap=5*phoneScale;
  ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font=`600 ${primarySize}px sans-serif`;const primaryWidth=ctx.measureText(primary).width;
  ctx.font=`${secondarySize}px sans-serif`;const secondaryWidth=ctx.measureText(secondary).width;
  const boxWidth=Math.max(primaryWidth,secondaryWidth)+padX*2;
  let centerX=Math.max(boxWidth/2+7,Math.min(ctx.canvas.width-boxWidth/2-7,x)),row=0;
  while(row<rows.length&&centerX-boxWidth/2<rows[row]+gap)row+=1;
  rows[row]=centerX+boxWidth/2;
  const top=y+18*phoneScale+row*rowStep;
  ctx.fillStyle=isPlayer?'rgba(30,25,20,.78)':'rgba(30,25,20,.58)';
  ctx.strokeStyle=isPlayer?'rgba(255,255,255,.34)':'rgba(255,255,255,.18)';ctx.lineWidth=Math.max(1,phoneScale*.65);
  ctx.beginPath();ctx.roundRect(centerX-boxWidth/2,top,boxWidth,boxHeight,6*phoneScale);ctx.fill();ctx.stroke();
  ctx.font=`600 ${primarySize}px sans-serif`;ctx.fillStyle=isPlayer?'rgba(255,255,255,.98)':'rgba(255,255,255,.88)';ctx.fillText(primary,centerX,top+11*phoneScale);
  ctx.font=`${secondarySize}px sans-serif`;
  ctx.fillStyle=label.allied?'rgba(187,247,208,.95)':'rgba(255,255,255,.7)';
  ctx.fillText(secondary,centerX,top+25.5*phoneScale);
  ctx.restore();
}
function hash(value){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
