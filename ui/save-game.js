export const SAVE_KEY = 'trees.autosave.v1';
export const SAVE_VERSION = 1;

function resolveStorage(storage) {
  return storage ?? globalThis.localStorage;
}

function safeRemove(storage) {
  try { resolveStorage(storage)?.removeItem(SAVE_KEY); } catch {}
}

export function clearAutosave(storage) {
  safeRemove(storage);
}

export function saveAutosave(state, storage, now = Date.now) {
  if (!state?.started || state.gameOver || !state.selectedSpecies) {
    if (state?.gameOver) safeRemove(storage);
    return false;
  }
  try {
    resolveStorage(storage).setItem(SAVE_KEY, JSON.stringify({
      version: SAVE_VERSION,
      savedAt: now(),
      state,
    }));
    return true;
  } catch {
    return false;
  }
}

export function loadAutosave({
  storage,
  createInitialState,
  stageByName,
  speciesNames,
} = {}) {
  let parsed;
  try {
    const raw = resolveStorage(storage)?.getItem(SAVE_KEY);
    if (!raw) return null;
    parsed = JSON.parse(raw);
  } catch {
    safeRemove(storage);
    return null;
  }
  const saved = parsed?.state;
  const stageName = saved?.lifeStage?.name;
  if (
    parsed?.version !== SAVE_VERSION
    || !saved?.started
    || saved.gameOver
    || !speciesNames?.includes(saved.selectedSpecies)
    || !stageByName?.[stageName]
  ) {
    safeRemove(storage);
    return null;
  }
  const initial = createInitialState();
  return {
    savedAt: Number(parsed.savedAt) || 0,
    state: {
      ...initial,
      ...saved,
      lifeStage: stageByName[stageName],
      eventModifiers: { ...initial.eventModifiers, ...(saved.eventModifiers || {}) },
      reproductionHistory: { ...initial.reproductionHistory, ...(saved.reproductionHistory || {}) },
      resourceShortageStreaks: { ...initial.resourceShortageStreaks, ...(saved.resourceShortageStreaks || {}) },
      resourceNudgeLevels: { ...initial.resourceNudgeLevels, ...(saved.resourceNudgeLevels || {}) },
    },
  };
}

export function autosaveSummary(save, seasons) {
  if (!save?.state) return '';
  const state = save.state;
  const season = seasons?.[state.seasonIndex]?.name || 'Unknown season';
  return `${state.selectedSpecies} · ${state.lifeStage.name} · Year ${state.year}, ${season}`;
}
