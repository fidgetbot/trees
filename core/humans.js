import { createDecision, findDecisionOption } from './decisions.js';
import { getPlayerShadeTarget, offspringGrowthFromLight } from './growth.js?rev=mature-grove-v1';
import { findActiveIncident, migrateLegacyIncidentState, openIncident, resolveIncident } from './incidents.js?rev=structured-event-outcomes-v1';

export const HUMAN_RUMORS = [
  {
    title: 'A Distant Tremor',
    body: 'A faint warning travels through the fungal dark. Far away, an old tree feels repeated blows against its trunk.',
    minRank: 2,
    presentation: 'ominous',
  },
  {
    title: 'The Signal Falters',
    body: 'The distant tree speaks only in broken pulses now. Around it, familiar root-signals are disappearing one by one.',
    minRank: 2,
    presentation: 'ominous',
  },
  {
    title: 'Silence in the Network',
    body: 'The old tree is gone. Where its roots once answered, the fungal network carries only a cold and empty silence.',
    minRank: 3,
    presentation: 'ominous',
  },
  {
    title: 'A Pattern of Loss',
    body: 'Other forests whisper of the same destruction. Humans are seeking the largest trunks and leaving broken ground behind them.',
    minRank: 4,
    presentation: 'ominous',
  },
  {
    title: 'The Cutting Draws Nearer',
    body: 'The missing forests are no longer impossibly distant. Each season, the edge of the silence feels closer.',
    minRank: 5,
    presentation: 'ominous',
  },
  {
    title: 'The Largest Trees',
    body: 'A grim rumor spreads: forests holding the greatest trees are being marked first. Their wood has drawn human attention.',
    minRank: 5,
    presentation: 'ominous',
  },
  {
    title: 'A Grove Left Standing',
    body: 'Then comes a different story. Humans spared one grove larger than all the rest—a thriving community of ancient trees and their descendants, protected together as a living ecosystem.',
    minRank: 5,
  },
];

