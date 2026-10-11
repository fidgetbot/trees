export function renderSpeciesSummary(speciesName, species, options = {}) {
  if (!species) return '';

  const {
    title = speciesName,
    intro = '',
    compact = false,
    reveal = false,
  } = options;

  if (reveal) return `
    <div class="species-reveal">
      <div class="reveal-art" aria-hidden="true"><img src="assets/botanical/${speciesName === 'Plum' ? 'plum-fruit-airy' : `${speciesName.toLowerCase()}-fruit-v1`}.png?rev=fruiting-botanical-library-v1" alt="" width="768" height="768" /></div>
      <p class="botanical-kicker">Your life begins as a</p>
      <h1>${title}</h1>
      <p class="reveal-description">${species.description}</p>
      <div class="reveal-trait"><span class="botanical-kicker">Your nature</span><strong>${species.bonusTitle}</strong><span>${species.bonusText}</span></div>
    </div>`;

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
    <div class="species-introduction">
      ${renderSpeciesCard(speciesName)}
    </div>`;
  els.startGame.disabled = false;
  els.startGame.textContent = 'Begin';
}
