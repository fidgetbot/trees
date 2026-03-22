import { randomChoice, randomInt } from './random.js';

export function createMajorEvents(deps) {
  const {
    getThreatMultiplier,
    recordDamage,
    getDroughtResistance,
    getRelationshipState,
    updateNeighborAliveState,
    updateAlliesCount,
  } = deps;

  return [
    {
      key: 'Drought',
      name: 'Summer Drought',
      icon: '☀️',
      desc: 'The rains fail. Every drop matters now.',
      severity: 'bad',
      apply: (s) => {
        const droughtResist = getDroughtResistance();
        const baseDroughtModifier = Math.max(0.15, 0.55 - (s.trunk * 0.08));
        s.eventModifiers.drought = Math.min(1, baseDroughtModifier + (droughtResist * 0.35));
        const baseThirst = Math.max(1, 2 - s.trunk - Math.floor(s.eventModifiers.shelter || 0));
        const thirst = Math.max(1, Math.floor(baseThirst * getThreatMultiplier() * (1 - droughtResist * 0.5)));
        s.health -= thirst;
        recordDamage(thirst, 'drought');
        const effects = ['Water collection reduced sharply', `Health -${thirst} from thirst and water stress`];
        if (droughtResist >= 0.4) effects.push(`Your species' natural drought tolerance helps you hold on to moisture.`);
        if (s.taprootDepth > 0) effects.push(`Your deep taproot finds lower moisture and softens the drought's bite.`);
        return effects;
      }
    },
    {
      key: 'Herbivores', name: 'Herbivore Surge', icon: '🐛', desc: 'Hungry mouths descend on your foliage.', severity: 'bad',
      apply: (s) => {
        const baseDamage = Math.max(1, 1 - s.defense);
        const damage = Math.floor(baseDamage * getThreatMultiplier());
        const prevLeaves = s.leafClusters;
        s.leafClusters = Math.max(1, s.leafClusters - damage);
        s.health -= 1;
        const lost = prevLeaves - s.leafClusters;
        return [`${lost} leaf cluster${lost !== 1 ? 's' : ''} eaten by insects`, 'Health -1 from stress', s.defense > 0 ? 'Chemical defense reduced damage' : 'No chemical defense!'];
      }
    },
    {
      key: 'Storm', name: 'Autumn Storm', icon: '⛈️', desc: 'Fierce winds test your structure. Flexibility and strength determine survival.', severity: 'bad',
      apply: (s) => {
        const damage = Math.max(0, 3 - s.trunk - Math.floor(s.rootZones / 2) - Math.floor(s.eventModifiers.shelter || 0));
        s.health -= damage;
        recordDamage(damage, 'storm');
        const effects = [];
        if (s.branches > 0) {
          const prevBranches = s.branches;
          s.branches = Math.max(1, s.branches - 1);
          const lost = prevBranches - s.branches;
          effects.push(`${lost} branch snapped by wind`);
        } else if (s.leafClusters > 0) {
          s.leafClusters = Math.max(0, s.leafClusters - 1);
          effects.push('Wind shreds your tender top growth before any true branch can form');
        } else {
          effects.push('The storm bends your young stem and scours the soil around your base');
        }
        if (damage > 0) effects.push(`Health -${damage} (roots and trunk were not strong enough)`);
        else effects.push('Deep roots and a strong trunk resisted damage');
        return effects;
      }
    },
    {
      key: 'Fire', name: 'Wildfire', icon: '🔥', desc: 'Flames sweep through the understory. Thick bark and fire adaptation are your only hope.', severity: 'critical',
      apply: (s) => {
        const barkProtection = Math.min(2, Math.floor(s.trunk / 2));
        const damage = Math.max(1, 2 - barkProtection - Math.floor(s.eventModifiers.shelter || 0));
        s.health -= damage;
        recordDamage(damage, 'storm');
        const effects = [];
        recordDamage(damage, 'fire');
        if (damage === 0) effects.push('Thick bark completely protected you!');
        else effects.push(`Health -${damage} from fire damage`);
        if (barkProtection > 0) effects.push('Thicker trunk reduced some fire damage');
        return effects;
      }
    },
    {
      key: 'LateFrost', name: 'Late Frost', icon: '❄️', desc: 'An unexpected freeze damages new growth and tender flowers.', severity: 'bad',
      apply: (s) => {
        const effects = [];
        if (s.flowers > 0) {
          const lost = Math.min(s.flowers, 1);
          s.flowers -= lost;
          effects.push(`${lost} flower${lost !== 1 ? 's' : ''} killed by frost`);
        }
        if (s.leafClusters > 3) {
          s.leafClusters -= 1;
          effects.push('1 leaf cluster damaged by frost');
        }
        s.health -= 1;
        recordDamage(1, 'frost');
        effects.push('Health -1 from cold stress');
        return effects;
      }
    },
    {
      key: 'FungalBlight', name: 'Fungal Blight', icon: '🍄', desc: 'A pathogen spreads through the fungal network, affecting connected trees.', severity: 'bad',
      apply: (s) => {
        s.eventModifiers.disease = 0.6;
        const effects = ['Resource collection reduced by 40%', 'Fungal allies may be affected'];
        const alliedNeighbors = s.neighbors.filter(n => !n.dead && getRelationshipState(n.relation).name === 'Ally');
        if (alliedNeighbors.length > 0) {
          const target = randomChoice(alliedNeighbors);
          const blightDamage = 4;
          target.health = Math.max(0, target.health - blightDamage);
          effects.push(`The blight spreads to your allied ${target.species}. (${target.health}/${target.maxHealth} health remains)`);
          if (target.health <= 0) {
            effects.push(`The ${target.species} is overwhelmed by blight.`);
            s.pendingInteractions.push((done) => {
              updateNeighborAliveState(target, 'fungal blight');
              done?.();
            });
          }
          updateAlliesCount();
        }
        return effects;
      }
    },
    {
      key: 'Beaver', name: 'Beaver Activity', icon: '🦫', desc: 'A beaver colony has moved into the watershed, changing water patterns.', severity: 'neutral',
      apply: (s) => {
        const effects = [];
        if (Math.random() < 0.5) {
          s.water += 3;
          effects.push('Dam raised water table: +3 water');
        } else {
          s.water = Math.max(0, s.water - 2);
          effects.push('Dam diverted water: -2 water');
        }
        return effects;
      }
    },
    {
      key: 'MycorrhizalBloom', name: 'Mycorrhizal Bloom', icon: '✨', desc: 'The fungal network flourishes, sharing nutrients generously.', severity: 'good',
      apply: (s) => {
        s.nutrients += 3;
        if (s.allies > 0) {
          s.nutrients += s.allies;
          return [`+${3 + s.allies} nutrients from fungal bloom`, 'Allies boosted the bonus!'];
        }
        return ['+3 nutrients from fungal bloom'];
      }
    },
    {
      key: 'BirdDispersal', name: 'Bird Dispersal', icon: '🐦', desc: 'Migratory birds arrive, carrying seeds and nutrients from distant forests.', severity: 'good',
      apply: (s) => {
        s.nutrients += 2;
        if (s.flowers > 0) {
          const pollinated = Math.min(s.flowers, randomInt(2) + 1);
          s.pollinated += pollinated;
          s.flowers -= pollinated;
          return ['+2 nutrients from bird droppings', `${pollinated} flower${pollinated !== 1 ? 's' : ''} pollinated by visiting birds`];
        }
        return ['+2 nutrients from bird droppings'];
      }
    },
  ];
}