export const HUMAN_ADAPTATION_CARDS = [
  null,
  { title: 'Baskets Beneath the Blossoms', paragraphs: [
    'While your flowers open, unfamiliar footsteps press the soil beneath you. Humans look upward and point between your branches. They carry ominously empty baskets.',
    'They leave without touching you, but the fungal network holds the memory of their path.',
  ] },
  { title: 'A Bitter Gift', paragraphs: [
    'New compounds gather inside your leaves. Their taste will be foul; their touch will leave a lingering irritation.',
    'Your crown has found a way to guard what it will soon bear.',
  ], unlock: { key: 'toxicLeaves', label: 'Grow Toxic Leaves' } },
  { title: 'The Open Hand', paragraphs: [
    'The humans return when fruit weighs down your branches. Bare fingers reach into your crown while baskets wait below.',
    'Only the new, slick oils on your leaves stand between their hunger and your harvest.',
  ] },
  { title: 'The Itching Retreat', paragraphs: [
    'Hands push between your leaves. Before long, the humans begin to scratch. Their skin reddens; their reaching becomes frantic and clumsy.',
    'The baskets are withdrawn.',
    'As the humans retreat, they begin to wrap their palms in strips of tough material.',
  ] },
  { title: 'Covered Hands', paragraphs: [
    'The humans return wearing thin gloves stitched from the material you saw before.',
    'Covered fingers press experimentally against your leaves. This time, the irritation does not immediately reach their skin.',
    'What stopped them once will not stop them forever.',
  ] },
  { title: 'A New Answer', paragraphs: [
    'Tender shoots harden into something sharper. You discover that growth need not always reach toward light. It can also guard what you have made.',
  ], unlock: { key: 'growThorns', label: 'Grow Thorns' } },
  { title: 'Points Through Cloth', paragraphs: [
    'Thin gloves push safely past your bitter leaves. Covered hands reach toward your fruit.',
    'Then your thorns strike. Their points pierce the material and find the fingers beneath. Hands recoil; torn gloves are pulled away.',
    'One human remains below, studying the fruit beyond reach. The human raises a long pole and measures the distance with its eyes.',
  ] },
  { title: 'Beyond Touch', paragraphs: [
    'The humans return carrying hooks, poles, and folded cloth. They no longer intend to place their bodies within your defenses.',
    'The devices reach farther than any hand.',
  ] },
  { title: 'Interlace the Crown', paragraphs: [
    'You learn to direct flexible shoots across the open ways through your canopy. Narrow paths become living knots.',
    'There is no clear path for a pole or net to penetrate.',
  ], unlock: { key: 'interlaceCrown', label: 'Interlace the Crown' } },
  { title: 'The Net Catches', paragraphs: [
    'Hooks rise toward your fruit. Cloth spreads beneath your crown.',
    'The first pole disappears between crossing shoots. The second twists sideways. Their net catches on a hundred small branches and folds around itself.',
    'The humans leave with little fruit and much torn cloth.',
    'Before leaving, one opens a pruning hook and tests its sharpness.',
  ] },
  { title: 'Teeth in the Wood', paragraphs: [
    'The wind turns sharp and bitter. Autumn strips away the leaves that hid your shape. Humans return to examine the exposed branches.',
    'This time they carry saws. Metal teeth touch your bark, withdraw, and touch it again.',
    'They have come not for fruit, but for firewood.',
  ] },
  { title: 'Resin in Waiting', paragraphs: [
    'Beneath your bark, sugars and water thicken into a slow golden defense. You learn to hold it ready until living wood is broken.',
    'The next wound can be flooded before the cutting runs deep.',
  ], unlock: { key: 'primeResin', label: 'Prime Resin Reserves' } },
  { title: 'Gold in the Cut', paragraphs: [
    'The saw opens your bark. You answer at once.',
    'Resin floods the wound, clings to the metal teeth, and hardens among them. The blade begins to drag. The humans pull harder, but every stroke grows shorter.',
    'At last they abandon the fouled saw beneath your branches.',
    'Through the fungal network comes one final image: other saws, clean and waiting.',
  ] },
  { title: 'The Tools Multiply', paragraphs: [
    'The humans have learned again.',
    'Hooks cut paths through your interlaced crown. Fresh blades replace those your resin disables. Gloves, covered faces, poles, and saws now arrive together.',
    'No single part of you can answer every tool.',
  ] },
  { title: 'Younger Roots Answer', paragraphs: [
    'A younger tree feels the approaching footsteps before they reach you. Its warning travels through shared soil.',
    'The life you sheltered can now shelter something in return.',
  ], unlock: { key: 'offspringRoles', label: 'Watch the Path, Stagger the Harvest, Close the Approach' } },
  { title: 'The Grove Watches', paragraphs: [
    'Your offspring’s warning reaches you while the humans are still distant.',
    'Fruit ripens at different heights and different times. Low young branches close the easiest approach. By the time the humans reach your trunk, the simple path they remember no longer exists.',
    'They leave carrying less than they expected.',
    'From the edge of the grove comes the sound of many human voices, arguing.',
  ] },
  { title: 'An Organized Crew', paragraphs: [
    'The ground trembles beneath more footsteps than before.',
    'Humans arrive with ladders, ropes, hooks, spare blades, and enough hands to clear their own path. Some study your crown. Others study the younger trees around you. Several begin marking where each trunk might fall.',
    'They are no longer trying to defeat one tree at a time.',
  ] },
  { title: 'Rouse the Grove', paragraphs: [
    'A warning passes from root to root. Water, minerals, and chemical signals move through the shared dark. Young crowns close above old paths. Roots lift the ground where ladders would stand.',
    'You do not prepare one defense. You prepare the grove.',
  ], unlock: { key: 'rouseGrove', label: 'Rouse the Grove' } },
  { title: 'No Clear Fall', paragraphs: [
    'The humans understand your thorns. They understand your bitter leaves. They have brought blades enough for your resin.',
    'What they do not understand is the grove.',
    'Every clear approach ends in a tangle of branches. Roots break the level ground beneath their ladders. Young branches slip around their ropes. Warning pulses travel ahead of every movement.',
    'The humans argue hotly about where the first cut tree would fall.',
    'One by one, the tools go quiet.',
  ] },
  { title: 'No Easy Tree', paragraphs: [
    'Seasons pass. The baskets do not return. The saws remain silent.',
    'Some humans now avoid the grove entirely. Others linger at its edge, watching the old crowns and the younger trees beneath them.',
    'They still make marks. They still measure. But their footsteps carry a different rhythm, and the roots cannot understand why.',
  ] },
];

export function ensureHumanState(state) {
  migrateLegacyIncidentState(state);
  state.offspringRecords ||= [];
  state.alliedNeighbors ??= 0;
  state.humanPressure ??= 0;
  state.humanAttention ??= 0;
  state.humanCooldown ??= 0;
  state.cuttingProgress ??= 0;
  state.thornDefense ??= 0;
  state.toxicLeaves ??= 0;
  state.humanStoryTurns ??= 0;
  state.humanRumorIndex ??= 0;
  state.lastHumanRumorTurn ??= -99;
  state.lastPressureYear ??= 0;
  state.protectionProgress ??= 0;
  state.protectionEligible ??= false;
  state.protectionDesignated ??= false;
  state.humanAdaptationChapter ??= 0;
  state.humanAdaptationLastAttempt ||= {};
  state.humanGroveRoles ||= {};
  state.interlacedCrown ??= false;
  state.humanResinPrimed ??= false;
  state.groveRoused ??= false;
  return state;
}

export function createOffspringRecords(state, count) {
  ensureHumanState(state);
  const created = [];
  for (let i = 0; i < count; i += 1) {
    const record = {
      id: `offspring-${state.year}-${state.seasonIndex}-${state.offspringRecords.length + 1}`,
      species: state.selectedSpecies || 'Plum',
      stageScore: 100,
      maxHealth: 8,
      health: 8,
      nurtureCount: 0,
      supportReceived: 0,
      activeCrises: [],
      groveSide: state.offspringRecords.length % 2 === 0 ? 'left' : 'right',
      dead: false,
    };
    state.offspringRecords.push(record);
    created.push(record);
  }
  syncOffspringCounts(state);
  return created;
}

