import { getTreeStructureSourceRect } from './canvas.js?rev=action-growth-v1';

export function modalPlainText(body) {
  return String(body || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildPopupLogMessage(title, body, maxLength = 220) {
  const text = modalPlainText(body);
  const excerpt = text.slice(0, maxLength);
  return `${title}: ${excerpt}${text.length > excerpt.length ? '…' : ''}`;
}

export function openModalSurface(els, { kind = '', eyebrow = 'Life in the grove' } = {}) {
  els.modal.dataset.kind = kind;
  els.modal.querySelector('#modal-kicker').textContent = eyebrow;
  els.modal.classList.remove('hidden');
  els.modal.querySelector('.modal-card').scrollTop = 0;
  // Keep keyboard navigation in the active dialog, including choice dialogs.
  const app = document.getElementById('app');
  const previousFocus = document.activeElement;
  if (app) app.inert = true;
  els.modal.onkeydown = event => {
    if (event.key !== 'Tab') return;
    const buttons = [...els.modal.querySelectorAll('button:not(:disabled), summary, [href], select, input, [tabindex="0"]')].filter(el => el.getClientRects().length);
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return () => {
    els.modal.classList.add('hidden');
    if (app) app.inert = false;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  };
}

export function renderGrowthChapter(stage, speciesName, stages, unlockHtml, { rootedSeed = false } = {}) {
  const stageKey = rootedSeed ? 'rooted-seed' : stage.name.toLowerCase().replaceAll(' ', '-');
  const source = `assets/trees/${speciesName.toLowerCase()}-${stageKey}-v1.png?rev=painted-life-stages-v1`;
  const bounds = getTreeStructureSourceRect(speciesName, stageKey);
  const portrait = bounds
    ? `<svg viewBox="0 0 ${bounds.width} ${bounds.height}" aria-hidden="true"><svg width="${bounds.width}" height="${bounds.height}" overflow="hidden"><image href="${source}" width="${bounds.width}" height="${bounds.imageHeight}" /></svg></svg>`
    : `<img src="${source}" alt="" />`;
  return `<div class="growth-portrait" aria-hidden="true">${portrait}</div>
    <p class="growth-prose">${stage.popup}</p>
    ${unlockHtml ? `<div class="growth-unlocks"><p class="botanical-kicker">New possibilities</p>${unlockHtml}</div>` : ''}
    <ol class="growth-path" aria-label="Life stages">${stages.map(item => `<li class="${item.rank < stage.rank ? 'complete' : ''}" ${item.rank === stage.rank ? 'aria-current="step"' : ''} title="${item.name}"><span class="sr-only">${item.name}</span></li>`).join('')}</ol>`;
}

export function showStandardModal(els, title, body, onContinue, presentation = {}) {
  els.modalTitle.textContent = title;
  els.modalBody.innerHTML = body;
  const close = openModalSurface(els, presentation);
  els.modalButton.style.display = '';
  els.modalButton.onclick = () => {
    close();
    onContinue?.();
  };
  els.modalButton.focus({ preventScroll: true });
}
