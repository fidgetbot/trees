import { reconcileCanopyHeight } from './growth.js?rev=directional-shade-v1';

export const CATEGORY_NAMES = {
  growth: '🌱 Growth',
  defense: '🛡️ Defense',
  diplomacy: '🤝 Diplomacy',
  reproduction: '🌸 Reproduction',
};

export const MAX_UNBRACED_HEIGHT = 3;

export const ACTION_UNLOCK_EXPLANATIONS = {
  growBranch: 'This lets you add a new branch and two leaf clusters, increasing sunlight gathered on future turns and supporting flowers.',
  extendRoot: 'This lets you reach more soil, increasing both water storage and nutrient gathering while improving stability and fungal reach.',
  growLeaves: 'This lets you grow a new leaf that collects more sunlight each turn.',
  growTaller: 'This lets you lengthen your trunk to reach more light and overtop nearby trees, but each unbraced level adds wind damage; Fortify Bark braces it.',
  taproot: 'This lets you drive a deeper anchor into the soil, adding more water storage and nutrient access than an ordinary root while improving drought resistance.',
  canopy: 'This lets you spread a broader crown that captures more sunlight than ordinary leaf growth.',
  bark: 'This lets you brace one level of spindly height while thickening your trunk, storing more water, gaining health, and resisting drought, storms, insects, fire, and woodpeckers.',
  rhizosphere: 'This lets you enrich the soil community around your roots for greater future nutrient gains.',
  growThorns: 'This lets you grow permanent thorns that deter humans and browsing animals.',
  toxicLeaves: 'This lets you grow chemically defended leaves that discourage humans and herbivores.',
  shelterGrove: 'This lets you brace yourself and your allies against the next hardship.',
  resinReserve: 'This lets you store a concentrated defensive reserve for the next serious threat.',
  woodSurge: 'This lets you direct a powerful growth surge into your trunk, roots, or crown.',
  connect: 'This lets you seek an underground fungal connection with a neighboring tree.',
  aidAlly: 'This lets you spend water and nutrients to heal an ally, accelerate its growth, strengthen your bond, and build the support needed for grove protection.',
  requestHelp: 'This lets you call on allied trees for resources and resilience when you are wounded.',
  shadeRival: 'This lets you lean over one shorter adjacent tree for +2 sunlight each turn while slowing its growth; choosing another target releases the first.',
  rootDominion: 'This lets you pressure a neighboring root system and take water and nutrients from it.',
  flower: 'This lets you produce blossoms that pollinators can turn into fruit and seeds.',
  massFlower: 'This lets you create a burst of blossoms for a larger but riskier reproductive effort.',
  nurtureOffspring: 'This lets you support an individual child tree, improving its health and accelerating its growth.',
  mastYear: 'This lets you make an immense reproductive push, filling the canopy with flowers and future seeds.',
};

export function getActionUnlockExplanation(action) {
  return ACTION_UNLOCK_EXPLANATIONS[action.key]
    || `This gives you a new ability: ${action.help.charAt(0).toLowerCase()}${action.help.slice(1)}`;
}

export function getActionUnlockAnnouncement(action) {
  return `${action.name} is now available!`;
}

export function isActionAnnounceableInSeason(actionKey, currentSeasonName, seasonalActions) {
  const allowedSeasons = seasonalActions[actionKey];
  return !allowedSeasons || allowedSeasons.includes(currentSeasonName);
}

export function isActionUnlockedForState(actionKey, state, lifeStages, progressiveUnlocks = {}) {
  const unlockStage = lifeStages.find(stage => stage.unlocks.includes(actionKey));
  const currentStage = state.lifeStage;
  if (!unlockStage || !currentStage || currentStage.rank < unlockStage.rank) return false;
  if ((actionKey === 'requestHelp' || actionKey === 'aidAlly') && !state.hasMadeFirstAlly) return false;
  const progressive = progressiveUnlocks[actionKey];
  if (!progressive || currentStage.name !== progressive.stage) return true;
  return (state.turnsInStage || 0) >= progressive.turnsInStage;
}

