// Action-sized growth assembled around the approved painted stage specimens.
// Only presentation state lives here; the resource/action rules remain in core/.
const imagePixels = new WeakMap();
const textures = new WeakMap();
const spriteMetrics = new WeakMap();
const count = value => Math.max(0, Math.floor(Number(value) || 0));

export function syncGrowthAttachments(state) {
  const species = state.selectedSpecies || 'Plum';
  const fresh = !state.visualGrowth || state.visualGrowth.species !== species;
  if (fresh) state.visualGrowth = { species, leafHosts: [] };
  const stage = state.lifeStage?.name || null;
  if (!state.visualGrowth.structuralBase || state.visualGrowth.stage !== stage) {
    // The complete painted specimen absorbs all structure accumulated before
    // this stage. Only later investments receive small terminal overlays.
    state.visualGrowth.stage = stage;
    state.visualGrowth.structuralBase = {
      roots: count(state.rootZones),
      branches: count(state.branches),
      taproots: count(state.taprootDepth),
    };
  }
  state.visualGrowth.juvenilePeak = Math.max(state.visualGrowth.juvenilePeak || 0, count(state.leafClusters));
  const hosts = state.visualGrowth.leafHosts || (state.visualGrowth.leafHosts = []);
  hosts.length = Math.min(hosts.length, count(state.leafClusters));
  while (hosts.length < count(state.leafClusters)) {
    const branches = count(state.branches);
    hosts.push(branches ? (fresh ? hosts.length % branches : branches - 1) : -1);
  }
  return state.visualGrowth;
}

export function getPaintedGrowthPlan(state, stage, geometry) {
  const { width, height } = geometry;
  const juvenile = stage === 'Seed' || stage === 'Sprout' || stage === 'Seedling';
  const current = {roots:count(state.rootZones),branches:count(state.branches),taproots:count(state.taprootDepth)};
  const base = state.visualGrowth?.structuralBase || current;
  const absorbedRoots = Math.max(count(base.roots), stage === 'Seed' ? 1 : 0);
  const rootVariants = ['radicle','forked','fan'];
  const roots = Array.from({ length: Math.max(0, current.roots - absorbedRoots) }, (_, offset) => {
    const index=absorbedRoots+offset,side=index%2?1:-1,tier=Math.floor(offset/6);
    return { id: `root-${index}`, index, spriteVariant:rootVariants[Math.min(2,offset)], u:side<0?.18:.82,
      v:(geometry.rootStart || .67)+(offset%3)*(geometry.juvenile?.035:.045),
      dx:side*width*(.11+(offset%3)*.025+tier*.018),dy:height*(.11+(offset%2)*.025),
      // Early roots build a legible three-step progression, like the first
      // painted leaf sequence: radicle, fork, then a spreading fine-root fan.
      spriteSize:height*(juvenile?[.34,.42,.50][Math.min(2,offset)]:[.19,.22,.25][Math.min(2,offset)]) };
  });
  const absorbedTaproots=count(base.taproots);
  for(let offset=0;offset<Math.max(0,current.taproots-absorbedTaproots);offset++){
    const index=absorbedTaproots+offset;
    roots.push({id:`taproot-${index}`,index,kind:'taproots',spriteVariant:rootVariants[Math.min(2,offset)],u:.5,
      v:.76+Math.min(.12,offset*.035),dx:width*(offset%2?.025:-.025),dy:height*(.12+offset*.02),spriteSize:height*(juvenile?.17:.2)});
  }
  const absorbedBranches=count(base.branches);
  const branches = Array.from({ length: Math.max(0,current.branches-absorbedBranches) }, (_, offset) => {
    const index=absorbedBranches+offset,side=index%2?1:-1,tier=Math.floor(offset/6);
    return { id: `branch-${index}`, index, spriteVariant:'shoot', u:side<0?.16:.84, v:.18+(index%6)*.055,
      dx:side*width*(.12+(offset%3)*.025+tier*.015),dy:-height*(.065+(offset%3)*.012),
      spriteSize:width*(juvenile?.16:.22) };
  });
  const hostSlots = new Map();
  const leaves = Array.from({ length: count(state.leafClusters) }, (_, i) => {
    const side = i % 2 ? -1 : 1, tier = Math.floor(i / 6);
    const host = state.visualGrowth?.leafHosts?.[i] ?? -1;
    const hostSlot=hostSlots.get(host)||0;hostSlots.set(host,hostSlot+1);
    const foliageWidth=width*(juvenile ? .50 : .42);
    return { id: `leaf-${i}`, index: i, hostSlot, host: branches.some(branch=>branch.index===host) ? host : -1,
      attachmentSurface: geometry.juvenile ? 'stem' : 'plant',
      u: .5, v: .12 + (i % 6) * .067, side,
      // Keep the supporting twig's end well inside the foliage module. Older
      // offsets could exceed half the painted cluster width and read as a
      // detached crown, especially on broad Plum specimens.
      dx: side * width * (.10 + (i % 3) * .018 + Math.min(3,tier) * .012),
      dy: -height * (.012 + (i % 2) * .012),
      width: foliageWidth, thickness: width * (juvenile ? .025 : .013) };
  });
  if(geometry.juvenile) {
    for(const leaf of leaves) {
      const slot=leaf.index-(geometry.representedLeaves||0);
      leaf.v=.22+(Math.max(0,slot)%5)*.047;
      leaf.dx=leaf.side*width*(.12+Math.floor(Math.max(0,slot)/5)*.025);
      leaf.dy=-height*.012;
      leaf.width=width*.25;
      leaf.thickness=width*.009;
    }
  }
  return { roots, branches, leaves:geometry.juvenile?leaves.slice(geometry.representedLeaves):leaves };
}

