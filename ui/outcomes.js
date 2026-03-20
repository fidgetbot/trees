export function renderSpringSeedFateBody({ prevSeeds, fate }) {
  return `
    <p>${prevSeeds} seed${prevSeeds !== 1 ? 's' : ''} faced the hazards of dispersal and germination.</p>
    <ul>${fate.results.map(r => `<li>${r}</li>`).join('')}</ul>
    <p><strong>${fate.sprouted}</strong> offspring successfully sprouted.</p>
  `;
}

export function renderVictoryBody({ score }) {
  return `
    <h2>🌳 You have become Ancient! 🌳</h2>
    <p>Your roots run deep. Your canopy towers above the forest.</p>
    <p>You have successfully established yourself in the ecosystem.</p>
    <p><em>Your offspring will flourish here and provide shade for generations to come.</em></p>
    <p>Current Score: <strong>${score}</strong></p>
    <p>Your milestone has been added to the grove records.</p>
    <p><small>Continue playing to see how long your lineage lasts...</small></p>
  `;
}

export function renderGameOverBody({ flavor, score }) {
  return `<p><em>${flavor}</em></p><p>Your lineage has ended.</p><p>Final score: <strong>${score}</strong></p><p>Your run has been added to the grove records.</p>`;
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
