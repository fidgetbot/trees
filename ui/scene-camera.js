export const STAGE_SCENE_OCCUPANCY=Object.freeze({
  Seed:.24,
  Sprout:.34,
  Seedling:.46,
  Sapling:.60,
  'Young Tree':.72,
  'Mature Tree':.84,
  Ancient:.92,
});

export const COMPARISON_CAMERA_TIMING=Object.freeze({
  duration:820,
  zoomStart:.65,
});

export function stageSceneOccupancy(stageName){
  return STAGE_SCENE_OCCUPANCY[stageName]??STAGE_SCENE_OCCUPANCY.Sapling;
}

export function sceneSafeViewport({canvasRect,hudRect,minimapRect,started=true,margin=12}={}){
  const width=Math.max(320,Math.round(canvasRect?.width||900));
  const height=Math.max(240,Math.round(canvasRect?.height||600));
  const canvasLeft=Number(canvasRect?.left)||0,canvasTop=Number(canvasRect?.top)||0;
  const topInset=minimapRect?.height
    ?Math.max(0,Math.round(minimapRect.bottom-canvasTop+margin))
    :(height<=500?Math.max(96,Math.round(height*.28)):126);
  const sideDock=Boolean(started&&height<=500&&width>=600&&hudRect?.width&&hudRect.left>canvasLeft+margin);
  if(sideDock){
    return{
      width,height,topInset,bottomInset:0,leftInset:0,
      rightInset:Math.max(0,Math.round(canvasLeft+width-hudRect.left+margin)),
      renderHeight:height,
    };
  }
  const safeBottom=started?Math.round((hudRect?.top??canvasTop+height)-canvasTop-margin):height;
  return{
    width,height,topInset,leftInset:0,rightInset:0,
    bottomInset:Math.max(0,height-safeBottom),
    renderHeight:Math.max(topInset+40,safeBottom),
  };
}

export function targetSceneZoom(bounds, viewport, { currentZoom = 1, margin = 12, stageName = 'Sapling' } = {}) {
  const usableWidth = Math.max(40, viewport.width - (viewport.leftInset||0) - (viewport.rightInset||0) - margin * 2);
  const usableHeight = Math.max(40, viewport.height - viewport.topInset - viewport.bottomInset);
  const width = Number(bounds?.width),height=Number(bounds?.height);
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return 1;
  const normalizedExtent=Math.max(width/usableWidth,height/usableHeight);
  const adjustment=stageSceneOccupancy(stageName)/normalizedExtent;
  return Math.max(.04,Math.min(3.2,currentZoom*adjustment));
}

export function isValidSceneCamera(camera){
  return Boolean(camera&&Number.isFinite(camera.x)&&Number.isFinite(camera.y)&&Number.isFinite(camera.zoom)&&camera.zoom>=.04&&camera.zoom<=3.2);
}

export function centeredSceneOffset(bounds, viewport) {
  const usableLeft=viewport.leftInset||0;
  const usableRight=Math.max(usableLeft+40,viewport.width-(viewport.rightInset||0));
  const centerX = usableLeft+(usableRight-usableLeft)/2;
  const usableTop = viewport.topInset;
  const usableBottom = Math.max(usableTop + 40, viewport.height - viewport.bottomInset);
  const centerY = usableTop + (usableBottom - usableTop) * .5;
  return {
    x: centerX - (bounds.x + bounds.width / 2),
    y: centerY - (bounds.y + bounds.height / 2),
  };
}

export function easeSceneCamera(progress) {
  const t = Math.max(0, Math.min(1, progress));
  return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function smootherSceneCamera(progress) {
  const t=Math.max(0,Math.min(1,progress));
  return t*t*t*(t*(t*6-15)+10);
}

export function interpolateSceneCamera(from, to, progress) {
  const t = easeSceneCamera(progress);
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    zoom: from.zoom + (to.zoom - from.zoom) * t,
  };
}

export function comparisonCameraFrame({from,panX,to,elapsed,timing=COMPARISON_CAMERA_TIMING}){
  const duration=Math.max(1,timing.duration);
  const zoomStart=Math.max(0,Math.min(.99,timing.zoomStart));
  const progress=Math.max(0,Math.min(1,elapsed/duration));
  if(progress>=1)return{phase:'done',done:true,...to};
  const panProgress=smootherSceneCamera(progress);
  const zoomProgress=smootherSceneCamera((panProgress-zoomStart)/(1-zoomStart));
  const sharedScaleX=from.x+(panX-from.x)*panProgress;
  const worldZoom=from.worldZoom*Math.pow(to.worldZoom/from.worldZoom,zoomProgress);
  return{
    phase:zoomProgress>0?'approach':'pan',
    done:false,
    x:sharedScaleX+(to.x-sharedScaleX)*zoomProgress,
    groundY:from.groundY+(to.groundY-from.groundY)*zoomProgress,
    worldZoom,
  };
}
