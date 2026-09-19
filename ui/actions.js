export function renderActionPanels({
  els,
  categories,
  unavailableActions = [],
  futureActions,
  categoryNames,
  onUseAction,
  onFinishTurn,
  noUsableActions = false,
}) {
  els.actionsList.innerHTML = '';

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
        <p class="action-help">${action.help}</p>
        ${statusText ? `<p class="action-state">${statusText}</p>` : ''}
        ${costsHtml}`;

      const btn = document.createElement('button');
      btn.textContent = 'Use Action';
      btn.onclick = () => onUseAction(action, scaledCost);
      card.appendChild(btn);
      wrap.appendChild(card);
    });

    details.appendChild(wrap);
    els.actionsList.appendChild(details);
  });

  if (unavailableActions.length > 0) {
    const section = document.createElement('section');
    section.className = 'unavailable-actions';
    section.setAttribute('aria-label', 'Other actions available at this growth stage');
    section.innerHTML = '<h4>Other actions at this stage</h4>';
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
    els.actionsList.appendChild(section);
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
        <p class="action-help">${action.help}</p>
        ${statusText ? `<p class="action-state">${statusText}</p>` : ''}
        ${costsHtml}
        <p class="future-reason">${reason}</p>`;
      wrap.appendChild(card);
    });
    details.appendChild(wrap);
    els.actionsList.appendChild(details);
  }

  const canEndTurn = Object.values(categories).some(arr => arr.length > 0) || noUsableActions;
  if (els.finishTurn) {
    els.finishTurn.classList.toggle('hidden', !canEndTurn);
    const remaining = Number.isFinite(Number(els.finishTurn.dataset.actionsRemaining))
      ? Number(els.finishTurn.dataset.actionsRemaining)
      : null;
    els.finishTurn.textContent = noUsableActions
      ? `Out of Resources — End Turn${remaining == null ? '' : ` (${remaining} action${remaining === 1 ? '' : 's'} remaining)`}`
      : `End Turn Early${remaining == null ? '' : ` (${remaining} action${remaining === 1 ? '' : 's'} remaining)`}`;
    els.finishTurn.onclick = canEndTurn ? onFinishTurn : null;
  }
}
