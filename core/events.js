import { findActiveIncident, migrateLegacyIncidentState, resolveIncident } from './incidents.js?rev=structured-event-outcomes-v1';
import { randomChoice, randomInt } from './random.js';
import { getFruitLossMultiplier } from './species.js';
import { canNeighborShadePlayer } from './growth.js?rev=canopy-competition-v2';

export function getHerbivoreDefense(state) {
  const thorns = Math.max(0, state.thornDefense || 0);
  const toxins = Math.max(0, state.toxicLeaves || 0);
  return { thorns, toxins, total: thorns + toxins };
}

export function getPollinatorSceneArt(visitor = '') {
  const normalized = visitor.toLowerCase();
  if (normalized.includes('bumblebee')) return 'pollinator-bumblebee';
  if (normalized.includes('honeybee')) return 'pollinator-honeybee';
  if (normalized.includes('hoverfl')) return 'pollinator-hoverfly';
  if (normalized.includes('butterfl')) return 'pollinator-butterfly';
  if (normalized.includes('beetle')) return 'pollinator-beetle';
  if (normalized.includes('mason') || normalized.includes('solitary') || normalized.includes('native bee')) return 'pollinator-mason-bee';
  return null;
}

function eventOutcome(summary, effects = [], factors = []) {
  return {
    summary,
    effects: effects.filter(Boolean),
    factors: factors.filter(Boolean),
  };
}

export function normalizeStoredProtection(state) {
  state.eventModifiers ||= {};
  state.eventModifiers.shelter = Number(state.eventModifiers.shelter || 0) > 0 ? 1 : 0;
  return state.eventModifiers.shelter;
}

export function applyStoredProtection(state, incomingDamage) {
  const damageBeforeProtection = Math.max(0, Number(incomingDamage) || 0);
  const charge = normalizeStoredProtection(state);
  const prevented = charge > 0 && damageBeforeProtection > 0
    ? Math.min(1, damageBeforeProtection)
    : 0;
  if (prevented > 0) state.eventModifiers.shelter = 0;
  return {
    damage: damageBeforeProtection - prevented,
    prevented,
    used: prevented > 0,
  };
}

