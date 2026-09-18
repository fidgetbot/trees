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

export function renderSuccessionBody({ generated }) {
  return `
    <p>Your current tree has died, but living offspring remain.</p>
    <p>Choose which surviving line will carry the grove forward:</p>
    <ul>
      ${generated.map(choice => `<li><strong>${choice.label}</strong> — ${choice.summary}</li>`).join('')}
    </ul>
  `;
}
