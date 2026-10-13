# Tests worth keeping

Run the suite with a current Node LTS (Node 22+); no dependencies or install step:

```sh
node --test tests/*.test.mjs
```

For a focused change, pass only the affected files. For example:

```sh
node --test tests/action-economy.test.mjs tests/threat-status.test.mjs
```

## Coverage boundaries

- **Rules:** resource spending/cancellation, affordability, gathering, unlock timing, relationships, seasonal damage, reproduction, succession, and victory eligibility.
- **Incident flows:** serializable state, ordered responses, stable warning/outcome identity, one-row unavoidable outcomes, delayed consequences, and scene-art cleanup.
- **Presentation logic:** selection and action ordering, camera trajectory/framing, growth attachment continuity, root geometry, and meaningful generated content such as displayed costs or escaped text.
- **Assets:** referenced files exist; failed images do not suppress successful siblings; caches avoid duplicate loads; structure retries use a fresh URL. The Image fixture simulates callbacks, not image decoding or pixels.

The checked-in harness is Node-based. It does **not** launch the game in a browser. In particular, passing geometry or generated-HTML checks does not prove that a phone map stays visible after closing Future Actions, that an image actually decodes, or that an announcement is readable. For changes to those paths, reproduce the affected interaction in a browser and inspect the rendered result. Do not substitute source-string assertions for that check.

Use [the simulator](../sim/README.md) for seeded balance/long-run investigations. Do not require simulations or gameplay playthroughs for test-only, copy-only, or asset-only maintenance; use focused verification appropriate to the change.

## Keep the harness small

1. Name the observable failure a test would catch. Prefer actual rules/resolvers and resulting state over extensive mocks.
2. Keep money/resource accounting, identity/lifecycle, boundary cases, and reproduced regressions even when they look small.
3. Do not freeze prose, punctuation, CSS spelling, file revision suffixes, or entire constant tables. Test meaningful contracts (such as a displayed cost, missing artwork, or unsafe camera) instead.
4. Merge overlap only when the owning test still exercises the distinct cases. Different loaders, defense types, seasons, or cancellation paths may have independent failure modes.
5. Keep fixtures local unless repetition actually warrants a helper. Restore global fakes after each test; keep global-fake cases serial. Asset tests use fresh module instances to isolate production caches.
6. Await a completion signal with a bounded timeout instead of guessing how long work takes.
7. A larger test count is not a goal. Nor is deleting a useful test to meet a reduction target.

## October 2026 pruning pass

- Removed source scans for HUD positioning, action markup, modal titles, and forbidden prose. These never exercised layout or interaction.
- Removed copy-only naming/sentence-style checks and literal snapshots of seasonal factors, asset counts, and grove positions. Retained unlock explanation completeness and seasonal eligibility in `progressive-unlocks.test.mjs`.
- Merged chemical serialization/response coverage into the shared-resolver lifecycle test; merged fruit-art identity into the lifecycle test while retaining both human and bird threat rolls.
- Dropped the hand-built gathering-summary fixture already covered by real engine gathering plus rendered output, and the no-op connection-toast test already covered by completed-action feedback behavior.
- Consolidated nine loader tests into `asset-loading.test.mjs`; retained each production loader and the distinct growth/structure recovery paths. File-existence and cache checks replace brittle filename/count expectations.
- Removed exact art-tuning assertions where relative size, stable attachment, or changed palette is the relevant contract. Kept the camera overshoot, offscreen culling, rooted-seed fallback, and persistent growth regressions.

No game/runtime code changed in this pass.