export function createMajorEvents(deps) {
  const {
    getThreatMultiplier,
    recordDamage,
    getDroughtResistance,
    getRelationshipState,
    updateNeighborAliveState,
    updateAlliesCount,
  } = deps;

  const applyWindStorm = (s, winter = false) => {
    const stagePressure = s.lifeStage?.rank >= 5 ? 4 : s.lifeStage?.rank >= 4 ? 2 : 0;
    const spindlyPenalty = Math.max(0, s.spindlyGrowth || 0);
    const unprotectedDamage = Math.max(0, 4 + stagePressure + spindlyPenalty - s.trunk - Math.floor(s.rootZones / 2));
    const storedProtection = applyStoredProtection(s, unprotectedDamage);
    const damage = storedProtection.damage;
    s.health -= damage;
    recordDamage(damage, 'storm');
    const effects = [];
    let structuralSummary = '';
    if (s.branches > 0) {
      const prevBranches = s.branches;
      s.branches = Math.max(1, s.branches - 1);
      const lost = prevBranches - s.branches;
      structuralSummary = lost > 0
        ? 'The wind snaps one branch from your crown.'
        : 'Your only branch bends low but holds fast.';
      effects.push(lost > 0 ? '−1 branch' : 'No branches lost');
    } else if (s.leafClusters > 0) {
      s.leafClusters = Math.max(0, s.leafClusters - 1);
      structuralSummary = winter
        ? 'Icy wind strips away tender top growth.'
        : 'The wind shreds tender top growth before a true branch can form.';
      effects.push('−1 leaf cluster');
    } else {
      structuralSummary = winter
        ? 'The gale bends your young stem and scours the frozen soil.'
        : 'The storm bends your young stem and scours the soil around your base.';
    }
    const healthSummary = storedProtection.used
      ? damage > 0
        ? 'Stored protection absorbs part of the force, but the remainder damages living tissue.'
        : 'Stored protection absorbs the remaining force before it can damage living tissue.'
      : damage > 0
        ? 'The remaining force damages living tissue.'
        : 'Your combined structural strength prevents health damage.';
    if (storedProtection.used) effects.push(`Stored protection −${storedProtection.prevented} damage`);
    effects.push(damage > 0 ? `Health −${damage}` : 'No health lost');
    if (spindlyPenalty > 0) effects.push(`Spindly growth +${spindlyPenalty} wind pressure`);
    return eventOutcome(`${structuralSummary} ${healthSummary}`, effects, [
      { kind: 'trunk', amount: s.trunk || 0 },
      { kind: 'root-zones', amount: Math.floor((s.rootZones || 0) / 2) },
      { kind: 'shelter', amount: storedProtection.prevented },
      { kind: 'spindly-growth', amount: spindlyPenalty },
    ]);
  };

  return [
    {
      key: 'Drought',
      name: 'Summer Drought',
      seasons: ['Summer'],
      icon: '☀️',
      desc: 'The rains fail. Every drop matters now.',
      severity: 'bad', sceneArt: 'event-drought',
      apply: (s) => {
        const droughtResist = getDroughtResistance();
        const baseDroughtModifier = Math.max(0.15, 0.55 - (s.trunk * 0.08));
        s.eventModifiers.drought = Math.min(1, baseDroughtModifier + (droughtResist * 0.35));
        const stagePressure = s.lifeStage?.rank >= 5 ? 4 : s.lifeStage?.rank >= 4 ? 2 : 0;
        const baseThirst = Math.max(1, 3 + stagePressure - s.trunk - Math.floor((s.taprootDepth || 0) / 2));
        const unprotectedThirst = Math.max(1, Math.ceil(baseThirst * getThreatMultiplier() * (1 - droughtResist * 0.45)));
        const storedProtection = applyStoredProtection(s, unprotectedThirst);
        const thirst = storedProtection.damage;
        s.health -= thirst;
        recordDamage(thirst, 'drought');
        const protections = [
          droughtResist >= 0.4 ? `species' drought tolerance` : null,
          s.taprootDepth > 0 ? 'deep roots' : null,
        ].filter(Boolean);
        const summary = storedProtection.used
          ? thirst > 0
            ? 'Your preparations preserve vital moisture, though the dry season still takes a toll.'
            : 'Your preparations preserve enough vital moisture to prevent health damage from the drought.'
          : protections.length
            ? `Your ${protections.join(' and ')} ${protections.length === 1 && !s.taprootDepth ? 'helps' : 'help'} you hold onto moisture, but the dry season still takes its toll.`
            : 'With little protection from the dry season, thirst and water stress take their toll.';
        return eventOutcome(summary, [
          'Water collection reduced',
          storedProtection.used ? `Stored protection −${storedProtection.prevented} damage` : null,
          thirst > 0 ? `Health −${thirst}` : 'No health lost',
        ], [
          { kind: 'species-drought-tolerance', amount: droughtResist },
          { kind: 'trunk', amount: s.trunk || 0 },
          { kind: 'taproot', amount: Math.floor((s.taprootDepth || 0) / 2) },
          { kind: 'shelter', amount: storedProtection.prevented },
        ]);
      }
    },
    {
      key: 'Herbivores', name: 'Herbivore Surge', seasons: ['Spring', 'Summer'], icon: '🐛', desc: 'Hungry mouths descend on your foliage.', severity: 'bad', sceneArt: 'browsers',
      apply: (s) => {
        const defenses = getHerbivoreDefense(s);
        const feedingPressure = Math.max(1, Math.ceil(2 * getThreatMultiplier()));
        const prevented = Math.min(feedingPressure, defenses.total);
        const damage = Math.max(0, feedingPressure - prevented);
        const prevLeaves = s.leafClusters;
        const leafFloor = Math.min(1, prevLeaves);
        s.leafClusters = Math.max(leafFloor, s.leafClusters - damage);
        const lost = prevLeaves - s.leafClusters;
        const defenseNames = [defenses.thorns > 0 ? 'thorns' : null, defenses.toxins > 0 ? 'toxic foliage' : null].filter(Boolean);
        const singularDefense = defenses.thorns === 0 && defenses.toxins > 0;
        let summary = '';
        if (damage === 0) {
          summary = `Your ${defenseNames.join(' and ')} ${singularDefense ? 'turns' : 'turn'} the browsers away before they can feed.`;
        } else if (lost > 0) {
          summary = defenseNames.length
            ? `Your ${defenseNames.join(' and ')} ${singularDefense ? 'reduces' : 'reduce'} the feeding pressure, but browsers still tear into reachable foliage.`
            : 'With no thorns or toxic foliage to deter them, the browsers tear into your leaves.';
        } else if (prevLeaves === 1) {
          summary = defenseNames.length
            ? `Your ${defenseNames.join(' and ')} ${singularDefense ? 'reduces' : 'reduce'} the feeding pressure, but browsers still graze your final leaf cluster. It survives, though tender tissue is damaged.`
            : 'No thorns or toxic foliage deter them. The browsers graze your final leaf cluster; it survives, but the feeding damages tender tissue.';
        } else {
          summary = defenseNames.length
            ? `Your ${defenseNames.join(' and ')} ${singularDefense ? 'reduces' : 'reduce'} the feeding pressure, but browsers still gnaw exposed buds and tender stems.`
            : 'With no foliage available, the browsers gnaw exposed buds and tender stems instead.';
        }
        const effects = [lost > 0 ? `−${lost} leaf cluster${lost === 1 ? '' : 's'}` : 'No leaf clusters lost'];
        if (damage > 0) {
          s.health -= 1;
          recordDamage(1, 'herbivores');
          effects.push('Health −1');
        }
        if (prevented > 0) effects.push(`Defenses blocked ${prevented} browsing pressure`);
        return eventOutcome(summary, effects, [
          { kind: 'feeding-pressure', amount: feedingPressure },
          { kind: 'thorns', amount: defenses.thorns },
          { kind: 'toxic-foliage', amount: defenses.toxins },
          { kind: 'leaf-floor', amount: lost === 0 && damage > 0 && prevLeaves === 1 ? 1 : 0 },
        ]);
      }
    },
    {
      key: 'Storm', name: 'Autumn Storm', seasons: ['Autumn'], icon: '⛈️', desc: 'Fierce winds test your structure. Flexibility and strength determine survival.', severity: 'bad', sceneArt: 'event-storm',
      apply: (s) => applyWindStorm(s, false),
    },
    {
      key: 'WinterStorm', name: 'Winter Gale', seasons: ['Winter'], icon: '🌨️', desc: 'A bitter gale drives ice through the grove and tests every unbraced limb.', severity: 'bad', sceneArt: 'event-winter-gale',
      apply: (s) => applyWindStorm(s, true),
    },
    {
      key: 'Fire', name: 'Wildfire', seasons: ['Summer', 'Autumn'], icon: '🔥', desc: 'Flames sweep through the understory. Thick bark and stored protection can blunt the heat.', severity: 'critical', sceneArt: 'event-wildfire',
      apply: (s) => {
        const barkProtection = Math.min(2, Math.floor(s.trunk / 2));
        const unprotectedDamage = Math.max(0, 2 - barkProtection);
        const storedProtection = applyStoredProtection(s, unprotectedDamage);
        const damage = storedProtection.damage;
        s.health -= damage;
        if (damage > 0) recordDamage(damage, 'fire');
        const protectionNames = [barkProtection > 0 ? 'thick bark' : null, storedProtection.used ? 'stored protection' : null].filter(Boolean);
        const summary = damage === 0
          ? `Your ${protectionNames.join(' and ')} ${protectionNames.length === 1 ? 'holds' : 'hold'} back the flames before they damage living tissue.`
          : protectionNames.length
            ? `Your ${protectionNames.join(' and ')} ${protectionNames.length === 1 ? 'blunts' : 'blunt'} the heat, but the fire still reaches living tissue.`
            : 'With no effective barrier, the fire reaches living tissue.';
        return eventOutcome(summary, [
          storedProtection.used ? `Stored protection −${storedProtection.prevented} damage` : null,
          damage > 0 ? `Health −${damage}` : 'No health lost',
        ], [
          { kind: 'bark', amount: barkProtection },
          { kind: 'shelter', amount: storedProtection.prevented },
        ]);
      }
    },
    {
      key: 'LateFrost', name: 'Late Frost', seasons: ['Spring'], icon: '❄️', desc: 'An unexpected freeze damages new growth and tender flowers.', severity: 'bad', sceneArt: 'event-late-frost',
      apply: (s) => {
        const effects = [];
        const losses = [];
        if (s.flowers > 0) {
          const lost = Math.min(s.flowers, 1);
          s.flowers -= lost;
          effects.push(`−${lost} flower${lost !== 1 ? 's' : ''}`);
          losses.push('flowers');
        }
        if (s.leafClusters > 3) {
          s.leafClusters -= 1;
          effects.push('−1 leaf cluster');
          losses.push('foliage');
        }
        const frostDamage = s.lifeStage?.rank >= 5 ? 3 : s.lifeStage?.rank >= 4 ? 2 : 1;
        s.health -= frostDamage;
        recordDamage(frostDamage, 'frost');
        effects.push(`Health −${frostDamage}`);
        const summary = losses.length
          ? `The sudden freeze kills tender ${losses.join(' and ')} and chills the tissues beneath.`
          : 'The sudden freeze chills exposed tissue even though no flowers or dense foliage are lost.';
        return eventOutcome(summary, effects, [{ kind: 'cold-stress', amount: frostDamage }]);
      }
    },
    {
      key: 'FungalBlight', name: 'Fungal Blight', seasons: ['Spring', 'Summer', 'Autumn'], icon: '🍄', desc: 'A pathogen spreads through damp soil and vulnerable living tissue.', severity: 'bad', sceneArt: 'event-fungal-blight',
      apply: (s) => {
        s.eventModifiers.disease = 0.5;
        const effects = ['Resource collection −50%'];
        let summary = 'The infection settles into your tissues, sharply reducing resource collection.';
        const factors = [{ kind: 'disease-collection-multiplier', amount: 0.5 }];
        const alliedNeighbors = s.neighbors.filter(n => !n.dead && getRelationshipState(n.relation).name === 'Ally');
        if (alliedNeighbors.length > 0) {
          const target = randomChoice(alliedNeighbors);
          const blightDamage = 5;
          const previousHealth = target.health;
          target.health = Math.max(0, target.health - blightDamage);
          const lostHealth = previousHealth - target.health;
          summary += ` It also travels through the fungal connection to your allied ${target.species}.`;
          effects.push(`Allied ${target.species} health −${lostHealth}`);
          factors.push({ kind: 'allied-tree-hit', amount: lostHealth, target: target.species });
          if (target.health <= 0) {
            summary += ` The ${target.species} is overwhelmed by the blight.`;
            effects.push(`Allied ${target.species} lost`);
            updateNeighborAliveState(target, 'fungal blight');
          }
          updateAlliesCount();
        }
        return eventOutcome(summary, effects, factors);
      }
    },
    {
      key: 'Beaver', name: 'Beaver Activity', seasons: ['Spring', 'Summer', 'Autumn'], icon: '🦫', desc: 'A beaver colony has moved into the watershed, changing water patterns.', severity: 'neutral', sceneArt: 'beaver',
      apply: (s) => {
        if (Math.random() < 0.5) {
          s.water += 3;
          return eventOutcome('A new dam raises the nearby water table and moistens the soil around your roots.', ['Water +3']);
        } else {
          s.water = Math.max(0, s.water - 2);
          return eventOutcome('The altered channel diverts water away from your roots.', ['Water −2']);
        }
      }
    },
    {
      key: 'MycorrhizalBloom', name: 'Mycorrhizal Bloom', seasons: ['Spring', 'Summer', 'Autumn', 'Winter'], icon: '✨', desc: 'The fungal network flourishes, sharing nutrients generously.', severity: 'good', sceneArt: 'event-mycorrhizal-bloom',
      apply: (s) => {
        const connectedAllies = s.neighbors.filter(neighbor => (
          !neighbor.dead && getRelationshipState(neighbor.relation).name === 'Ally'
        )).length;
        s.nutrients += 3;
        if (connectedAllies > 0) {
          s.nutrients += connectedAllies;
          return eventOutcome('Connected allies strengthen the fungal bloom, sending a richer pulse through the shared soil.', [`Nutrients +${3 + connectedAllies}`], [{ kind: 'connected-allies', amount: connectedAllies }]);
        }
        return eventOutcome('The flourishing fungal network releases a fresh pulse of nutrients around your roots.', ['Nutrients +3']);
      }
    },
    {
      key: 'BirdDispersal', name: 'Bird Dispersal', seasons: ['Autumn', 'Winter'], icon: '🐦', desc: 'Migratory birds arrive, carrying seeds and nutrients from distant forests.', severity: 'good', sceneArt: 'fruit-robin',
      apply: (s) => {
        s.nutrients += 2;
        if (s.flowers > 0) {
          const pollinated = Math.min(s.flowers, randomInt(2) + 1);
          s.pollinated += pollinated;
          s.flowers -= pollinated;
          return eventOutcome('The visiting birds enrich the soil and carry pollen between your blossoms.', ['Nutrients +2', `${pollinated} flower${pollinated !== 1 ? 's' : ''} pollinated`]);
        }
        return eventOutcome('The visiting birds leave nutrient-rich droppings beneath your canopy.', ['Nutrients +2']);
      }
    },
  ];
}

