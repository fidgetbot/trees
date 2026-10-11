import { openModalSurface } from './modal.js?rev=quiet-action-dock-v1';

export function showChoiceModalUI(els, title, body, choices, presentation = {}) {
  els.modalTitle.textContent = title;
  els.modalBody.innerHTML = body;
  const close = openModalSurface(els, presentation);
  els.modalButton.style.display = 'none';
  els.modalButton.onclick = null;

  const wrap = document.createElement('div');
  wrap.className = 'neighbor-choices';
  let activeGroup = null;
  choices.forEach(choice => {
    if (choice.group && choice.group !== activeGroup) {
      activeGroup = choice.group;
      const heading = document.createElement('div');
      heading.className = 'neighbor-choice-group';
      const title = document.createElement('strong');
      title.className = 'neighbor-choice-group-title';
      title.textContent = choice.group;
      heading.appendChild(title);
      if (choice.groupDescription) {
        const description = document.createElement('span');
        description.className = 'neighbor-choice-group-description';
        description.textContent = choice.groupDescription;
        heading.appendChild(description);
      }
      wrap.appendChild(heading);
    }
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
      close();
      els.modalButton.style.display = '';
      choice.onChoose?.();
    };
    wrap.appendChild(btn);
  });

  els.modalBody.appendChild(wrap);
  wrap.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
}
