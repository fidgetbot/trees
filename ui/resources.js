export function renderResourcePhaseBody({ state, gains }) {
  const season = gains.season;
  const exposure = Math.round(gains.exposure * 100);
  const baseline = gains.neutralGains || { sunlight: gains.sunlightGain, water: gains.waterGain, nutrients: gains.nutrientGain };
  const deltas = gains.relationDeltas || { sunlight: 0, water: 0, nutrients: 0 };
  const relations = gains.relations || { shadedNeighbors: 0, crowdingNeighbors: 0, connectedAllies: 0 };
  const bonusActions = Math.max(0, state.actions - 3);
  const number = value => Number(value || 0).toFixed(2).replace(/\.?0+$/, '');
  const factor = (label, tone = 'neutral') => `<span class="resource-factor ${tone}">${label}</span>`;
  const seasonalFactor = (kind, value) => factor(`${gains.season.name} ${kind} ×${number(value)}`, value > 1 ? 'positive' : value < 1 ? 'negative' : 'neutral');
  const diseaseFactor = state.eventModifiers?.disease ?? 1;
  const droughtFactor = state.eventModifiers?.drought ?? 1;

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
    Winter: `The world sleeps. New leaves wait for spring, while dormancy saves ${gains.dormancySavings || 0} nutrient${gains.dormancySavings === 1 ? '' : 's'} of upkeep.`,
  };

  return `
    <p style="color: var(--muted); margin-bottom: 16px; font-style: italic;">${seasonDescriptions[season.name]}</p>
    <div class="resource-summary">
      <div class="res-line">
        <span class="res-icon">☀️</span>
        <span class="res-name">Sunlight</span>
        <span class="res-value">+${gains.sunlightGain}</span>
        <span class="resource-factors">
          ${factor(`${state.leafClusters} leaf cluster${state.leafClusters === 1 ? '' : 's'}`)}
          ${gains.canopyBonus ? factor(`Canopy +${number(gains.canopyBonus)}`, 'positive') : ''}
          ${gains.heightSunlightBonus ? factor(`Height +${number(gains.heightSunlightBonus)}`, 'positive') : ''}
          ${gains.canopyAdvantage ? factor(`Shading +${number(gains.canopyAdvantage)}`, 'positive') : ''}
          ${seasonalFactor('light', season.factorSun)}
          ${exposure < 100 ? factor(`Crowding leaves ${exposure}% exposed`, 'negative') : factor('Full light exposure')}
          ${diseaseFactor < 1 ? factor(`Disease ×${number(diseaseFactor)}`, 'negative') : ''}
        </span>
        ${comparison('sunlight', deltas.sunlight, baseline.sunlight, [relations.shadedNeighbors ? `you shade ${relations.shadedNeighbors} neighbor${relations.shadedNeighbors === 1 ? '' : 's'}` : '', relations.crowdingNeighbors ? `${relations.crowdingNeighbors} neighbor${relations.crowdingNeighbors === 1 ? '' : 's'} crowd you` : ''])}
      </div>
      <div class="res-line">
        <span class="res-icon">💧</span>
        <span class="res-name">Water</span>
        <span class="res-value">+${gains.waterGain}</span>
        <span class="resource-factors">
          ${factor(`Trunk storage ${state.trunk}`)}
          ${state.rootZones ? factor(`Root support +${Math.floor(state.rootZones / 2)}`, 'positive') : ''}
          ${gains.taprootBonus ? factor(`Taproot +${number(gains.taprootBonus)}`, 'positive') : ''}
          ${gains.allyWater ? factor(`Allies +${number(gains.allyWater)}`, 'positive') : ''}
          ${seasonalFactor('water', season.factorWater)}
          ${droughtFactor < 1 ? factor(`Drought ×${number(droughtFactor)}`, 'negative') : ''}
          ${diseaseFactor < 1 ? factor(`Disease ×${number(diseaseFactor)}`, 'negative') : ''}
        </span>
        ${comparison('water', deltas.water, baseline.water, [relations.connectedAllies ? `${relations.connectedAllies} connected ${relations.connectedAllies === 1 ? 'ally shares' : 'allies share'} water · larger allies share more` : ''])}
      </div>
      <div class="res-line">
        <span class="res-icon">🌱</span>
        <span class="res-name">Nutrients</span>
        <span class="res-value">+${gains.nutrientGain}</span>
        <span class="resource-factors">
          ${factor(`Roots +${number((state.rootZones || 0) * 0.7)}`, 'positive')}
          ${gains.taprootNutrients ? factor(`Taproot +${number(gains.taprootNutrients)}`, 'positive') : ''}
          ${gains.allyNutrients ? factor(`Allies +${number(gains.allyNutrients)}`, 'positive') : ''}
          ${gains.soilBonus ? factor(`Healthy soil +${number(gains.soilBonus)}`, 'positive') : ''}
          ${gains.maintenanceCost ? factor(`Upkeep −${number(gains.maintenanceCost)}`, 'negative') : ''}
          ${gains.dormancySavings ? factor(`Dormancy saved ${number(gains.dormancySavings)}`, 'positive') : ''}
          ${diseaseFactor < 1 ? factor(`Disease ×${number(diseaseFactor)}`, 'negative') : ''}
        </span>
        ${comparison('nutrients', deltas.nutrients, baseline.nutrients, [relations.connectedAllies ? `${relations.connectedAllies} connected ${relations.connectedAllies === 1 ? 'ally' : 'allies'}` : ''])}
      </div>
      <div class="actions-earned">
        <strong>${state.actions} actions</strong> available this turn
        ${bonusActions > 0 ? `<br><small>+${bonusActions} bonus action${bonusActions === 1 ? '' : 's'} from high resource yield</small>` : ''}
      </div>
    </div>
  `;
}
