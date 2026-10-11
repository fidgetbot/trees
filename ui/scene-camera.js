export function targetSceneZoom(bounds, viewport, { player = false } = {}) {
  if (player) return 1;
  const usableWidth = Math.max(180, viewport.width * .72);
  const usableHeight = Math.max(40, viewport.height - viewport.topInset - viewport.bottomInset);
  const width = Math.max(1, bounds?.width || 1);
  const height = Math.max(1, bounds?.height || 1);
  const widthZoom = width <= 44 ? 2.6 : (usableWidth - 44) / (width - 44);
  const desiredHeight = Math.max(58, usableHeight * .78);
  const heightZoom = height <= 58 ? 2.6 : (desiredHeight - 58) / (height - 58);
  return Math.max(.0005, Math.min(2.6, widthZoom, heightZoom));
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
