import { neighborHeightLevel, neighborRhizosphereGrowthBonus, playerHeightLevel } from '../core/growth.js?rev=relationship-notebook-v1';
import { rhizosphereNutrientSupport } from '../core/neighbor-economy.js?rev=rhizosphere-soil-v1';

const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const allocatedAmount = (total, slots, slot) => {
  const index = slots.indexOf(slot);
  if (index < 0 || total <= 0 || !slots.length) return 0;
  const base = Math.floor(total / slots.length);
  return base + (index < total % slots.length ? 1 : 0);
};

const signedRelationship = score => {
  const value = Math.round(Number(score) || 0);
  if (value > 0) return `+${value} above neutral`;
  if (value < 0) return `−${Math.abs(value)} below neutral`;
  return 'Neutral';
};

const allyFeeling = score => score >= 90
  ? 'deeply trusting'
  : score >= 70
    ? 'warm and secure'
    : 'newly allied';

const rivalFeeling = score => score < -50
  ? 'openly hostile'
  : score <= -30
    ? 'actively competitive'
    : 'wary and competitive';

export function describeGroveRelationships(state, { getRelationshipState, getNeighborStage } = {}) {
  const report = state.groveRelationshipReport || {};
  const living = (state.neighbors || []).filter(neighbor => !neighbor.dead);
  const relationshipName = neighbor => getRelationshipState(neighbor.relation).name;
  const currentContestedSlots = living
    .filter(neighbor => [1, 3].includes(neighbor.slot) && ['Rival', 'Hostile'].includes(relationshipName(neighbor)))
    .map(neighbor => neighbor.slot);
  const contestedSlots = report.contestedSlots || currentContestedSlots;
  const blockedCount = report.rootCompetitionDefense ?? report.blockedRootSlots?.length ?? Math.min(
    contestedSlots.length,
    Math.ceil(Math.max(0, state.taprootDepth || 0) / 2),
  );
  const crowdingSlots = report.crowdingSlots || living.filter(neighbor => neighbor.shadingPlayer).map(neighbor => neighbor.slot);
  const hostileSlots = report.hostileSlots || living
    .filter(neighbor => [1, 3].includes(neighbor.slot) && relationshipName(neighbor) === 'Hostile')
    .map(neighbor => neighbor.slot)
    .slice(0, 2);

  const allies = living
    .filter(neighbor => relationshipName(neighbor) === 'Ally')
    .map(neighbor => {
      const enrichments = Math.max(0, Math.round((neighbor.rhizosphereBonus || 0) / 0.5));
      const aidGiven = Math.max(0, neighbor.helpGivenToThem || 0);
      const helpReceived = Math.max(0, neighbor.helpReceivedFromThem || 0);
      const favorBalance = aidGiven - Math.max(0, neighbor.timesAskedThemForHelp || 0);
      return {
        species: neighbor.species,
        stageName: getNeighborStage(neighbor.stageScore).name,
        relationshipText: signedRelationship(neighbor.relation),
        feeling: allyFeeling(neighbor.relation),
        enrichments,
        rhizosphereGrowth: neighborRhizosphereGrowthBonus(neighbor),
        rhizosphereNutrients: rhizosphereNutrientSupport(neighbor),
        aidGiven,
        helpReceived,
        favorBalance,
        health: neighbor.health ?? 10,
        maxHealth: neighbor.maxHealth ?? 10,
        reserves: {
          sunlight: neighbor.reserves?.sunlight ?? 12,
          water: neighbor.reserves?.water ?? 12,
          nutrients: neighbor.reserves?.nutrients ?? 12,
        },
      };
    });

  const rivals = living
    .filter(neighbor => ['Rival', 'Hostile'].includes(relationshipName(neighbor)))
    .map(neighbor => {
      const relationName = relationshipName(neighbor);
      const immediatelyAdjacent = [1, 3].includes(neighbor.slot);
      const heightDifference = neighborHeightLevel(neighbor, getNeighborStage) - playerHeightLevel(state);
      const sunlightLoss = allocatedAmount(report.canopySunlightLoss || 0, crowdingSlots, neighbor.slot);
      const rootPressure = contestedSlots.includes(neighbor.slot) ? 1 : 0;
      const waterLoss = hostileSlots.includes(neighbor.slot) ? 1 : 0;
      return {
        species: neighbor.species,
        stageName: getNeighborStage(neighbor.stageScore).name,
        relationName,
        relationshipText: signedRelationship(neighbor.relation),
        feeling: rivalFeeling(neighbor.relation),
        position: immediatelyAdjacent ? 'immediately adjacent' : 'outer grove',
        canopyActive: Boolean(neighbor.shadingPlayer),
        heightDifference: Math.max(0, heightDifference),
        sunlightLoss,
        rootPressure,
        rootPressureTotal: contestedSlots.length,
        rootBlockedTotal: blockedCount,
        nutrientLossTotal: Math.max(0, report.rootNutrientsLost ?? (contestedSlots.length - blockedCount)),
        waterLoss,
      };
    });

  return {
    totals: {
      allyWater: Math.max(0, report.allyWater || 0),
      allyNutrients: Math.max(0, report.allyNutrients || 0),
      canopySunlightLoss: Math.max(0, report.canopySunlightLoss || 0),
      rootNutrientsLost: Math.max(0, report.rootNutrientsLost || 0),
      hostileWaterLost: Math.max(0, report.hostileWaterLost || 0),
    },
    allies,
    rivals,
  };
}

