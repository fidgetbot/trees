export function recordDamageForState(state, amount, cause) {
  if (amount > 0) state.lastDamageCause = cause || 'decline';
}

export function healthWarningBandForState(state) {
  const ratio = state.maxHealth > 0 ? state.health / state.maxHealth : 1;
  if (ratio <= 0.10) return 4;
  if (ratio <= 0.25) return 3;
  if (ratio <= 0.45) return 2;
  if (ratio <= 0.70) return 1;
  return 0;
}

export function getHealthWarningContent(level) {
  const content = {
    1: {
      title: 'Wounded',
      body: 'Something is wrong. Your tissues ache, and your leaves hang heavy. You can still recover, but the forest has begun to press against you.',
    },
    2: {
      title: 'Struggling',
      body: 'Stress spreads through you. Water and strength are no longer reaching every branch. What was once discomfort is becoming danger.',
    },
    3: {
      title: 'Critical',
      body: 'You are failing. Your roots weaken, your crown dims, and death presses close. Immediate relief is no longer optional.',
    },
    4: {
      title: 'Near Death',
      body: 'Your life is slipping away. Sap slows, tissues fail, and the forest waits in silence. Without help, this season may be your last.',
    },
  };
  return content[level];
}

export function deathFlavorForCause(cause) {
  const map = {
    drought: 'The soil gave less and less, until at last there was nothing left to draw. You dried where you stood.',
    fire: 'Flame climbed your bark and ran your crown in a single bright hunger. By morning, only blackened wood remained.',
    blight: 'Rot spread quietly through your tissues, turning strength to weakness until you could no longer hold yourself together.',
    storm: 'Wind found every weakness in your form. When the storm passed, you could not rise from what it had broken.',
    insects: 'Too many mouths found you tender. Piece by piece, stress and hunger hollowed out your strength.',
    frost: 'Cold entered the living places within you and would not leave. By thaw, too much had already died.',
    chemicals: 'Hostile compounds burned through the delicate balance that kept you alive. The soil itself became an enemy.',
    decline: 'Season by season, loss outweighed recovery. At last, your strength failed, and the forest closed over your absence.',
  };
  return map[cause] || map.decline;
}