export function rollMajorEvent(majorEvents) {
  const weights = majorEvents.map(e => e.severity === 'critical' ? 0.05 : e.severity === 'bad' ? 0.25 : e.severity === 'neutral' ? 0.2 : 0.15);
  const total = weights.reduce((a, b) => a + b, 0);
  const r = Math.random() * total;
  let sum = 0;
  for (let i = 0; i < majorEvents.length; i++) {
    sum += weights[i];
    if (r <= sum) return majorEvents[i];
  }
  return majorEvents[0];
}

export function resolveFruitThreats(state, events) { /* unchanged below */
  if (!state.pendingFruitThreat) return;
  const threat = state.pendingFruitThreat;
  const defensePower = state.defense + state.fruitDefense;
  let losses = 0;
  let saved = 0;
  for (let i = 0; i < state.developing; i++) {
    let lossChance = threat.baseLoss;
    if (threat.type === 'human') lossChance -= 0.12 * defensePower;
    if (threat.type === 'bird') lossChance -= 0.08 * defensePower;
    if (threat.type === 'chewer') lossChance -= 0.1 * defensePower;
    lossChance = Math.max(0.05, Math.min(0.95, lossChance));
    if (Math.random() < lossChance) losses += 1; else saved += 1;
  }
  state.developing = Math.max(0, state.developing - losses);
  events.push({ text: losses > 0 ? threat.outcome(losses, saved, defensePower > 0) : threat.safeText, effect: losses > 0 ? 'fruit-loss' : 'fruit-safe' });
  state.pendingFruitThreat = null;
  state.fruitDefense = Math.max(0, state.fruitDefense - 1);
}