export function syncOffspringCounts(state) {
  ensureHumanState(state);
  state.offspringTrees = state.offspringRecords.filter(child => !child.dead).length;
  return state.offspringTrees;
}

export function growOffspringRecords(state, random = Math.random) {
  ensureHumanState(state);
  const shadeTarget = getPlayerShadeTarget(state);
  for (const [index, child] of state.offspringRecords.entries()) {
    if (child.dead) continue;
    const baseGrowth = 35 + Math.floor(random() * 26);
    const rhizosphereGrowth = Math.max(0, Math.floor((child.rhizosphereBonus || 0) * 4));
    child.stageScore += offspringGrowthFromLight(baseGrowth, child, index, shadeTarget) + rhizosphereGrowth;
    if (child.health < child.maxHealth && random() < 0.16) child.health += 1;
  }
  syncOffspringCounts(state);
}

export function nurtureOffspring(state, childId = null) {
  ensureHumanState(state);
  const candidates = state.offspringRecords
    .filter(child => !child.dead)
    .sort((a, b) => a.nurtureCount - b.nurtureCount || a.stageScore - b.stageScore);
  const child = childId
    ? candidates.find(candidate => candidate.id === childId)
    : candidates[0];
  if (!child) return null;
  child.nurtureCount += 1;
  child.stageScore += 300;
  child.maxHealth += 1;
  child.health = Math.min(child.maxHealth, child.health + 2);
  return child;
}

export function describeOffspring(state, lifeStages) {
  ensureHumanState(state);
  const roleLabels = { watchPath: 'Watch the Path', staggerHarvest: 'Stagger the Harvest', closeApproach: 'Close the Approach' };
  return state.offspringRecords
    .filter(child => !child.dead)
    .map(child => {
      const stage = [...lifeStages].reverse().find(candidate => child.stageScore >= candidate.threshold) || lifeStages[0];
      const nextStage = lifeStages.find(candidate => candidate.rank === stage.rank + 1) || null;
      return {
        id: child.id,
        species: child.species,
        groveSide: child.groveSide,
        stageName: stage.name,
        stageScore: child.stageScore,
        nextStageName: nextStage?.name || null,
        nextStageThreshold: nextStage?.threshold || null,
        health: child.health,
        maxHealth: child.maxHealth,
        nurtureCount: child.nurtureCount || 0,
        supportReceived: child.supportReceived || 0,
        rhizosphereBonus: child.rhizosphereBonus || 0,
        humanRoles: Object.entries(state.humanGroveRoles)
          .filter(([, childId]) => childId === child.id)
          .map(([role]) => roleLabels[role])
          .filter(Boolean),
      };
    });
}

const OFFSPRING_CRISIS_TEMPLATES = [
  { kind: 'nutrients', title: 'Aphid pressure', amount: 7, healthLoss: 2, flavors: [
    child => `${child.species} offspring sends a faint distress signal: aphids are draining its newest leaves.`,
    child => `${child.species} offspring is still struggling with aphids. Its young growth is weakening.`,
    child => `${child.species} offspring is close to collapse under the infestation.`,
  ] },
  { kind: 'water', title: 'Dry roots', amount: 6, healthLoss: 2, flavors: [
    child => `${child.species} offspring asks through the fungal network for water; its shallow roots have found dry soil.`,
    child => `${child.species} offspring is still thirsty. Its leaves are beginning to droop.`,
    child => `${child.species} offspring is close to collapse from drought.`,
  ] },
  { kind: 'nutrients', title: 'Blight recovery', amount: 9, healthLoss: 3, flavors: [
    child => `${child.species} offspring asks for rich reserves after walling off a patch of blight.`,
    child => `${child.species} offspring is still spending its reserves against blight.`,
    child => `${child.species} offspring can barely contain the blight now.`,
  ] },
];

export function createOffspringCrisis(state, child, random = Math.random) {
  ensureHumanState(state);
  state.nextOffspringCrisisId = (state.nextOffspringCrisisId || 0) + 1;
  const template = OFFSPRING_CRISIS_TEMPLATES[Math.min(
    OFFSPRING_CRISIS_TEMPLATES.length - 1,
    Math.floor(random() * OFFSPRING_CRISIS_TEMPLATES.length),
  )];
  const crisis = {
    kind: template.kind,
    title: template.title,
    amount: template.amount,
    healthLoss: template.healthLoss,
    flavors: template.flavors.map(flavor => flavor(child)),
    stage: 0,
    id: `offspring-crisis-${state.nextOffspringCrisisId}`,
  };
  child.activeCrises ||= [];
  child.activeCrises.push(crisis);
  return crisis;
}