const plural = (amount, word) => `${amount} ${word}${amount === 1 ? '' : 's'}`;
const signed = value => value > 0 ? `+${value}` : String(value);

function allyCard(ally) {
  const balance = `${signed(ally.favorBalance)} balance`;
  return `<article class="relationship-card relationship-card-ally">
    <header class="relationship-card-header">
      <div><h4>${escapeHtml(ally.species)} ally</h4><p>${escapeHtml(ally.stageName)} · fungal alliance active · ${escapeHtml(ally.feeling)}</p></div>
      <strong>${escapeHtml(ally.relationshipText)}</strong>
    </header>
    <div class="relationship-card-rows">
      <p><b>Shared soil</b><span>${plural(ally.enrichments, 'enrichment')} · <em>+${ally.rhizosphereGrowth} growth each season · +${ally.rhizosphereNutrients} nutrient${ally.rhizosphereNutrients === 1 ? '' : 's'} each turn · protected from Lean soil</em></span></p>
      <p><b>Give and take</b><span>You aided it ${plural(ally.aidGiven, 'time')} · it helped you ${plural(ally.helpReceived, 'time')} · <em>${escapeHtml(balance)}</em></span></p>
      <p><b>Condition</b><span>Health ${ally.health}/${ally.maxHealth} · reserves ${ally.reserves.sunlight} sunlight, ${ally.reserves.water} water, ${ally.reserves.nutrients} nutrients</span></p>
    </div>
  </article>`;
}

function rivalCard(rival) {
  const canopy = rival.canopyActive
    ? `${plural(rival.heightDifference, 'level')} taller, resulting in <em>−${rival.sunlightLoss} sunlight this turn</em>`
    : 'Not currently shading you';
  const rootResults = [];
  if (rival.nutrientLossTotal) rootResults.push(`−${rival.nutrientLossTotal} nutrient${rival.nutrientLossTotal === 1 ? '' : 's'} each turn`);
  if (rival.waterLoss) rootResults.push(`−${rival.waterLoss} water each turn`);
  const roots = rival.rootPressure
    ? `${rival.rootPressure} pressure${rival.rootPressureTotal > 1 ? ` of ${rival.rootPressureTotal} total` : ''} · ${rival.rootBlockedTotal} blocked by deep roots, resulting in <em>${rootResults.length ? rootResults.join(' and ') : 'no current resource loss'}</em>${rival.rootPressureTotal > 1 ? ' across the grove' : ''}`
    : 'Not close enough to compete with your roots';
  return `<article class="relationship-card relationship-card-rival">
    <header class="relationship-card-header">
      <div><h4>${escapeHtml(rival.species)} ${escapeHtml(rival.relationName.toLowerCase())}</h4><p>${escapeHtml(rival.stageName)} · ${escapeHtml(rival.position)} · ${escapeHtml(rival.feeling)}</p></div>
      <strong>${escapeHtml(rival.relationshipText)}</strong>
    </header>
    <div class="relationship-card-rows">
      <p><b>Canopy</b><span>${canopy}</span></p>
      <p><b>Roots</b><span>${roots}</span></p>
    </div>
  </article>`;
}

export function renderGroveRelationships(state, deps) {
  const view = describeGroveRelationships(state, deps);
  const allySummary = view.totals.allyWater || view.totals.allyNutrients
    ? `${view.totals.allyWater ? `+${view.totals.allyWater} water` : ''}${view.totals.allyWater && view.totals.allyNutrients ? '<br>' : ''}${view.totals.allyNutrients ? `+${view.totals.allyNutrients} nutrient${view.totals.allyNutrients === 1 ? '' : 's'}` : ''}`
    : 'No resources shared';
  const rivalLosses = [
    view.totals.canopySunlightLoss ? `−${view.totals.canopySunlightLoss} sunlight` : '',
    view.totals.rootNutrientsLost ? `−${view.totals.rootNutrientsLost} nutrient${view.totals.rootNutrientsLost === 1 ? '' : 's'}` : '',
    view.totals.hostileWaterLost ? `−${view.totals.hostileWaterLost} water` : '',
  ].filter(Boolean);

  return `<section class="grove-relationships" aria-labelledby="grove-relationships-title">
    <h3 id="grove-relationships-title">Allies and rivals</h3>
    <p class="relationship-intro">Your living relationships, and their current effect on the grove.</p>
    <div class="relationship-balance">
      <p><span>Allies last turn</span><strong>${allySummary}</strong></p>
      <p class="relationship-pressure"><span>Rival pressure</span><strong>${rivalLosses.length ? rivalLosses.join('<br>') : 'No resource losses'}</strong></p>
    </div>
    ${view.allies.length ? `<h4 class="relationship-list-title">Allies</h4>${view.allies.map(allyCard).join('')}` : ''}
    ${view.rivals.length ? `<h4 class="relationship-list-title">Rivals</h4>${view.rivals.map(rivalCard).join('')}` : ''}
    ${!view.allies.length && !view.rivals.length ? '<p class="relationship-empty">No neighboring tree is currently an ally or rival.</p>' : ''}
  </section>`;
}
