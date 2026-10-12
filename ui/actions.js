import { updateActionDockStatus } from './context-actions.js?rev=future-actions-label-v1';
export function renderActionPanels({
  els,
  categories,
  contextualActions = [],
  contextTarget = null,
  contextPresentation = null,
  unavailableActions = [],
  futureActions,
  onUseAction,
  onFinishTurn,
  onSelectPlayer,
  actionPoints = 0,
  carouselScrollLeft = 0,
  onCarouselScroll = null,
}) {
  const allUsableCount = Object.values(categories).reduce((sum, actions) => sum + actions.length, 0);
  const dock = updateActionDockStatus(els, actionPoints, allUsableCount);
  const dockToolbar = els.actionsRemaining?.closest('.dock-toolbar');
  const isNeighborOverview = contextTarget?.type === 'neighbor-tree';
  dockToolbar?.classList.toggle('hidden', isNeighborOverview);
  dockToolbar?.setAttribute('aria-hidden', String(isNeighborOverview));
  els.actionsList.innerHTML = '';
  const sheetActions = document.getElementById('sheet-actions');
  if (sheetActions) sheetActions.innerHTML = '';
  const selectedInfo = document.getElementById('selected-info');
  if (selectedInfo) selectedInfo.textContent = `${contextPresentation?.title || 'Your tree'} — ${contextPresentation?.detail || ''}`;

  const context = document.createElement('section');
  context.className = 'context-command';
  context.setAttribute('aria-live', 'polite');
  context.setAttribute('aria-label', 'Actions for the selected grove object');
  const heading = document.createElement('div');
  heading.className = 'context-command-heading';
  heading.innerHTML = `
    <div>
      <strong>${(contextPresentation?.title || 'Your tree').replace(' · You', '')}</strong><span class="context-stage">${contextTarget?.subtitle || contextTarget?.stageName || contextPresentation?.kicker || ''}</span>

    </div>`;
  if (contextTarget?.type && contextTarget.type !== 'player-tree') {
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'context-reset';
    reset.textContent = contextTarget.type === 'neighbor-tree' ? 'Return to your tree' : 'Your tree';
    reset.onclick = onSelectPlayer;
    heading.appendChild(reset);
  }
  context.appendChild(heading);

  const shortlist = document.createElement('div');
  shortlist.className = 'context-shortlist';
  if (isNeighborOverview) {
    shortlist.classList.add('neighbor-overview');
    const status = document.createElement('div');
    status.className = `neighbor-status neighbor-status-${(contextPresentation?.relationship || 'unknown').toLowerCase()}`;
    status.innerHTML = `<span>Relationship</span><strong>${contextPresentation?.relationship || 'Unknown'}</strong>`;
    const effects = document.createElement('div');
    effects.className = 'neighbor-effects';
    effects.innerHTML = `<span>Current effects</span><ul>${(contextPresentation?.effects || ['No current effects']).map(effect => `<li>${effect}</li>`).join('')}</ul>`;
    shortlist.append(status, effects);
  } else if (contextualActions.length) {
    shortlist.classList.add('action-carousel');
    shortlist.tabIndex = 0;
    shortlist.setAttribute('role', 'group');
    shortlist.setAttribute('aria-roledescription', 'carousel');
    shortlist.setAttribute('aria-label', `${contextualActions.length} available actions. Scroll horizontally to browse.`);
    contextualActions.forEach(({ action, scaledCost, costsHtml }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'context-action';
      button.dataset.actionKey = action.key;
      button.innerHTML = `<span class="context-action-icon">${action.icon}</span><strong>${action.name}</strong><span class="action-description">${action.help}</span>${costsHtml}`;
      button.title = action.help || action.name;
      button.onclick = () => onUseAction(action, scaledCost);
      shortlist.appendChild(button);
    });
    shortlist.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const cards = [...shortlist.querySelectorAll('.context-action')];
      if (!cards.length) return;
      const activeIndex = cards.indexOf(document.activeElement);
      let nextIndex = activeIndex;
      if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = cards.length - 1;
      else if (event.key === 'ArrowRight') nextIndex = Math.min(cards.length - 1, Math.max(0, activeIndex + 1));
      else nextIndex = activeIndex < 0 ? cards.length - 1 : Math.max(0, activeIndex - 1);
      event.preventDefault();
      const nextCard = cards[nextIndex];
      nextCard.focus({ preventScroll: true });
      const desiredLeft = event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? shortlist.scrollWidth - shortlist.clientWidth
          : nextCard.offsetLeft - (shortlist.clientWidth - nextCard.offsetWidth) / 2;
      shortlist.scrollLeft = Math.max(0, Math.min(shortlist.scrollWidth - shortlist.clientWidth, desiredLeft));
      onCarouselScroll?.(shortlist.scrollLeft);
    });
    shortlist.addEventListener('scroll', () => onCarouselScroll?.(shortlist.scrollLeft), { passive: true });
    requestAnimationFrame(() => {
      shortlist.scrollLeft = Math.max(0, Number(carouselScrollLeft) || 0);
    });
  } else {
    const empty = document.createElement('p');
    empty.className = 'context-empty';
    empty.textContent = dock.canAct
      ? 'No actions for this selection. Choose your tree for its available moves.'
      : actionPoints <= 0 ? 'Your action points are used up. End turn to continue.' : 'You cannot take any actions with your current resources and conditions. End turn to continue.';
    shortlist.appendChild(empty);
  }
  context.appendChild(shortlist);
  els.actionsList.appendChild(context);

  const allActions = document.createElement('details');
  allActions.className = 'all-actions';
  allActions.open = true;
  allActions.innerHTML = `<summary>Future Actions</summary>`;
  const catalog = document.createElement('div');
  catalog.className = 'all-actions-catalog';

  if (unavailableActions.length > 0) {
    const section = document.createElement('section');
    section.className = 'unavailable-actions';
    section.setAttribute('aria-label', 'Unavailable actions and requirements');
    section.innerHTML = '<h4>Unavailable right now</h4><p>These actions cannot currently be taken. Each lists what is missing.</p>';
    const wrap = document.createElement('div');
    wrap.className = 'unavailable-actions-list';
    unavailableActions.forEach(({ action, costsHtml, statusText, reason }) => {
      const row = document.createElement('div');
      row.className = 'unavailable-action';
      row.innerHTML = `
        <div class="unavailable-action-title"><strong>${action.name}</strong><span>${action.icon}</span></div>
        <p class="action-description">${action.help}</p>
        ${statusText ? `<p class="action-state">${statusText}</p>` : ''}
        ${costsHtml}
        <p class="unavailable-reason">${reason}.</p>`;
      wrap.appendChild(row);
    });
    section.appendChild(wrap);
    catalog.appendChild(section);
  }

  if (futureActions.length > 0) {
    const details = document.createElement('details');
    details.className = 'future-actions';
    details.innerHTML = `<summary>🔒 Future Growth (${futureActions.length})</summary>`;
    const wrap = document.createElement('div');
    wrap.className = 'future-actions-list';
    futureActions.forEach(({ action, costsHtml, statusText, reason }) => {
      const card = document.createElement('div');
      card.className = 'action-card disabled';
      card.innerHTML = `
        <div class="action-header">
          <h4 class="action-title">${action.name}</h4>
          <span class="action-icon">${action.icon}</span>
        </div>
        <span class="prereq-missing">Locked</span>
        <p class="action-description">${action.help}</p>
        ${statusText ? `<p class="action-state">${statusText}</p>` : ''}
        ${costsHtml}
        <p class="future-reason">${reason}</p>`;
      wrap.appendChild(card);
    });
    details.appendChild(wrap);
    catalog.appendChild(details);
  }

  if (!unavailableActions.length && !futureActions.length) {
    const empty = document.createElement('p');
    empty.className = 'requirements-empty';
    empty.textContent = 'Every unlocked action is currently available in the carousel.';
    catalog.appendChild(empty);
  }

  allActions.appendChild(catalog);
  (sheetActions || els.actionsList).appendChild(allActions);

  if (els.finishTurn) {
    els.finishTurn.classList.remove('hidden');
    els.finishTurn.textContent = 'End turn →';
    els.finishTurn.title = dock.endTitle;
    els.finishTurn.onclick = onFinishTurn;
  }
}