export function advanceOffspringCrises(state, random = Math.random) {
  ensureHumanState(state);
  const results = [];
  const livingChildren = state.offspringRecords.filter(child => !child.dead);
  const hasActiveCrisis = livingChildren.some(child => (child.activeCrises || []).length > 0);
  if (!hasActiveCrisis && livingChildren.length > 0 && random() < 0.18) {
    const target = livingChildren[Math.min(livingChildren.length - 1, Math.floor(random() * livingChildren.length))];
    createOffspringCrisis(state, target, random);
  }
  for (const child of livingChildren) {
    child.activeCrises ||= [];
    for (const crisis of [...child.activeCrises]) {
      const flavor = crisis.flavors[Math.min(crisis.stage, crisis.flavors.length - 1)];
      crisis.stage += 1;
      child.health = Math.max(0, child.health - crisis.healthLoss);
      if (child.health <= 0) {
        child.dead = true;
        results.push({ child, crisis, flavor, died: true });
      } else {
        results.push({ child, crisis, flavor, died: false });
      }
    }
  }
  syncOffspringCounts(state);
  return results;
}

export function resolveOffspringCrisisAid(state, childId, crisisId, { withhold = false } = {}) {
  ensureHumanState(state);
  const child = state.offspringRecords.find(candidate => candidate.id === childId && !candidate.dead);
  const crisis = child?.activeCrises?.find(candidate => candidate.id === crisisId);
  if (!child || !crisis) return null;

  if (withhold) {
    crisis.amount += 2;
    return { child, crisis, given: 0, resolved: false, withheld: true };
  }

  const given = Math.min(crisis.amount, Math.max(0, state[crisis.kind] || 0));
  state[crisis.kind] -= given;
  child.supportReceived = (child.supportReceived || 0) + (given > 0 ? 1 : 0);
  if (given >= crisis.amount) {
    child.health = Math.min(child.maxHealth, child.health + crisis.healthLoss + 2);
    child.activeCrises = child.activeCrises.filter(candidate => candidate.id !== crisis.id);
    return { child, crisis, given, resolved: true, withheld: false };
  }
  if (given > 0) {
    child.health = Math.min(child.maxHealth, child.health + 1);
    crisis.amount = Math.max(1, crisis.amount - given);
  } else {
    crisis.amount += 2;
  }
  return { child, crisis, given, resolved: false, withheld: false };
}

export function getProtectedCompanions(state, { getRelationshipState, getNeighborStage }) {
  ensureHumanState(state);
  const supportedAllies = state.neighbors
    .map((neighbor, index) => ({ neighbor, index }))
    .filter(({ neighbor }) => !neighbor.dead)
    .filter(({ neighbor }) => getRelationshipState(neighbor.relation).name === 'Ally')
    .filter(({ neighbor }) => getNeighborStage(neighbor.stageScore).rank >= 5)
    .filter(({ neighbor }) => (neighbor.helpGivenToThem || 0) >= 2)
    .filter(({ neighbor }) => getNeighborStage(neighbor.firstAidStageScore ?? neighbor.stageScore).rank < 5 || (neighbor.growthAidReceived || 0) >= 4)
    .filter(({ neighbor }) => neighbor.health >= Math.ceil(neighbor.maxHealth * 0.5))
    .map(({ neighbor, index }) => ({ kind: 'ally', id: `neighbor-${index}`, tree: neighbor }));

  const supportedChildren = state.offspringRecords
    .filter(child => !child.dead)
    .filter(child => getNeighborStage(child.stageScore).rank >= 5)
    .filter(child => child.nurtureCount >= 2)
    .filter(child => child.health >= Math.ceil(child.maxHealth * 0.5))
    .map(child => ({ kind: 'offspring', id: child.id, tree: child }));

  return [...supportedAllies, ...supportedChildren];
}

export function updateProtectionProgress(state, deps) {
  const companions = getProtectedCompanions(state, deps);
  state.protectionProgress = Math.min(2, companions.length);
  state.protectionEligible = state.lifeStage?.name === 'Ancient'
    && state.protectionProgress >= 2
    && state.humanAdaptationChapter >= 20
    && state.humanRumorIndex >= HUMAN_RUMORS.length;
  return { companions, eligible: state.protectionEligible };
}

export function woodAttraction(state) {
  const rank = state.lifeStage?.rank || 0;
  if (rank < 4) return 0;
  return Math.max(0, (rank - 3) * 2 + (state.trunk || 0) + Math.floor((state.branches || 0) / 2) + Math.floor((state.canopySpread || 0) / 2));
}

export function buildConservationDecision(state, deps) {
  const { companions } = updateProtectionProgress(state, deps);
  const names = companions.slice(0, 2).map(entry => entry.kind === 'offspring'
    ? `${entry.tree.species} offspring`
    : `${entry.tree.species} ally`);
  return createDecision({
    kind: 'conservation-inspection',
    title: 'Visitors in the Grove',
    body: `<p>Humans arrive again, but these carry notebooks and measuring tapes instead of saws.</p><p>They study you and the two great trees you helped flourish: <strong>${names.join(' and ')}</strong>.</p>`,
    options: [{ id: 'receive-inspection', label: 'Let them witness the living grove' }],
  });
}

