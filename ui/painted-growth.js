// Action-sized growth assembled around the approved painted stage specimens.
// Only presentation state lives here; the resource/action rules remain in core/.
const imagePixels = new WeakMap();
const textures = new WeakMap();
const count = value => Math.max(0, Math.floor(Number(value) || 0));

export function syncGrowthAttachments(state) {
  const species = state.selectedSpecies || 'Plum';
  const fresh = !state.visualGrowth || state.visualGrowth.species !== species;
  if (fresh) state.visualGrowth = { species, leafHosts: [] };
  const hosts = state.visualGrowth.leafHosts;
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
  const roots = Array.from({ length: Math.max(0, count(state.rootZones) - 1) }, (_, i) => {
    const side = i % 2 ? 1 : -1, tier = Math.floor(i / 6);
    return { id: `root-${i + 1}`, index: i + 1, u: .5, v: .66 + (i % 3) * .055,
      dx: side * width * (.30 + (i % 3) * .095 + tier * .045),
      dy: height * (.16 + (i % 2) * .05 + tier * .025),
      thickness: width * (juvenile ? .026 : .016) };
  });
  if(count(state.taprootDepth)) roots.push({id:'taproot',depth:count(state.taprootDepth),index:count(state.taprootDepth)-1,kind:'taproots',u:.5,v:.76,dx:width*.025,dy:height*(.16+count(state.taprootDepth)*.085),thickness:width*.032});
  const branches = Array.from({ length: count(state.branches) }, (_, i) => {
    const side = i % 2 ? 1 : -1, tier = Math.floor(i / 6);
    return { id: `branch-${i}`, index: i, u: .5, v: .22 + (i % 6) * .048,
      dx: side * width * (.35 + (i % 3) * .07 + tier * .035),
      dy: -height * (.12 + (i % 3) * .025), thickness: width * .032 };
  });
  const hostSlots = new Map();
  const leaves = Array.from({ length: count(state.leafClusters) }, (_, i) => {
    const side = i % 2 ? -1 : 1, tier = Math.floor(i / 6);
    const host = state.visualGrowth?.leafHosts?.[i] ?? -1;
    const hostSlot=hostSlots.get(host)||0;hostSlots.set(host,hostSlot+1);
    return { id: `leaf-${i}`, index: i, hostSlot, host: host < branches.length ? host : -1,
      u: .5, v: .12 + (i % 6) * .067, side,
      dx: side * width * (.21 + (i % 3) * .07 + tier * .065),
      dy: -height * (.025 + (i % 2) * .035),
      width: width * (juvenile ? .50 : .39), thickness: width * (juvenile ? .025 : .013) };
  });
  return { roots, branches, leaves };
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
  canvas.width = source?.width || image.naturalWidth;
  canvas.height = source?.height || image.naturalHeight;
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

export function preparePaintedGrowth(image, source, state, stage, geometry) {
  const pixel=pixels(image,source),texture=woodTexture(image,pixel);
  const plan=getPaintedGrowthPlan(state,stage,geometry);
  const position=module=>{
    const ink=inkPoint(pixel,module.u,module.v);
    if(!ink)return null;
    const start={x:(ink.x/pixel.width-.5)*geometry.width,y:(ink.y/pixel.height-geometry.groundRatio)*geometry.height};
    return {...module,start,end:{x:start.x+module.dx,y:start.y+module.dy}};
  };
  const roots=plan.roots.map(position).filter(Boolean),branches=plan.branches.map(position).filter(Boolean);
  const leaves=plan.leaves.map(module=>{
    const host=branches.find(b=>b.index===module.host);
    if(!host)return position(module);
    const attachment=.58+(module.hostSlot%4)*.1,tier=Math.floor(module.hostSlot/4);
    const start=curvePoint(host.start,host.end,host.dx*.1,attachment);
    return {...module,attachment,start,end:{x:start.x+module.side*geometry.width*(.13+tier*.06),y:start.y-geometry.height*(.045+tier*.028)},width:module.width*.85};
  }).filter(Boolean);
  return {texture,roots,branches,leaves};
}

export function drawGrowthWood(ctx,growth,reveal,season){
  for(const root of growth.roots){
    let progress=growthReveal(root.index,root.kind||'roots',reveal);
    if(root.kind==='taproots'&&reveal?.from.taproots){const existing=(.16+reveal.from.taproots*.085)/(.16+root.depth*.085);progress=existing+(1-existing)*progress;}
    ribbon(ctx,growth.texture,root.start,root.end,root.thickness,progress,root.dx*.12);
    const start=curvePoint(root.start,root.end,root.dx*.12,.52);
    const end={x:start.x+root.dx*.32,y:start.y+root.dy*.70};
    ribbon(ctx,growth.texture,start,end,root.thickness*.37,Math.max(0,(progress-.52)/.48),-root.dx*.10);
  }
  for(const branch of growth.branches)ribbon(ctx,growth.texture,branch.start,branch.end,branch.thickness,growthReveal(branch.index,'branches',reveal),branch.dx*.1);
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
