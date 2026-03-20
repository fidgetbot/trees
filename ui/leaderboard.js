export function createLeaderboardStore({ storage, storageKey, limit = 10 }) {
  function load() {
    try {
      const raw = storage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function save(entries) {
    storage.setItem(storageKey, JSON.stringify(entries.slice(0, limit)));
  }

  function saveRun(entry) {
    const entries = load();
    entries.push(entry);
    entries.sort((a, b) => b.score - a.score || b.year - a.year);
    save(entries);
    return entry;
  }

  return {
    load,
    save,
    saveRun,
  };
}

export function createRunRecord(state, reason = 'game over') {
  return {
    species: state.selectedSpecies || 'Unknown',
    score: state.score,
    year: state.year,
    stage: state.lifeStage.name,
    allies: state.allies,
    viableSeeds: state.viableSeeds,
    offspring: state.offspringPool,
    reason,
    savedAt: new Date().toISOString(),
  };
}

export function renderLeaderboardBody(entries) {
  if (!entries.length) {
    return '<p>No grove records yet. Finish a run to plant the first one.</p>';
  }

  return `
    <ol class="leaderboard-list">
      ${entries.map((entry, idx) => `
        <li>
          <strong>#${idx + 1} — ${entry.species}</strong><br>
          Score <strong>${entry.score}</strong> · Year ${entry.year} · ${entry.stage}<br>
          Seeds ${entry.viableSeeds} · Allies ${entry.allies} · ${entry.reason}
        </li>
      `).join('')}
    </ol>
  `;
}
