const TERMINAL_STATES = new Set(['resolved', 'expired']);

export const INCIDENT_STATES = Object.freeze({
  OPEN: 'open',
  AWAITING_RESPONSE: 'awaiting-response',
  ONGOING: 'ongoing',
  RESOLVED: 'resolved',
  EXPIRED: 'expired',
});

export const RESPONSE_MODES = Object.freeze({
  NONE: 'none',
  IMMEDIATE: 'immediate',
  ACTION_WINDOW: 'action-window',
});

function turnKey(state) {
  return Number.isFinite(state?.turnsElapsed) ? state.turnsElapsed : 0;
}

export function ensureIncidentState(state) {
  state.incidents ||= [];
  state.responseQueue ||= [];
  state.nextIncidentId ||= 1;
  return state;
}

export function migrateLegacyIncidentState(state) {
  ensureIncidentState(state);
  if (state.pendingChemicalThreat) {
    const threat = state.pendingChemicalThreat;
    openIncident(state, {
      kind: 'chemical-threat', title: threat.title || 'Chemical Threat', summary: threat.warning || '',
      artwork: threat.sceneArt, state: INCIDENT_STATES.ONGOING, responseMode: RESPONSE_MODES.ACTION_WINDOW,
      deadlineTurn: (state.turnsElapsed || 0) + 1, scenePersistent: true,
      meta: { threatKey: threat.threatKey || threat.sceneArt || threat.title },
    });
  }
  if (state.pendingFruitThreat) {
    const threat = state.pendingFruitThreat;
    openIncident(state, {
      kind: 'fruit-threat', title: 'Fruit Threat', summary: threat.warning || '', artwork: threat.sceneArt || (threat.type === 'human' ? 'human-surveyor' : 'event-growth'),
      state: INCIDENT_STATES.ONGOING, responseMode: RESPONSE_MODES.ACTION_WINDOW,
      deadlineTurn: (state.turnsElapsed || 0) + 1, scenePersistent: true, meta: { threatType: threat.type },
    });
  }
  if (state.pendingHumanEncounter) {
    const encounter = state.pendingHumanEncounter;
    openIncident(state, {
      kind: 'human-encounter', title: encounter.phase === 'cutting' ? 'The Cutters Return' : 'Humans at Your Trunk',
      summary: encounter.phase === 'cutting' ? 'Humans wait beside your trunk with cutting tools.' : 'Humans measure and mark your trunk.',
      artwork: encounter.phase === 'cutting' ? 'human-logger' : 'human-surveyor', severity: 'warning',
      response: { kind: 'human-encounter' }, meta: { encounter },
    });
  }
  for (const notice of state.pendingCanopyNotices || []) {
    openIncident(state, { kind: 'canopy-notice', title: 'The Canopy Shifts', summary: notice.message || '', artwork: 'event-relationship', meta: { kind: notice.kind, reportPending: true } });
  }
  delete state.pendingChemicalThreat;
  delete state.pendingFruitThreat;
  delete state.pendingHumanEncounter;
  delete state.pendingCanopyNotices;
  delete state.activeSceneArt;
  delete state.pendingInteractions;
  return state;
}

export function getIncident(state, incidentId) {
  ensureIncidentState(state);
  return state.incidents.find(incident => incident.id === incidentId) || null;
}

export function getActiveIncidents(state) {
  ensureIncidentState(state);
  return state.incidents.filter(incident => !TERMINAL_STATES.has(incident.state));
}

export function findActiveIncident(state, kind, predicate = () => true) {
  return getActiveIncidents(state).find(incident => incident.kind === kind && predicate(incident)) || null;
}

export function incidentArtworkFor({ artwork, sceneArt, effect = '', title = '', summary = '', subject = null } = {}) {
  if (artwork) return artwork;
  if (sceneArt) return sceneArt;
  const copy = `${title} ${summary}`.toLowerCase();
  if (subject?.species) {
    const portrait = `tree:${subject.species}:${subject.stageName || 'young-tree'}`;
    if (copy.includes('aphid')) return [portrait, 'aphids'];
    if (copy.includes('mite')) return [portrait, 'mites'];
    if (copy.includes('blight') || copy.includes('fungal')) return [portrait, 'event-fungal-blight'];
    if (copy.includes('rot') || copy.includes('mold')) return [portrait, 'damp-rot'];
    if (copy.includes('dry root') || copy.includes('thirst') || copy.includes('droop')) return [portrait, 'event-drought'];
    if (copy.includes('branch') || copy.includes('storm')) return [portrait, 'event-storm'];
    return portrait;
  }
  if (effect === 'human-warning' || copy.includes('human') || copy.includes('cutter')) return 'human-surveyor';
  if (copy.includes('aphid')) return 'aphids';
  if (copy.includes('mite')) return 'mites';
  if (copy.includes('blight')) return 'event-fungal-blight';
  if (copy.includes('rot') || copy.includes('mold')) return 'damp-rot';
  if (copy.includes('drought') || copy.includes('dry root') || copy.includes('thirst')) return 'event-drought';
  if (copy.includes('snow') || copy.includes('ice') || copy.includes('frost')) return 'event-snow';
  if (copy.includes('rain') || effect === 'rain') return 'event-rain';
  if (copy.includes('wind') || copy.includes('storm') || copy.includes('branch')) return 'event-storm';
  if (copy.includes('fruit') || copy.includes('seed') || effect === 'growth') return 'event-growth';
  if (copy.includes('nutrient') || effect === 'nutrients') return 'event-nutrients';
  if (copy.includes('offspring')) return 'event-offspring';
  if (copy.includes('ally') || copy.includes('rival') || copy.includes('hostile') || copy.includes('canopy')) return 'event-relationship';
  return 'event-ambient';
}

