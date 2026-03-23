export const CATEGORY_NAMES = {
  growth: '🌱 Growth',
  defense: '🛡️ Defense',
  diplomacy: '🤝 Diplomacy',
  reproduction: '🌸 Reproduction',
};

export function getActionAvailability({
  action,
  state,
  lifeStages,
  currentStageRank,
  currentSeasonName,
  seasonalActions,
  getScaledCost,
  canAfford,
  isActionUnlocked,
}) {
  if (action.hideAt) {
    const hideStage = lifeStages.find(s => s.name === action.hideAt);
    if (hideStage && currentStageRank >= hideStage.rank) return { hidden: true };
  }

  const scaledCost = getScaledCost(action.baseCost, action.key);
  const prereqOk = action.prereq ? action.prereq(state) : true;
  const affordable = canAfford(scaledCost);
  const unlocked = isActionUnlocked(action.key);
  const allowedSeasons = seasonalActions[action.key];
  const seasonLocked = allowedSeasons && !allowedSeasons.includes(currentSeasonName);
  const usable = prereqOk && affordable && state.actions > 0 && !seasonLocked && unlocked;

  let reason = null;
  if (!usable) {
    if (!unlocked) reason = `Awakens at the ${lifeStages.find(stage => stage.unlocks.includes(action.key))?.name || 'next stage'}`;
    else if (seasonLocked) reason = `Best attempted in ${allowedSeasons.join('/')}`;
    else if (!prereqOk) {
      if (action.key === 'connect') reason = 'Your roots must reach deeper first';
      else if (action.key === 'requestHelp') reason = state.allies < 1 ? 'You need an ally to call on' : 'You would only ask for help when wounded';
      else reason = 'The moment is not right yet';
    } else if (!affordable || state.actions <= 0) reason = 'You lack the resources right now';
    else reason = 'Unavailable';
  }

  return {
    hidden: false,
    scaledCost,
    prereqOk,
    affordable,
    unlocked,
    allowedSeasons,
    seasonLocked,
    usable,
    reason,
  };
}