export function growthReveal(index, kind, reveal) {
  if (!reveal || index < (reveal.from[kind] || 0)) return 1;
  return Math.max(0, Math.min(1, reveal.progress));
}

export function leafReveal(leaf, reveal) {
  const progress=growthReveal(leaf.index,'leaves',reveal);
  if(!reveal||leaf.host<0||leaf.host<(reveal.from.branches||0))return progress;
  // New foliage waits for its supporting branch to reach its attachment.
  const attachment=leaf.attachment??(.58+(leaf.hostSlot||0)%4*.1);
  return progress*Math.max(0,(reveal.progress-attachment)/(1-attachment));
}

function pixels(image, source) {
  if (imagePixels.has(image)) return imagePixels.get(image);
  const canvas = document.createElement('canvas');
  canvas.width = source?.width || image.naturalWidth || image.width;
  canvas.height = source?.height || image.naturalHeight || image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, source?.x || 0, source?.y || 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  const result = { canvas, data: ctx.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height };
  imagePixels.set(image, result);
  return result;
}

// Attach to opaque tissue in the actual PNG, not to an assumed center line.
function inkPoint(pixel, u, v) {
  const desiredX = pixel.width * u, desiredY = Math.round(pixel.height * v);
  for (let radius = 0; radius < 24; radius++) {
    for (const y of radius ? [desiredY - radius, desiredY + radius] : [desiredY]) {
      if (y < 0 || y >= pixel.height) continue;
      let best = null, distance = Infinity;
      for (let x = 0; x < pixel.width; x++) {
        if (pixel.data[(y * pixel.width + x) * 4 + 3] < 210) continue;
        const d = Math.abs(x - desiredX);
        if (d < distance) { best = { x, y }; distance = d; }
      }
      if (best) {
        // Move off an antialiased edge into the same contiguous piece of wood.
        let left = best.x, right = best.x;
        while (left > 0 && pixel.data[(y * pixel.width + left - 1) * 4 + 3] > 160) left--;
        while (right < pixel.width - 1 && pixel.data[(y * pixel.width + right + 1) * 4 + 3] > 160) right++;
        return { x: (left + right) / 2, y, left, right };
      }
    }
  }
  return null;
}