export function getActionUnlockReason(actionKey, state, lifeStages, progressiveUnlocks = {}) {
  const unlockStage = lifeStages.find(stage => stage.unlocks.includes(actionKey));
  if (!unlockStage || !state.lifeStage || state.lifeStage.rank < unlockStage.rank) {
    return `Awakens at the ${unlockStage?.name || 'next stage'}`;
  }
  if ((actionKey === 'requestHelp' || actionKey === 'aidAlly') && !state.hasMadeFirstAlly) {
    return 'Awakens after you form your first alliance';
  }
  const progressive = progressiveUnlocks[actionKey];
  if (progressive && state.lifeStage.name === progressive.stage && (state.turnsInStage || 0) < progressive.turnsInStage) {
    return `Awakens ${progressive.label}`;
  }
  return null;
}

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
  getUnlockReason,
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
  const shortfalls = {
    sunlight: Math.max(0, (scaledCost.sunlight || 0) - state.sunlight),
    water: Math.max(0, (scaledCost.water || 0) - state.water),
    nutrients: Math.max(0, (scaledCost.nutrients || 0) - state.nutrients),
  };

  let reason = null;
  if (!usable) {
    if (!unlocked) reason = getUnlockReason?.(action.key) || `Awakens at the ${lifeStages.find(stage => stage.unlocks.includes(action.key))?.name || 'next stage'}`;
    else if (seasonLocked) {
      reason = action.key === 'growLeaves'
        ? 'Winter dormancy: new leaves can unfurl when spring returns'
        : `Best attempted in ${allowedSeasons.join('/')}`;
    }
    else if (!prereqOk) {
      if (action.key === 'connect') reason = 'Your roots must reach deeper first';
      else if (action.key === 'requestHelp') reason = (state.alliedNeighbors || 0) < 1 ? 'You need a living allied neighbor to call on' : 'You would only ask for help when wounded';
      else if (action.key === 'growTaller') reason = `Your trunk already carries ${MAX_UNBRACED_HEIGHT} unbraced height levels; use Fortify Bark before reaching higher`;
      else reason = 'The moment is not right yet';
    } else if (state.actions <= 0) reason = 'No actions remain this turn';
    else if (!affordable) {
      const missing = [
        ['sunlight', 'sunlight', shortfalls.sunlight],
        ['water', 'water', shortfalls.water],
        ['nutrient', 'nutrients', shortfalls.nutrients],
      ].filter(([, , amount]) => amount > 0).map(([singular, plural, amount]) => `${amount} more ${amount === 1 ? singular : plural}`);
      reason = `You need ${missing.join(' and ')}`;
    }
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
    shortfalls,
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
    nurtureOffspringAction = () => null,
    getRelationshipState,
    getNeighborStage,
  } = deps;

  return [
    { key: 'growBranch', name: 'Grow Branch', icon: '🌿', category: 'growth', help: 'Adds one branch and two leaf clusters, increasing future sunlight collection and supporting flowers.', baseCost: { sunlight: 2, water: 1, nutrients: 1 }, effect: s => { s.branches += 1; s.leafClusters += 2; } },
    { key: 'extendRoot', name: 'Extend Root', icon: '🥕', category: 'growth', help: 'Adds a root zone that improves water storage, nutrient gathering, storm stability, and fungal reach.', baseCost: { sunlight: 1, water: 0, nutrients: 0 }, effect: s => { s.rootZones += 1; } },
    { key: 'growLeaves', name: 'Grow Leaf', icon: '🍃', category: 'growth', help: 'Grows one leaf, increasing sunlight collection.', baseCost: { sunlight: 1, water: 1, nutrients: 1 }, hideAt: 'Young Tree', effect: s => { s.leafClusters += 1; } },
    { key: 'growTaller', name: 'Grow Taller', icon: '↟', category: 'growth', help: 'Lengthens your trunk for +1 sunlight each turn and greater shading reach. Each unbraced level adds +1 storm damage; use Fortify Bark to brace it.', status: s => { const risk = Math.max(0, s.spindlyGrowth || 0); return risk ? `${risk}/${MAX_UNBRACED_HEIGHT} height levels unbraced · +${risk} storm damage` : 'No unbraced height · no extra storm damage'; }, baseCost: { sunlight: 3, water: 2, nutrients: 1 }, prereq: s => (s.spindlyGrowth || 0) < MAX_UNBRACED_HEIGHT, effect: s => { s.heightGrowth = (s.heightGrowth || 0) + 1; s.spindlyGrowth = (s.spindlyGrowth || 0) + 1; if (getNeighborStage) { const changes = (s.neighbors || []).map(neighbor => reconcileCanopyHeight(s, neighbor, getNeighborStage, getRelationshipState)).filter(Boolean); if (changes.length) s.pendingCanopyNotices = [...(s.pendingCanopyNotices || []), ...changes]; } } },
    { key: 'taproot', name: 'Deepen Taproot', icon: '⬇️', category: 'growth', help: 'Adds a root zone plus deep water access, improving water and nutrients more than an ordinary root while resisting drought.', baseCost: { sunlight: 3, water: 1, nutrients: 3 }, effect: s => { s.rootZones += 1; s.taprootDepth += 1; s.maxHealth += 1; s.health = Math.min(s.maxHealth, s.health + 1); } },
    { key: 'canopy', name: 'Expand Canopy', icon: '🌳', category: 'growth', help: 'Spread a broader crown for more sunlight than ordinary leaf growth.', baseCost: { sunlight: 4, water: 2, nutrients: 3 }, effect: s => { s.leafClusters += 2; s.branches += 1; s.canopySpread += 1; } },

    { key: 'bark', name: 'Fortify Bark', icon: '🛡️', category: 'defense', help: 'Braces one level of spindly height, thickens your trunk, adds health and water storage, and resists drought, storms, insects, fire, and woodpeckers.', status: s => { const risk = Math.max(0, s.spindlyGrowth || 0); return risk ? `Will brace 1 of ${risk} unbraced height levels` : 'No unbraced height; still strengthens bark, health, and water storage'; }, baseCost: { sunlight: 4, water: 2, nutrients: 3 }, effect: s => { s.trunk += 1; s.defense += 1; s.maxHealth += 1; s.health = Math.min(s.maxHealth, s.health + 1); s.spindlyGrowth = Math.max(0, (s.spindlyGrowth || 0) - 1); } },
    { key: 'rhizosphere', name: 'Enrich Rhizosphere', icon: '🍄', category: 'defense', help: 'Invest in the soil food web for future nutrient gain.', baseCost: { sunlight: 2, water: 1, nutrients: 4 }, effect: s => { s.eventModifiers.soilBonus = (s.eventModifiers.soilBonus || 0) + 0.25; } },
    { key: 'growThorns', name: 'Grow Thorns', icon: '🌵', category: 'defense', help: 'Builds a permanent physical deterrent against humans and browsing animals.', baseCost: { sunlight: 4, water: 2, nutrients: 4 }, effect: s => { s.thornDefense = (s.thornDefense || 0) + 1; s.defense += 1; } },
    { key: 'toxicLeaves', name: 'Grow Toxic Leaves', icon: '☠️', category: 'defense', help: 'Builds permanent chemical deterrence against humans and herbivores.', baseCost: { sunlight: 3, water: 2, nutrients: 5 }, effect: s => { s.toxicLeaves = (s.toxicLeaves || 0) + 1; s.defense += 1; } },
    { key: 'shelterGrove', name: 'Shelter the Grove', icon: '⛺', category: 'defense', help: 'Spend resources to brace yourself and your allies against the next hardship.', baseCost: { sunlight: 4, water: 3, nutrients: 6 }, effect: s => { s.eventModifiers.shelter = 1; } },
    { key: 'resinReserve', name: 'Resin Reserve', icon: '🧪', category: 'defense', help: 'Choose a nutrient-heavy defensive investment for the next hardship.', baseCost: { sunlight: 2, water: 1, nutrients: 8 }, effect: (s, context) => resinReserveAction(s, context) },
    { key: 'woodSurge', name: 'Wood Surge', icon: '🏗️', category: 'growth', help: 'Choose a nutrient-heavy growth push for trunk, roots, or crown.', baseCost: { sunlight: 2, water: 2, nutrients: 8 }, effect: (s, context) => woodSurgeAction(s, context) },

    { key: 'connect', name: 'Seek Root Connection', icon: '🤝', category: 'diplomacy', help: 'Attempt underground friendship with a chosen neighboring tree.', baseCost: { sunlight: 1, water: 0, nutrients: 1 }, prereq: s => s.rootZones >= 3, effect: (s, context) => attemptConnection(s, context) },
    { key: 'aidAlly', name: 'Offer Aid to Ally', icon: '🎁', category: 'diplomacy', help: 'Heal and nourish an injured ally, strengthen your bond, and build protection-goal support.', baseCost: { sunlight: 0, water: 1, nutrients: 4 }, prereq: s => s.neighbors.some(n => !n.dead && getRelationshipState(n.relation).name === 'Ally' && n.health < n.maxHealth), effect: (s, context) => offerAidToAlly(s, context) },
    { key: 'requestHelp', name: 'Request Help from Allies', icon: '🆘', category: 'diplomacy', help: 'Spend 1 nutrient to ask an ally for health, water, or nutrients. Repeated requests strain the bond.', baseCost: { sunlight: 0, water: 0, nutrients: 1 }, prereq: s => s.neighbors.some(n => !n.dead && getRelationshipState(n.relation).name === 'Ally'), effect: (s, context) => requestHelpFromAllies(s, context) },
    { key: 'shadeRival', name: 'Shade Neighbor', icon: '☂️', category: 'diplomacy', help: 'Lean over one shorter adjacent tree for +2 sunlight each turn, slowing its growth while you remain taller. Choosing another target releases the first.', baseCost: { sunlight: 3, water: 1, nutrients: 2 }, prereq: s => s.neighbors.some(n => !n.dead && (n.slot === 1 || n.slot === 3)), effect: (s, context) => shadeRivalAction(s, context) },
    { key: 'rootDominion', name: 'Root Dominion', icon: '👑', category: 'diplomacy', help: 'Assert territorial pressure on a neighboring tree, stealing water and nutrients. Established rivalries pay off better than fresh betrayals.', baseCost: { sunlight: 7, water: 4, nutrients: 5 }, prereq: s => s.neighbors.some(n => !n.dead), effect: (s, context) => rootDominionAction(s, context) },

    { key: 'flower', name: 'Produce Flower', icon: '🌸', category: 'reproduction', help: 'Creates blossoms that can be pollinated into fruit in spring.', baseCost: { sunlight: 3, water: 2, nutrients: 2 }, effect: s => { s.flowers += 1; } },
    { key: 'massFlower', name: 'Mass Flowering', icon: '💐', category: 'reproduction', help: 'Pour resources into a burst of blossoms for a risky reproductive surge.', baseCost: { sunlight: 6, water: 3, nutrients: 4 }, effect: s => { s.flowers += 3; } },
    { key: 'nurtureOffspring', name: 'Nurture Offspring', icon: '👶', category: 'reproduction', help: 'Choose and support one child tree, then see exactly how its health and growth improve.', baseCost: { sunlight: 2, water: 2, nutrients: 4 }, prereq: s => (s.offspringRecords || []).some(child => !child.dead), effect: (s, context) => nurtureOffspringAction(s, context) },
    { key: 'mastYear', name: 'Mast Year', icon: '🌰', category: 'reproduction', help: 'An immense reproductive push that floods the canopy with flowers and future seed.', baseCost: { sunlight: 8, water: 4, nutrients: 8 }, effect: s => { s.flowers += 5; s.pollinated += 1; } },
  ];
}