function getHumanEncounterIncident(state) {
  return findActiveIncident(state, 'human-encounter', incident => ['awaiting-response', 'ongoing'].includes(incident.state));
}

function clearHumanEncounter(state, outcome = {}) {
  const incident = getHumanEncounterIncident(state);
  if (incident) resolveIncident(state, incident.id, outcome);
}

export function buildHumanEncounterDecision(state, suppliedEncounter = null) {
  ensureHumanState(state);
  const encounter = suppliedEncounter || getHumanEncounterIncident(state)?.meta?.encounter;
  if (!encounter) return null;
  const options = [];
  if (state.branches > 0) {
    options.push({
      id: 'drop-branch',
      label: 'Drop a branch nearby (lose 1 branch and up to 2 leaf clusters)',
      preview: 'A forceful immediate defense that drives the humans away.',
    });
  }
  if (state.allies > 0) {
    options.push({
      id: 'call-network',
      label: state.nutrients >= 2 ? 'Draw support through the fungal network (2 nutrients)' : 'Draw support through the fungal network — need 2 nutrients',
      affordable: state.nutrients >= 2,
      preview: 'Allied roots share water and minerals while fungal signals prime sticky resin and irritating defensive chemistry.',
    });
  }
  const thornCost = { water: 2, nutrients: 3 };
  const oilCost = { sunlight: 3, nutrients: 2 };
  const canGrowThorns = state.water >= thornCost.water && state.nutrients >= thornCost.nutrients;
  const canReleaseOils = state.sunlight >= oilCost.sunlight && state.nutrients >= oilCost.nutrients;
  options.push({
    id: 'emergency-thorns',
    label: canGrowThorns ? 'Grow emergency thorns (2 water, 3 nutrients)' : 'Grow emergency thorns — need 2 water and 3 nutrients',
    affordable: canGrowThorns,
    preview: 'A lasting thorn level and a strong immediate deterrent.',
    meta: { cost: thornCost },
  });
  options.push({
    id: 'irritating-oils',
    label: canReleaseOils ? 'Release irritating leaf oils (3 sunlight, 2 nutrients)' : 'Release irritating leaf oils — need 3 sunlight and 2 nutrients',
    affordable: canReleaseOils,
    preview: 'The strongest immediate deterrent, but its effect is temporary.',
    meta: { cost: oilCost },
  });
  if (!canGrowThorns && !canReleaseOils && !options.some(option => option.affordable !== false)) {
    options.push({ id: 'endure-cutting', label: 'Endure without defending yourself', preview: 'No resource cost, but the humans face almost no resistance.' });
  }
  return createDecision({
    kind: 'human-encounter',
    title: encounter.phase === 'survey' ? 'Humans at Your Trunk' : 'The Cutters Return',
    body: encounter.phase === 'survey'
      ? '<p>Humans circle your trunk, measuring your girth and studying the shape of your wood. One raises a bright marking brush.</p>'
      : `<p>${encounter.count} humans return with cutting tools. Old marks on your trunk guide them back to you.</p><p><strong>Cutting damage:</strong> ${state.cuttingProgress}/3</p>`,
    options,
    meta: { encounter },
  });
}

function failEncounter(state, encounter) {
  if (encounter.phase === 'survey') {
    state.humanAttention += 1;
    state.humanCooldown = 4;
    clearHumanEncounter(state, { title: 'The Tree Is Marked', summary: 'The humans leave a bright mark and intend to return.' });
    return {
      title: 'The Tree Is Marked',
      body: '<p>The humans paint a bright mark low on your trunk. They leave for now, but the fungal network carries an uneasy certainty: they intend to return.</p><p class="threat-status threat-growing">The danger is drawing closer.</p>',
    };
  }

  const damage = 2 + Math.floor(state.humanPressure / 3);
  state.health = Math.max(0, state.health - damage);
  state.trunk = Math.max(1, state.trunk - 1);
  state.cuttingProgress += 1;
  state.humanAttention += 1;
  state.humanCooldown = 3;
  clearHumanEncounter(state, { title: 'A Deep Cut', summary: `The humans cut deeply before leaving. Cutting damage: ${state.cuttingProgress}/3.` });
  if (state.cuttingProgress >= 3) {
    state.health = 0;
    state.lastDamageCause = 'logging';
    return {
      title: 'Felled',
      body: '<p>The final cuts pass through your remaining wood. Your crown falls, and your root-signals break into silence.</p><p>The cutting ends only when the tree is gone.</p>',
      fatal: true,
    };
  }
  return {
    title: 'A Deep Cut',
    body: `<p>The humans carve deeply into your trunk before leaving. You lose <strong>${damage} health</strong> and one level of trunk growth.</p><p><strong>Cutting damage:</strong> ${state.cuttingProgress}/3</p><p class="threat-status threat-growing">They have withdrawn, but they mean to return.</p>`,
  };
}