// Move an interior attachment point to the first painted edge in the growth
// direction. The persistent sprite is drawn below the stage painting, so its
// base remains concealed while the new terminal growth emerges beyond the
// existing silhouette instead of disappearing underneath it.
function terminalPoint(pixel, ink, dx, dy) {
  const length = Math.hypot(dx, dy) || 1;
  const stepX = dx / length, stepY = dy / length;
  let x = ink.x, y = ink.y, last = { x, y };
  const limit = Math.ceil(Math.hypot(pixel.width, pixel.height));
  for (let step = 0; step < limit; step++) {
    const px = Math.round(x), py = Math.round(y);
    if (px < 0 || px >= pixel.width || py < 0 || py >= pixel.height) break;
    const alpha = pixel.data[(py * pixel.width + px) * 4 + 3];
    if (alpha < 96) break;
    last = { x, y };
    x += stepX;
    y += stepY;
  }
  return last;
}

function woodTexture(image, pixel) {
  if (textures.has(image)) return textures.get(image);
  // Straighten a small strip of the specimen's own wood. Both color and grain
  // come from the approved source painting; no flat-color plant fallback.
  const canvas = document.createElement('canvas'); canvas.width = 24; canvas.height = 96;
  const ctx = canvas.getContext('2d');
  for (let row = 0; row < 96; row++) {
    const p = inkPoint(pixel, .5, .63 + row / 96 * .13);
    if (!p) continue;
    const half=Math.max(1,Math.min(7,(p.right-p.left)*.44));
    ctx.drawImage(pixel.canvas, Math.max(0,p.x-half), p.y, half*2, 1, 0, row, 24, 1);
  }
  textures.set(image, canvas);
  return canvas;
}

function curvePoint(start, end, bend, t) {
  const control = { x: start.x + (end.x - start.x) * .62 + bend, y: start.y + (end.y - start.y) * .08 };
  return { x: (1-t)**2*start.x+2*(1-t)*t*control.x+t*t*end.x, y: (1-t)**2*start.y+2*(1-t)*t*control.y+t*t*end.y };
}

function ribbon(ctx, texture, start, end, thickness, progress = 1, bend = 0) {
  if (progress <= 0) return;
  const steps = 28, left = [], right = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps * progress, p = curvePoint(start, end, bend, t);
    const q = curvePoint(start, end, bend, Math.min(1, t + .001));
    const before = t === 1 ? curvePoint(start, end, bend, .999) : p;
    const dx = q.x - before.x, dy = q.y - before.y, length = Math.hypot(dx,dy) || 1;
    const half = thickness * (1 - t * .94) / 2;
    left.push({ x:p.x-dy/length*half, y:p.y+dx/length*half });
    right.push({ x:p.x+dy/length*half, y:p.y-dx/length*half });
  }
  // Carry the painted grain along the curve, rather than stretching a texture
  // across its whole bounding box (which makes a curved root read as a spike).
  for(let i=0;i<steps;i++) {
    const a=left[i],b=right[i],c=left[i+1],d=right[i+1];
    const sy=i/steps*texture.height,sh=texture.height/steps;
    const topWidth=Math.hypot(b.x-a.x,b.y-a.y),bottomWidth=Math.hypot(d.x-c.x,d.y-c.y);
    const middle={x:(a.x+b.x)/2,y:(a.y+b.y)/2},next={x:(c.x+d.x)/2,y:(c.y+d.y)/2};
    const length=Math.hypot(next.x-middle.x,next.y-middle.y);
    ctx.save();ctx.translate(middle.x,middle.y);ctx.rotate(Math.atan2(next.y-middle.y,next.x-middle.x)-Math.PI/2);
    // Tiny overlap avoids hairline seams between rotated paint strips.
    const w=Math.max(topWidth,bottomWidth);
    ctx.drawImage(texture,0,sy,texture.width,sh,-w/2,-.04,w,length+.10);ctx.restore();
  }
}