export function createActions(deps) {
  const {
    resinReserveAction,
    woodSurgeAction,
    attemptConnection,
    offerAidToAlly,
    requestHelpFromAllies,
    shadeRivalAction,
    rootDominionAction,
    getRelationshipState,
  } = deps;

  return [
    { key: 'growBranch', name: 'Grow Branch', icon: '🌿', category: 'growth', help: 'Adds woody structure and supports future leaves and flowers.', baseCost: { sunlight: 2, water: 1, nutrients: 1 }, effect: s => { s.branches += 1; s.leafClusters += 2; } },
    { key: 'extendRoot', name: 'Extend Root', icon: '🥕', category: 'growth', help: 'Expands nutrient access, storm stability, and fungal networking reach.', baseCost: { sunlight: 1, water: 0, nutrients: 0 }, effect: s => { s.rootZones += 1; } },
    { key: 'growLeaves', name: 'Grow Leaves', icon: '🍃', category: 'growth', help: 'Increases sunlight collection.', baseCost: { sunlight: 1, water: 1, nutrients: 1 }, hideAt: 'Small Tree', effect: s => { s.leafClusters += 1; } },
    { key: 'thicken', name: 'Thicken Trunk', icon: '🪵', category: 'growth', help: 'Stores more water, improves health, and helps survive drought and storms.', baseCost: { sunlight: 4, water: 2, nutrients: 2 }, effect: s => { s.trunk += 1; s.defense += 1; s.health += 1; s.maxHealth += 1; } },
    { key: 'taproot', name: 'Deepen Taproot', icon: '⬇️', category: 'growth', help: 'Drive a deeper anchor into the soil, greatly boosting water collection and drought resilience.', baseCost: { sunlight: 3, water: 1, nutrients: 3 }, effect: s => { s.rootZones += 1; s.taprootDepth += 1; s.maxHealth += 1; s.health = Math.min(s.maxHealth, s.health + 1); } },
    { key: 'canopy', name: 'Expand Canopy', icon: '🌳', category: 'growth', help: 'Spread a broader crown for more sunlight than ordinary leaf growth.', baseCost: { sunlight: 4, water: 2, nutrients: 3 }, effect: s => { s.leafClusters += 2; s.branches += 1; s.canopySpread += 1; } },

    { key: 'bark', name: 'Fortify Bark', icon: '🛡️', category: 'defense', help: 'Lay down denser protective tissue to resist insects, fire, and woodpeckers.', baseCost: { sunlight: 3, water: 1, nutrients: 2 }, effect: s => { s.trunk += 1; s.defense += 1; s.maxHealth += 1; s.health = Math.min(s.maxHealth, s.health + 1); } },
    { key: 'rhizosphere', name: 'Enrich Rhizosphere', icon: '🍄', category: 'defense', help: 'Invest in the soil food web for future nutrient gain.', baseCost: { sunlight: 2, water: 1, nutrients: 4 }, effect: s => { s.eventModifiers.soilBonus = (s.eventModifiers.soilBonus || 0) + 0.25; } },
    { key: 'shelterGrove', name: 'Shelter the Grove', icon: '⛺', category: 'defense', help: 'Spend resources to brace yourself and your allies against the next hardship.', baseCost: { sunlight: 4, water: 3, nutrients: 6 }, effect: s => { s.eventModifiers.shelter = 1; } },
    { key: 'resinReserve', name: 'Resin Reserve', icon: '🧪', category: 'defense', help: 'Choose a nutrient-heavy defensive investment for the next hardship.', baseCost: { sunlight: 2, water: 1, nutrients: 8 }, effect: s => resinReserveAction(s) },
    { key: 'woodSurge', name: 'Wood Surge', icon: '🏗️', category: 'growth', help: 'Choose a nutrient-heavy growth push for trunk, roots, or crown.', baseCost: { sunlight: 2, water: 2, nutrients: 8 }, effect: s => woodSurgeAction(s) },

    { key: 'connect', name: 'Seek Root Connection', icon: '🤝', category: 'diplomacy', help: 'Attempt underground friendship with a chosen neighboring tree.', baseCost: { sunlight: 1, water: 0, nutrients: 1 }, prereq: s => s.rootZones >= 3, effect: s => attemptConnection(s) },
    { key: 'aidAlly', name: 'Offer Aid to Ally', icon: '🎁', category: 'diplomacy', help: 'Send substantial reserves to support an ally and improve its health.', baseCost: { sunlight: 0, water: 1, nutrients: 4 }, prereq: s => s.neighbors.some(n => !n.dead && getRelationshipState(n.relation).name === 'Ally'), effect: s => offerAidToAlly(s) },
    { key: 'requestHelp', name: 'Request Help from Allies', icon: '🆘', category: 'diplomacy', help: 'Call on allied trees to send resources and resilience.', baseCost: { sunlight: 0, water: 0, nutrients: 1 }, prereq: s => s.allies >= 1 && s.health < s.maxHealth, effect: s => requestHelpFromAllies(s) },
    { key: 'shadeRival', name: 'Shade Neighbor', icon: '☂️', category: 'diplomacy', help: 'Crowd a neighboring tree out of light and reclaim nutrients. Pressing an existing rivalry can now return more nutrients than the action costs.', baseCost: { sunlight: 3, water: 1, nutrients: 2 }, prereq: s => s.neighbors.some(n => !n.dead), effect: s => shadeRivalAction(s) },
    { key: 'rootDominion', name: 'Root Dominion', icon: '👑', category: 'diplomacy', help: 'Assert territorial pressure on a neighboring tree, stealing water and nutrients. Established rivalries pay off better than fresh betrayals.', baseCost: { sunlight: 7, water: 4, nutrients: 5 }, prereq: s => s.neighbors.some(n => !n.dead), effect: s => rootDominionAction(s) },

    { key: 'flower', name: 'Produce Flower', icon: '🌸', category: 'reproduction', help: 'Creates blossoms that can be pollinated into fruit in spring.', baseCost: { sunlight: 3, water: 2, nutrients: 2 }, effect: s => { s.flowers += 1; } },
    { key: 'massFlower', name: 'Mass Flowering', icon: '💐', category: 'reproduction', help: 'Pour resources into a burst of blossoms for a risky reproductive surge.', baseCost: { sunlight: 6, water: 3, nutrients: 4 }, effect: s => { s.flowers += 3; } },
    { key: 'nurtureOffspring', name: 'Nurture Offspring', icon: '👶', category: 'reproduction', help: 'Send reserves toward seedlings and improve lineage survival.', baseCost: { sunlight: 2, water: 2, nutrients: 4 }, prereq: s => s.offspringTrees >= 1 || s.seeds >= 1, effect: s => { s.offspringPool += 2; s.offspringTrees += 1; s.health = Math.min(s.maxHealth, s.health + 1); } },
    { key: 'mastYear', name: 'Mast Year', icon: '🌰', category: 'reproduction', help: 'An immense reproductive push that floods the canopy with flowers and future seed.', baseCost: { sunlight: 8, water: 4, nutrients: 8 }, effect: s => { s.flowers += 5; s.pollinated += 1; } },
  ];
}