export function resolveHumanDecision(state, decision, optionId, deps = {}) {
  const { random = Math.random } = deps;
  const option = findDecisionOption(decision, optionId);
  if (!option) return { title: 'The Moment Passes', body: '<p>No response was chosen.</p>' };

  if (decision.kind === 'conservation-inspection') {
    state.protectionDesignated = true;
    state.protectionEligible = true;
    state.victoryAchieved = true;
    clearHumanEncounter(state, { title: 'A Protected Ecosystem', summary: 'The grove receives lasting protection.' });
    return {
      title: 'A Protected Ecosystem',
      body: '<p>The visitors recognize that this is not merely valuable timber, but a rare community of great trees supporting one another across generations.</p><p>Boundaries are drawn around the grove. Cutting is forbidden. Your ecosystem will be allowed to endure.</p><p class="threat-status threat-solved">The axes will not return.</p>',
      victory: true,
    };
  }

  const encounter = getHumanEncounterIncident(state)?.meta?.encounter || decision.meta?.encounter;
  if (!encounter) return { title: 'The Humans Have Gone', body: '<p>The grove is quiet again.</p>' };

  if (option.id === 'drop-branch' && state.branches > 0) {
    state.branches -= 1;
    state.leafClusters = Math.max(0, state.leafClusters - 2);
    state.humanAttention = Math.max(0, state.humanAttention - 1);
    state.humanCooldown = 6;
    clearHumanEncounter(state, { title: 'Branchfall', summary: 'The humans flee after a heavy branch crashes beside them.' });
    return {
      title: 'Branchfall',
      body: '<p>You release a heavy branch. It crashes into the ground beside the humans, who abandon their tools and flee.</p><p>You lose <strong>1 branch</strong> and up to <strong>2 leaf clusters</strong>.</p><p class="threat-status threat-solved">The grove is safe for now.</p>',
      repelled: true,
    };
  }

  // Thorns are a strong physical deterrent to people; toxic foliage is much
  // better against herbivores and leaf pests than against tools and gloves.
  let defensePower = state.thornDefense * 3 + state.toxicLeaves + Math.min(2, state.defense || 0);
  if (option.id === 'call-network' && state.nutrients >= 2 && state.allies > 0) {
    state.nutrients -= 2;
    defensePower += 3 + Math.min(3, state.allies);
  }
  if (option.id === 'emergency-thorns') {
    if (state.water < 2 || state.nutrients < 3) return failEncounter(state, encounter);
    state.water -= 2;
    state.nutrients -= 3;
    state.thornDefense += 1;
    defensePower += 4;
  }
  if (option.id === 'irritating-oils') {
    if (state.sunlight < 3 || state.nutrients < 2) return failEncounter(state, encounter);
    state.sunlight -= 3;
    state.nutrients -= 2;
    defensePower += 5;
  }
  if (option.id === 'endure-cutting') defensePower = 0;

  const difficulty = encounter.phase === 'survey'
    ? 2 + state.humanPressure * 0.45
    : 5 + state.humanPressure * 0.7 + state.humanAttention * 0.35;
  const successChance = Math.max(0.08, Math.min(0.9, 0.38 + defensePower * 0.08 - difficulty * 0.035));
  if (random() < successChance) {
    state.humanAttention = Math.max(0, state.humanAttention - 1);
    state.humanCooldown = 5;
    clearHumanEncounter(state, { title: 'The Humans Retreat', summary: 'The humans abandon the grove.' });
    return {
      title: 'The Humans Retreat',
      body: option.id === 'call-network'
        ? '<p>Signals pass through your fungal partners. Allied roots share water and minerals while your wounded bark floods with sticky resin and irritating defensive compounds. The humans’ tools gum up, their skin begins to sting, and they abandon the cutting.</p><p class="threat-status threat-solved">The grove is safe for now.</p>'
        : option.id === 'emergency-thorns'
          ? '<p>New thorns harden along your lowest growth. The humans recoil from the spikes and abandon their work.</p><p>The thorn growth remains as a permanent defense.</p><p class="threat-status threat-solved">The grove is safe for now.</p>'
          : option.id === 'irritating-oils'
            ? '<p>You flood your leaves and bark with irritating oils. Burning skin and itching eyes drive the humans out of the grove.</p><p class="threat-status threat-solved">The grove is safe for now.</p>'
            : '<p>The humans reconsider the difficult ground and leave the grove untouched.</p><p class="threat-status threat-solved">The grove is safe for now.</p>',
      repelled: true,
    };
  }
  return failEncounter(state, encounter);
}

const ROLE_KEYS = ['watchPath', 'staggerHarvest', 'closeApproach'];

function hasLivingRole(state, role) {
  const childId = state.humanGroveRoles?.[role];
  return (state.offspringRecords || []).some(child => child.id === childId && !child.dead);
}

export function activeHumanGroveRoles(state) {
  ensureHumanState(state);
  return ROLE_KEYS.filter(role => hasLivingRole(state, role));
}

