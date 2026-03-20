export function renderResourcePhaseBody({ state, gains }) {
  const season = gains.season;
  const exposure = Math.round(gains.exposure * 100);

  const seasonDescriptions = {
    Spring: 'Spring rains awaken the soil. Buds swell with potential.',
    Summer: 'The sun climbs high. Your leaves drink in the long light.',
    Autumn: 'The air cools. Your tree prepares for the coming dormancy.',
    Winter: 'The world sleeps. Your roots still reach for what they can find.',
  };

  return `
    <p style="color: var(--muted); margin-bottom: 16px; font-style: italic;">${seasonDescriptions[season.name]}</p>
    <div class="resource-summary">
      <div class="res-line">
        <span class="res-icon">☀️</span>
        <span class="res-name">Sunlight</span>
        <span class="res-value">+${gains.sunlightGain}</span>
        <span class="res-detail">${state.leafClusters} leaves + canopy bonus ${gains.canopyBonus} × ${exposure}% exposure × ${season.factorSun} season</span>
      </div>
      <div class="res-line">
        <span class="res-icon">💧</span>
        <span class="res-name">Water</span>
        <span class="res-value">+${gains.waterGain}</span>
        <span class="res-detail">trunk ${state.trunk} + roots ${state.rootZones} + taproot bonus ${gains.taprootBonus} support water storage</span>
      </div>
      <div class="res-line">
        <span class="res-icon">🌱</span>
        <span class="res-name">Nutrients</span>
        <span class="res-value">+${gains.nutrientGain}</span>
        <span class="res-detail">roots ${gains.rootNutrients.toFixed(1)} + allies ${gains.allyNutrients.toFixed(1)} + soil ${gains.soilBonus.toFixed(2)} − upkeep ${gains.maintenanceCost}</span>
      </div>
      <div class="actions-earned">
        <strong>${state.actions} actions</strong> available this turn
        ${gains.sunlightGain + gains.waterGain + gains.nutrientGain >= 5 ? '<br><small>+1 bonus action from high resource yield</small>' : ''}
      </div>
    </div>
  `;
}
