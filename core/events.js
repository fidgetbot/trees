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

export function resolveSeedFate(seedCount) { const results=[]; let sprouted=0; for (let i=0;i<seedCount;i++){ const r=Math.random(); if (r<0.22) results.push('A seed was eaten outright before it could travel.'); else if (r<0.42) results.push('A seed landed in deep shade and failed to establish.'); else if (r<0.62) results.push('A bird carried one of your seeds away, but dropped it on poor ground.'); else if (r<0.82) { sprouted += 1; results.push('A seed reached promising soil and sprouted into offspring.'); } else { sprouted += 1; results.push('An animal carried a seed to open ground, where it sprouted successfully.'); } } return { sprouted, results }; }

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
  if (state.pendingChemicalThreat) {
    const delayed = state.pendingChemicalThreat;
    state.pendingChemicalThreat = null;
    events.push({ text: delayed.warning, effect: 'warning' });
    events.push({ text: delayed.ignore(), effect: 'damage' });
  }
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
  if (alliedNeighbors.length > 0) { advanceAllyCrises(events); checkAllyBetrayal(events); }
  if (hostileNeighbors.length > 0 && Math.random() < 0.35) queueHostileTreeThreat(randomChoice(hostileNeighbors), events);
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
