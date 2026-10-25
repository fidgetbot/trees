import { applyNeighborAid, ensureNeighborEconomy } from './neighbor-economy.js?rev=mature-grove-v1';
import { buildChemicalDefenseDecision, buildHostileEncroachmentDecision, resolveSharedDecision } from './events.js?rev=mature-grove-v1';
import { buildConservationDecision, buildHumanEncounterDecision, resolveHumanDecision, resolveOffspringCrisisAid } from './humans.js?rev=human-adaptation-v1';
import { keepIncidentOngoing, resolveIncident } from './incidents.js?rev=structured-event-outcomes-v1';

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
      kind: 'offspring-aid', title: `Your ${child.species} offspring asks for help`,
      body: `<p><strong>This is your offspring.</strong></p><p><em>${crisis.flavors[Math.min(crisis.stage - 1, crisis.flavors.length - 1)]}</em></p><p>It needs <strong>${crisis.amount} ${icon} ${crisis.kind}</strong>.</p><p><strong>Your current reserves:</strong> ☀️${state.sunlight || 0} · 💧${state.water || 0} · 🌱${state.nutrients || 0}</p><p><strong>Offspring health:</strong> ${child.health}/${child.maxHealth} · <strong>Growth:</strong> ${child.stageScore}</p>`,
      options: [{ id: 'give', label: 'Give what you can', affordable: true }, { id: 'withhold', label: 'Withhold your resources', affordable: true }],
      meta: { childId: child.id, crisisId: crisis.id },
    };
  }
  if (response.kind === 'ally-aid') {
    const neighbor = state.neighbors.find(candidate => candidate.slot === response.neighborSlot && !candidate.dead);
    const crisis = neighbor?.activeCrises?.find(candidate => candidate.id === response.crisisId);
    if (!neighbor || !crisis) return null;
    ensureNeighborEconomy(neighbor);
    const available = Math.min(crisis.amount, Math.max(0, state[crisis.kind] || 0));
    const partial = Math.min(available, Math.max(1, Math.floor(crisis.amount / 2)));
    const icon = crisis.kind === 'nutrients' ? '🌱' : crisis.kind === 'water' ? '💧' : '☀️';
    return {
      kind: 'ally-aid', title: `${neighbor.species} ally asks for help`,
      body: `<p><em>${crisis.flavors[Math.max(0, Math.min(crisis.stage - 1, crisis.flavors.length - 1))]}</em></p><p>It needs <strong>${crisis.amount} ${icon} ${crisis.kind}</strong>.</p><p><strong>Your current reserves:</strong> ☀️${state.sunlight || 0} · 💧${state.water || 0} · 🌱${state.nutrients || 0}</p><p>Any contribution replenishes real reserves and prevents shortage damage for at least one turn. Keeping your resources does not harm the relationship.</p><p><strong>Ally health:</strong> ${neighbor.health}/${neighbor.maxHealth}</p>`,
      options: [
        { id: 'give', label: available ? `Send ${available} ${crisis.kind}` : `No ${crisis.kind} to spare`, affordable: available > 0, disabled: available <= 0 },
        ...(partial < available ? [{ id: 'partial', label: `Send just ${partial} ${crisis.kind}`, affordable: true }] : []),
        { id: 'withhold', label: 'Keep my reserves for now', affordable: true },
      ],
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
    ensureNeighborEconomy(neighbor);
    const requested = optionId === 'partial' ? Math.max(1, Math.floor(crisis.amount / 2)) : crisis.amount;
    const offered = optionId === 'withhold' ? 0 : Math.min(requested, Math.max(0, state[crisis.kind] || 0));
    const given = applyNeighborAid(neighbor, crisis.kind, offered);
    state[crisis.kind] = Math.max(0, (state[crisis.kind] || 0) - given);
    if (given > 0) {
      neighbor.helpGivenToThem += 1;
      neighbor.lastAidMemory = 'you-helped';
      applyRelationshipDelta(neighbor, given >= requested && optionId !== 'partial' ? 8 : 2);
      const recovered = !neighbor.activeCrises.some(c => c.id === crisis.id);
      summary = recovered
        ? `You send ${given} ${crisis.kind}. The ${neighbor.species} has enough reserves to leave immediate shortage and continue recovering.`
        : `You send ${given} ${crisis.kind}. Its reserves rise, and it is protected from shortage damage for ${neighbor.aidGrace} turn${neighbor.aidGrace === 1 ? '' : 's'} while its roots recover.`;
    } else {
      summary = `You keep your reserves. The ${neighbor.species} continues trying to recover on its own. Your relationship is unchanged.`;
    }
    const newState = getRelationshipState(neighbor.relation).name;
    if (!(neighbor.activeCrises || []).some(candidate => candidate.id === crisis.id)) resolveIncident(state, incident.id, { title: 'Aid Given', summary });
    else keepIncidentOngoing(state, incident.id, { title: incident.title, summary });
    const relation = oldState !== newState ? `<p><strong>Relationship:</strong> ${oldState} → ${newState}</p>` : '';
    return { title: 'Ally Response', body: `<p>${summary}</p>${relation}<p><strong>Health:</strong> ${neighbor.health}/${neighbor.maxHealth}</p>` };
  }
  return { title: 'The Moment Passes', body: '<p>No response was available.</p>' };
}
