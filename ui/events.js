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
        <div class="event-icon">${major.icon}</div>
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
          <p>The forest is still. Your tree rests.</p>
        </div>
      </div>
    `;
  }

  const minorHtml = minors.length
    ? `<div class="minor-events"><h4>Forest Whispers</h4><ul>${minors.map(e => `<li>${e.text}</li>`).join('')}</ul></div>`
    : '<p class="no-events">The forest sleeps quietly this turn.</p>';

  return `
    ${majorHtml}
    ${minorHtml}
  `;
}
