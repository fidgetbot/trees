import { MINIMAP_FRUIT_ASSETS } from './grove-minimap.js?rev=fruit-minimap-v3';
import { openModalSurface } from './modal.js?rev=continuous-roots-v2';

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
    const fruitSrc = MINIMAP_FRUIT_ASSETS[choice.species];
    if (fruitSrc) {
      const fruit = document.createElement('img');
      fruit.className = 'neighbor-choice-fruit';
      fruit.src = fruitSrc;
      fruit.alt = '';
      fruit.setAttribute('aria-hidden', 'true');
      btn.appendChild(fruit);
    }
    const copy = document.createElement('span');
    copy.className = 'neighbor-choice-copy';
    const label = document.createElement('span');
    label.className = 'neighbor-choice-label';
    label.textContent = choice.label;
    copy.appendChild(label);
    if (choice.description) {
      const description = document.createElement('span');
      description.className = 'neighbor-choice-description';
      description.textContent = choice.description;
      copy.appendChild(description);
    }
    btn.appendChild(copy);
    btn.disabled = choice.disabled === true;
    btn.onclick = () => {
      if (presentation.resolveInPlace) {
        const outcome = choice.onChoose?.();
        if (!outcome) return;
        els.modalTitle.textContent = outcome.title || title;
        els.modalBody.innerHTML = outcome.body || '';
        els.modalButton.textContent = outcome.buttonLabel || 'Continue';
        els.modalButton.style.display = '';
        let continued = false;
        els.modalButton.onclick = () => {
          if (continued) return;
          continued = true;
          close();
          outcome.onContinue?.();
        };
        els.modal.querySelector('.modal-card').scrollTop = 0;
        els.modalButton.focus({ preventScroll: true });
        return;
      }
      close();
      els.modalButton.style.display = '';
      choice.onChoose?.();
    };
    wrap.appendChild(btn);
  });

  els.modalBody.appendChild(wrap);
  wrap.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
}
