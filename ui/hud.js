export function showFeedbackUI(els, message, type = 'success') {
  const feedback = document.createElement('div');
  feedback.className = `feedback ${type}`;
  feedback.textContent = message;
  els.feedbackContainer.appendChild(feedback);

  setTimeout(() => {
    feedback.remove();
  }, 3000);
}

export function setTurnEndBannerUI(els, message = '') {
  if (!els.turnEndBanner) return;
  if (!message) {
    els.turnEndBanner.textContent = '';
    els.turnEndBanner.classList.add('hidden');
    return;
  }
  els.turnEndBanner.innerHTML = `<strong>Turn ending:</strong> ${message}`;
  els.turnEndBanner.classList.remove('hidden');
}

export function initTooltipsUI(els) {
  const statRows = document.querySelectorAll('.stat-row[data-help]');

  statRows.forEach(row => {
    row.addEventListener('mouseenter', () => {
      const helpText = row.dataset.help;
      els.tooltip.textContent = helpText;
      els.tooltip.classList.remove('hidden');

      const rect = row.getBoundingClientRect();
      const tooltipRect = els.tooltip.getBoundingClientRect();

      let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
      let top = rect.top - tooltipRect.height - 8;

      left = Math.max(10, Math.min(left, window.innerWidth - tooltipRect.width - 10));
      top = Math.max(10, top);

      els.tooltip.style.left = `${left}px`;
      els.tooltip.style.top = `${top}px`;
    });

    row.addEventListener('mouseleave', () => {
      els.tooltip.classList.add('hidden');
    });
  });
}

export function initCollapsibleGroupsUI() {
  const groupTitles = document.querySelectorAll('.stat-group-title');

  groupTitles.forEach(title => {
    title.addEventListener('click', () => {
      const group = title.closest('.stat-group');
      group.classList.toggle('collapsed');
    });
  });
}

