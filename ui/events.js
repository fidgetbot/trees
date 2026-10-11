import { renderEncounterArt } from './fauna-art.js?rev=encounter-art-v1';

export function renderEventPhaseBody({ major, minors, consequences }) {
  let majorHtml = '';
  if (major) {
    const majorClass = major.severity === 'critical'
      ? 'event-critical'
      : major.severity === 'bad'
        ? 'event-bad'
        : major.severity === 'neutral'
          ? 'event-neutral'
          : 'event-good';

    majorHtml = `
      <div class="event-major ${majorClass}">
        ${renderEncounterArt(major.sceneArt) || `<div class="event-icon">${major.icon}</div>`}
        <div class="event-content">
          <h3>${major.name}</h3>
          <p>${major.desc}</p>
          ${consequences.length ? `
            <div class="event-consequences">
              <strong>Effects:</strong>
              <ul>${consequences.map(c => `<li>${c}</li>`).join('')}</ul>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  } else {
    majorHtml = `
      <div class="event-major event-good">
        <div class="event-icon">🌙</div>
        <div class="event-content">
          <h3>Quiet Night</h3>
          <p>The forest is still. You rest.</p>
        </div>
      </div>
    `;
  }

  const minorHtml = minors.length
    ? `<div class="minor-events"><h4>Forest Whispers</h4><ul>${minors.map(e => {
      const art = renderEncounterArt(e.sceneArt);
      const classes = [art ? 'illustrated-event' : '', e.compactThreat ? 'compact-threat-event' : ''].filter(Boolean).join(' ');
      const copy = e.compactThreat
        ? `<span class="compact-threat-copy"><strong>${e.title}</strong><span>${e.text}</span><small>${e.status}</small></span>`
        : `<span>${e.text}</span>`;
      return `<li class="${classes}">${art}${copy}</li>`;
    }).join('')}</ul></div>`
    : '<p class="no-events">The forest sleeps quietly this turn.</p>';

  return `
    ${majorHtml}
    ${minorHtml}
  `;
}
