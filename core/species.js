export const SPECIES = {
  Plum: {
    icon: '🟣',
    description: 'Fast-growing plum tree with abundant blossoms and soft fruit.',
    bonusTitle: 'Fast growth',
    bonusText: '+20% stage progress',
    branches: 1, rootZones: 2, trunk: 1, health: 10,
    growthRate: 1.2, droughtResist: 0.35, pollinators: ['bumblebees', 'mason bees', 'hoverflies'],
  },
  Peach: {
    icon: '🍑',
    description: 'Tender peach tree with rich fruit and moderate resilience.',
    bonusTitle: 'Resilient',
    bonusText: 'Modest extra durability',
    branches: 1, rootZones: 2, trunk: 1, health: 10,
    growthRate: 1.08, droughtResist: 0.36, pollinators: ['honeybees', 'bumblebees', 'butterflies'],
  },
  Apricot: {
    icon: '🟠',
    description: 'Early-blooming apricot tree, productive but frost-sensitive.',
    bonusTitle: 'Early bloomer',
    bonusText: 'Flowering actions cost -1 sunlight',
    branches: 1, rootZones: 2, trunk: 1, health: 10,
    growthRate: 1.15, droughtResist: 0.3, pollinators: ['mason bees', 'honeybees', 'beetles'],
  },
  Pear: {
    icon: '🍐',
    description: 'Steady pear tree with durable wood and dependable fruit.',
    bonusTitle: 'Steady heartwood',
    bonusText: 'Balanced durability with dependable fruit, not dominant survivability',
    branches: 1, rootZones: 2, trunk: 1, health: 10,
    growthRate: 0.98, droughtResist: 0.28, pollinators: ['hoverflies', 'honeybees', 'solitary bees'],
  },
  Citrus: {
    icon: '🍋',
    description: 'Glossy-leaved citrus tree with fragrant blossoms and thirsty roots.',
    bonusTitle: 'Fragrant',
    bonusText: '1.25× pollinator attraction',
    branches: 1, rootZones: 2, trunk: 1, health: 9,
    growthRate: 1.0, droughtResist: 0.18, pollinators: ['honeybees', 'small native bees', 'hoverflies'],
  },
  Cherry: {
    icon: '🍒',
    description: 'Graceful cherry tree with showy flowers and bird-loved fruit.',
    bonusTitle: 'Alluring',
    bonusText: '+25% positive relationship gain',
    branches: 1, rootZones: 2, trunk: 1, health: 10,
    growthRate: 1.15, droughtResist: 0.35, pollinators: ['bumblebees', 'mason bees', 'butterflies'],
  },
};

export function getCurrentSpeciesSpec(state) {
  return SPECIES[state.selectedSpecies] || null;
}

export function getStageProgressIncrement(state) {
  const growthRate = getCurrentSpeciesSpec(state)?.growthRate || 1;
  const baseIncrement = state.year >= 15 ? 1.5 : 1;
  return baseIncrement * growthRate;
}

export function getSpeciesAdjustedCost(state, actionKey, baseCost, currentStage) {
  const multiplier = Math.max(1, currentStage.rank);
  const cost = {
    sunlight: Math.floor((baseCost.sunlight || 0) * multiplier),
    water: Math.floor((baseCost.water || 0) * multiplier),
    nutrients: Math.floor((baseCost.nutrients || 0) * multiplier),
  };

  if (state.selectedSpecies === 'Apricot' && ['flower', 'massFlower', 'mastYear'].includes(actionKey)) {
    cost.sunlight = Math.max(0, cost.sunlight - 1);
  }

  return cost;
}

export function getAdjustedRelationshipDelta(state, delta) {
  return delta > 0 && state.selectedSpecies === 'Cherry'
    ? Math.max(1, Math.ceil(delta * 1.25))
    : delta;
}

export function getPollinatorChance(state, baseChance) {
  const multiplier = state.selectedSpecies === 'Citrus' ? 1.25 : 1;
  return Math.min(0.95, baseChance * multiplier);
}

export function getDroughtResistance(state) {
  return getCurrentSpeciesSpec(state)?.droughtResist || 0;
}
