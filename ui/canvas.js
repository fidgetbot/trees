export function renderForestScene({
  ctx,
  canvas,
  state,
  currentSeason,
  playerStageName,
  getNeighborTree,
  getRelationshipState,
}) {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = gradientBackground(ctx, currentSeason);
  ctx.fillRect(0, 0, w, h / 2);
  ctx.fillStyle = '#4a3b2f';
  ctx.fillRect(0, h / 2, w, h / 2);
  ctx.strokeStyle = '#000';
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();

  const positions = [120, 260, 450, 640, 780];
  positions.forEach((x, idx) => {
    const isPlayer = idx === 2;
    const neighbor = isPlayer ? null : getNeighborTree(idx);
    drawTree({
      ctx,
      x,
      groundY: h / 2,
      isPlayer,
      neighbor,
      state,
      playerStageName,
      getRelationshipState,
    });
  });

  drawFungalNetwork({ ctx, positions, groundY: h / 2, allies: state.allies });
}

function gradientBackground(ctx, currentSeason) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, currentSeason.top);
  gradient.addColorStop(1, currentSeason.bottom);
  return gradient;
}

function drawFungalNetwork({ ctx, positions, groundY, allies }) {
  if (allies <= 0) return;

  const playerX = positions[2];
  const connectedIndices = [];

  if (allies >= 1) connectedIndices.push(0);
  if (allies >= 2) connectedIndices.push(1);
  if (allies >= 3) connectedIndices.push(3);
  if (allies >= 4) connectedIndices.push(4);

  ctx.strokeStyle = 'rgba(180, 220, 255, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);

  connectedIndices.forEach(idx => {
    const targetX = positions[idx];
    const startY = groundY + 30;
    const endY = groundY + 70 + (idx * 5);

    ctx.beginPath();
    ctx.moveTo(playerX, startY);
    ctx.bezierCurveTo(
      playerX - (playerX - targetX) * 0.3, startY + 40,
      targetX + (playerX - targetX) * 0.3, endY - 20,
      targetX, endY,
    );
    ctx.stroke();

    ctx.fillStyle = 'rgba(180, 220, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(targetX, endY, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.setLineDash([]);
}

function drawTree({ ctx, x, groundY, isPlayer, neighbor, state, playerStageName, getRelationshipState }) {
  const stageName = isPlayer ? playerStageName : (neighbor?.stageName || 'Sapling');
  const stageScaleMap = { Seed: 0.18, Sprout: 0.28, Seedling: 0.45, Sapling: 0.7, 'Small Tree': 1.0, 'Mature Tree': 1.35, Ancient: 1.7 };
  const baseScale = stageScaleMap[stageName] || 0.8;
  const scale = isPlayer ? Math.max(baseScale, baseScale + state.trunk * 0.05) : baseScale;
  const leafClusters = isPlayer ? state.leafClusters : (neighbor ? neighbor.branches : 2);
  const trunk = isPlayer ? state.trunk : (neighbor ? neighbor.trunk : 1);
  const branches = isPlayer ? state.branches : (neighbor ? neighbor.branches : 2);
  const rootZones = isPlayer ? state.rootZones : (neighbor ? neighbor.roots : 2);

  const canopyR = (14 + Math.max(0, leafClusters) * 2) * scale;
  const treeColor = isPlayer ? '#2f8f46' : (neighbor && neighbor.ally ? '#2a2a2a' : '#151515');
  const rootColor = isPlayer ? '#256f39' : '#222';
  let crownTopY = groundY - 12;

  for (let i = 0; i < Math.max(1, Math.min(rootZones, 8)); i++) {
    const dir = i % 2 === 0 ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x + dir * (10 + i * 8) * scale, groundY + (14 + i * 10) * scale);
    ctx.strokeStyle = rootColor;
    ctx.lineWidth = Math.max(1.5, 2 * scale);
    ctx.stroke();
  }

  ctx.fillStyle = treeColor;
  if (stageName === 'Seed') {
    ctx.beginPath();
    ctx.ellipse(x, groundY - 4, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    crownTopY = groundY - 8;
  } else if (stageName === 'Sprout') {
    const trunkH = 14;
    const trunkW = 6;
    ctx.fillRect(x - trunkW / 2, groundY - trunkH, trunkW, trunkH);
    ctx.strokeStyle = treeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, groundY - trunkH);
    ctx.quadraticCurveTo(x - 8, groundY - trunkH - 10, x - 14, groundY - trunkH - 6);
    ctx.moveTo(x, groundY - trunkH);
    ctx.quadraticCurveTo(x + 8, groundY - trunkH - 10, x + 14, groundY - trunkH - 6);
    ctx.stroke();
    crownTopY = groundY - trunkH - 10;
  } else if (stageName === 'Seedling') {
    const trunkH = 28;
    const trunkW = 7;
    ctx.fillRect(x - trunkW / 2, groundY - trunkH, trunkW, trunkH);
    ctx.beginPath();
    ctx.ellipse(x, groundY - trunkH - 6, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    crownTopY = groundY - trunkH - 16;
  } else if (stageName === 'Sapling') {
    const trunkH = 55 * scale;
    const trunkW = 6 * scale;
    ctx.fillRect(x - trunkW / 2, groundY - trunkH, trunkW, trunkH);
    const saplingCanopyR = (10 + Math.max(0, leafClusters) * 0.8) * scale;
    ctx.beginPath();
    ctx.ellipse(x, groundY - trunkH - saplingCanopyR * 0.3, saplingCanopyR, saplingCanopyR * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    crownTopY = groundY - trunkH - saplingCanopyR - 6;
  } else {
    const trunkH = (48 + trunk * 14) * scale;
    const trunkW = (10 + trunk * 3) * scale;
    ctx.fillRect(x - trunkW / 2, groundY - trunkH, trunkW, trunkH);
    for (let i = 0; i < Math.max(1, Math.min(branches, 8)); i++) {
      const y = groundY - trunkH + 18 + i * 8 * scale;
      const dir = i % 2 === 0 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dir * (18 + i * 5) * scale, y - (8 + i * 3) * scale);
      ctx.strokeStyle = treeColor;
      ctx.lineWidth = Math.max(2, 2.5 * scale);
      ctx.stroke();
    }
    if (leafClusters > 0) {
      const slowCanopyR = (12 + Math.max(0, leafClusters) * 1.2) * scale;
      ctx.beginPath();
      ctx.ellipse(x, groundY - trunkH - slowCanopyR * 0.25, slowCanopyR, slowCanopyR * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      crownTopY = groundY - trunkH - slowCanopyR;
    } else {
      crownTopY = groundY - trunkH;
    }
  }

  if (isPlayer && state.flowers > 0 && stageName !== 'Seed' && stageName !== 'Sprout') {
    ctx.fillStyle = '#ffb6c1';
    for (let i = 0; i < Math.min(state.flowers, 5); i++) {
      const fx = x + (i - 2) * 8;
      const fy = crownTopY - canopyR * 0.3 - 10;
      ctx.beginPath();
      ctx.arc(fx, fy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (!isPlayer && neighbor) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    const label = neighbor.offspring ? `${neighbor.species} offspring (${neighbor.stageName})` : `${neighbor.species} (${(neighbor.relationName || (neighbor.ally ? 'Ally' : 'Neutral')).toLowerCase()})`;
    ctx.fillText(label, x, groundY + 110);
    if (!neighbor.offspring && typeof neighbor.health === 'number' && typeof neighbor.maxHealth === 'number') {
      const healthColor = getRelationshipState(neighbor.relation).name === 'Ally' ? 'rgba(187, 247, 208, 0.9)' : 'rgba(255,255,255,0.55)';
      ctx.fillStyle = healthColor;
      ctx.font = '10px sans-serif';
      ctx.fillText(`Health ${neighbor.health}/${neighbor.maxHealth}`, x, groundY + 124);
    }
  }
}