export function processSeasonalReproduction(state, events, getCurrentSeasonName) { /* unchanged */
  const season = getCurrentSeasonName();
  if (season === 'Summer' && state.pollinated > 0) {
    const ripened = state.pollinated;
    state.developing += ripened;
    state.pollinated = 0;
    if (ripened > 0) state.hasProducedFruit = true;
    events.push({ text: `${ripened} pollinated flower${ripened !== 1 ? 's' : ''} swelled into fruit in the summer sun. (+${ripened} fruit)`, effect: 'growth' });
  }
  if (season === 'Summer' && state.developing > 0 && !state.pendingFruitThreat && Math.random() < 0.45) {
    const threats = [{ type:'human', warning:'Lots of human activity stirs beneath your branches. They are eyeing your sweet fruits.', baseLoss:0.45, outcome:(losses,saved,defended)=> defended ? `Your bitter chemistry saved some fruit, but humans still took ${losses}. ${saved} remained.` : `Humans harvested ${losses} ripe fruit${losses !== 1 ? 's' : ''} from your branches.`, safeText:'Your fruits ripened untouched despite the curious humans.' }, { type:'bird', warning:'Bright birds gather near your canopy, watching the ripening fruit.', baseLoss:0.35, outcome:(losses,saved,defended)=> defended ? `Your defenses discouraged the birds from many fruits. ${losses} were lost, ${saved} survived.` : `Birds pecked through ${losses} fruit${losses !== 1 ? 's' : ''} before autumn.`, safeText:'Most birds lost interest before doing any serious damage.' }, { type:'chewer', warning:'Gnawing animals are scouting your branches for easy meals.', baseLoss:0.4, outcome:(losses,saved,defended)=> defended ? `Your bitter compounds protected part of the crop. ${losses} fruit lost, ${saved} saved.` : `${losses} fruit${losses !== 1 ? 's' : ''} were chewed apart before the seeds matured.`, safeText:'The animals passed by without ruining your fruits.' }];
    state.pendingFruitThreat = randomChoice(threats);
    events.push({ text: `${state.pendingFruitThreat.warning} You could invest in Chemical Defense before the danger peaks.`, effect: 'warning' });
  }
  if (season === 'Summer' && state.pendingFruitThreat) resolveFruitThreats(state, events);
  if (season === 'Autumn' && state.developing > 0) {
    const matured = state.developing;
    state.seeds += matured;
    state.developing = 0;
    events.push({ text: `${matured} surviving fruit${matured !== 1 ? 's' : ''} hardened into ${matured} seed${matured !== 1 ? 's' : ''}. (+${matured} seed${matured !== 1 ? 's' : ''})`, effect: 'growth' });
  }
}

import { createDecision } from './decisions.js';

export function resolveSeedFate(seedCount) { const results=[]; let sprouted=0; for (let i=0;i<seedCount;i++){ const r=Math.random(); if (r<0.22) results.push('A seed was eaten outright before it could travel.'); else if (r<0.42) results.push('A seed landed in deep shade and failed to establish.'); else if (r<0.62) results.push('A bird carried one of your seeds away, but dropped it on poor ground.'); else if (r<0.82) { sprouted += 1; results.push('A seed reached promising soil and sprouted into offspring.'); } else { sprouted += 1; results.push('An animal carried a seed to open ground, where it sprouted successfully.'); } } return { sprouted, results }; }

export function resolvePendingStartOfTurnEffects(state) {
  const resolved = [];

  if (state.pendingChemicalThreat) {
    const delayed = state.pendingChemicalThreat;
    state.pendingChemicalThreat = null;
    resolved.push({
      key: 'pendingChemicalThreat',
      title: delayed.title,
      warning: delayed.warning,
      body: delayed.ignore(),
    });
  }

  return resolved;
}

