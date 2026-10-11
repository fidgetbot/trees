const RESOURCE_MARKS = {
  sunlight: '<circle cx="16" cy="16" r="5"/><path d="M16 3v4m0 18v4M3 16h4m18 0h4M7 7l3 3m12 12 3 3M7 25l3-3M22 10l3-3"/>',
  water: '<path d="M16 4C13 9 7 15 7 20a9 9 0 0 0 18 0c0-5-6-11-9-16Z"/><path d="M11 20c0 3 2 5 5 5"/>',
  nutrients: '<path d="M16 28V17m0 4C7 21 4 15 5 9c7 0 11 4 11 12Zm0-4C16 9 21 5 28 5c0 7-5 12-12 12Z"/>',
};
const resourceMark = kind => `<span class="res-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${RESOURCE_MARKS[kind]}</svg></span>`;

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
  const maintenance = gains.maintenance || { sunlight: 0, water: 0, nutrients: gains.maintenanceCost || 0 };
  const capacities = gains.capacities || { sunlight: state.sunlight, water: state.water, nutrients: state.nutrients };
  const overflow = gains.overflow || { sunlight: 0, water: 0, nutrients: 0 };
  const storage = kind => `<div class="gather-storage"><span>Stored ${number(state[kind])}/${number(capacities[kind])}</span><meter min="0" max="${Math.max(1, capacities[kind])}" value="${Math.max(0, state[kind])}" aria-label="Stored ${kind}"></meter></div>`;
  const excess = (kind, label) => overflow[kind] ? `<p class="gather-overflow">${number(overflow[kind])} excess ${label} returned to the grove</p>` : '';
  const species = (state.selectedSpecies || 'Plum').toLowerCase();
  const art = `assets/botanical/${species === 'plum' ? 'plum-foliage-airy' : `${species}-foliage-v1`}.png`;

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
    Autumn: 'The air cools. You prepare for the coming dormancy.',
    Winter: `The world sleeps. New leaves wait for spring, while dormancy saves ${gains.dormancySavings || 0} resource unit${gains.dormancySavings === 1 ? '' : 's'} of upkeep.`,
  };

  return `
    <img class="gather-specimen" src="${art}" alt="" aria-hidden="true" />
    <p class="gather-prose">${seasonDescriptions[season.name]}</p>
    <div class="resource-summary">
      <section class="res-line gather-sunlight" aria-label="Sunlight gathered">
        ${resourceMark('sunlight')}
        <span class="res-name">Sunlight</span>
        <span class="res-value">+${gains.sunlightGain}</span>
        ${storage('sunlight')}
        ${excess('sunlight', 'stored energy')}
        <details class="gather-details"><summary>View sunlight details</summary>
        <span class="resource-factors">
          ${factor(`${state.leafClusters} leaf cluster${state.leafClusters === 1 ? '' : 's'}`)}
          ${gains.canopyBonus ? factor(`Canopy +${number(gains.canopyBonus)}`, 'positive') : ''}
          ${gains.heightSunlightBonus ? factor(`Height +${number(gains.heightSunlightBonus)}`, 'positive') : ''}
          ${gains.canopyAdvantage ? factor(`Shading +${number(gains.canopyAdvantage)}`, 'positive') : ''}
          ${seasonalFactor('light', season.factorSun)}
          ${exposure < 100 ? factor(`Crowding: leaves ${exposure}% exposed · ${Math.max(0,4-(state.trunk||0))*8}% from thin trunk${relations.crowdingNeighbors ? ` · ${relations.crowdingNeighbors*12}% from neighboring shade` : ''}`, 'negative') : factor('Full light exposure')}
          ${diseaseFactor < 1 ? factor(`Disease ×${number(diseaseFactor)}`, 'negative') : ''}
          ${maintenance.sunlight ? factor(`Respiration −${number(maintenance.sunlight)}`, 'negative') : ''}
        </span>
        ${comparison('sunlight', deltas.sunlight, baseline.sunlight, [relations.shadedNeighbors ? `you shade ${relations.shadedNeighbors} neighbor${relations.shadedNeighbors === 1 ? '' : 's'}` : '', relations.crowdingNeighbors ? `${relations.crowdingNeighbors} neighbor${relations.crowdingNeighbors === 1 ? '' : 's'} crowd you` : ''])}
        </details>
      </section>
      <section class="res-line gather-water" aria-label="Water gathered">
        ${resourceMark('water')}
        <span class="res-name">Water</span>
        <span class="res-value">+${gains.waterGain}</span>
        ${storage('water')}
        ${excess('water', 'water')}
        <details class="gather-details"><summary>View water details</summary>
        <span class="resource-factors">
          ${factor(`Trunk storage ${state.trunk}`)}
          ${state.rootZones ? factor(`Root support +${Math.floor((gains.effectiveRoots ?? state.rootZones) / 2)}`, 'positive') : ''}
          ${gains.taprootBonus ? factor(`Taproot +${number(gains.taprootBonus)}`, 'positive') : ''}
          ${gains.allyWater ? factor(`Allies +${number(gains.allyWater)}`, 'positive') : ''}
          ${gains.hostileWaterPenalty ? factor(`Hostile roots −${number(gains.hostileWaterPenalty)}`, 'negative') : ''}
          ${seasonalFactor('water', season.factorWater)}
          ${droughtFactor < 1 ? factor(`Drought ×${number(droughtFactor)}`, 'negative') : ''}
          ${diseaseFactor < 1 ? factor(`Disease ×${number(diseaseFactor)}`, 'negative') : ''}
          ${maintenance.water ? factor(`Transpiration −${number(maintenance.water)}`, 'negative') : ''}
        </span>
        ${comparison('water', deltas.water, baseline.water, [relations.connectedAllies ? `${relations.connectedAllies} connected ${relations.connectedAllies === 1 ? 'ally shares' : 'allies share'} water · larger allies share more` : '', relations.hostileNeighbors ? `${relations.hostileNeighbors} hostile neighbor${relations.hostileNeighbors === 1 ? '' : 's'} invade your root zone` : ''])}
        </details>
      </section>
      <section class="res-line gather-nutrients" aria-label="Nutrients gathered">
        ${resourceMark('nutrients')}
        <span class="res-name">Nutrients</span>
        <span class="res-value">+${gains.nutrientGain}</span>
        ${storage('nutrients')}
        ${excess('nutrients', 'nutrients')}
        <details class="gather-details"><summary>View nutrients details</summary>
        <span class="resource-factors">
          ${factor(`Roots +${number(((gains.effectiveRoots ?? state.rootZones) || 0) * 0.7)}`, 'positive')}
          ${gains.taprootNutrients ? factor(`Taproot +${number(gains.taprootNutrients)}`, 'positive') : ''}
          ${gains.allyNutrients ? factor(`Allies +${number(gains.allyNutrients)}`, 'positive') : ''}
          ${gains.shadeNutrientBonus ? factor(`Shading +${number(gains.shadeNutrientBonus)}`, 'positive') : ''}
          ${gains.rootCompetitionPenalty ? factor(`Rival roots −${number(gains.rootCompetitionPenalty)}`, 'negative') : ''}
          ${gains.soilBonus ? factor(`Healthy soil +${number(gains.soilBonus)}`, 'positive') : ''}
          ${maintenance.nutrients ? factor(`Tissue upkeep −${number(maintenance.nutrients)}`, 'negative') : ''}
          ${gains.dormancySavings ? factor(`Dormancy saved ${number(gains.dormancySavings)}`, 'positive') : ''}
          ${diseaseFactor < 1 ? factor(`Disease ×${number(diseaseFactor)}`, 'negative') : ''}
        </span>
        ${comparison('nutrients', deltas.nutrients, baseline.nutrients, [relations.connectedAllies ? `${relations.connectedAllies} connected ${relations.connectedAllies === 1 ? 'ally' : 'allies'}` : '', relations.rivalNeighbors || relations.hostileNeighbors ? `${relations.rivalNeighbors || 0} rival and ${relations.hostileNeighbors || 0} hostile neighbor roots compete with you` : ''])}
        </details>
      </section>
      <div class="actions-earned">
        <strong>${state.actions} actions</strong><span> available this turn</span>
        ${bonusActions > 0 ? `<small>+${bonusActions} bonus action${bonusActions === 1 ? '' : 's'} from high resource yield</small>` : ''}
      </div>
    </div>
  `;
}
