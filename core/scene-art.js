// Remove only the resolved encounter; unrelated visitors remain in the grove.
export function clearSceneArt(state, kind) {
  if (!kind || !Array.isArray(state.activeSceneArt)) return;
  state.activeSceneArt = state.activeSceneArt.filter(active => active !== kind);
}