export function rollMajorEvent(majorEvents, currentSeasonName = null, random = Math.random) {
  const eligibleEvents = currentSeasonName
    ? majorEvents.filter(event => !event.seasons || event.seasons.includes(currentSeasonName))
    : majorEvents;
  if (!eligibleEvents.length) return null;
  const weights = eligibleEvents.map(e => e.severity === 'critical' ? 0.05 : e.severity === 'bad' ? 0.25 : e.severity === 'neutral' ? 0.2 : 0.15);
  const total = weights.reduce((a, b) => a + b, 0);
  const r = random() * total;
  let sum = 0;
  for (let i = 0; i < eligibleEvents.length; i++) {
    sum += weights[i];
    if (r <= sum) return eligibleEvents[i];
  }
  return eligibleEvents[0];
}

const FRUIT_THREATS = Object.freeze({
  human: { type:'human', sceneArt:'human-surveyor', warning:'Lots of human activity stirs beneath your branches. They are eyeing your sweet fruits.', baseLoss:0.45, outcome:(losses,saved,defended)=> defended ? `Your established defenses reduced the risk, but humans still took ${losses}. ${saved} remained.` : `Humans harvested ${losses} ripe fruit${losses !== 1 ? 's' : ''} from your branches.`, safeText:'Your fruits ripened untouched despite the curious humans.' },
  bird: { type:'bird', sceneArt:'fruit-robin', warning:'Bright birds gather near your canopy, watching the ripening fruit.', baseLoss:0.35, outcome:(losses,saved,defended)=> defended ? `Your defenses discouraged the birds from many fruits. ${losses} were lost, ${saved} survived.` : `Birds pecked through ${losses} fruit${losses !== 1 ? 's' : ''} before autumn.`, safeText:'Most birds lost interest before doing any serious damage.' },
  chewer: { type:'chewer', sceneArt:'fruit-squirrel', warning:'Gnawing animals are scouting your branches for easy meals.', baseLoss:0.4, outcome:(losses,saved,defended)=> defended ? `Your established defenses reduced the risk. ${losses} fruit lost, ${saved} remained.` : `${losses} fruit${losses !== 1 ? 's' : ''} were chewed apart before the seeds matured.`, safeText:'The animals passed by without ruining your fruits.' },
});

export function resolveFruitThreats(state, events) {
  migrateLegacyIncidentState(state);
  const incident = findActiveIncident(state, 'fruit-threat', candidate => candidate.state === 'ongoing');
  if (!incident) return;
  const threat = FRUIT_THREATS[incident.meta?.threatType];
  if (!threat) return;
  const defensePower = state.defense + state.fruitDefense;
  let losses = 0;
  let saved = 0;
  for (let i = 0; i < state.developing; i++) {
    let lossChance = threat.baseLoss;
    if (threat.type === 'human') lossChance -= 0.12 * defensePower;
    if (threat.type === 'bird') lossChance -= 0.08 * defensePower;
    if (threat.type === 'chewer') lossChance -= 0.1 * defensePower;
    lossChance *= getFruitLossMultiplier(state);
    lossChance = Math.max(0.05, Math.min(0.95, lossChance));
    if (Math.random() < lossChance) losses += 1; else saved += 1;
  }
  state.developing = Math.max(0, state.developing - losses);
  const conclusion = losses > 0 ? threat.outcome(losses, saved, defensePower > 0) : threat.safeText;
  const summary = `${conclusion} The danger to this season's fruit has passed.`;
  resolveIncident(state, incident.id, { title: incident.title, summary, effects: losses > 0 ? [`−${losses} fruit`] : ['Fruit safe'] });
  incident.meta.reportPending = true;
  events.push({ title: incident.title, text: summary, effect: losses > 0 ? 'fruit-loss' : 'fruit-safe', sceneArt: threat.sceneArt, existingIncidentId: incident.id });
  state.fruitDefense = Math.max(0, state.fruitDefense - 1);
}

