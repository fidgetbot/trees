import { randomChoice } from './random.js';

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
      key: 'Herbivores',
      name: 'Herbivore Surge',
      icon: '🐛',
      desc: 'Hungry mouths descend on your foliage.',
      severity: 'bad',
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
      key: 'Storm',
      name: 'Autumn Storm',
      icon: '⛈️',
      desc: 'Fierce winds test your structure. Flexibility and strength determine survival.',
      severity: 'bad',
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
      key: 'Fire',
      name: 'Wildfire',
      icon: '🔥',
      desc: 'Flames sweep through the understory. Thick bark and fire adaptation are your only hope.',
      severity: 'critical',
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
      key: 'LateFrost',
      name: 'Late Frost',
      icon: '❄️',
      desc: 'An unexpected freeze damages new growth and tender flowers.',
      severity: 'bad',
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
      key: 'FungalBlight',
      name: 'Fungal Blight',
      icon: '🍄',
      desc: 'A pathogen spreads through the fungal network, affecting connected trees.',
      severity: 'bad',
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
      key: 'Beaver',
      name: 'Beaver Activity',
      icon: '🦫',
      desc: 'A beaver colony has moved into the watershed, changing water patterns.',
      severity: 'neutral',
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
      key: 'MycorrhizalBloom',
      name: 'Mycorrhizal Bloom',
      icon: '✨',
      desc: 'The fungal network flourishes, sharing nutrients generously.',
      severity: 'good',
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
      key: 'BirdDispersal',
      name: 'Bird Dispersal',
      icon: '🐦',
      desc: 'Migratory birds arrive, carrying seeds and nutrients from distant forests.',
      severity: 'good',
      apply: (s) => {
        s.nutrients += 2;
        if (s.flowers > 0) {
          const pollinated = Math.min(s.flowers, Math.floor(Math.random() * 2) + 1);
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
  const weights = majorEvents.map(e => {
    if (e.severity === 'critical') return 0.05;
    if (e.severity === 'bad') return 0.25;
    if (e.severity === 'neutral') return 0.2;
    return 0.15;
  });

  const total = weights.reduce((a, b) => a + b, 0);
  const r = Math.random() * total;
  let sum = 0;
  for (let i = 0; i < majorEvents.length; i++) {
    sum += weights[i];
    if (r <= sum) return majorEvents[i];
  }
  return majorEvents[0];
}
