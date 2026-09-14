export function renderSpeciesSummary(speciesName, species, options = {}) {
  if (!species) return '';

  const {
    title = speciesName,
    intro = '',
    compact = false,
  } = options;

  return `
    <div class="species-summary ${compact ? 'compact' : ''}">
      <div class="species-summary-head">
        <div class="species-summary-title-row">
          <span class="species-summary-icon">${species.icon || '🌳'}</span>
          <div>
            <div class="species-summary-kicker">${intro}</div>
            <h3>${title}</h3>
          </div>
        </div>
        <p class="species-summary-description">${species.description}</p>
      </div>
      <div class="species-summary-bonus"><strong>Bonus:</strong> ${species.bonusTitle} — ${species.bonusText}</div>
    </div>`;
}

export function initSpeciesSelectUI(els, speciesName, renderSpeciesCard) {
  els.speciesList.innerHTML = `
    <div class="species-card selected species-card-detail">
      ${renderSpeciesCard(speciesName)}
    </div>`;
  els.startGame.disabled = false;
  els.startGame.textContent = 'Begin';
}