function markStoryActionAnnounced(state, unlock) {
  if (!unlock) return;
  const keys = unlock.key === 'offspringRoles' ? ROLE_KEYS : [unlock.key];
  state.announcedActionUnlocks ||= [];
  for (const key of keys) {
    if (!state.announcedActionUnlocks.includes(key)) state.announcedActionUnlocks.push(key);
  }
}

function displayAdaptationCard(state, chapter) {
  const card = HUMAN_ADAPTATION_CARDS[chapter];
  if (!card) return null;
  state.humanAdaptationChapter = chapter;
  markStoryActionAnnounced(state, card.unlock);
  return {
    ...card,
    chapter,
    body: card.paragraphs.join(' '),
    presentation: 'ominous',
    artwork: chapter >= 11 ? 'human-logger' : 'human-surveyor',
  };
}

function onceThisYear(state, key) {
  if (state.humanAdaptationLastAttempt[key] === state.year) return false;
  state.humanAdaptationLastAttempt[key] = state.year;
  return true;
}

function failedAdaptationAttempt(state, { key, chapter, title, paragraphs, fruitLoss = 0, cutting = false }) {
  if (fruitLoss > 0) state.developing = Math.max(0, (state.developing || 0) - fruitLoss);
  if (cutting) {
    state.health = Math.max(0, state.health - 2);
    state.trunk = Math.max(1, (state.trunk || 1) - 1);
    state.cuttingProgress = (state.cuttingProgress || 0) + 1;
    state.lastDamageCause = 'logging';
  }
  return {
    title,
    paragraphs,
    body: paragraphs.join(' '),
    chapter,
    presentation: 'ominous',
    artwork: cutting ? 'human-logger' : 'human-surveyor',
    failure: true,
    retryKey: key,
  };
}

export function advanceHumanAdaptation(state) {
  ensureHumanState(state);
  const chapter = state.humanAdaptationChapter;
  const season = ['Spring', 'Summer', 'Autumn', 'Winter'][state.seasonIndex] || 'Spring';
  const rank = state.lifeStage?.rank || 0;
  const fruitReady = (state.developing || 0) > 0;

  if (chapter === 0 && rank >= 4 && season === 'Spring' && ((state.flowers || 0) > 0 || (state.pollinated || 0) > 0)) return displayAdaptationCard(state, 1);
  if (chapter === 1) return displayAdaptationCard(state, 2);
  if (chapter === 2 && season === 'Summer' && fruitReady && onceThisYear(state, 'open-hand')) {
    state.humanAdaptationOpenHandPrepared = (state.toxicLeaves || 0) > 0;
    return displayAdaptationCard(state, 3);
  }
  if (chapter === 3) {
    if (state.humanAdaptationOpenHandPrepared) return displayAdaptationCard(state, 4);
    state.humanAdaptationChapter = 2;
    const loss = Math.max(1, Math.min(state.developing || 0, Math.ceil((state.developing || 0) / 2)));
    return failedAdaptationAttempt(state, {
      key: 'open-hand', chapter: 3, title: 'The Baskets Fill', fruitLoss: loss,
      paragraphs: [`Bare hands move freely through your crown. The humans take ${loss} fruit before withdrawing.`, 'They have learned nothing new. They will return the same way when fruit hangs from you again.'],
    });
  }
  if (chapter === 4 && season === 'Spring' && state.year > (state.humanAdaptationLastAttempt['open-hand'] || 0)) return displayAdaptationCard(state, 5);
  if (chapter === 5) return displayAdaptationCard(state, 6);
  if (chapter === 6 && season === 'Summer' && fruitReady && onceThisYear(state, 'covered-hands')) {
    if ((state.thornDefense || 0) > 0) return displayAdaptationCard(state, 7);
    const loss = Math.max(1, Math.min(state.developing || 0, Math.ceil((state.developing || 0) / 2)));
    return failedAdaptationAttempt(state, {
      key: 'covered-hands', chapter: 7, title: 'Covered Hands Reach Deep', fruitLoss: loss,
      paragraphs: [`Thin gloves keep your oils from their skin. The humans take ${loss} fruit before leaving.`, 'They will return with the same protection next year.'],
    });
  }
  if (chapter === 7 && season === 'Spring') return displayAdaptationCard(state, 8);
  if (chapter === 8) return displayAdaptationCard(state, 9);
  if (chapter === 9 && season === 'Summer' && fruitReady && onceThisYear(state, 'long-reach')) {
    if (state.interlacedCrown) return displayAdaptationCard(state, 10);
    const loss = Math.max(1, Math.min(state.developing || 0, Math.ceil((state.developing || 0) / 2)));
    return failedAdaptationAttempt(state, {
      key: 'long-reach', chapter: 10, title: 'The Long Reach', fruitLoss: loss,
      paragraphs: [`Hooks and nets pass through the open ways in your crown. The humans take ${loss} fruit without touching leaf or thorn.`, 'They will return with the same devices next year.'],
    });
  }
  if (chapter === 10 && season === 'Autumn') return displayAdaptationCard(state, 11);
  if (chapter === 11) return displayAdaptationCard(state, 12);
  if (chapter === 12 && season === 'Autumn' && onceThisYear(state, 'saws')) {
    if (state.humanResinPrimed) {
      state.humanResinPrimed = false;
      return displayAdaptationCard(state, 13);
    }
    return failedAdaptationAttempt(state, {
      key: 'saws', chapter: 13, title: 'A Deep Cut', cutting: true,
      paragraphs: ['The saw runs cleanly through unprepared wood. Before the humans withdraw, a deep wound crosses your trunk.', 'You lose 2 health and one level of trunk growth. They will return with the same saws next autumn.'],
    });
  }
  if (chapter === 13) return displayAdaptationCard(state, 14);
  if (chapter === 14 && rank >= 5 && (state.offspringRecords || []).some(child => !child.dead)) return displayAdaptationCard(state, 15);
  if (chapter === 15 && season === 'Summer' && fruitReady && activeHumanGroveRoles(state).length === 3) return displayAdaptationCard(state, 16);
  if (chapter === 16 && season === 'Autumn') return displayAdaptationCard(state, 17);
  if (chapter === 17) return displayAdaptationCard(state, 18);
  if (chapter === 18 && season === 'Autumn' && state.groveRoused) return displayAdaptationCard(state, 19);
  if (chapter === 19) return displayAdaptationCard(state, 20);
  return null;
}