function getSpriteMetrics(image,kind){
  let cached=spriteMetrics.get(image);if(cached)return cached;
  const pixel=pixels(image),threshold=96;let minX=pixel.width,minY=pixel.height,maxX=0,maxY=0;
  for(let y=0;y<pixel.height;y++)for(let x=0;x<pixel.width;x++)if(pixel.data[(y*pixel.width+x)*4+3]>=threshold){
    minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
  }
  if(maxX<=minX||maxY<=minY)return null;
  if(kind==='shoot'){
    const band=Math.max(2,(maxX-minX)*.08);let sx=0,sy=0,n=0;
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=Math.min(maxX,minX+band);x++)if(pixel.data[(y*pixel.width+x)*4+3]>=threshold){sx+=x;sy+=y;n++;}
    cached={anchorX:n?sx/n:minX,anchorY:n?sy/n:maxY,tipX:maxX,tipY:minY,bounds:{minX,minY,maxX,maxY}};
  }else{
    // Sink the sprite anchor below the blunt extraction cap. The discarded
    // proximal portion stays inside the painted root while the fine distal
    // rootlets emerge cleanly from it.
    const start=minY+(maxY-minY)*.12,band=Math.max(2,(maxY-minY)*.05);let sx=0,sy=0,n=0;
    for(let y=Math.round(start);y<=Math.min(maxY,Math.round(start+band));y++)for(let x=minX;x<=maxX;x++)if(pixel.data[(y*pixel.width+x)*4+3]>=threshold){sx+=x;sy+=y;n++;}
    cached={anchorX:n?sx/n:(minX+maxX)/2,anchorY:n?sy/n:start,tipX:(minX+maxX)/2,tipY:maxY,bounds:{minX,minY,maxX,maxY}};
  }
  spriteMetrics.set(image,cached);return cached;
}

function drawSprite(ctx,image,module,progress,kind,season){
  if(!image||progress<=0)return;
  const metrics=getSpriteMetrics(image,kind);if(!metrics)return;
  const size=module.spriteSize,scale=size/image.naturalWidth;
  ctx.save();ctx.translate(module.start.x,module.start.y);
  if(kind==='shoot'){
    ctx.rotate(Math.atan2(module.dy,module.dx));ctx.scale(progress,progress);
    if(season==='Winter'){
      // Retain the central woody shoot while concealing its young leaves.
      const tx=(metrics.tipX-metrics.anchorX)*scale,ty=(metrics.tipY-metrics.anchorY)*scale,w=size*.055;
      const length=Math.hypot(tx,ty)||1,nx=-ty/length*w,ny=tx/length*w;
      ctx.beginPath();ctx.moveTo(nx,ny);ctx.lineTo(tx+nx,ty+ny);ctx.lineTo(tx-nx,ty-ny);ctx.lineTo(-nx,-ny);ctx.closePath();ctx.clip();
    }
  }else{
    ctx.rotate(Math.atan2(module.dy,module.dx)-Math.PI/2);ctx.scale(progress,progress);
    const rootLength=(metrics.bounds.maxY-metrics.anchorY)*scale,rootWidth=size*.54;
    // Taper the visible join to a point even though the source specimen was
    // extracted from a larger painted sheet with a flat proximal edge.
    ctx.beginPath();ctx.moveTo(-size*.012,0);ctx.lineTo(-size*.075,rootLength*.2);
    ctx.lineTo(-rootWidth,rootLength);ctx.lineTo(rootWidth,rootLength);
    ctx.lineTo(size*.075,rootLength*.2);ctx.lineTo(size*.012,0);ctx.closePath();ctx.clip();
  }
  ctx.drawImage(image,-metrics.anchorX*scale,-metrics.anchorY*scale,image.naturalWidth*scale,image.naturalHeight*scale);
  ctx.restore();
}

