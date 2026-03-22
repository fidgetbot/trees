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
  currentStageRequirements,
  affordableActions,
  speciesBadgeHtml,
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
    if (!reqs.length || state.lifeStage.name === 'Ancient') {
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
  document.getElementById('leaf-clusters').textContent = state.leafClusters;
  document.getElementById('root-zones').textContent = state.rootZones;
  document.getElementById('branches').textContent = state.branches;
  document.getElementById('trunk').textContent = state.trunk;
  document.getElementById('flowers').textContent = state.flowers;
  document.getElementById('pollinated').textContent = state.pollinated;
  document.getElementById('developing').textContent = state.developing;
  document.getElementById('seeds').textContent = state.seeds;
  document.getElementById('allies').textContent = state.allies;
  document.getElementById('health').textContent = state.health;
  document.getElementById('max-health').textContent = `/ ${state.maxHealth}`;

  if (els.actionsRemaining) {
    if (state.actions > 0) {
      els.actionsRemaining.textContent = `${state.actions} action${state.actions !== 1 ? 's' : ''} remaining`;
      els.actionsBanner.classList.remove('hidden');
      els.actionsBanner.classList.remove('no-actions');
    } else {
      els.actionsRemaining.textContent = '';
      els.actionsBanner.classList.add('hidden');
      els.actionsBanner.classList.add('no-actions');
    }
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