export function processSeasonalReproduction(state, events, getCurrentSeasonName) { /* unchanged */
  migrateLegacyIncidentState(state);
  const season = getCurrentSeasonName();
  const pendingFruitThreatAtStart = Boolean(findActiveIncident(state, 'fruit-threat', incident => incident.state === 'ongoing'));
  if (pendingFruitThreatAtStart) resolveFruitThreats(state, events);
  if (season === 'Summer' && state.pollinated > 0) {
    const ripened = state.pollinated;
    state.developing += ripened;
    state.pollinated = 0;
    if (ripened > 0) state.hasProducedFruit = true;
    events.push({ text: `${ripened} pollinated flower${ripened !== 1 ? 's' : ''} swelled into fruit in the summer sun. (+${ripened} fruit)`, effect: 'growth' });
  }
  if (season === 'Summer' && state.developing > 0 && !pendingFruitThreatAtStart && Math.random() < 0.45) {
    const threat = randomChoice(Object.values(FRUIT_THREATS));
    events.push({
      title: threat.type === 'human' ? 'Fruit Gatherers' : threat.type === 'bird' ? 'Fruit-Watching Birds' : 'Fruit Chewers',
      text: `${threat.warning} You have until the next event phase to strengthen your bark or defensive foliage. The danger is still gathering.`,
      effect: 'warning',
      sceneArt: threat.sceneArt,
      kind: 'fruit-threat',
      state: 'ongoing',
      responseMode: 'action-window',
      deadlineTurn: (state.turnsElapsed || 0) + 1,
      scenePersistent: true,
      meta: { threatType: threat.type },
    });
  }
  if (season === 'Autumn' && state.developing > 0) {
    const matured = state.developing;
    state.seeds += matured;
    state.developing = 0;
    events.push({ text: `${matured} surviving fruit${matured !== 1 ? 's' : ''} hardened into ${matured} seed${matured !== 1 ? 's' : ''}. (+${matured} seed${matured !== 1 ? 's' : ''})`, effect: 'growth' });
  }
}

import { createDecision } from './decisions.js';

export function resolveSeedFate(seedCount) { const results=[]; let sprouted=0; for (let i=0;i<seedCount;i++){ const r=Math.random(); if (r<0.18) results.push('A seed was eaten outright before it could travel.'); else if (r<0.33) results.push('A seed landed in deep shade and failed to establish.'); else if (r<0.48) results.push('A bird carried one of your seeds away, but dropped it on poor ground.'); else if (r<0.78) { sprouted += 1; results.push('A seed reached promising soil and sprouted into offspring.'); } else { sprouted += 1; results.push('An animal carried a seed to open ground, where it sprouted successfully.'); } } return { sprouted, results }; }

export function resolvePendingStartOfTurnEffects(state) {
  migrateLegacyIncidentState(state);
  const resolved = [];

  const delayedIncident = findActiveIncident(state, 'chemical-threat', incident => incident.state === 'ongoing' && (incident.deadlineTurn == null || incident.deadlineTurn <= (state.turnsElapsed || 0)));
  if (delayedIncident) {
    const delayed = buildChemicalDefenseDecision(state, {
      computeCurrentLifeStage: () => state.lifeStage,
      threat: delayedIncident.meta?.threatKey,
    }).meta.threat;
    const consequence = delayed.ignore();
    if (consequence.damage) state.lastDamageCause = consequence.damage.cause;
    const body = `${consequence.body} The danger has passed, though it left damage behind.`;
    resolveIncident(state, delayedIncident.id, { title: delayed.title, summary: body });
    delayedIncident.meta.reportPending = true;
    resolved.push({
      key: delayedIncident.id,
      title: delayed.title,
      warning: delayed.warning,
      sceneArt: delayed.sceneArt,
      body,
      incidentId: delayedIncident.id,
    });
    return resolved;
  }

  return resolved;
}

export function buildChemicalDefenseDecision(state, deps = {}) {
  migrateLegacyIncidentState(state);
  const { computeCurrentLifeStage, threat: preservedThreat = null } = deps;
  const DEFENSE_COST = { sunlight: 3, water: 1, nutrients: 2 };
  const canAffordDefense = state.sunlight >= DEFENSE_COST.sunlight && state.water >= DEFENSE_COST.water && state.nutrients >= DEFENSE_COST.nutrients;

  const currentStage = computeCurrentLifeStage().name;
  let threats;

  if (currentStage === 'Seedling') {
    threats = [
      {
        key: 'aphids',
        title: 'Aphid Cluster',
        sceneArt: 'aphids',
        warning: 'Tiny aphids gather on your tender stem, piercing and sucking at your sap.',
        defend: () => { state.defense += 1; return 'You release sticky compounds that trap the aphids. They fall away, unable to feed.'; },
        ignore: () => { state.leafClusters = Math.max(0, state.leafClusters - 1); state.health = Math.max(0, state.health - 1); return { body: 'The aphids feast unchecked, draining your strength. You lose 1 leaf cluster and 1 health.', damage: { amount: 1, cause: 'insects' } }; }
      },
      {
        key: 'surface-crawlers',
        title: 'Surface Crawlers',
        sceneArt: 'surface-crawlers',
        warning: 'Small insects swarm the soil surface around your base, nibbling at your tender roots.',
        defend: () => { state.defense += 1; return 'You release defensive compounds into the soil. The crawlers retreat from your roots.'; },
        ignore: () => { state.rootZones = Math.max(0, state.rootZones - 1); state.health = Math.max(0, state.health - 1); return { body: 'The insects damage your shallow roots. You lose 1 root zone and 1 health.', damage: { amount: 1, cause: 'insects' } }; }
      },
      {
        key: 'damp-rot',
        title: 'Damp Rot',
        sceneArt: 'damp-rot',
        warning: 'The soil around you stays too wet. Mold creeps up your tender stem.',
        defend: () => { state.eventModifiers.disease = Math.max(state.eventModifiers.disease, 0.9); return 'You mobilize protective chemistry. The mold cannot take hold on your tissues.'; },
        ignore: () => { state.health = Math.max(0, state.health - 2); return { body: 'The damp rot spreads. You lose 2 health as your stem weakens.', damage: { amount: 2, cause: 'blight' } }; }
      }
    ];
  } else {
    threats = [
      {
        key: 'mites',
        title: 'Mite Surge',
        sceneArt: 'mites',
        warning: 'Tiny mites mass along your bark and tender leaves, itching and feeding in their thousands.',
        defend: () => { state.defense += 1; return 'You flood your tissues with bitter compounds. The mites retreat before they can do serious harm.'; },
        ignore: () => { state.leafClusters = Math.max(0, state.leafClusters - 1); state.health = Math.max(0, state.health - 1); return { body: 'You do nothing. The mites feast, costing you 1 leaf cluster and 1 health.', damage: { amount: 1, cause: 'insects' } }; }
      },
      {
        key: 'browsers',
        kind: 'browsers',
        title: 'Hungry Browsers',
        sceneArt: 'browsers',
        warning: 'Warm-blooded mouths nose through your lower growth, searching for tender shoots and leaves.',
        defend: () => {
          state.fruitDefense += 1;
          if (state.developing > 0) return 'You turn your tissues bitter. The browsers recoil before they can strip your leaves or reach your fruit.';
          return 'You turn your tissues bitter. The browsers recoil before they can strip your young growth.';
        },
        ignore: () => {
          const lostFruit = Math.min(2, state.developing);
          if (lostFruit > 0) state.developing = Math.max(0, state.developing - lostFruit);
          state.leafClusters = Math.max(0, state.leafClusters - 1);
          return { body: lostFruit > 0 ? `You leave yourself undefended. Browsers strip 1 leaf cluster and ruin ${lostFruit} fruit.` : 'You leave yourself undefended. Browsers strip 1 leaf cluster and chew through your tender new growth.', damage: { amount: 1, cause: 'insects' } };
        }
      },
      {
        key: 'airborne-spores',
        title: 'Spores on the Damp Air',
        sceneArt: 'airborne-spores',
        warning: 'Damp air clings too long. Spores settle into tender tissues and wounded places.',
        defend: () => { state.eventModifiers.disease = Math.max(state.eventModifiers.disease, 0.9); return 'You mobilize defensive chemistry before the infection can take hold.'; },
        ignore: () => { state.health = Math.max(0, state.health - 2); return { body: 'Blight takes hold. You lose 2 health to spreading infection.', damage: { amount: 2, cause: 'blight' } }; }
      }
    ];
  }

  const threat = typeof preservedThreat === 'string'
    ? threats.find(candidate => candidate.key === preservedThreat || candidate.title === preservedThreat) || threats[0]
    : preservedThreat || threats[Math.floor(Math.random() * threats.length)];
  const permanentBrowserDefense = threat.kind === 'browsers' ? getHerbivoreDefense(state) : null;
  if (permanentBrowserDefense?.total > 0) {
    const defenseNames = [
      permanentBrowserDefense.thorns > 0 ? 'thorns' : null,
      permanentBrowserDefense.toxins > 0 ? 'toxic leaves' : null,
    ].filter(Boolean);
    const defenseText = defenseNames.length === 2 ? `${defenseNames[0]} and ${defenseNames[1]}` : defenseNames[0];
    return createDecision({
      kind: 'chemical-defense',
      title: threat.title,
      body: `<p><strong>Your established ${defenseText} are ready.</strong> Choose whether to rely on them.</p>`,
      options: [{
        id: 'use-permanent-defenses',
        label: `Rely on your ${defenseText}`,
        affordable: true,
      }],
      meta: { threat, threatKey: threat.key, cost: DEFENSE_COST, deficits: {}, permanentBrowserDefense },
    });
  }
  const costText = `☀️${DEFENSE_COST.sunlight} 💧${DEFENSE_COST.water} 🌱${DEFENSE_COST.nutrients}`;
  const deficits = {
    sunlight: Math.max(0, DEFENSE_COST.sunlight - state.sunlight),
    water: Math.max(0, DEFENSE_COST.water - state.water),
    nutrients: Math.max(0, DEFENSE_COST.nutrients - state.nutrients),
  };
  const deficitParts = [];
  if (deficits.sunlight) deficitParts.push(`☀️+${deficits.sunlight}`);
  if (deficits.water) deficitParts.push(`💧+${deficits.water}`);
  if (deficits.nutrients) deficitParts.push(`🌱+${deficits.nutrients}`);
  const deficitText = deficitParts.join(' ');
  return createDecision({
    kind: 'chemical-defense',
    title: threat.title,
    body: canAffordDefense
      ? '<p>Choose whether to spend reserves now or conserve them while the threat remains.</p>'
      : `<p><strong>Defense unavailable:</strong> need ${deficitText} more.</p>`,
    options: canAffordDefense ? [
      {
        id: 'defend',
        label: `Release defensive compounds (${costText})`,
        affordable: true,
      },
      {
        id: 'conserve',
        label: 'Conserve strength',
        affordable: true,
      }
    ] : [
      {
        id: 'conserve',
        label: `Not enough resources — need ${deficitText}`,
        affordable: true,
      }
    ],
    meta: { threat, threatKey: threat.key, cost: DEFENSE_COST, deficits },
  });
}