function titleFromEvent(event = {}) {
  if (event.title) return event.title;
  const text = String(event.text || '');
  if (event.sceneArt === 'woodpecker') return 'Woodpecker';
  if (event.sceneArt === 'beaver') return 'Beaver Activity';
  if (event.sceneArt === 'fruit-squirrel') return 'Squirrel Visit';
  if (event.sceneArt === 'fruit-robin') return 'Bird Visit';
  if (event.effect === 'pollinated') return text.split(' visited!')[0] || 'Pollinator Visit';
  if (event.effect === 'rain') return 'Passing Rain';
  if (event.effect === 'snow') return 'Winter Moisture';
  if (event.effect === 'nutrients') return 'Forest Gift';
  if (event.effect === 'growth') return text.includes('seed') ? 'Seeds Mature' : 'Fruit Develops';
  if (event.effect === 'offspring-loss') return 'Offspring Lost';
  if (event.effect === 'human-warning') return 'Humans in the Grove';
  if (event.effect === 'flavor') return 'Grove Observation';
  if (text.includes('root rot')) return 'Root Rot';
  if (text.includes('branch')) return 'Branch Damage';
  if (event.effect === 'warning') return 'Grove Warning';
  return 'Grove Event';
}

function effectChips(event = {}) {
  if (Array.isArray(event.effects)) return event.effects.filter(Boolean);
  const matches = String(event.text || '').match(/\(([^)]+)\)/g) || [];
  const chips = matches.map(value => value.slice(1, -1)).filter(Boolean);
  if (event.status) chips.push(event.status);
  return chips;
}

export function openIncident(state, input = {}) {
  ensureIncidentState(state);
  const responseMode = input.responseMode || (input.response ? RESPONSE_MODES.IMMEDIATE : RESPONSE_MODES.NONE);
  const incidentState = input.state || (responseMode === RESPONSE_MODES.IMMEDIATE
    ? INCIDENT_STATES.AWAITING_RESPONSE
    : responseMode === RESPONSE_MODES.ACTION_WINDOW
      ? INCIDENT_STATES.ONGOING
      : INCIDENT_STATES.RESOLVED);
  const id = input.id || `incident-${state.nextIncidentId++}`;
  const incident = {
    id,
    kind: input.kind || 'observation',
    subject: input.subject || { type: 'player' },
    severity: input.severity || 'neutral',
    priority: input.priority || (input.tier === 'major' ? 'lead' : 'standard'),
    title: input.title || 'Grove Event',
    summary: input.summary || '',
    artwork: incidentArtworkFor(input),
    effects: Array.isArray(input.effects) ? input.effects.filter(Boolean) : [],
    openedTurn: input.openedTurn ?? turnKey(state),
    openedYear: input.openedYear ?? state.year ?? 1,
    openedSeason: input.openedSeason ?? state.seasonIndex ?? 0,
    state: incidentState,
    responseMode,
    deadlineTurn: input.deadlineTurn ?? null,
    decisionKey: input.decisionKey || input.response?.kind || null,
    response: input.response ? structuredClone(input.response) : null,
    outcome: input.outcome || null,
    quiet: input.quiet === true,
    scenePersistent: input.scenePersistent ?? !TERMINAL_STATES.has(incidentState),
    meta: input.meta ? structuredClone(input.meta) : {},
  };
  state.incidents.push(incident);
  if (incident.state === INCIDENT_STATES.AWAITING_RESPONSE && !state.responseQueue.includes(id)) {
    state.responseQueue.push(id);
  }
  while (state.incidents.length > 100) {
    const resolvedIndex = state.incidents.findIndex(candidate => TERMINAL_STATES.has(candidate.state));
    if (resolvedIndex < 0) break;
    state.incidents.splice(resolvedIndex, 1);
  }
  return incident;
}