export function updateHudUI({
  els,
  state,
  currentSeasonName,
  currentStage,
  seasons = [],
  currentStageRequirements,
  affordableActions,
  speciesBadgeHtml,
  offspringStats = [],
}) {
  document.getElementById('score').textContent = state.score;
  document.getElementById('year').textContent = state.year;
  document.getElementById('season').textContent = currentSeasonName;

  const stageEl = document.getElementById('life-stage');
  if (stageEl) {
    stageEl.textContent = currentStage.name;
    stageEl.style.color = currentStage.name === 'Ancient' ? '#FFD700' : '#4CAF50';
  }

  const growthHint = document.getElementById('growth-hint');
  if (growthHint) {
    const reqs = currentStageRequirements;
    const missing = reqs.filter(r => !r.met);
    if (state.victoryAchieved) {
      growthHint.textContent = 'Protected ecosystem established.';
    } else if (state.lifeStage.name === 'Ancient') {
      growthHint.textContent = `Protection: ${state.protectionProgress || 0}/2 supported Mature-or-better allies or children`;
    } else if (!reqs.length) {
      growthHint.textContent = 'Fully grown.';
    } else if (missing.length === 0) {
      growthHint.textContent = 'Growth is imminent.';
    } else {
      growthHint.textContent = `Next growth: ${missing.map(r => r.label).join(' · ')}`;
    }
  }

  document.getElementById('sunlight').textContent = state.sunlight;
  document.getElementById('water').textContent = state.water;
  document.getElementById('nutrients').textContent = state.nutrients;
  const actionSunlight = document.getElementById('action-sunlight');
  const actionWater = document.getElementById('action-water');
  const actionNutrients = document.getElementById('action-nutrients');
  const actionHealth = document.getElementById('action-health');
  if (actionSunlight) actionSunlight.textContent = state.sunlight;
  if (actionWater) actionWater.textContent = state.water;
  if (actionNutrients) actionNutrients.textContent = state.nutrients;
  if (actionHealth) actionHealth.textContent = `${state.health}/${state.maxHealth}`;
  document.getElementById('leaf-clusters').textContent = state.leafClusters;
  document.getElementById('root-zones').textContent = state.rootZones;
  document.getElementById('branches').textContent = state.branches;
  document.getElementById('trunk').textContent = state.trunk;
  const heightGrowth = document.getElementById('height-growth');
  const spindlyGrowth = document.getElementById('spindly-growth');
  if (heightGrowth) heightGrowth.textContent = `+${state.heightGrowth || 0}`;
  if (spindlyGrowth) spindlyGrowth.textContent = (state.spindlyGrowth || 0) > 0 ? `+${state.spindlyGrowth} damage` : 'None';
  document.getElementById('flowers').textContent = state.flowers;
  document.getElementById('pollinated').textContent = state.pollinated;
  document.getElementById('developing').textContent = state.developing;
  document.getElementById('seeds').textContent = state.seeds;
  document.getElementById('allies').textContent = state.allies;
  document.getElementById('health').textContent = state.health;
  document.getElementById('max-health').textContent = `/ ${state.maxHealth}`;

  const offspringDetails = document.getElementById('offspring-stats');
  const offspringSummary = document.getElementById('offspring-stats-summary');
  const offspringList = document.getElementById('offspring-stats-list');
  if (offspringDetails && offspringSummary && offspringList) {
    offspringDetails.classList.toggle('hidden', offspringStats.length === 0);
    offspringSummary.textContent = `Offspring · ${offspringStats.length} living`;
    offspringList.innerHTML = offspringStats.map(child => {
      const progress = child.nextStageThreshold
        ? `${child.stageScore}/${child.nextStageThreshold} toward ${child.nextStageName}`
        : `${child.stageScore} growth · fully grown`;
      return `<div class="offspring-stat-card">
        <strong>${child.species} · ${child.stageName}</strong>
        <span>${child.health}/${child.maxHealth} health</span>
        <span>${progress}</span>
        <span>Nurtured ${child.nurtureCount} time${child.nurtureCount === 1 ? '' : 's'} · aided ${child.supportReceived} time${child.supportReceived === 1 ? '' : 's'}</span>
      </div>`;
    }).join('');
  }

  const seasonGuideSummary = document.getElementById('season-guide-summary');
  const seasonGuideGrid = document.getElementById('season-guide-grid');
  if (seasonGuideSummary && seasonGuideGrid && seasons.length) {
    const current = seasons.find(season => season.name === currentSeasonName) || seasons[0];
    const pct = factor => `${Math.round(factor * 100)}%`;
    const dormancy = current.name === 'Winter' ? ' · leaf growth rests, upkeep is halved' : '';
    seasonGuideSummary.textContent = `Seasonal gathering · ${current.name}: ${pct(current.factorSun)} light, ${pct(current.factorWater)} water${dormancy}`;
    seasonGuideGrid.innerHTML = seasons.map(season => `
      <div class="season-guide-row${season.name === currentSeasonName ? ' current' : ''}">
        <strong>${season.name}</strong><span>☀️ ${pct(season.factorSun)}</span><span>💧 ${pct(season.factorWater)}${season.name === 'Winter' ? ' · dormant' : ''}</span>
      </div>`).join('');
  }

  if (els.actionsRemaining) {
    els.actionsRemaining.textContent = `(${state.actions} remaining)`;
    els.actionsRemaining.classList.toggle('no-actions', state.actions <= 0);
  }

  els.log.innerHTML = state.log.map(line => `<div class="log-entry">${line}</div>`).join('');

  const phasePill = document.getElementById('phase-indicator');
  if (phasePill) {
    phasePill.textContent = state.actions > 0 ? 'Action Phase' : 'Event Phase';
    phasePill.className = 'phase-pill ' + (state.actions > 0 ? 'phase-action' : 'phase-event');
  }

  const speciesBadge = document.getElementById('species-badge');
  if (speciesBadge && speciesBadgeHtml) {
    speciesBadge.innerHTML = speciesBadgeHtml;
  }
}