export function resolveChemicalDefenseChoice(state, decision, choiceId, deps = {}) {
  const { recordDamage = () => {} } = deps;
  const { threat, cost } = decision.meta;
  const costText = `☀️${cost.sunlight} 💧${cost.water} 🌱${cost.nutrients}`;

  if (choiceId === 'use-permanent-defenses' && threat.kind === 'browsers') {
    const defenses = getHerbivoreDefense(state);
    const defenseResult = defenses.thorns > 0 && defenses.toxins > 0
      ? 'Thorns bar the browsers from your lower growth, while toxic leaves make every reachable bite unpalatable.'
      : defenses.thorns > 0
        ? 'Thorns bar the browsers from your tender lower growth until they move on.'
        : 'The first bitter bites warn the browsers away from your toxic foliage.';
    return {
      title: threat.title,
      body: `<p>${defenseResult}</p><p>No foliage or fruit is lost, and no additional resources are spent.</p><p class="threat-status threat-solved">The danger has passed.</p>`,
      threatStatus: 'solved',
    };
  }

  if (choiceId === 'defend') {
    const hasResourcesNow = state.sunlight >= cost.sunlight && state.water >= cost.water && state.nutrients >= cost.nutrients;
    if (!hasResourcesNow) {
      return {
        title: threat.title,
        body: '<p>Your reserves are no longer sufficient. The threat remains unresolved.</p>',
        threatStatus: 'growing',
        threatKey: threat.key,
      };
    }
    state.sunlight -= cost.sunlight;
    state.water -= cost.water;
    state.nutrients -= cost.nutrients;
    const body = threat.defend();
    return {
      title: threat.title,
      body: `<p>${body}</p><p class="threat-status threat-solved">The danger has passed.</p><p><em>Spent: ${costText}</em></p>`,
      threatStatus: 'solved',
    };
  }

  return {
    title: threat.title,
    body: '<p>You conserve your reserves. The threat remains unresolved.</p>',
    threatStatus: 'growing',
    threatKey: threat.key,
  };
}

export function resolveUnanswerableChemicalThreat(state, decision, deps = {}) {
  if (decision?.kind !== 'chemical-defense') throw new Error('An automatic chemical outcome requires a chemical-defense decision');
  const hasResponse = decision.options.some(option => option.id === 'defend' || option.id === 'use-permanent-defenses');
  if (hasResponse) throw new Error('Automatic chemical outcomes are only valid when the player has no response');
  const { threat } = decision.meta;
  const before = {
    health: state.health || 0,
    leafClusters: state.leafClusters || 0,
    rootZones: state.rootZones || 0,
    developing: state.developing || 0,
  };
  const consequence = threat.ignore();
  if (consequence.damage) (deps.recordDamage || ((amount, cause) => { if (amount > 0) state.lastDamageCause = cause || 'decline'; }))(consequence.damage.amount, consequence.damage.cause);
  const effects = [
    before.health > state.health ? `−${before.health - state.health} health` : null,
    before.leafClusters > state.leafClusters ? `−${before.leafClusters - state.leafClusters} leaf cluster${before.leafClusters - state.leafClusters === 1 ? '' : 's'}` : null,
    before.rootZones > state.rootZones ? `−${before.rootZones - state.rootZones} root zone${before.rootZones - state.rootZones === 1 ? '' : 's'}` : null,
    before.developing > state.developing ? `−${before.developing - state.developing} fruit` : null,
  ].filter(Boolean);
  return {
    title: threat.title,
    text: `${threat.warning} ${consequence.body} The danger has passed, though it left damage behind.`,
    effects,
    effect: consequence.damage ? 'damage' : 'good',
    sceneArt: threat.sceneArt,
    kind: 'chemical-threat',
    state: 'resolved',
    responseMode: 'none',
    scenePersistent: false,
    meta: { threatKey: threat.key, automaticOutcome: true },
  };
}

