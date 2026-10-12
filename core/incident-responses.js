import { buildChemicalDefenseDecision, buildHostileEncroachmentDecision, resolveSharedDecision } from './events.js?rev=incident-system-v1';
import { buildConservationDecision, buildHumanEncounterDecision, resolveHumanDecision, resolveOffspringCrisisAid } from './humans.js?rev=incident-system-v1';
import { keepIncidentOngoing, resolveIncident } from './incidents.js?rev=incident-system-v1';

function plainText(html = '') {
  return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function buildIncidentDecision(state, incident, deps = {}) {
  const { computeCurrentLifeStage, getRelationshipState, compareConflictPower, getNeighborStage } = deps;
  const response = incident?.response;
  if (!response) return null;
  if (response.kind === 'chemical-defense') {
    return buildChemicalDefenseDecision(state, { computeCurrentLifeStage, threat: response.threatKey });
  }
  if (response.kind === 'hostile-encroachment') {
    const neighbor = state.neighbors.find(candidate => candidate.slot === response.neighborSlot && !candidate.dead);
    return neighbor ? buildHostileEncroachmentDecision(state, neighbor, { getRelationshipState, compareConflictPower, getNeighborStage }) : null;
  }
  if (response.kind === 'human-encounter') return buildHumanEncounterDecision(state, incident.meta?.encounter);
  if (response.kind === 'conservation-inspection') return buildConservationDecision(state, { getRelationshipState, getNeighborStage });
  if (response.kind === 'offspring-aid') {
    const child = state.offspringRecords.find(candidate => candidate.id === response.childId && !candidate.dead);
    const crisis = child?.activeCrises?.find(candidate => candidate.id === response.crisisId);
    if (!child || !crisis) return null;
    const icon = crisis.kind === 'nutrients' ? '🌱' : crisis.kind === 'water' ? '💧' : '☀️';
    return {
      kind: 'offspring-aid', title: `${child.species} offspring asks for help`,
      body: `<p><em>${crisis.flavors[Math.min(crisis.stage - 1, crisis.flavors.length - 1)]}</em></p><p>It needs <strong>${crisis.amount} ${icon} ${crisis.kind}</strong>.</p><p><strong>Health:</strong> ${child.health}/${child.maxHealth} · <strong>Growth:</strong> ${child.stageScore}</p>`,
      options: [{ id: 'give', label: 'Give what you can', affordable: true }, { id: 'withhold', label: 'Withhold your resources', affordable: true }],
      meta: { childId: child.id, crisisId: crisis.id },
    };
  }
  if (response.kind === 'ally-aid') {
    const neighbor = state.neighbors.find(candidate => candidate.slot === response.neighborSlot && !candidate.dead);
    const crisis = neighbor?.activeCrises?.find(candidate => candidate.id === response.crisisId);
    if (!neighbor || !crisis) return null;
    const icon = crisis.kind === 'nutrients' ? '🌱' : crisis.kind === 'water' ? '💧' : '☀️';
    return {
      kind: 'ally-aid', title: `${neighbor.species} asks for help`,
      body: `<p><em>${crisis.flavors[Math.min(crisis.stage - 1, crisis.flavors.length - 1)]}</em></p><p>It needs <strong>${crisis.amount} ${icon} ${crisis.kind}</strong>.</p><p><strong>Health:</strong> ${neighbor.health}/${neighbor.maxHealth}</p>`,
      options: [{ id: 'give', label: 'Give what you can', affordable: true }, { id: 'withhold', label: 'Withhold your resources', affordable: true }],
      meta: { neighborSlot: neighbor.slot, crisisId: crisis.id },
    };
  }
  return null;
}

export function resolveIncidentDecision(state, incident, decision, optionId, deps = {}) {
  const { getRelationshipState, compareConflictPower, applyRelationshipDelta, getNeighborStage, recordDamage, random = Math.random } = deps;
  if (decision.kind === 'chemical-defense' || decision.kind === 'hostile-encroachment') {
    const outcome = resolveSharedDecision(state, decision, optionId, { getRelationshipState, compareConflictPower, applyRelationshipDelta, getNeighborStage, recordDamage, random });
    if (outcome.threatStatus === 'growing') {
      incident.meta.threatKey = outcome.threatKey || decision.meta?.threatKey;
      incident.deadlineTurn = (state.turnsElapsed || 0) + 1;
      keepIncidentOngoing(state, incident.id, { title: outcome.title, summary: plainText(outcome.body) });
    } else resolveIncident(state, incident.id, { title: outcome.title, summary: plainText(outcome.body) });
    return outcome;
  }
  if (decision.kind === 'human-encounter' || decision.kind === 'conservation-inspection') {
    const outcome = resolveHumanDecision(state, decision, optionId, { random });
    resolveIncident(state, incident.id, { title: outcome.title, summary: plainText(outcome.body) });
    return outcome;
  }
  if (decision.kind === 'offspring-aid') {
    const child = state.offspringRecords.find(candidate => candidate.id === decision.meta.childId && !candidate.dead);
    const crisis = child?.activeCrises?.find(candidate => candidate.id === decision.meta.crisisId);
    if (!child || !crisis) return { title: 'The Moment Passes', body: '<p>The crisis is no longer active.</p>' };
    const outcome = resolveOffspringCrisisAid(state, child.id, crisis.id, { withhold: optionId === 'withhold' });
    const summary = outcome.resolved
      ? `You meet the full request with ${outcome.given} ${crisis.kind}. Your offspring steadies, and the crisis passes.`
      : outcome.withheld
        ? `You keep your reserves. Your ${child.species} offspring remains in danger, and its need grows.`
        : outcome.given > 0 ? `You send ${outcome.given} ${crisis.kind}. It helps, but the crisis remains.` : `You have none of the needed ${crisis.kind} to send. The crisis worsens.`;
    if (outcome.resolved) resolveIncident(state, incident.id, { title: 'Aid Given to Offspring', summary });
    else keepIncidentOngoing(state, incident.id, { title: incident.title, summary });
    return { title: outcome.resolved ? 'Aid Given to Offspring' : 'The Crisis Continues', body: `<p>${summary}</p><p><strong>Health:</strong> ${child.health}/${child.maxHealth}</p>` };
  }
  if (decision.kind === 'ally-aid') {
    const neighbor = state.neighbors.find(candidate => candidate.slot === decision.meta.neighborSlot && !candidate.dead);
    const crisis = neighbor?.activeCrises?.find(candidate => candidate.id === decision.meta.crisisId);
    if (!neighbor || !crisis) return { title: 'The Moment Passes', body: '<p>The crisis is no longer active.</p>' };
    const oldState = getRelationshipState(neighbor.relation).name;
    let summary;
    if (optionId === 'withhold') {
      neighbor.helpRefusedToThem += 1; neighbor.lastAidMemory = 'you-refused'; crisis.amount += 2;
      neighbor.relation = Math.max(-100, neighbor.relation - 12);
      summary = `You keep your reserves. The ${neighbor.species} weakens and remembers the silence.`;
    } else {
      const given = Math.min(crisis.amount, Math.max(0, state[crisis.kind] || 0));
      state[crisis.kind] -= given;
      neighbor.helpGivenToThem += given > 0 ? 1 : 0; neighbor.helpRefusedToThem += given <= 0 ? 1 : 0;
      neighbor.lastAidMemory = given > 0 ? 'you-helped' : 'you-refused';
      if (given >= crisis.amount) {
        neighbor.health = Math.min(neighbor.maxHealth, neighbor.health + crisis.healthLoss + 2);
        neighbor.activeCrises = neighbor.activeCrises.filter(candidate => candidate.id !== crisis.id);
        applyRelationshipDelta(neighbor, 12);
        summary = `You meet the full request. The ${neighbor.species} steadies and remembers your generosity.`;
      } else if (given > 0) {
        neighbor.health = Math.min(neighbor.maxHealth, neighbor.health + 1); crisis.amount = Math.max(1, crisis.amount - given);
        applyRelationshipDelta(neighbor, 2); summary = `You send ${given} ${crisis.kind}. It helps, but the crisis remains.`;
      } else {
        crisis.amount += 2; applyRelationshipDelta(neighbor, -8); summary = `You cannot send what the ${neighbor.species} needs. The crisis worsens.`;
      }
    }
    const newState = getRelationshipState(neighbor.relation).name;
    if (!(neighbor.activeCrises || []).some(candidate => candidate.id === crisis.id)) resolveIncident(state, incident.id, { title: 'Aid Given', summary });
    else keepIncidentOngoing(state, incident.id, { title: incident.title, summary });
    const relation = oldState !== newState ? `<p><strong>Relationship:</strong> ${oldState} → ${newState}</p>` : '';
    return { title: 'Ally Response', body: `<p>${summary}</p>${relation}<p><strong>Health:</strong> ${neighbor.health}/${neighbor.maxHealth}</p>` };
  }
  return { title: 'The Moment Passes', body: '<p>No response was available.</p>' };
}
