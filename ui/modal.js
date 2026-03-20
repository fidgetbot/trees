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
