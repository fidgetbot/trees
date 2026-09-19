export function renderSpringSeedFateBody({ prevSeeds, fate }) {
  const shadeWarning = fate.shadedSprouts > 0
    ? `<p class="threat-status threat-growing"><strong>${fate.shadedSprouts} new offspring ${fate.shadedSprouts === 1 ? 'has' : 'have'} sprouted beneath the side where your crown is casting shade.</strong> ${fate.shadedSprouts === 1 ? 'Its' : 'Their'} growth will be slower until you shade the other neighbor or stop shading.</p>`
    : '';
  return `
    <p>${prevSeeds} seed${prevSeeds !== 1 ? 's' : ''} faced the hazards of dispersal and germination.</p>
    <ul>${fate.results.map(r => `<li>${r}</li>`).join('')}</ul>
    <p><strong>${fate.sprouted}</strong> offspring successfully sprouted.</p>
    ${shadeWarning}
  `;
}

export function renderVictoryBody({ score }) {
  return `
    <h2>Your Grove Is Protected</h2>
    <p>You grew ancient, and you helped two other trees become great and resilient beside you.</p>
    <p>Humans recognize the grove as a living ecosystem rather than a source of timber. Its boundaries are protected from cutting.</p>
    <p><em>Your roots remain connected. Your descendants will inherit a forest that is still alive.</em></p>
    <p>Current Score: <strong>${score}</strong></p>
    <p><small>Continue playing to see how long your lineage lasts...</small></p>
  `;
}

export function renderGameOverBody({ flavor, score }) {
  return `<p><em>${flavor}</em></p><p>Your lineage has ended.</p><p>Final score: <strong>${score}</strong></p>`;
}

export function renderFullGameOverBody({ flavor, score, lifetimeTurns, years, cause, species }) {
  const quotes = {
    drought: 'Even the deepest root belongs, at last, to the turning earth.',
    fire: 'Ash is not an ending; it is the forest remembering how to begin.',
    logging: 'A fallen crown still feeds the dark, patient life below.',
  };
  const quote = quotes[cause] || 'Nothing in the forest vanishes; life changes form and passes onward.';
  const causeLabel = String(cause || 'decline').replace(/\b\w/g, letter => letter.toUpperCase());
  return `
    <section class="game-over-screen" role="main" aria-labelledby="game-over-title">
      <div class="game-over-card">
        <p class="game-over-kicker">The grove falls quiet</p>
        <h1 id="game-over-title">Your ${species} has died</h1>
        <p class="game-over-flavor"><em>${flavor}</em></p>
        <dl class="game-over-stats">
          <div><dt>Lifetime</dt><dd>${lifetimeTurns} turn${lifetimeTurns === 1 ? '' : 's'}${years ? ` · ${years} full year${years === 1 ? '' : 's'}` : ''}</dd></div>
          <div><dt>Cause of death</dt><dd>${causeLabel}</dd></div>
          <div><dt>Final score</dt><dd>${score}</dd></div>
        </dl>
        <blockquote>“${quote}”</blockquote>
        <button id="try-again" type="button">Try Again</button>
      </div>
    </section>`;
}

export function renderSuccessionBody({ generated }) {
  return `
    <p>Your current tree has died, but living offspring remain.</p>
    <p>Choose which surviving line will carry the grove forward:</p>
    <ul>
      ${generated.map(choice => `<li><strong>${choice.label}</strong> — ${choice.summary}</li>`).join('')}
    </ul>
  `;
}