export function advanceHumanSystem(state, deps = {}) {
  const {
    getRelationshipState,
    getNeighborStage,
    random = Math.random,
  } = deps;
  ensureHumanState(state);
  state.humanStoryTurns += 1;
  if (state.humanCooldown > 0) state.humanCooldown -= 1;

  if (state.protectionDesignated) return {};

  const activeHumanIncident = getHumanEncounterIncident(state);
  if (activeHumanIncident) {
    return { decision: buildHumanEncounterDecision(state, activeHumanIncident.meta?.encounter), incidentId: activeHumanIncident.id };
  }

  const storyCard = advanceHumanAdaptation(state);
  if (storyCard) return { storyCard };

  const protection = updateProtectionProgress(state, { getRelationshipState, getNeighborStage });
  if (protection.eligible && !state.victoryAchieved) {
    const incident = openIncident(state, {
      kind: 'conservation-inspection', title: 'Visitors in the Grove',
      summary: 'Human visitors arrive with notebooks and measuring tapes to study the living grove.',
      artwork: 'human-surveyor', severity: 'good',
      response: { kind: 'conservation-inspection' },
    });
    return { decision: buildConservationDecision(state, { getRelationshipState, getNeighborStage }), incidentId: incident.id, incident };
  }

  const nextRumor = HUMAN_RUMORS[state.humanRumorIndex];
  if (nextRumor
    && state.lifeStage?.rank >= nextRumor.minRank
    && state.humanStoryTurns - state.lastHumanRumorTurn >= 6) {
    state.humanRumorIndex += 1;
    state.lastHumanRumorTurn = state.humanStoryTurns;
    return { rumor: nextRumor };
  }

  if (state.lifeStage?.rank >= 4 && state.year > state.lastPressureYear) {
    state.humanPressure = Math.min(8, state.humanPressure + 1);
    state.lastPressureYear = state.year;
  }

  // Once the adaptation race begins, its legible seasonal chapters replace
  // the old random survey/cutting loop. Legacy pending encounters above still
  // resolve for compatible saved games.
  if (state.humanAdaptationChapter > 0) return {};

  const attraction = woodAttraction(state);
  if (attraction <= 0 || state.humanCooldown > 0) return {};
  const baseChance = state.lifeStage.rank === 4 ? 0.025 : state.lifeStage.rank === 5 ? 0.065 : 0.1;
  const chance = Math.min(0.28, baseChance + attraction * 0.004 + state.humanPressure * 0.012);
  if (random() >= chance) return {};

  const phase = state.humanAttention > 0 || state.cuttingProgress > 0 ? 'cutting' : 'survey';
  const encounter = {
    phase,
    count: phase === 'survey' ? 2 : Math.min(5, 2 + Math.floor((state.humanPressure + state.humanAttention) / 3)),
  };
  const incident = openIncident(state, {
    kind: 'human-encounter',
    title: phase === 'survey' ? 'Humans at Your Trunk' : 'The Cutters Return',
    summary: phase === 'survey'
      ? 'Humans have entered the grove and are measuring your trunk. Their interest is growing.'
      : 'The marked humans have returned with cutting tools and wait beside your trunk.',
    artwork: phase === 'survey' ? 'human-surveyor' : 'human-logger',
    severity: 'warning',
    response: { kind: 'human-encounter' },
    meta: { encounter },
  });
  return {
    incident,
    decision: buildHumanEncounterDecision(state, encounter),
    incidentId: incident.id,
  };
}