export function buildHostileEncroachmentDecision(state, neighbor, deps = {}) {
  const {
    getRelationshipState,
    compareConflictPower,
    getNeighborStage,
  } = deps;

  const DEFENSE_COST = { sunlight: 3, water: 1, nutrients: 2 };
  const DIPLOMACY_COST = { sunlight: 5, water: 2, nutrients: 3 };
  const relationName = getRelationshipState(neighbor.relation).name.toLowerCase();
  const canAffordDefense = state.sunlight >= DEFENSE_COST.sunlight && state.water >= DEFENSE_COST.water && state.nutrients >= DEFENSE_COST.nutrients;
  const canAffordDiplomacy = state.sunlight >= DIPLOMACY_COST.sunlight && state.water >= DIPLOMACY_COST.water && state.nutrients >= DIPLOMACY_COST.nutrients;
  const powerPreview = compareConflictPower ? compareConflictPower(neighbor) : null;
  const canCrowdCanopy = getNeighborStage ? canNeighborShadePlayer(state, neighbor, getNeighborStage) : Boolean(neighbor.shadingPlayer);

  return createDecision({
    kind: 'hostile-encroachment',
    title: 'Hostile Encroachment',
    body: `<p><em>The ${relationName} ${neighbor.species} presses into your space, ${canCrowdCanopy ? 'crowding your light and ' : ''}entangling your root zone.</em></p><p><strong>Your resources:</strong> ☀️${state.sunlight} 💧${state.water} 🌱${state.nutrients}</p>`,
    options: [
      {
        id: 'chemical-battle',
        label: canAffordDefense ? `Chemical battle (☀️${DEFENSE_COST.sunlight} 💧${DEFENSE_COST.water} 🌱${DEFENSE_COST.nutrients})` : `Chemical battle (☀️${DEFENSE_COST.sunlight} 💧${DEFENSE_COST.water} 🌱${DEFENSE_COST.nutrients}) — too costly right now`,
        affordable: canAffordDefense,
        preview: powerPreview ? `Your strength: ${powerPreview.yourPower}. Their strength: ${powerPreview.theirPower}.` : null,
      },
      {
        id: 'diplomacy',
        label: canAffordDiplomacy ? `Attempt diplomacy (☀️${DIPLOMACY_COST.sunlight} 💧${DIPLOMACY_COST.water} 🌱${DIPLOMACY_COST.nutrients})` : `Attempt diplomacy (☀️${DIPLOMACY_COST.sunlight} 💧${DIPLOMACY_COST.water} 🌱${DIPLOMACY_COST.nutrients}) — too costly right now`,
        affordable: canAffordDiplomacy,
      },
      {
        id: 'endure',
        label: 'Endure and conserve strength',
        affordable: true,
      },
    ],
    meta: { neighbor, relationName, canCrowdCanopy, defenseCost: DEFENSE_COST, diplomacyCost: DIPLOMACY_COST },
  });
}

export function resolveHostileEncroachmentChoice(state, neighbor, choiceId, deps = {}) {
  const {
    getRelationshipState,
    compareConflictPower,
    applyRelationshipDelta = (_neighbor, _delta) => {},
    getNeighborStage = () => ({ rank: 0 }),
    random = Math.random,
  } = deps;

  const DEFENSE_COST = { sunlight: 3, water: 1, nutrients: 2 };
  const DIPLOMACY_COST = { sunlight: 5, water: 2, nutrients: 3 };
  const yieldGround = () => {
    const canCrowdCanopy = canNeighborShadePlayer(state, neighbor, getNeighborStage);
    neighbor.shadingPlayer = canCrowdCanopy;
    neighbor.playerShading = false;
    if (canCrowdCanopy) {
      const lost = Math.min(state.sunlight, 2);
      state.sunlight -= lost;
      return { resource: 'sunlight', lost, description: 'crowds your leaves and takes the light above you' };
    }
    const lost = Math.min(state.nutrients, 2);
    state.nutrients -= lost;
    return { resource: 'nutrients', lost, description: 'cannot overtop you, but its roots seize part of the contested soil' };
  };

  if (choiceId === 'chemical-battle') {
    const hasResources = state.sunlight >= DEFENSE_COST.sunlight && state.water >= DEFENSE_COST.water && state.nutrients >= DEFENSE_COST.nutrients;
    if (!hasResources) {
      const loss = yieldGround();
      neighbor.relation = Math.max(-100, neighbor.relation - 4);
      return {
        title: 'Space Lost',
        body: `<p>You lack the resources to defend yourself. The ${neighbor.species} ${loss.description}.</p><p>You lose <strong>${loss.lost} ${loss.resource}</strong>.</p>`,
        oldState: getRelationshipState(neighbor.relation + 4).name,
        newState: getRelationshipState(neighbor.relation).name,
      };
    }

    state.sunlight -= DEFENSE_COST.sunlight;
    state.water -= DEFENSE_COST.water;
    state.nutrients -= DEFENSE_COST.nutrients;
    const oldState = getRelationshipState(neighbor.relation).name;
    const { yourPower, theirPower } = compareConflictPower(neighbor);
    const swing = yourPower - theirPower + Math.floor(random() * 5) - 2;
    let body = '';
    if (swing >= 2) {
      neighbor.shadingPlayer = false;
      const stolenSun = Math.max(1, Math.min(3, Math.floor(random() * 3) + 1));
      const stolenWater = Math.max(0, Math.min(2, Math.floor(random() * 2)));
      const stolenNutrients = Math.max(1, Math.min(3, Math.floor(random() * 3) + 1));
      state.sunlight += stolenSun; state.water += stolenWater; state.nutrients += stolenNutrients;
      neighbor.stageScore = Math.max(0, neighbor.stageScore - 40);
      neighbor.relation = Math.max(-100, neighbor.relation - 6);
      body = `Your chemistry turns the contested ground against the ${neighbor.species}. You siphon <strong>${stolenSun} sunlight</strong>, <strong>${stolenWater} water</strong>, and <strong>${stolenNutrients} nutrients</strong>.`;
    } else if (swing <= -2) {
      const lostSun = Math.min(state.sunlight, Math.max(1, Math.floor(random() * 3) + 1));
      const lostWater = Math.min(state.water, Math.max(0, Math.floor(random() * 2)));
      const lostNutrients = Math.min(state.nutrients, Math.max(1, Math.floor(random() * 3) + 1));
      state.sunlight -= lostSun; state.water -= lostWater; state.nutrients -= lostNutrients;
      neighbor.stageScore += 40;
      neighbor.relation = Math.max(-100, neighbor.relation - 8);
      neighbor.shadingPlayer = getNeighborStage ? canNeighborShadePlayer(state, neighbor, getNeighborStage) : true;
      neighbor.playerShading = false;
      body = `The ${neighbor.species} overpowers you in the soil-war, stripping away <strong>${lostSun} sunlight</strong>, <strong>${lostWater} water</strong>, and <strong>${lostNutrients} nutrients</strong>.`;
    } else {
      neighbor.shadingPlayer = false;
      neighbor.relation = Math.max(-100, neighbor.relation - 2);
      body = `The struggle poisons the ground between you, but neither of you yields. You repel the ${neighbor.species}, for now.`;
    }
    return {
      title: 'Chemical Battle',
      body: `<p>${body}</p><p><em>Spent: ☀️${DEFENSE_COST.sunlight} 💧${DEFENSE_COST.water} 🌱${DEFENSE_COST.nutrients}</em></p><p><strong>Your resources now:</strong> ☀️ ${state.sunlight} · 💧 ${state.water} · 🌱 ${state.nutrients}</p>`,
      oldState,
      newState: getRelationshipState(neighbor.relation).name,
    };
  }

  if (choiceId === 'diplomacy') {
    const hasResources = state.sunlight >= DIPLOMACY_COST.sunlight && state.water >= DIPLOMACY_COST.water && state.nutrients >= DIPLOMACY_COST.nutrients;
    if (!hasResources) {
      const loss = yieldGround();
      neighbor.relation = Math.max(-100, neighbor.relation - 4);
      return {
        title: 'Space Lost',
        body: `<p>You lack the resources for diplomacy. The ${neighbor.species} ${loss.description}.</p><p>You lose <strong>${loss.lost} ${loss.resource}</strong>.</p>`,
        oldState: getRelationshipState(neighbor.relation + 4).name,
        newState: getRelationshipState(neighbor.relation).name,
      };
    }

    state.sunlight -= DIPLOMACY_COST.sunlight;
    state.water -= DIPLOMACY_COST.water;
    state.nutrients -= DIPLOMACY_COST.nutrients;
    const oldState = getRelationshipState(neighbor.relation).name;
    const rootBonus = Math.min(0.25, Math.max(0, state.rootZones - 3) * 0.05);
    const roll = random();
    let body = '';
    let title = 'Diplomacy Attempt';
    if (roll < 0.35 + rootBonus) {
      applyRelationshipDelta(neighbor, Math.max(25, -neighbor.relation));
      neighbor.shadingPlayer = false;
      neighbor.playerShading = false;
      neighbor.stageScore = Math.max(0, neighbor.stageScore - 20);
      body = `You extend your roots with gifts of nutrients and a tentative truce. The ${neighbor.species} hesitates, then accepts. The hostility between you softens into wary neutrality.`;
      title = 'Diplomacy Succeeded';
    } else if (roll < 0.65 + rootBonus) {
      applyRelationshipDelta(neighbor, 8);
      body = `Your overture is met with suspicion. The ${neighbor.species} does not attack, but keeps its distance. The soil between you remains tense.`;
    } else {
      applyRelationshipDelta(neighbor, -5);
      neighbor.stageScore += 20;
      body = `The ${neighbor.species} interprets your gifts as weakness and presses harder. Your diplomacy failed, and the rivalry deepens.`;
    }
    return {
      title,
      body: `<p>${body}</p><p><em>Spent: ☀️${DIPLOMACY_COST.sunlight} 💧${DIPLOMACY_COST.water} 🌱${DIPLOMACY_COST.nutrients}</em></p><p><strong>Your resources now:</strong> ☀️ ${state.sunlight} · 💧 ${state.water} · 🌱 ${state.nutrients}</p>`,
      oldState,
      newState: getRelationshipState(neighbor.relation).name,
    };
  }

  const loss = yieldGround();
  const oldState = getRelationshipState(neighbor.relation).name;
  neighbor.relation = Math.max(-100, neighbor.relation - 4);
  return {
    title: 'Space Lost',
    body: `<p>You conserve your strength and yield a little ground. The ${neighbor.species} ${loss.description}.</p><p>You lose <strong>${loss.lost} ${loss.resource}</strong>.</p>`,
    oldState,
    newState: getRelationshipState(neighbor.relation).name,
  };
}

