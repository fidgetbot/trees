export function showChoiceModalUI(els, title, body, choices) {
  els.modalTitle.textContent = title;
  els.modalBody.innerHTML = body;
  els.modal.classList.remove('hidden');
  els.modalButton.style.display = 'none';
  els.modalButton.onclick = null;

  const wrap = document.createElement('div');
  wrap.className = 'neighbor-choices';
  choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.className = 'neighbor-choice';
    btn.textContent = choice.label;
    btn.onclick = () => {
      els.modal.classList.add('hidden');
      els.modalButton.style.display = '';
      choice.onChoose?.();
    };
    wrap.appendChild(btn);
  });

  els.modalBody.appendChild(wrap);
}