export function drawGrowthSprites(ctx,growth,reveal,season,{getRootImage,getBranchImage}={}){
  for(const root of growth.roots)drawSprite(ctx,getRootImage?.(root),root,growthReveal(root.index,root.kind||'roots',reveal),'root',season);
  for(const branch of growth.branches)drawSprite(ctx,getBranchImage?.(branch),branch,growthReveal(branch.index,'branches',reveal),'shoot',season);
}

export function preparePaintedGrowth(image, source, state, stage, geometry, supportImage=null) {
  const pixel=pixels(image,source),supportPixel=supportImage?pixels(supportImage):pixel,texture=woodTexture(image,pixel);
  const plan=getPaintedGrowthPlan(state,stage,geometry);
  const position=(module,surface=pixel)=>{
    const ink=inkPoint(surface,module.u,module.v);
    if(!ink)return null;
    const direction={
      x:module.dx/geometry.width*surface.width,
      y:module.dy/geometry.height*surface.height,
    };
    // Root stamps begin within the painted root mass so their blunt source
    // caps remain hidden; only their fine distal growth emerges. Shoots need
    // the actual silhouette edge because their painted base is already slim.
    const terminal=geometry.juvenile&&module.id.startsWith('root-')
      ? ink
      : terminalPoint(surface,ink,direction.x,direction.y);
    const start={
      x:(terminal.x/surface.width-(geometry.anchorX||.5))*geometry.width,
      y:(terminal.y/surface.height-geometry.groundRatio)*geometry.height,
    };
    return {...module,start,end:{x:start.x+module.dx,y:start.y+module.dy}};
  };
  const roots=plan.roots.map(module=>position(module)).filter(Boolean);
  // Juvenile support images contain the shoot/wood with foliage removed. That
  // prevents a broad painted leaf from being mistaken for a stem attachment.
  const branches=plan.branches.map(module=>position(module,geometry.juvenile?supportPixel:pixel)).filter(Boolean);
  const leaves=plan.leaves.map(module=>{
    const host=branches.find(b=>b.index===module.host);
    if(!host)return position(module,module.attachmentSurface==='stem'?supportPixel:pixel);
    const attachment=.58+(module.hostSlot%4)*.1,tier=Math.floor(module.hostSlot/4);
    const start=curvePoint(host.start,host.end,host.dx*.1,attachment);
    const reach=Math.min(module.width*.34,geometry.width*(.08+Math.min(3,tier)*.015));
    return {...module,attachment,start,end:{x:start.x+module.side*reach,y:start.y-Math.min(module.width*.1,geometry.height*.02)}};
  }).filter(Boolean);
  return {texture,roots,branches,leaves};
}

export function drawGrowthWood(ctx,growth,reveal,season){
  // Major roots and branches use painted persistent modules. The only curved
  // ribbons retained here are short petioles concealed by foliage clusters.
  if(season!=='Winter')for(const leaf of growth.leaves)ribbon(ctx,growth.texture,leaf.start,leaf.end,leaf.thickness,leafReveal(leaf,reveal));
}

export function drawGrowthLeaves(ctx,growth,reveal,season,getImage,filter='none'){
  if(season==='Winter')return;
  for(const leaf of growth.leaves){
    const image=getImage(leaf.index);if(!image)continue;
    const progress=leafReveal(leaf,reveal);if(progress<=0)continue;
    const width=leaf.width*progress,height=width*image.naturalHeight/image.naturalWidth;
    const center=curvePoint(leaf.start,leaf.end,0,progress);
    ctx.save();ctx.translate(center.x,center.y);ctx.scale(leaf.side,1);ctx.rotate(leaf.side*.12);ctx.filter=filter;
    // The petiole ends inside the painted twig junction, not at the edge of
    // transparent padding; the existing cluster overlaps and conceals the join.
    ctx.drawImage(image,-width*.48,-height*.56,width,height);ctx.restore();
  }
}
