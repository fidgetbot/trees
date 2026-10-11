export const STAGE_SCENE_OCCUPANCY=Object.freeze({
  Seed:.24,
  Sprout:.34,
  Seedling:.46,
  Sapling:.60,
  'Young Tree':.72,
  'Mature Tree':.84,
  Ancient:.92,
});

export function stageSceneOccupancy(stageName){
  return STAGE_SCENE_OCCUPANCY[stageName]??STAGE_SCENE_OCCUPANCY.Sapling;
}

export function targetSceneZoom(bounds, viewport, { currentZoom = 1, margin = 12, stageName = 'Sapling' } = {}) {
  const usableWidth = Math.max(40, viewport.width - margin * 2);
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
  const centerX = viewport.width / 2;
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

export function interpolateSceneCamera(from, to, progress) {
  const t = easeSceneCamera(progress);
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    zoom: from.zoom + (to.zoom - from.zoom) * t,
  };
}
