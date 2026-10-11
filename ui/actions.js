import { updateActionDockStatus } from './context-actions.js?rev=feeding-pests-v1';
export function renderActionPanels({
  els,
  categories,
  contextualActions = [],
  contextTarget = null,
  contextPresentation = null,
  unavailableActions = [],
  futureActions,
  categoryNames,
  onUseAction,
  onFinishTurn,
  onSelectPlayer,
  actionPoints = 0,
}) {
  const allUsableCount = Object.values(categories).reduce((sum, actions) => sum + actions.length, 0);
  const dock = updateActionDockStatus(els, actionPoints, allUsableCount);
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
    reset.textContent = 'Your tree';
    reset.onclick = onSelectPlayer;
    heading.appendChild(reset);
  }
  context.appendChild(heading);

  const shortlist = document.createElement('div');
  shortlist.className = 'context-shortlist';
  if (contextualActions.length) {
    contextualActions.forEach(({ action, scaledCost, costsHtml }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'context-action';
      button.dataset.actionKey = action.key;
      button.innerHTML = `<span class="context-action-icon">${action.icon}</span><strong>${action.name}</strong>${costsHtml}`;
      button.title = action.help || action.name;
      button.onclick = () => onUseAction(action, scaledCost);
      shortlist.appendChild(button);
    });
  } else {
    const empty = document.createElement('p');
    empty.className = 'context-empty';
    empty.textContent = dock.canAct
      ? 'No actions for this selection. Choose your tree or More actions for available moves.'
      : actionPoints <= 0 ? 'Your action points are used up. End turn to continue.' : 'You cannot take any actions with your current resources and conditions. End turn to continue.';
    shortlist.appendChild(empty);
  }
  context.appendChild(shortlist);
  els.actionsList.appendChild(context);

  const allActions = document.createElement('details');
  allActions.className = 'all-actions';
  allActions.open = true;
  allActions.innerHTML = `<summary>More actions <span>${allUsableCount} available</span></summary>`;
  const catalog = document.createElement('div');
  catalog.className = 'all-actions-catalog';

  Object.entries(categories).forEach(([catKey, catActions]) => {
    if (catActions.length === 0) return;

    const details = document.createElement('details');
    details.className = 'action-category';
    details.open = true;
    details.innerHTML = `<summary class="category-header">${categoryNames[catKey]} (${catActions.length})</summary>`;

    const wrap = document.createElement('div');
    wrap.className = 'category-actions';

    catActions.forEach(({ action, scaledCost, costsHtml, statusText }) => {
      const card = document.createElement('div');
      card.className = 'action-card';
      card.innerHTML = `
        <div class="action-header">
          <h4 class="action-title">${action.name}</h4>
          <span class="action-icon">${action.icon}</span>
        </div>
        <details class="action-explanation"><summary>What does this do?</summary><p>${action.help}</p></details>
        ${statusText ? `<p class="action-state">${statusText}</p>` : ''}
        ${costsHtml}`;

      const btn = document.createElement('button');
      btn.textContent = 'Use Action';
      btn.onclick = () => { document.getElementById('detail-sheet')?.close(); onUseAction(action, scaledCost); };
      card.appendChild(btn);
      wrap.appendChild(card);
    });

    details.appendChild(wrap);
    catalog.appendChild(details);
  });

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
        <p>${action.help}</p>
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
        <details class="action-explanation"><summary>What does this do?</summary><p>${action.help}</p></details>
        ${statusText ? `<p class="action-state">${statusText}</p>` : ''}
        ${costsHtml}
        <p class="future-reason">${reason}</p>`;
      wrap.appendChild(card);
    });
    details.appendChild(wrap);
    catalog.appendChild(details);
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
