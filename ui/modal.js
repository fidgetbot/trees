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

export function showStandardModal(els, title, body, onContinue) {
  els.modalTitle.textContent = title;
  els.modalBody.innerHTML = body;
  els.modal.classList.remove('hidden');
  els.modalButton.style.display = '';
  els.modalButton.onclick = () => {
    els.modal.classList.add('hidden');
    onContinue?.();
  };
}
