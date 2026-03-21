# Trees simulation runner

The `sim/` directory contains the headless Node-based simulation harness for **Trees**.

## Current entrypoint

- `node sim/run.js`
- `node sim/run.js --turns 48`
- `node sim/run.js --turns 48 --games 8 --seed 20 --species Plum`

## What it does now

`sim/run.js` is no longer a stub scaffold.

It now:
- creates an initial game state without browser dependencies
- runs seeded headless simulations through the shared engine in `core/`
- executes a baseline non-interactive policy automatically
- runs repeated batch simulations
- emits structured JSON for analysis

## Supported CLI flags

- `--turns N` — turn cap per game
- `--games N` — number of games to run in the batch
- `--seed X` — deterministic seed for reproducible runs
- `--species <name>` — choose the player species for the batch

## Output shape

The runner prints JSON with these top-level sections:

- `version`
- `mode`
- `options`
- `summary`
- `games`

### `summary` includes

- win/loss counts
- average score, years, turns played, allies, viable seeds, offspring pool, and ending health
- score/year percentiles
- final-stage counts
- stage reach counts and rates
- death-cause counts
- aggregated action usage
- aggregated major-event counts
- aggregated minor-effect counts
- species breakdowns

### Each item in `games` includes

- seed
- species
- turns played
- final year / stage / score
- allies / viable seeds / offspring pool
- ending health
- victory / game-over state
- death cause and death flavor when applicable
- per-run `metrics`
- per-turn `history`

### Per-run `metrics` includes

- `actionsTaken`
- `majorEvents`
- `minorEffects`
- `stageTransitions`
- `stagesReached`
- `peak`
- `endingResources`

## Notes on fidelity

This is a **Simulation MVP / balance harness**, not a perfect mirror of every browser interaction path.

Current limitations:
- diplomacy and other interaction-heavy flows still use simplified headless fallbacks in some places
- the baseline policy is intended to produce useful progression and reporting, not optimal play
- simulation results should guide balancing discussions, but manual browser playtests still matter

## Typical workflow

1. Run a seeded batch for one species
2. Inspect the `summary` block for stage reach, score spread, event frequency, and action usage
3. Compare across seeds/species
4. Use the results to inform balancing or future simulation-fidelity work