export function buildChemicalDefenseDecision(state, deps = {}) {
  const { computeCurrentLifeStage } = deps;
  const DEFENSE_COST = { sunlight: 3, water: 1, nutrients: 2 };
  const canAffordDefense = state.sunlight >= DEFENSE_COST.sunlight && state.water >= DEFENSE_COST.water && state.nutrients >= DEFENSE_COST.nutrients;

  const currentStage = computeCurrentLifeStage().name;
  let threats;

  if (currentStage === 'Seedling') {
    threats = [
      {
        title: 'Aphid Cluster',
        warning: 'Tiny aphids gather on your tender stem, piercing and sucking at your sap.',
        defend: () => { state.defense += 1; return 'You release sticky compounds that trap the aphids. They fall away, unable to feed.'; },
        ignore: () => { state.leafClusters = Math.max(0, state.leafClusters - 1); state.health = Math.max(0, state.health - 1); return { body: 'The aphids feast unchecked, draining your strength. You lose 1 leaf cluster and 1 health.', damage: { amount: 1, cause: 'insects' } }; }
      },
      {
        title: 'Surface Crawlers',
        warning: 'Small insects swarm the soil surface around your base, nibbling at your tender roots.',
        defend: () => { state.defense += 1; return 'You release defensive compounds into the soil. The crawlers retreat from your roots.'; },
        ignore: () => { state.rootZones = Math.max(0, state.rootZones - 1); state.health = Math.max(0, state.health - 1); return { body: 'The insects damage your shallow roots. You lose 1 root zone and 1 health.', damage: { amount: 1, cause: 'insects' } }; }
      },
      {
        title: 'Damp Rot',
        warning: 'The soil around you stays too wet. Mold creeps up your tender stem.',
        defend: () => { state.eventModifiers.disease = Math.max(state.eventModifiers.disease, 0.9); return 'You mobilize protective chemistry. The mold cannot take hold on your tissues.'; },
        ignore: () => { state.health = Math.max(0, state.health - 2); return { body: 'The damp rot spreads. You lose 2 health as your stem weakens.', damage: { amount: 2, cause: 'blight' } }; }
      }
    ];
  } else {
    threats = [
      {
        title: 'Mite Surge',
        warning: 'Tiny mites mass along your bark and tender leaves, itching and feeding in their thousands.',
        defend: () => { state.defense += 1; return 'You flood your tissues with bitter compounds. The mites retreat before they can do serious harm.'; },
        ignore: () => { state.leafClusters = Math.max(0, state.leafClusters - 1); state.health = Math.max(0, state.health - 1); return { body: 'You do nothing. The mites feast, costing you 1 leaf cluster and 1 health.', damage: { amount: 1, cause: 'insects' } }; }
      },
      {
        title: 'Hungry Browsers',
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
        title: 'Spores on the Damp Air',
        warning: 'Damp air clings too long. Spores settle into tender tissues and wounded places.',
        defend: () => { state.eventModifiers.disease = Math.max(state.eventModifiers.disease, 0.9); return 'You mobilize defensive chemistry before the infection can take hold.'; },
        ignore: () => { state.health = Math.max(0, state.health - 2); return { body: 'Blight takes hold. You lose 2 health to spreading infection.', damage: { amount: 2, cause: 'blight' } }; }
      }
    ];
  }

  const threat = threats[Math.floor(Math.random() * threats.length)];
  const costText = `☀️${DEFENSE_COST.sunlight} 💧${DEFENSE_COST.water} 🌱${DEFENSE_COST.nutrients}`;
  const affordText = canAffordDefense ? 'You can afford this response.' : 'You do not have enough stored resources for this response.';

  return createDecision({
    kind: 'chemical-defense',
    title: threat.title,
    body: `<p><em>${threat.warning}</em></p><p>How do you respond?</p><p><strong>Defense cost:</strong> ${costText}</p><p><strong>Your resources:</strong> ☀️${state.sunlight} 💧${state.water} 🌱${state.nutrients}</p><p><em>${affordText}</em></p>`,
    options: [
      {
        id: 'defend',
        label: canAffordDefense ? `Release defensive compounds (${costText})` : `Release defensive compounds (${costText}) — too costly right now`,
        affordable: canAffordDefense,
      },
      {
        id: 'conserve',
        label: 'Conserve strength',
        affordable: true,
      }
    ],
    meta: { threat, cost: DEFENSE_COST },
  });
}

