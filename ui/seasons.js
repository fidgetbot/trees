import { TURNS_PER_SEASON } from '../core/constants.js?rev=botanical-roots-v1';

export { TURNS_PER_SEASON };

const SEASON_PRESENTATIONS = Object.freeze({
  Spring: Object.freeze({
    title: 'Spring returns',
    lead: 'Dormancy loosens. Water rises through the roots, buds swell, and the grove begins again.',
    details: Object.freeze([
      Object.freeze({ label: 'Light and water', text: 'normal gathering returns.' }),
      Object.freeze({ label: 'Growth', text: 'leaves and flowering actions awaken.' }),
    ]),
  }),
  Summer: Object.freeze({
    title: 'Summer arrives',
    lead: 'The canopy fills. Long days press warmth into every leaf while the upper soil begins to dry.',
    details: Object.freeze([
      Object.freeze({ label: 'Light', text: 'gathering is strongest now.' }),
      Object.freeze({ label: 'Water', text: 'gathering falls to 60%.' }),
    ]),
  }),
  Autumn: Object.freeze({
    title: 'Autumn turns',
    lead: 'The light thins. Leaves begin to color, and the grove draws the work of summer inward.',
    details: Object.freeze([
      Object.freeze({ label: 'Light', text: 'gathering falls to 60%.' }),
      Object.freeze({ label: 'Water', text: 'gathering settles at 80%.' }),
    ]),
  }),
  Winter: Object.freeze({
    title: 'Winter settles',
    lead: 'The canopy quiets. Sap slows, leaves rest, and snow gathers along the soil.',
    details: Object.freeze([
      Object.freeze({ label: 'Light and water', text: 'gathering is at its lowest.' }),
      Object.freeze({ label: 'Dormancy', text: 'leaf growth rests and tissue upkeep falls.' }),
    ]),
  }),
});

export function seasonProgress(turnInSeason, turnsPerSeason = TURNS_PER_SEASON) {
  const total = Math.max(1, Math.trunc(Number(turnsPerSeason)) || TURNS_PER_SEASON);
  const turn = Math.min(total, Math.max(1, Math.trunc(Number(turnInSeason)) || 1));
  return {
    turn,
    total,
    degrees: (turn / total) * 360,
    label: `Turn ${turn} of ${total}`,
  };
}

export function seasonChangePresentation(seasonName, year) {
  const season = Object.hasOwn(SEASON_PRESENTATIONS, seasonName) ? seasonName : 'Spring';
  const presentation = SEASON_PRESENTATIONS[season];
  return {
    ...presentation,
    season,
    eyebrow: `A new season · Year ${Math.max(1, Math.trunc(Number(year)) || 1)}`,
    buttonLabel: `Begin ${season}`,
    sceneArt: `season-${season.toLowerCase()}`,
  };
}

export function renderSeasonChangeBody(presentation) {
  return `<p class="season-change-copy">${presentation.lead}</p>
    <div class="season-change-summary">${presentation.details.map(detail =>
      `<span><strong>${detail.label}:</strong> ${detail.text}</span>`
    ).join('')}</div>`;
}
