export function randomInt(maxExclusive, rng = Math.random) {
  return Math.floor(rng() * maxExclusive);
}

export function randomChoice(items, rng = Math.random) {
  if (!items?.length) return undefined;
  return items[randomInt(items.length, rng)];
}

export function createSeededRng(seed = Date.now()) {
  let state = seed >>> 0;
  return function rng() {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