export function openEventIncident(state, event, overrides = {}) {
  return openIncident(state, {
    kind: overrides.kind || event.kind || event.effect || 'observation',
    title: overrides.title || titleFromEvent(event),
    summary: overrides.summary || event.text || '',
    artwork: overrides.artwork || incidentArtworkFor({ ...event, title: overrides.title || titleFromEvent(event), summary: event.text }),
    effects: overrides.effects || effectChips(event),
    severity: overrides.severity || (event.effect === 'damage' || event.effect === 'offspring-loss' ? 'bad' : event.effect === 'warning' || event.effect === 'human-warning' ? 'warning' : event.effect === 'good' || event.effect === 'pollinated' ? 'good' : 'neutral'),
    quiet: overrides.quiet ?? event.effect === 'flavor',
    response: overrides.response || event.response || null,
    responseMode: overrides.responseMode || event.responseMode,
    state: overrides.state || event.state,
    deadlineTurn: overrides.deadlineTurn ?? event.deadlineTurn,
    scenePersistent: overrides.scenePersistent ?? event.scenePersistent,
    subject: overrides.subject || event.subject,
    meta: { ...(event.meta || {}), ...(overrides.meta || {}) },
  });
}

export function openMajorIncident(state, major, consequences = []) {
  if (!major) return null;
  return openIncident(state, {
    kind: `major:${major.key}`,
    title: major.name,
    summary: major.desc,
    artwork: major.sceneArt,
    effects: consequences,
    severity: major.severity,
    tier: 'major',
    priority: 'lead',
    state: INCIDENT_STATES.RESOLVED,
    scenePersistent: false,
    meta: { majorKey: major.key },
  });
}

export function resolveIncident(state, incidentId, outcome = {}) {
  const incident = getIncident(state, incidentId);
  if (!incident) return null;
  incident.state = outcome.state || INCIDENT_STATES.RESOLVED;
  incident.outcome = {
    title: outcome.title || incident.title,
    summary: outcome.summary || '',
    effects: Array.isArray(outcome.effects) ? outcome.effects.filter(Boolean) : [],
  };
  incident.scenePersistent = false;
  state.responseQueue = state.responseQueue.filter(id => id !== incidentId);
  return incident;
}

export function keepIncidentOngoing(state, incidentId, outcome = {}) {
  const incident = getIncident(state, incidentId);
  if (!incident) return null;
  incident.state = INCIDENT_STATES.ONGOING;
  incident.outcome = outcome.title || outcome.summary ? {
    title: outcome.title || incident.title,
    summary: outcome.summary || '',
    effects: Array.isArray(outcome.effects) ? outcome.effects.filter(Boolean) : [],
  } : null;
  incident.scenePersistent = true;
  state.responseQueue = state.responseQueue.filter(id => id !== incidentId);
  return incident;
}

export function awaitIncidentResponse(state, incidentId, updates = {}) {
  const incident = getIncident(state, incidentId);
  if (!incident) return null;
  incident.state = INCIDENT_STATES.AWAITING_RESPONSE;
  incident.responseMode = RESPONSE_MODES.IMMEDIATE;
  if (updates.title) incident.title = updates.title;
  if (updates.summary) incident.summary = updates.summary;
  if (updates.response) incident.response = structuredClone(updates.response);
  if (updates.subject) incident.subject = structuredClone(updates.subject);
  if (updates.artwork) incident.artwork = structuredClone(updates.artwork);
  incident.scenePersistent = true;
  incident.outcome = null;
  if (!state.responseQueue.includes(incidentId)) state.responseQueue.push(incidentId);
  return incident;
}

export function expireIncident(state, incidentId) {
  const incident = getIncident(state, incidentId);
  if (!incident) return null;
  incident.state = INCIDENT_STATES.EXPIRED;
  incident.scenePersistent = false;
  state.responseQueue = state.responseQueue.filter(id => id !== incidentId);
  return incident;
}

export function incidentSceneArtKinds(state) {
  return [...new Set(getActiveIncidents(state)
    .filter(incident => incident.scenePersistent)
    .flatMap(incident => Array.isArray(incident.artwork) ? incident.artwork : [incident.artwork])
    .filter(kind => typeof kind === 'string' && !kind.startsWith('tree:')))];
}

export function queuedResponseIncidents(state) {
  ensureIncidentState(state);
  return state.responseQueue.map(id => getIncident(state, id)).filter(incident => incident?.state === INCIDENT_STATES.AWAITING_RESPONSE);
}

export function assertSerializableIncidentState(state) {
  const value = { incidents: state.incidents || [], responseQueue: state.responseQueue || [] };
  const containsUnsupportedValue = candidate => {
    if (typeof candidate === 'function' || typeof candidate === 'symbol' || typeof candidate === 'bigint' || candidate === undefined) return true;
    if (!candidate || typeof candidate !== 'object') return false;
    return Object.values(candidate).some(containsUnsupportedValue);
  };
  if (containsUnsupportedValue(value)) return false;
  try {
    return JSON.stringify(JSON.parse(JSON.stringify(value))) === JSON.stringify(value);
  } catch {
    return false;
  }
}
