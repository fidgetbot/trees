export function renderResourcePhaseBody({ state, gains }) {
  const season = gains.season;
  const exposure = Math.round(gains.exposure * 100);
  const baseline = gains.neutralGains || { sunlight: gains.sunlightGain, water: gains.waterGain, nutrients: gains.nutrientGain };
  const deltas = gains.relationDeltas || { sunlight: 0, water: 0, nutrients: 0 };
  const relations = gains.relations || { shadedNeighbors: 0, crowdingNeighbors: 0, connectedAllies: 0 };
  const bonusActions = Math.max(0, state.actions - 3);

  const comparison = (kind, delta, neutral, causes) => {
    const activeCauses = causes.filter(Boolean).join(' · ');
    if (delta > 0) return `<span class="grove-effect positive">+${delta} above the neutral-grove baseline of ${neutral}${activeCauses ? ` · ${activeCauses}` : ''}</span>`;
    if (delta < 0) return `<span class="grove-effect negative">${Math.abs(delta)} below the neutral-grove baseline of ${neutral}${activeCauses ? ` · ${activeCauses}` : ''}</span>`;
    if (activeCauses) return `<span class="grove-effect neutral">At the neutral-grove baseline of ${neutral} after rounding · ${activeCauses}</span>`;
    return `<span class="grove-effect neutral">Neutral-grove baseline: ${neutral}</span>`;
  };

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
        ${comparison('sunlight', deltas.sunlight, baseline.sunlight, [relations.shadedNeighbors ? `you shade ${relations.shadedNeighbors} neighbor${relations.shadedNeighbors === 1 ? '' : 's'}` : '', relations.crowdingNeighbors ? `${relations.crowdingNeighbors} neighbor${relations.crowdingNeighbors === 1 ? '' : 's'} crowd you` : ''])}
      </div>
      <div class="res-line">
        <span class="res-icon">💧</span>
        <span class="res-name">Water</span>
        <span class="res-value">+${gains.waterGain}</span>
        <span class="res-detail">trunk ${state.trunk} + roots ${state.rootZones} + taproot bonus ${gains.taprootBonus} support water storage</span>
        ${comparison('water', deltas.water, baseline.water, [relations.connectedAllies ? `${relations.connectedAllies} connected ${relations.connectedAllies === 1 ? 'ally shares' : 'allies share'} water` : ''])}
      </div>
      <div class="res-line">
        <span class="res-icon">🌱</span>
        <span class="res-name">Nutrients</span>
        <span class="res-value">+${gains.nutrientGain}</span>
        <span class="res-detail">roots ${gains.rootNutrients.toFixed(1)} (including taproot ${gains.taprootNutrients.toFixed(1)}) + allies ${gains.allyNutrients.toFixed(1)} + canopy advantage ${gains.shadeNutrients.toFixed(1)} − crowding ${gains.crowdingNutrients.toFixed(1)} + soil ${gains.soilBonus.toFixed(2)} − upkeep ${gains.maintenanceCost}</span>
        ${comparison('nutrients', deltas.nutrients, baseline.nutrients, [relations.connectedAllies ? `${relations.connectedAllies} connected ${relations.connectedAllies === 1 ? 'ally' : 'allies'}` : '', relations.shadedNeighbors ? `canopy advantage over ${relations.shadedNeighbors}` : '', relations.crowdingNeighbors ? `crowded by ${relations.crowdingNeighbors}` : ''])}
      </div>
      <div class="actions-earned">
        <strong>${state.actions} actions</strong> available this turn
        ${bonusActions > 0 ? `<br><small>+${bonusActions} bonus action${bonusActions === 1 ? '' : 's'} from high resource yield</small>` : ''}
      </div>
    </div>
  `;
}