export function describeDecisionPrompt(decision) {
  if (!decision) return null;
  if (decision.kind === 'hostile-encroachment') {
    const neighbor = decision.meta?.neighbor;
    const relationName = decision.meta?.relationName;
    if (!neighbor || !relationName) return null;
    return {
      text: decision.meta?.canCrowdCanopy
        ? `The ${relationName} ${neighbor.species} crowds your light and tangles the soil around your roots.`
        : `The ${relationName} ${neighbor.species} cannot overtop you, but its roots press aggressively into your soil.`,
      effect: 'warning',
    };
  }
  if (decision.kind === 'chemical-defense') {
    const threat = decision.meta?.threat;
    const permanentDefense = decision.meta?.permanentBrowserDefense;
    const hasResponse = decision.options.some(option => option.id === 'defend' || option.id === 'use-permanent-defenses');
    const deficits = decision.meta?.deficits || {};
    const deficitParts = [
      deficits.sunlight ? `☀️${deficits.sunlight}` : null,
      deficits.water ? `💧${deficits.water}` : null,
      deficits.nutrients ? `🌱${deficits.nutrients}` : null,
    ].filter(Boolean);
    if (permanentDefense?.total > 0) {
      const defenses = [permanentDefense.thorns > 0 ? 'thorns' : null, permanentDefense.toxins > 0 ? 'toxic leaves' : null].filter(Boolean).join(' and ');
      return {
        title: decision.title,
        text: threat?.warning || 'Browsers approach your foliage.',
        status: `Your established ${defenses} stand ready.`,
        effect: 'good',
        sceneArt: threat?.sceneArt,
        compactThreat: true,
      };
    }
    return {
      title: decision.title,
      text: threat?.warning || 'A chemical threat rises around you.',
      status: hasResponse ? 'A response is available.' : `Defense requires ${deficitParts.join(' ')} more.`,
      effect: 'warning',
      sceneArt: threat?.sceneArt,
      compactThreat: true,
    };
  }
  return null;
}

export function resolveSharedDecision(state, decision, choiceId, deps = {}) {
  if (!decision) throw new Error('Decision is required');

  if (decision.kind === 'chemical-defense') {
    return resolveChemicalDefenseChoice(state, decision, choiceId, {
      recordDamage: deps.recordDamage,
    });
  }

  if (decision.kind === 'hostile-encroachment') {
    const neighbor = decision.meta?.neighbor;
    if (!neighbor) throw new Error('Hostile encroachment decision missing neighbor');
    return resolveHostileEncroachmentChoice(state, neighbor, choiceId, {
      getRelationshipState: deps.getRelationshipState,
      compareConflictPower: deps.compareConflictPower,
      applyRelationshipDelta: deps.applyRelationshipDelta,
      getNeighborStage: deps.getNeighborStage,
      random: deps.random,
    });
  }

  throw new Error(`Unsupported shared decision kind: ${decision.kind}`);
}

export const WINTER_PRECIPITATION = [
  { text: 'Soft snow settles around your roots, holding a little moisture for the thaw. (+1 water)', water: 1, effect: 'snow' },
  { text: 'Icicles form along your branches, then melt into the soil during a pale afternoon. (+1 water)', water: 1, effect: 'snow' },
  { text: 'A brief winter rain darkens the frozen soil. (+2 water)', water: 2, effect: 'rain' },
];

export function applyHeavySnow(state, events, stageByName, random = Math.random) {
  const isVulnerable = state.branches > 1 && state.lifeStage.rank >= stageByName['Sapling'].rank;
  if (!isVulnerable || random() >= 0.04) return false;
  state.branches -= 1;
  events.push({ text: 'Heavy snow builds until one burdened branch gives way. (-1 branch)', effect: 'damage' });
  return true;
}

export function getLivingNeighborsByDisposition(state, getRelationshipState) {
  const living = state.neighbors.filter(neighbor => !neighbor.dead);
  return {
    allied: living.filter(neighbor => getRelationshipState(neighbor.relation).name === 'Ally'),
    contested: living.filter(neighbor => ['Rival', 'Hostile'].includes(getRelationshipState(neighbor.relation).name)),
  };
}

