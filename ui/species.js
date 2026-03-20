export function renderSpeciesSummary(speciesName, species, options = {}) {
  if (!species) return '';

  const {
    title = speciesName,
    intro = '',
    compact = false,
  } = options;

  const startingEdge = [];
  if (species.health > 10) startingEdge.push(`Health ${species.health}`);
  if (species.trunk > 1) startingEdge.push(`Trunk ${species.trunk}`);

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
      <div class="species-summary-meta">
        <div><strong>Pollinators:</strong> ${species.pollinators.join(', ')}</div>
        <div><strong>Starting edge:</strong> ${startingEdge.length ? startingEdge.join(' · ') : 'Balanced baseline'}</div>
      </div>
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