export function resolveChemicalDefenseChoice(state, decision, choiceId, deps = {}) {
  const { recordDamage = () => {} } = deps;
  const { threat, cost } = decision.meta;
  const costText = `☀️${cost.sunlight} 💧${cost.water} 🌱${cost.nutrients}`;

  if (choiceId === 'defend') {
    const hasResourcesNow = state.sunlight >= cost.sunlight && state.water >= cost.water && state.nutrients >= cost.nutrients;
    if (!hasResourcesNow) {
      state.pendingChemicalThreat = {
        title: threat.title,
        warning: threat.warning,
        ignore: () => {
          const result = threat.ignore();
          if (result.damage) recordDamage(result.damage.amount, result.damage.cause);
          return result.body;
        }
      };
      return {
        title: threat.title,
        body: `<p>You do not have enough reserves to mount a chemical defense. The danger will crest next turn.</p>`,
      };
    }
    state.sunlight -= cost.sunlight;
    state.water -= cost.water;
    state.nutrients -= cost.nutrients;
    const body = threat.defend();
    return {
      title: threat.title,
      body: `<p>${body}</p><p><em>Spent: ${costText}</em></p>`,
    };
  }

  state.pendingChemicalThreat = {
    title: threat.title,
    warning: threat.warning,
    ignore: () => {
      const result = threat.ignore();
      if (result.damage) recordDamage(result.damage.amount, result.damage.cause);
      return result.body;
    }
  };
  return {
    title: threat.title,
    body: `<p>You conserve your reserves. The danger is not gone; it will break over you next turn.</p>`,
  };
}

