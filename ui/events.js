import { renderEncounterArt } from './fauna-art.js?rev=incident-system-v1';

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function statusLabel(incident) {
  if (incident.state === 'awaiting-response') return 'Needs response';
  if (incident.state === 'ongoing') return incident.responseMode === 'action-window' && incident.deadlineTurn != null
    ? `Ongoing · respond by turn ${incident.deadlineTurn}`
    : 'Ongoing';
  if (incident.state === 'expired') return 'Expired';
  return '';
}

function renderEffects(effects = []) {
  const visible = effects.filter(Boolean);
  if (!visible.length) return '';
  return `<span class="incident-effects">${visible.map(effect => `<span class="incident-effect">${escapeHtml(effect)}</span>`).join('')}</span>`;
}

function renderIncident(incident, { lead = false } = {}) {
  const art = renderEncounterArt(incident.artwork || 'event-ambient');
  const status = statusLabel(incident);
  const classes = [
    'journal-incident',
    lead ? 'journal-incident-lead' : '',
    incident.quiet ? 'journal-incident-quiet' : '',
    `incident-${incident.severity || 'neutral'}`,
  ].filter(Boolean).join(' ');
  return `<article class="${classes}" data-incident-id="${escapeHtml(incident.id)}">
    ${art}
    <div class="journal-incident-copy">
      <h3>${escapeHtml(incident.title)}</h3>
      ${incident.summary ? `<p>${escapeHtml(incident.summary)}</p>` : ''}
      ${renderEffects(incident.effects)}
      ${status ? `<strong class="incident-status">${escapeHtml(status)}</strong>` : ''}
    </div>
  </article>`;
}

export function renderEventPhaseBody({ incidents = [], pendingResponses = 0 } = {}) {
  const ordered = [...incidents].sort((a, b) => (a.priority === 'lead' ? -1 : 0) - (b.priority === 'lead' ? -1 : 0));
  const leadId = ordered.find(incident => incident.priority === 'lead')?.id;
  const rows = ordered.length
    ? ordered.map(incident => renderIncident(incident, { lead: incident.id === leadId })).join('')
    : '<p class="quiet-night-summary"><strong>Quiet night.</strong> The forest is still. You rest.</p>';

  return `
    <img class="night-specimen" src="assets/events/moonlit-night-branches-v1.png?rev=night-branches-v1" alt="" aria-hidden="true" />
    <p class="night-prose">Darkness settles over the grove.</p>
    <section class="night-journal" aria-label="Night journal">${rows}</section>
    ${pendingResponses ? `<p class="encounter-queue-summary"><strong>${pendingResponses} ${pendingResponses === 1 ? 'encounter needs' : 'encounters need'} your response.</strong></p>` : ''}
  `;
}
