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
    const label = document.createElement('span');
    label.className = 'neighbor-choice-label';
    label.textContent = choice.label;
    btn.appendChild(label);
    if (choice.description) {
      const description = document.createElement('span');
      description.className = 'neighbor-choice-description';
      description.textContent = choice.description;
      btn.appendChild(description);
    }
    btn.disabled = choice.disabled === true;
    btn.onclick = () => {
      els.modal.classList.add('hidden');
      els.modalButton.style.display = '';
      choice.onChoose?.();
    };
    wrap.appendChild(btn);
  });

  els.modalBody.appendChild(wrap);
}
