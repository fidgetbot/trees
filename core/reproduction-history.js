const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const amount = Math.max(0, Math.trunc(Number(entry.amount) || 0));
  if (!amount) return null;
  return {
    amount,
    year: Math.max(1, Math.trunc(Number(entry.year) || 1)),
    seasonIndex: Math.max(0, Math.min(3, Math.trunc(Number(entry.seasonIndex) || 0))),
    turnInSeason: Math.max(1, Math.min(4, Math.trunc(Number(entry.turnInSeason) || 1))),
  };
}

export function ensureReproductionHistory(state) {
  const hadHistory = Boolean(state.reproductionHistory && typeof state.reproductionHistory === 'object');
  const existing = hadHistory
    ? state.reproductionHistory
    : {};
  const visibleFlowers = Math.max(0, Math.trunc(Number(state.flowers) || 0))
    + Math.max(0, Math.trunc(Number(state.pollinated) || 0));
  const visibleFruit = Math.max(0, Math.trunc(Number(state.developing) || 0));
  state.reproductionHistory = {
    flowersGrown: Math.max(
      Math.max(0, Math.trunc(Number(existing.flowersGrown) || 0)),
      hadHistory ? 0 : visibleFlowers,
    ),
    fruitGrown: Math.max(
      Math.max(0, Math.trunc(Number(existing.fruitGrown) || 0)),
      hadHistory ? 0 : visibleFruit,
    ),
    lastFlowering: normalizeEntry(existing.lastFlowering),
    lastFruitSet: normalizeEntry(existing.lastFruitSet),
  };
  return state.reproductionHistory;
}

function recordGrowth(state, totalKey, lastKey, amount) {
  const grown = Math.max(0, Math.trunc(Number(amount) || 0));
  if (!grown) return null;
  const history = ensureReproductionHistory(state);
  history[totalKey] += grown;
  history[lastKey] = {
    amount: grown,
    year: Math.max(1, Math.trunc(Number(state.year) || 1)),
    seasonIndex: Math.max(0, Math.min(3, Math.trunc(Number(state.seasonIndex) || 0))),
    turnInSeason: Math.max(1, Math.min(4, Math.trunc(Number(state.turnInSeason) || 1))),
  };
  return history[lastKey];
}

export const recordFlowerGrowth = (state, amount) => recordGrowth(state, 'flowersGrown', 'lastFlowering', amount);
export const recordFruitGrowth = (state, amount) => recordGrowth(state, 'fruitGrown', 'lastFruitSet', amount);

export function formatReproductionMoment(entry, noun) {
  const normalized = normalizeEntry(entry);
  if (!normalized) return 'Not yet recorded';
  const season = SEASON_NAMES[normalized.seasonIndex];
  const plural = normalized.amount === 1 ? noun : `${noun}s`;
  return `${season}, Year ${normalized.year} · Turn ${normalized.turnInSeason} · +${normalized.amount} ${plural}`;
}
