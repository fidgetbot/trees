export function renderActionPanels({
  els,
  categories,
  futureActions,
  categoryNames,
  onUseAction,
  onFinishTurn,
  noUsableActions = false,
  warningHtml = '',
}) {
  els.actionsList.innerHTML = '';

  if (warningHtml) {
    const warning = document.createElement('div');
    warning.className = 'nothing-affordable';
    warning.innerHTML = warningHtml;
    els.actionsList.appendChild(warning);
  }

  Object.entries(categories).forEach(([catKey, catActions]) => {
    if (catActions.length === 0) return;

    const details = document.createElement('details');
    details.className = 'action-category';
    details.open = true;
    details.innerHTML = `<summary class="category-header">${categoryNames[catKey]} (${catActions.length})</summary>`;

    const wrap = document.createElement('div');
    wrap.className = 'category-actions';

    catActions.forEach(({ action, scaledCost, costsHtml }) => {
      const card = document.createElement('div');
      card.className = 'action-card';
      card.innerHTML = `
        <div class="action-header">
          <h4 class="action-title">${action.name}</h4>
          <span class="action-icon">${action.icon}</span>
        </div>
        <p class="action-help">${action.help}</p>
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

  if (futureActions.length > 0) {
    const details = document.createElement('details');
    details.className = 'future-actions';
    details.innerHTML = `<summary>🔒 Future Growth (${futureActions.length})</summary>`;
    const wrap = document.createElement('div');
    wrap.className = 'future-actions-list';
    futureActions.forEach(({ action, costsHtml, reason }) => {
      const card = document.createElement('div');
      card.className = 'action-card disabled';
      card.innerHTML = `
        <div class="action-header">
          <h4 class="action-title">${action.name}</h4>
          <span class="action-icon">${action.icon}</span>
        </div>
        <span class="prereq-missing">Locked</span>
        <p class="action-help">${action.help}</p>
        ${costsHtml}
        <p class="future-reason">${reason}</p>`;
      wrap.appendChild(card);
    });
    details.appendChild(wrap);
    els.actionsList.appendChild(details);
  }

  if (Object.values(categories).some(arr => arr.length > 0) || noUsableActions) {
    const endBtn = document.createElement('button');
    endBtn.className = 'finish-turn-btn';
    endBtn.textContent = noUsableActions ? 'Out of Resources — End Turn →' : 'Finish Turn Early →';
    endBtn.onclick = onFinishTurn;
    els.actionsList.appendChild(endBtn);
  }
}