export function buildHostileEncroachmentDecision(state, neighbor, deps = {}) {
  const {
    getRelationshipState,
    compareConflictPower,
  } = deps;

  const DEFENSE_COST = { sunlight: 3, water: 1, nutrients: 2 };
  const DIPLOMACY_COST = { sunlight: 5, water: 2, nutrients: 3 };
  const relationName = getRelationshipState(neighbor.relation).name.toLowerCase();
  const canAffordDefense = state.sunlight >= DEFENSE_COST.sunlight && state.water >= DEFENSE_COST.water && state.nutrients >= DEFENSE_COST.nutrients;
  const canAffordDiplomacy = state.sunlight >= DIPLOMACY_COST.sunlight && state.water >= DIPLOMACY_COST.water && state.nutrients >= DIPLOMACY_COST.nutrients;
  const powerPreview = compareConflictPower ? compareConflictPower(neighbor) : null;

  return createDecision({
    kind: 'hostile-encroachment',
    title: 'Hostile Encroachment',
    body: `<p><em>The ${relationName} ${neighbor.species} presses into your space, trying to steal your sunlight and entangle your roots.</em></p><p><strong>Your resources:</strong> ☀️${state.sunlight} 💧${state.water} 🌱${state.nutrients}</p>`,
    options: [
      {
        id: 'chemical-battle',
        label: canAffordDefense ? `Chemical battle (☀️${DEFENSE_COST.sunlight} 💧${DEFENSE_COST.water} 🌱${DEFENSE_COST.nutrients})` : `Chemical battle (☀️${DEFENSE_COST.sunlight} 💧${DEFENSE_COST.water} 🌱${DEFENSE_COST.nutrients}) — too costly right now`,
        affordable: canAffordDefense,
        preview: powerPreview,
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
    meta: { neighbor, relationName, defenseCost: DEFENSE_COST, diplomacyCost: DIPLOMACY_COST },
  });
}

export function resolveHostileEncroachmentChoice(state, neighbor, choiceId, deps = {}) {
  const {
    getRelationshipState,
    compareConflictPower,
    applyRelationshipDelta = (_neighbor, _delta) => {},
    random = Math.random,
  } = deps;

  const DEFENSE_COST = { sunlight: 3, water: 1, nutrients: 2 };
  const DIPLOMACY_COST = { sunlight: 5, water: 2, nutrients: 3 };

  if (choiceId === 'chemical-battle') {
    const hasResources = state.sunlight >= DEFENSE_COST.sunlight && state.water >= DEFENSE_COST.water && state.nutrients >= DEFENSE_COST.nutrients;
    if (!hasResources) {
      state.eventModifiers.shade = (state.eventModifiers.shade || 0) + 0.12;
      const lostSun = Math.min(state.sunlight, 2);
      state.sunlight -= lostSun;
      neighbor.relation = Math.max(-100, neighbor.relation - 4);
      return {
        title: 'Space Lost',
        body: `<p>You lack the resources to defend yourself. The ${neighbor.species} steals your light.</p><p>You lose <strong>${lostSun} sunlight</strong>.</p>`,
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
      body = `The ${neighbor.species} overpowers you in the soil-war, stripping away <strong>${lostSun} sunlight</strong>, <strong>${lostWater} water</strong>, and <strong>${lostNutrients} nutrients</strong>.`;
    } else {
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
      state.eventModifiers.shade = (state.eventModifiers.shade || 0) + 0.12;
      const lostSun = Math.min(state.sunlight, 2);
      state.sunlight -= lostSun;
      neighbor.relation = Math.max(-100, neighbor.relation - 4);
      return {
        title: 'Space Lost',
        body: `<p>You lack the resources for diplomacy. The ${neighbor.species} steals your light.</p><p>You lose <strong>${lostSun} sunlight</strong>.</p>`,
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
      applyRelationshipDelta(neighbor, 25);
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

  state.eventModifiers.shade = (state.eventModifiers.shade || 0) + 0.12;
  const lostSun = Math.min(state.sunlight, 2);
  state.sunlight -= lostSun;
  const oldState = getRelationshipState(neighbor.relation).name;
  neighbor.relation = Math.max(-100, neighbor.relation - 4);
  return {
    title: 'Space Lost',
    body: `<p>You conserve your strength and yield a little ground. The ${neighbor.species} takes advantage, crowding your leaves.</p><p>You lose <strong>${lostSun} sunlight</strong>.</p>`,
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
      text: `The ${relationName} ${neighbor.species} crowds your light and tangles the soil around your roots.`,
      effect: 'warning',
    };
  }
  if (decision.kind === 'chemical-defense') {
    return {
      text: decision.meta?.threat?.warning || 'A chemical threat rises around you.',
      effect: 'warning',
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
      random: deps.random,
    });
  }

  throw new Error(`Unsupported shared decision kind: ${decision.kind}`);
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
    checkAllyBetrayal,
    queueHostileTreeThreat,
    queueChemicalDefenseThreat,
    computeCurrentLifeStage,
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
      const citrusBonusText = state.selectedSpecies === 'Citrus' ? ' Its fragrant blossoms drew them in.' : '';
      events.push({ text: `${visitor} visited! ${pollinated} flower${pollinated !== 1 ? 's' : ''} were successfully pollinated. (+${pollinated} flowers pollinated)${citrusBonusText}`, effect: 'pollinated' });
    }
  }
  processSeasonalReproduction(state, events, () => currentSeasonName);
  if (Math.random() < 0.25) { state.nutrients += 1; events.push({ text: 'Forest animals left nitrogen-rich gifts near your trunk. (+1 nutrient)', effect: 'nutrients' }); }
  if (Math.random() < 0.25) { state.water += 2; state.eventModifiers.rainChain += 1; events.push({ text: 'A passing rain shower refreshed the soil. (+2 water)', effect: 'rain' }); if (state.eventModifiers.rainChain >= 3) { state.health -= 1; recordDamage(1, 'blight'); events.push({ text: 'Too much rain caused mild root rot. (-1 health)', effect: 'damage' }); } } else state.eventModifiers.rainChain = 0;
  if (Math.random() < 0.15 && state.branches > 1 && state.lifeStage.rank >= STAGE_BY_NAME['Sapling'].rank) { state.branches -= 1; events.push({ text: 'A sharp wind snapped a tender branch. (-1 branch)', effect: 'damage' }); }
  const alliedNeighbors = state.neighbors.filter(n => getRelationshipState(n.relation).name === 'Ally');
  const hostileNeighbors = state.neighbors.filter(n => getRelationshipState(n.relation).name === 'Hostile');
  const contestedNeighbors = state.neighbors.filter(n => ['Rival', 'Hostile'].includes(getRelationshipState(n.relation).name));
  if (alliedNeighbors.length > 0) { advanceAllyCrises(events); checkAllyBetrayal(events); }
  if (contestedNeighbors.length > 0 && Math.random() < 0.35) queueHostileTreeThreat(randomChoice(contestedNeighbors), events);
  if (state.lifeStage.rank >= STAGE_BY_NAME['Seedling'].rank && Math.random() < 0.18) queueChemicalDefenseThreat(events);
  if (Math.random() < 0.12) {
    const currentStage = computeCurrentLifeStage().name;
    const early = ['A beetle trundles past your seed, unaware of the life within.','Earthworms turn the soil nearby, aerating the ground you will soon reach for.','A gentle rain soaks the earth above you, promising moisture to come.','Ants march in lines across the soil surface, busy with their own purposes.','The soil shifts slightly as a mole tunnels past, deep below.'];
    const mid = ['Two hopeful crows have chosen your branches to make a nest for their young.','A squirrel vanishes along your bark with one of your seeds, perhaps to lose it somewhere generous.','A fox sleeps for an afternoon in the small shade you cast.','Robins tug worms from the damp soil near your roots.','A gentle breeze rustles your new leaves.'];
    const late = ['Two hopeful crows have chosen your branches to make a nest for their young.','A squirrel vanishes along your bark with one of your seeds, perhaps to lose it somewhere generous.','Bees drift lazily through your flowers, dusted gold with pollen.','A fox sleeps for an afternoon in the shade you cast.','Robins tug worms from the damp soil near your roots.'];
    const flavor = (currentStage === 'Seed' || currentStage === 'Sprout' || currentStage === 'Seedling') ? randomChoice(early) : (currentStage === 'Sapling' || currentStage === 'Small Tree') ? randomChoice(mid) : randomChoice(late);
    events.push({ text: flavor, effect: 'flavor' });
  }
  if (state.lifeStage.rank >= STAGE_BY_NAME['Sapling'].rank && Math.random() < 0.12) { events.push({ text: 'Squirrels dart through your canopy. If you already carry seed, some may be buried in lucky ground.', effect: 'helper' }); if (state.seeds > 0 && Math.random() < 0.5) state.seeds += 1; }
  if (state.lifeStage.rank >= STAGE_BY_NAME['Sapling'].rank && Math.random() < 0.1) { events.push({ text: 'A woodpecker drums at your bark, probing for insects in weakened places.', effect: 'warning' }); if (state.defense + state.trunk >= 3) { events.push({ text: 'Your bark holds. The pecking dislodges pests before they can spread. (+1 nutrient)', effect: 'good' }); state.nutrients += 1; } else { state.health = Math.max(0, state.health - 1); recordDamage(1, 'insects'); events.push({ text: 'The pecking opens small wounds in your bark. (-1 health)', effect: 'damage' }); } }
  if (state.lifeStage.rank >= STAGE_BY_NAME['Small Tree'].rank && Math.random() < 0.08) { events.push({ text: 'Beavers work the nearby watercourse, changing the moisture around your roots.', effect: 'warning' }); if (state.trunk >= 3) { state.water += 2; events.push({ text: 'You are large enough to escape their teeth, and the altered watershed leaves you with wetter soil. (+2 water)', effect: 'good' }); } else { state.health = Math.max(0, state.health - 2); recordDamage(2, 'storm'); events.push({ text: 'The altered flow and gnawing pressure leave you stressed. (-2 health)', effect: 'damage' }); } }
  if (state.offspringTrees > 0 && !state.pendingOffspringThreat && Math.random() < 0.18) { state.pendingOffspringThreat = true; events.push({ text: 'Your young offspring is under aphid pressure. Chemical Defense this turn may save it.', effect: 'warning' }); }
  else if (state.pendingOffspringThreat) { state.pendingOffspringThreat = false; if (state.defense > 0 || state.fruitDefense > 0) events.push({ text: 'You shielded your offspring with defensive chemistry. It survives the aphid attack. (+offspring survives)', effect: 'offspring-safe' }); else if (Math.random() < 0.5) { state.offspringTrees = Math.max(0, state.offspringTrees - 1); state.offspringPool = Math.max(0, state.offspringPool - 1); events.push({ text: 'A young offspring succumbed to aphids before it could establish itself. (-1 offspring)', effect: 'offspring-loss' }); } else events.push({ text: 'Your offspring weathered the aphids on its own, but only barely. (+offspring survives)', effect: 'offspring-safe' }); }
  return events;
}