export function maybeEscalateCanopyHostility(state, deps = {}) {
  const {
    getRelationshipState,
    getNeighborStage = () => ({ rank: 0 }),
    seedlingRank = 2,
    random = Math.random,
    chance = 0.05,
  } = deps;
  if ((state.lifeStage?.rank || 0) < seedlingRank || random() >= chance) return null;
  const candidates = (state.neighbors || []).filter(neighbor => {
    if (neighbor.dead || (neighbor.slot !== 1 && neighbor.slot !== 3)) return false;
    const relationship = getRelationshipState(neighbor.relation).name;
    return relationship === 'Neutral' || relationship === 'Rival';
  });
  if (!candidates.length) return null;

  const neighbor = candidates[Math.floor(random() * candidates.length)];
  const oldState = getRelationshipState(neighbor.relation).name;
  neighbor.relation = Math.min(neighbor.relation, -60);
  neighbor.ally = false;
  neighbor.playerShading = false;
  const canCrowd = canNeighborShadePlayer(state, neighbor, getNeighborStage);
  neighbor.shadingPlayer = canCrowd;
  return {
    neighbor,
    oldState,
    newState: getRelationshipState(neighbor.relation).name,
    canCrowd,
    event: {
      text: canCrowd
        ? `The ${neighbor.species} turns hostile and bends its taller crown over you, stealing light. Grow Taller to escape its shade, or use diplomacy to soften the hostility.`
        : `The ${neighbor.species} turns hostile and leans toward you, but it is not tall enough to cast shade yet. Keep growing taller, or use diplomacy before it overtops you.`,
      effect: 'warning',
    },
  };
}

export function rollMinorEvents(state, deps) {
  const {
    currentSeasonName,
    getPollinatorChance,
    species,
    recordDamage,
    STAGE_BY_NAME,
    getRelationshipState,
    advanceAllyCrises,
    advanceOffspringCrises,
    checkAllyBetrayal,
    queueHostileTreeThreat,
    queueChemicalDefenseThreat,
    computeCurrentLifeStage,
    getNeighborStage,
    random = Math.random,
  } = deps;
  const events = [];
  if (state.flowers > 0) {
    const basePollinatorChance = currentSeasonName === 'Spring' ? 0.55 : currentSeasonName === 'Summer' ? 0.4 : 0.1;
    const pollinatorChance = getPollinatorChance(basePollinatorChance);
    if (Math.random() < pollinatorChance) {
      const pollinated = Math.min(state.flowers, randomInt(2) + 1);
      state.pollinated += pollinated;
      state.flowers -= pollinated;
      const visitor = randomChoice(species[state.selectedSpecies].pollinators);
      const visitorText = visitor.charAt(0).toUpperCase() + visitor.slice(1);
      const citrusBonusText = state.selectedSpecies === 'Citrus' ? ' Its fragrant blossoms drew them in.' : '';
      const blossomVerb = pollinated === 1 ? 'was' : 'were';
      events.push({ text: `${visitorText} visited! ${pollinated} flower${pollinated !== 1 ? 's' : ''} ${blossomVerb} successfully pollinated. (+${pollinated} flower${pollinated !== 1 ? 's' : ''} pollinated)${citrusBonusText}`, effect: 'pollinated', sceneArt: getPollinatorSceneArt(visitor) });
    }
  }
  processSeasonalReproduction(state, events, () => currentSeasonName);
  if (Math.random() < 0.25) { state.nutrients += 1; events.push({ text: 'Forest animals left nitrogen-rich gifts near your trunk. (+1 nutrient)', effect: 'nutrients' }); }
  if (Math.random() < 0.25) {
    if (currentSeasonName === 'Winter') {
      const weather = randomChoice(WINTER_PRECIPITATION);
      state.water += weather.water;
      state.eventModifiers.rainChain = 0;
      events.push({ text: weather.text, effect: weather.effect });
    } else {
      state.water += 2;
      state.eventModifiers.rainChain += 1;
      if (state.eventModifiers.rainChain >= 3) {
        state.health -= 1;
        recordDamage(1, 'blight');
        events.push({
          title: 'Rain and Root Rot',
          text: 'A passing shower refreshes the soil, but repeated saturation causes mild root rot.',
          effects: ['Water +2', 'Health −1'],
          effect: 'damage',
          sceneArt: 'event-rain',
        });
      } else {
        events.push({ text: 'A passing rain shower refreshed the soil. (+2 water)', effect: 'rain' });
      }
    }
  } else state.eventModifiers.rainChain = 0;
  if (currentSeasonName === 'Winter') applyHeavySnow(state, events, STAGE_BY_NAME);
  if (Math.random() < 0.15 && state.branches > 1 && state.lifeStage.rank >= STAGE_BY_NAME['Sapling'].rank) { state.branches -= 1; events.push({ text: 'A sharp wind snapped a tender branch. (-1 branch)', effect: 'damage' }); }
  const escalation = maybeEscalateCanopyHostility(state, {
    getRelationshipState,
    getNeighborStage,
    seedlingRank: STAGE_BY_NAME['Seedling'].rank,
    random,
  });
  if (escalation) events.push(escalation.event);
  const { allied: alliedNeighbors, contested: contestedNeighbors } = getLivingNeighborsByDisposition(state, getRelationshipState);
  if (alliedNeighbors.length > 0) { advanceAllyCrises(events); checkAllyBetrayal(events); }
  if (state.offspringTrees > 0) advanceOffspringCrises(events);
  const adjacentContested = contestedNeighbors.filter(neighbor =>
    (neighbor.slot === 1 || neighbor.slot === 3)
    && neighbor !== escalation?.neighbor
  );
  if (adjacentContested.length > 0 && random() < 0.25) queueHostileTreeThreat(adjacentContested[Math.floor(random() * adjacentContested.length)], events);
  if (state.lifeStage.rank >= STAGE_BY_NAME['Seedling'].rank && Math.random() < 0.18) queueChemicalDefenseThreat(events);
  if (state.lifeStage.rank >= STAGE_BY_NAME['Sapling'].rank && Math.random() < 0.12) {
    const buriedSeed = state.seeds > 0 && Math.random() < 0.5;
    if (buriedSeed) state.seeds += 1;
    events.push({
      text: buriedSeed
        ? 'Squirrels carry seed through your canopy and bury one in lucky ground.'
        : 'Squirrels dart through your canopy, searching for seed to carry and bury.',
      effects: buriedSeed ? ['Seed +1'] : [],
      effect: 'helper',
      sceneArt: 'fruit-squirrel',
    });
  }
  if (state.lifeStage.rank >= STAGE_BY_NAME['Sapling'].rank && Math.random() < 0.1) {
    if (state.defense + state.trunk >= 3) {
      state.nutrients += 1;
      events.push({ title: 'Woodpecker', text: 'A woodpecker probes for insects. Your established defenses withstand the pecking, which dislodges pests before they spread.', effects: ['Nutrients +1'], effect: 'good', sceneArt: 'woodpecker' });
    } else {
      state.health = Math.max(0, state.health - 1);
      recordDamage(1, 'insects');
      events.push({ title: 'Woodpecker', text: 'A woodpecker probes weakened bark for insects, opening small wounds as it pecks.', effects: ['−1 health'], effect: 'damage', sceneArt: 'woodpecker' });
    }
  }
  if (state.lifeStage.rank >= STAGE_BY_NAME['Young Tree'].rank && Math.random() < 0.08) {
    if (state.trunk >= 3) {
      state.water += 2;
      events.push({ title: 'Beaver Activity', text: 'Beavers reshape the nearby watercourse. Your trunk escapes their teeth, and the altered watershed leaves wetter soil.', effects: ['+2 water'], effect: 'good', sceneArt: 'beaver' });
    } else {
      state.health = Math.max(0, state.health - 2);
      recordDamage(2, 'storm');
      events.push({ title: 'Beaver Activity', text: 'Beavers reshape the nearby watercourse. Gnawing pressure and altered flow leave you stressed.', effects: ['−2 health'], effect: 'damage', sceneArt: 'beaver' });
    }
  }
  return events;
}
