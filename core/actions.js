import { clearPlayerShadeTarget, getPlayerShadeTarget, reconcileCanopyHeight } from './growth.js?rev=mature-grove-v1';
import { openIncident } from './incidents.js?rev=structured-event-outcomes-v1';

export const CATEGORY_NAMES = {
  growth: '🌱 Growth',
  defense: '🛡️ Defense',
  diplomacy: '🤝 Diplomacy',
  reproduction: '🌸 Reproduction',
};

export const MAX_UNBRACED_HEIGHT = 3;

export function hasStoredProtection(state) {
  return Number(state.eventModifiers?.shelter || 0) > 0;
}

export const ACTION_UNLOCK_EXPLANATIONS = {
  growBranch: 'This lets you add a new branch and two leaf clusters, increasing sunlight gathered on future turns and supporting flowers.',
  extendRoot: 'This lets you reach more soil, increasing both water storage and nutrient gathering while improving stability and fungal reach.',
  growLeaves: 'This lets you grow a new leaf that collects more sunlight each turn.',
  growTaller: 'This lets you lengthen your trunk to reach more light and overtop nearby trees, but each unbraced level adds wind damage; Fortify Trunk braces it.',
  taproot: 'This lets major roots curve deeper into the soil, adding more water storage and nutrient access than ordinary outward growth while improving drought resistance.',
  canopy: 'This lets you spread a broader crown that captures more sunlight than ordinary leaf growth.',
  bark: 'This lets you brace one level of spindly height while thickening your trunk, storing more water, gaining health, and resisting drought, storms, insects, fire, and woodpeckers.',
  rhizosphere: 'This lets you enrich the shared soil community, increasing your nutrient uptake while permanently helping connected allies and living offspring grow.',
  growThorns: 'This lets you add permanent thorns repeatedly; every layer strengthens defense against humans, fruit threats, conflict, and browsing animals.',
  toxicLeaves: 'This lets you add permanent toxic foliage repeatedly; every layer strengthens defense against humans, fruit threats, conflict, and herbivores.',
  interlaceCrown: 'This lets flexible shoots close the paths that harvesting poles and nets need through your canopy.',
  primeResin: 'This lets you hold resin ready to flood a cutting wound and foul a saw before it runs deep.',
  watchPath: 'This gives one living offspring the role of detecting approaching humans through the shared soil.',
  staggerHarvest: 'This gives one living offspring the role of spreading the grove’s fruit ripening across different heights and times.',
  closeApproach: 'This gives one living offspring the role of filling easy access routes with low, dense growth.',
  rouseGrove: 'This coordinates all three offspring roles into a prepared grove-wide defense against an organized crew.',
  shelterGrove: 'This lets you store protection against the next severe weather event while earning goodwill from every living neighbor.',
  resinReserve: 'This lets you store a concentrated defensive reserve for the next serious threat.',
  woodSurge: 'This lets you direct a powerful growth surge into your trunk, roots, or crown.',
  connect: 'This lets you seek an underground fungal connection with a neighboring tree.',
  aidAlly: 'This lets you spend sunlight, water, and nutrients to replenish an ally’s real reserves, heal it, accelerate its growth, strengthen your bond, and build the support needed for grove protection.',
  requestHelp: 'This lets you see and request any ally’s safe surplus sunlight, water, nutrients, or recovery aid without taking the donor’s survival reserves.',
  shadeRival: 'This lets you lean over one shorter adjacent tree for +2 sunlight and +1 nutrient each turn while slowing its growth; choosing another target releases the first.',
  stopShade: 'This lets you withdraw your crown from the neighbor and any offspring beneath it, ending the ongoing shade without spending resources.',
  rootDominion: 'This establishes one lasting contested root zone, taking up to 1 water and 1 nutrient from that neighbor every turn until you stop or switch targets.',
  stopRootDominion: 'This withdraws your roots from the contested soil and ends the ongoing transfer without spending resources.',
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

export function isActionUnlockedForState(actionKey, state, lifeStages, progressiveUnlocks = {}, storyUnlocks = {}) {
  const unlockStage = lifeStages.find(stage => stage.unlocks.includes(actionKey));
  const currentStage = state.lifeStage;
  if (!unlockStage || !currentStage || currentStage.rank < unlockStage.rank) return false;
  if ((actionKey === 'requestHelp' || actionKey === 'aidAlly') && !state.hasMadeFirstAlly) return false;
  const story = storyUnlocks[actionKey];
  if (story && (state.humanAdaptationChapter || 0) < story.chapter) return false;
  const progressive = progressiveUnlocks[actionKey];
  if (!progressive || currentStage.name !== progressive.stage) return true;
  return (state.turnsInStage || 0) >= progressive.turnsInStage;
}

export function getActionUnlockReason(actionKey, state, lifeStages, progressiveUnlocks = {}, storyUnlocks = {}) {
  const unlockStage = lifeStages.find(stage => stage.unlocks.includes(actionKey));
  if (!unlockStage || !state.lifeStage || state.lifeStage.rank < unlockStage.rank) {
    return `Awakens at the ${unlockStage?.name || 'next stage'}`;
  }
  if ((actionKey === 'requestHelp' || actionKey === 'aidAlly') && !state.hasMadeFirstAlly) {
    return 'Awakens after you form your first alliance';
  }
  const story = storyUnlocks[actionKey];
  if (story && (state.humanAdaptationChapter || 0) < story.chapter) return `Awakens ${story.label}`;
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
  if (action.hidden?.(state)) return { hidden: true };
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
      if (action.prereqReason) reason = action.prereqReason(state);
      else if (action.key === 'connect') reason = 'Your roots must reach deeper first';
      else if (action.key === 'growTaller') reason = `Your trunk already carries ${MAX_UNBRACED_HEIGHT} unbraced height levels; use Fortify Trunk before reaching higher`;
      else if (action.key === 'shelterGrove' && hasStoredProtection(state)) reason = 'Stored protection is already ready';
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
    stopRootDominionAction = () => null,
    getRootDominionTarget = () => null,
    nurtureOffspringAction = () => null,
    getRelationshipState = () => ({ name: 'Neutral' }),
    getNeighborStage,
    canAnyAllyHelp = s => s.neighbors.some(n => !n.dead && getRelationshipState(n.relation).name === 'Ally'),
    updateAlliesCount = () => {},
  } = deps;

  return [
    { key: 'growBranch', name: 'Grow Branch', icon: '🌿', category: 'growth', help: 'Adds a branch and two leaf clusters; improves sunlight and supports flowers.', baseCost: { sunlight: 2, water: 1, nutrients: 1 }, effect: s => { s.branches += 1; s.leafClusters += 2; } },
    { key: 'extendRoot', name: 'Extend Root', icon: '🥕', category: 'growth', help: 'Improves water, nutrients, stability, and fungal reach.', baseCost: { sunlight: 1, water: 0, nutrients: 0 }, effect: s => { s.rootZones += 1; } },
    { key: 'growLeaves', name: 'Grow Leaf', icon: '🍃', category: 'growth', help: 'Grows one leaf; improves sunlight gathering.', baseCost: { sunlight: 1, water: 1, nutrients: 1 }, hideAt: 'Young Tree', effect: s => { s.leafClusters += 1; } },
    { key: 'growTaller', name: 'Grow Taller', icon: '↟', category: 'growth', help: 'Improves sunlight and shading reach; increases storm risk until braced.', baseCost: { sunlight: 3, water: 2, nutrients: 1 }, prereq: s => (s.spindlyGrowth || 0) < MAX_UNBRACED_HEIGHT, effect: s => { s.heightGrowth = (s.heightGrowth || 0) + 1; s.spindlyGrowth = (s.spindlyGrowth || 0) + 1; if (getNeighborStage) { const changes = (s.neighbors || []).map(neighbor => reconcileCanopyHeight(s, neighbor, getNeighborStage, getRelationshipState)).filter(Boolean); changes.forEach(change => openIncident(s, { kind:'canopy-notice', title:'The Canopy Shifts', summary:change.message, artwork:'event-relationship', severity:change.kind==='hostile-crowding'?'warning':'neutral', meta:{kind:change.kind,unannounced:true,neighborSlot:change.neighbor?.slot} })); } } },
    { key: 'taproot', name: 'Deepen Roots', icon: '⬇️', category: 'growth', help: 'Develops major roots downward, improving water, nutrients, health, drought resistance, and defense against rival roots.', baseCost: { sunlight: 2, water: 0, nutrients: 1 }, effect: s => { s.rootZones += 1; s.taprootDepth += 1; s.maxHealth += 1; s.health = Math.min(s.maxHealth, s.health + 1); } },
    { key: 'canopy', name: 'Expand Canopy', icon: '🌳', category: 'growth', help: 'Adds a branch and three leaf clusters while broadening the crown for stronger sunlight collection.', baseCost: { sunlight: 4, water: 2, nutrients: 3 }, effect: s => { s.leafClusters += 3; s.branches += 1; s.canopySpread += 1; } },

    { key: 'bark', name: 'Fortify Trunk', icon: '🛡️', category: 'defense', help: 'Braces height; improves health, water storage, and resistance.', baseCost: { sunlight: 4, water: 2, nutrients: 3 }, effect: s => { s.trunk += 1; s.defense += 1; s.maxHealth += 1; s.health = Math.min(s.maxHealth, s.health + 1); s.spindlyGrowth = Math.max(0, (s.spindlyGrowth || 0) - 1); } },
    { key: 'rhizosphere', name: 'Enrich Rhizosphere', icon: '🍄', category: 'defense', help: 'Adds strong permanent nutrient uptake and storage while accelerating connected allies and offspring.', baseCost: { sunlight: 1, water: 1, nutrients: 2 }, effect: s => {
      s.eventModifiers.soilBonus = (s.eventModifiers.soilBonus || 0) + 1.5;
      for (const neighbor of s.neighbors || []) {
        if (neighbor.dead || getRelationshipState(neighbor.relation).name !== 'Ally') continue;
        neighbor.rhizosphereBonus = (neighbor.rhizosphereBonus || 0) + 0.5;
        neighbor.relation = Math.min(100, neighbor.relation + 3);
        neighbor.growthAidReceived = (neighbor.growthAidReceived || 0) + 1;
        if (neighbor.firstAidStageScore == null) neighbor.firstAidStageScore = neighbor.stageScore;
      }
      for (const child of s.offspringRecords || []) {
        if (child.dead) continue;
        child.rhizosphereBonus = (child.rhizosphereBonus || 0) + 0.5;
      }
    } },
    { key: 'growThorns', name: 'Grow Thorns', icon: '🌵', category: 'defense', help: 'Adds lasting physical defense, strongest against humans, large browsers, and chewing animals.', status: s => `${s.thornDefense || 0} thorn layer${(s.thornDefense || 0) === 1 ? '' : 's'} · strongest against humans and physical browsing`, baseCost: { sunlight: 4, water: 2, nutrients: 4 }, effect: s => { s.thornDefense = (s.thornDefense || 0) + 1; s.defense += 1; } },
    { key: 'toxicLeaves', name: 'Grow Toxic Leaves', icon: '☠️', category: 'defense', help: 'Adds lasting chemical defense, strongest against leaf-eating animals, pests, and fruit chewers.', status: s => `${s.toxicLeaves || 0} toxic layer${(s.toxicLeaves || 0) === 1 ? '' : 's'} · strongest against herbivores and leaf pests`, baseCost: { sunlight: 3, water: 2, nutrients: 5 }, effect: s => { s.toxicLeaves = (s.toxicLeaves || 0) + 1; s.defense += 1; } },
    { key: 'interlaceCrown', name: 'Interlace the Crown', icon: '🪢', category: 'defense', help: 'Closes clear paths through the canopy to poles, hooks, and nets.', status: s => s.interlacedCrown ? 'Living knots prepared' : 'Crown paths remain open', baseCost: { sunlight: 3, water: 2, nutrients: 3 }, prereq: s => !s.interlacedCrown, effect: s => { s.interlacedCrown = true; } },
    { key: 'primeResin', name: 'Prime Resin Reserves', icon: '🟠', category: 'defense', help: 'Stores resin to flood the next serious saw wound and foul the blade.', status: s => s.humanResinPrimed ? 'Resin primed for the next cutting attempt' : 'No cutting reserve primed', baseCost: { sunlight: 2, water: 2, nutrients: 5 }, prereq: s => !s.humanResinPrimed, effect: s => { s.humanResinPrimed = true; } },
    {
      key: 'shelterGrove',
      name: 'Shelter the Grove',
      icon: '⛺',
      category: 'defense',
      help: 'Stores protection against 1 damage from the next drought, storm, gale, or wildfire; every living neighbor gains +2 attitude.',
      status: s => hasStoredProtection(s)
        ? 'Stored protection ready · unavailable until it is used'
        : 'No protection currently stored',
      baseCost: { sunlight: 4, water: 3, nutrients: 6 },
      prereq: s => !hasStoredProtection(s),
      effect: s => {
        s.eventModifiers ||= {};
        s.eventModifiers.shelter = 1;
        for (const neighbor of s.neighbors || []) {
          if (neighbor.dead) continue;
          neighbor.relation = Math.min(100, (neighbor.relation || 0) + 2);
          if (neighbor.relation >= 0) {
            neighbor.playerShading = false;
            neighbor.shadingPlayer = false;
            neighbor.playerRootDominated = false;
          }
        }
        updateAlliesCount(s);
      },
    },
    { key: 'resinReserve', name: 'Resin Reserve', icon: '🧪', category: 'defense', help: 'Stores defense for the next serious threat.', baseCost: { sunlight: 2, water: 1, nutrients: 8 }, effect: (s, context) => resinReserveAction(s, context) },
    { key: 'woodSurge', name: 'Wood Surge', icon: '🏗️', category: 'growth', help: 'Boosts your trunk, roots, or crown.', baseCost: { sunlight: 2, water: 2, nutrients: 8 }, effect: (s, context) => woodSurgeAction(s, context) },

    { key: 'connect', name: 'Seek Root Connection', icon: '🤝', category: 'diplomacy', help: 'Seeks a fungal connection with a neighbor.', baseCost: { sunlight: 1, water: 0, nutrients: 1 }, prereq: s => s.rootZones >= 3, effect: (s, context) => attemptConnection(s, context) },
    { key: 'aidAlly', name: 'Offer Aid to Ally', icon: '🎁', category: 'diplomacy', help: 'Replenishes sunlight, water, and nutrient reserves, heals and grows an ally, and strengthens your bond.', baseCost: { sunlight: 1, water: 1, nutrients: 2 }, prereq: s => s.neighbors.some(n => !n.dead && getRelationshipState(n.relation).name === 'Ally' && (n.health < n.maxHealth || n.activeCrises?.length)), effect: (s, context) => offerAidToAlly(s, context) },
    { key: 'requestHelp', name: 'Request Help from Allies', icon: '🆘', category: 'diplomacy', help: 'Ask an allied tree to share resources it can safely spare.', baseCost: { sunlight: 0, water: 0, nutrients: 0 }, prereq: s => canAnyAllyHelp(s), prereqReason: s => s.neighbors.some(n => !n.dead && getRelationshipState(n.relation).name === 'Ally') ? 'No ally can safely spare health or resources right now' : 'You need a living allied neighbor to call on', effect: (s, context) => requestHelpFromAllies(s, context) },
    { key: 'shadeRival', name: 'Shade Neighbor', icon: '☂️', category: 'diplomacy', help: 'Gains +2 sunlight and +1 nutrient each turn by slowing a shorter neighbor.', baseCost: { sunlight: 3, water: 1, nutrients: 2 }, prereq: s => s.neighbors.some(n => !n.dead && (n.slot === 1 || n.slot === 3)), effect: (s, context) => shadeRivalAction(s, context) },
    { key: 'stopShade', name: 'Stop Shading', icon: '↔️', category: 'diplomacy', help: 'Withdraws your crown and releases the shaded neighbor and offspring.', announce: false, hidden: s => !getPlayerShadeTarget(s), baseCost: { sunlight: 0, water: 0, nutrients: 0 }, prereq: s => Boolean(getPlayerShadeTarget(s)), effect: s => { s.lastReleasedShadeTarget = clearPlayerShadeTarget(s)?.species || null; } },
    { key: 'rootDominion', name: 'Root Dominion', icon: '👑', category: 'diplomacy', help: 'Establishes one lasting contested root zone, drawing up to 1 water and 1 nutrient from the target each turn.', status: s => getRootDominionTarget(s) ? `Active against ${getRootDominionTarget(s).species}` : 'No active root dominion', baseCost: { sunlight: 7, water: 4, nutrients: 5 }, prereq: s => s.neighbors.some(n => !n.dead), effect: (s, context) => rootDominionAction(s, context) },
    { key: 'stopRootDominion', name: 'Stop Root Dominion', icon: '↩️', category: 'diplomacy', help: 'Withdraws your roots from the contested soil and ends the ongoing transfer.', announce: false, hidden: s => !getRootDominionTarget(s), baseCost: { sunlight: 0, water: 0, nutrients: 0 }, prereq: s => Boolean(getRootDominionTarget(s)), effect: (s, context) => stopRootDominionAction(s, context) },

    { key: 'flower', name: 'Produce Flower', icon: '🌸', category: 'reproduction', help: 'Creates a blossom that can become fruit and seed.', baseCost: { sunlight: 3, water: 2, nutrients: 2 }, effect: s => { s.flowers += 1; } },
    { key: 'massFlower', name: 'Mass Flowering', icon: '💐', category: 'reproduction', help: 'Creates three blossoms in one risky surge.', baseCost: { sunlight: 6, water: 3, nutrients: 4 }, effect: s => { s.flowers += 3; } },
    { key: 'nurtureOffspring', name: 'Nurture Offspring', icon: '👶', category: 'reproduction', help: 'Improves one child’s health and growth.', baseCost: { sunlight: 2, water: 2, nutrients: 4 }, prereq: s => (s.offspringRecords || []).some(child => !child.dead), effect: (s, context) => nurtureOffspringAction(s, context) },
    { key: 'watchPath', name: 'Teach: Watch the Path', icon: '👁️', category: 'reproduction', help: 'An offspring learns to warn the grove before humans arrive.', status: s => groveRoleStatus(s, 'watchPath'), baseCost: { sunlight: 2, water: 2, nutrients: 3 }, prereq: s => canAssignGroveRole(s, 'watchPath'), effect: s => assignGroveRole(s, 'watchPath') },
    { key: 'staggerHarvest', name: 'Teach: Stagger the Harvest', icon: '🗓️', category: 'reproduction', help: 'An offspring helps spread fruit ripening across different heights and times.', status: s => groveRoleStatus(s, 'staggerHarvest'), baseCost: { sunlight: 3, water: 2, nutrients: 3 }, prereq: s => canAssignGroveRole(s, 'staggerHarvest'), effect: s => assignGroveRole(s, 'staggerHarvest') },
    { key: 'closeApproach', name: 'Teach: Close the Approach', icon: '🌿', category: 'reproduction', help: 'An offspring develops low dense growth across an easy human route.', status: s => groveRoleStatus(s, 'closeApproach'), baseCost: { sunlight: 3, water: 3, nutrients: 4 }, prereq: s => canAssignGroveRole(s, 'closeApproach'), effect: s => assignGroveRole(s, 'closeApproach') },
    { key: 'rouseGrove', name: 'Rouse the Grove', icon: '🌲', category: 'defense', help: 'Coordinates prepared offspring into one grove-wide answer to an organized crew.', status: s => s.groveRoused ? 'The grove is prepared' : `${activeGroveRoleCount(s)}/3 offspring roles prepared`, baseCost: { sunlight: 5, water: 5, nutrients: 7 }, prereq: s => activeGroveRoleCount(s) === 3 && !s.groveRoused, effect: s => { s.groveRoused = true; } },
    { key: 'mastYear', name: 'Mast Year', icon: '🌰', category: 'reproduction', help: 'Creates five blossoms and one pollination in a major surge.', baseCost: { sunlight: 8, water: 4, nutrients: 8 }, effect: s => { s.flowers += 5; s.pollinated += 1; } },
  ];
}

function livingRoleChild(state, role) {
  const id = state.humanGroveRoles?.[role];
  return (state.offspringRecords || []).find(child => child.id === id && !child.dead) || null;
}

function activeGroveRoleCount(state) {
  return ['watchPath', 'staggerHarvest', 'closeApproach'].filter(role => livingRoleChild(state, role)).length;
}

function canAssignGroveRole(state, role) {
  return !livingRoleChild(state, role) && (state.offspringRecords || []).some(child => !child.dead);
}

function assignGroveRole(state, role) {
  state.humanGroveRoles ||= {};
  const alreadyAssigned = new Set(Object.values(state.humanGroveRoles));
  const living = (state.offspringRecords || []).filter(child => !child.dead);
  const child = living.find(candidate => !alreadyAssigned.has(candidate.id))
    || [...living].sort((a, b) => (b.nurtureCount || 0) - (a.nurtureCount || 0) || b.stageScore - a.stageScore)[0];
  if (child) state.humanGroveRoles[role] = child.id;
  return child;
}

function groveRoleStatus(state, role) {
  const child = livingRoleChild(state, role);
  return child ? `${child.species} offspring prepared` : 'No offspring assigned';
}
