# Trees - Game Specification

Trees is a browser-based tree-life survival strategy game. You play as a fruiting tree growing through the seasons, balancing structure, resources, reproduction, diplomacy, and survival inside a living forest.

This file describes the **current game**, the **current codebase architecture**, and the **high-level design decisions** that should guide future work.

## Documentation Conventions

**`SPEC.md` is stable truth, not a progress log.**

Use this file for:
- current gameplay design
- current architecture
- high-level goals
- important design decisions and constraints

Do **not** use this file for:
- implementation diary entries
- step-by-step refactor history
- temporary work-slice progress notes
- stale milestone checklists that belong in project tracking

**GitHub Issues are the source of truth for progress tracking.**

Ongoing work should be tracked in issues, including:
- progress updates
- current status
- blockers
- next steps
- validation notes
- milestone progress as work is completed

As work proceeds, the relevant GitHub issue(s) should be updated instead of appending progress history to this spec.

## Overview

- **Platform:** Web-based HTML5 game
- **Graphics:** HTML5 Canvas, 2D
- **Hosting:** GitHub Pages from `fidgetbot/trees`
- **Resolution:** 900×600
- **Current focus:** fruiting trees only

The game combines:
- seasonal resource management
- growth through life stages
- diplomacy and rivalry with neighboring trees
- reproduction and lineage continuation
- environmental threats and long-term survival

## Core Player Loop

Each turn follows this structure:
1. **Resource Phase** — the tree gathers sunlight, water, and nutrients
2. **Action Phase** — the player spends actions on growth, defense, diplomacy, or reproduction
3. **Event Phase** — the game resolves seasonal events, threats, and downstream consequences

Time advances in:
- **3 turns per season**
- **4 seasons per year**
- **12 turns per year**

A typical run is about:
- surviving early fragility
- building enough structure to keep growing
- reaching reproduction
- enduring major threats
- either dying, continuing through succession, or stabilizing into an Ancient lineage

## Core Systems

### Life Stages

Trees progress automatically when their stage requirements are met. Growth is not an action; it is a consequence of development and survival.

| Stage | Requirements | Unlocks | Vulnerabilities |
|-------|--------------|---------|-----------------|
| **Seed** | — | Basic growth only | All threats fatal |
| **Sprout** | After first action (grow roots) | First leaves, basic photosynthesis | Drought, herbivory |
| **Seedling** | 1 season + 2 root zones + 2 leaf growths | Root extension, fungal connections | Aphids, browsing animals |
| **Sapling** | 4 seasons + survive 1 major event | Branch growth, chemical defense | Wind, competition |
| **Small Tree** | 2 years + 2 branches | Flowers, reproduction | Lightning, disease |
| **Mature Tree** | 3 years + first fruit | Full canopy, ally support | Fire, beetle swarms, ally betrayal |
| **Ancient** | 3 years + survive 2 major events + 1 ally | Victory state / long-term resilience | Highly resilient |

#### Growth nudges

When the player is close to growth, the game can surface flavor nudges indicating what is still missing. These are presentation cues, not separate mechanics.

### Resources

Resources persist between turns and represent stored biological capital.

#### Sunlight
Generated primarily from leaves and canopy exposure, modified by season and competition.

#### Water
Generated from trunk storage, roots, and taproot depth, modified by season and drought pressure.

#### Nutrients
Generated from roots and fungal/allied support, reduced by upkeep and adverse conditions.

The current implementation intentionally treats nutrients as a meaningful limiting resource, especially for later-stage trees.

### Action Economy

- **Base actions per turn:** 3
- Actions spend combinations of sunlight, water, and nutrients
- Costs scale upward by life stage so later growth and defense decisions remain meaningful
- If the player cannot afford any currently available action, the browser UI keeps the end-turn path available instead of auto-advancing immediately

Growth actions are intentionally differentiated:
- **Grow Leaves** is the cheapest direct sunlight-increase action
- **Grow Branch** adds structure and a larger burst of new foliage, making it a stronger but pricier way to improve future sunlight collection

Action categories currently include:
- growth and structure
- defense and resilience
- reproduction
- diplomacy and rivalry
- advanced late-game sinks

### Seasonal Constraints

Some actions are season-locked to reflect tree biology.

Current notable lock:
- flowering actions are **Spring-only**

Most other actions remain broadly available year-round once unlocked by stage.

### Neighbor Trees and Diplomacy

The player exists in a forest with persistent neighboring trees.

Current relationship states:
- Ally
- Friendly
- Neutral
- Rival
- Hostile

Current diplomacy/rivalry systems include:
- root connection with variable outcomes, including rare immediate breakthroughs or sharp setbacks
- aid to allies
- requesting help from allies
- shading neighboring trees starting in the sapling stage, including proactive aggression against neutral, friendly, or allied neighbors
- confirmation warnings before attacking friendly or allied neighbors, since aggression immediately turns them into rivals
- proactive aggression is intentionally less rewarding on the first strike than pressing an existing rivalry, so hostile play is viable without making betrayal the dominant opener
- root domination starting in the mature stage, with direct resource theft from targeted neighbors and proactive escalation into rivalry
- ally crises and ally neglect consequences
- betrayal pressure in hostile or strained long-term relationships

Neighbors are persistent actors, but they are still simplified relative to the player tree.

### Reproduction and Lineage

The current reproduction chain is:
- flowers
- pollinated flowers
- developing fruit
- seeds
- spring seed-fate resolution
- offspring pool / offspring trees

If the current tree dies but viable lineage remains, the game can continue through succession rather than ending immediately.

### Threats, Events, and Survival

The game includes both major and minor events, along with delayed consequence chains.

Current systems include:
- seasonal minor events
- major environmental threats
- fruit-threat warning/response chains
- chemical-defense threat chains that can resolve at the start of the next turn if left unanswered
- damage tracking and death flavoring
- health warning thresholds as the tree approaches collapse

### Scoring, Victory, and Continuation

- Score updates continuously during play
- Reaching **Ancient** is the current victory threshold
- Runs may continue after victory
- Death may end the run or transition into succession if offspring remain
- Browser play also maintains a local grove-record leaderboard

## Species Scope

Current focus is **fruiting trees only**.

Implemented playable species:
- Plum
- Peach
- Apricot
- Pear
- Citrus
- Cherry

Non-fruiting trees such as oak or redwood are intentionally deferred for later, since they likely need distinct reproduction and progression systems rather than being forced into the current fruit-tree model.

## Current Implementation Status

### Implemented now

The current codebase includes:
- the full seasonal resource → action → event loop
- automatic life-stage progression
- six playable fruit-tree species
- persistent neighboring trees with relationship states
- diplomacy/rivalry actions and ally-state tracking
- reproduction through flowers, fruit, seeds, and spring seed fate
- threat-response chains for fruit threats and chemical defense
- ally crises and neglect consequences
- succession on death when lineage remains
- scoring, Ancient victory, and post-victory continuation
- local browser leaderboard storage
- headless seeded simulation for automated playtests and balance analysis

### Current simplifications / limitations

The current build still simplifies several systems:
- flowering is season-locked, but most other actions are still available year-round
- succession currently uses curated heir archetypes rather than fully simulated offspring individuals
- neighbors are persistent and meaningful, but not fully mirrored player-equivalents
- some diplomacy/interaction-heavy flows still use simplified handling in headless simulation
- the browser leaderboard is local-only; there is no shared online leaderboard yet

## Architecture Overview

The codebase is organized into three primary layers plus a browser adapter:

### `core/`
Shared rules and state-transition helpers with no DOM dependency.

Current responsibilities include:
- shared constants and stage definitions
- species rules and species-specific adjustments
- stage progression logic
- seedable randomness helpers
- action catalog and availability rules
- event rolling and event resolution helpers, including shared start-of-turn pending-consequence resolution, shared hostile-encroachment decision/resolution flow, shared chemical-defense threat decision/resolution flow, and shared decision-runner dispatch for interactive event choices
- diplomacy and survival helpers, including shared relationship-resolution plus normalized decision-object builders for connection, ally aid, ally help, and aggression, alongside the corresponding shared resolution logic and shared diplomacy-decision dispatch
- shared engine turn/state flow

### `ui/`
Browser-only rendering, modal presentation, HUD updates, and browser setup helpers.

Current responsibilities include:
- action panel rendering
- resource/event/outcome modal bodies
- species selection UI
- leaderboard presentation/storage helpers
- forest canvas rendering
- HUD updates and browser interaction wiring
- browser app bootstrap helpers

### `sim/`
Headless Node-based simulation and balance-analysis tooling.

Current responsibilities include:
- seeded simulation runs
- reporting the committed app build version from `version.json` in simulation output
- repeated batch execution
- baseline automated action selection
- structured JSON reporting for balance analysis

### `main.js`
Browser adapter/controller that wires the browser surface to the shared rules and UI modules.

Current reality:
- `main.js` still contains some gameplay-bearing orchestration for interactive browser flows
- this is a transitional state, not the desired final architecture

Architectural intent:
- `main.js` should become a thin browser adapter
- gameplay rules, balance numbers, target eligibility, and state transitions should live in shared `core/` modules
- browser play and headless simulation should consume the same shared gameplay rules path rather than maintaining separate approximations

## Simulation and Balance Workflow

The simulation harness exists to support balance analysis and automated playtesting without replacing manual browser playtests.

Current simulation capabilities include:
- deterministic seeds
- repeated batch runs
- species-specific runs
- structured per-game history
- aggregate reporting across runs

Current reporting includes:
- stage reach counts and rates
- score and year percentiles
- action usage frequencies
- event frequencies
- death causes
- species breakdowns
- per-run stage transitions
- per-run peak metrics

Representative usage examples:
- `node sim/run.js`
- `node sim/run.js --turns 48`
- `node sim/run.js --turns 48 --games 8 --seed 20 --species Plum`

Detailed simulation usage and output documentation belongs in `sim/README.md`.

## Design Decisions and Invariants

These principles should continue to guide future work:

### One shared rules engine
Browser play and headless simulation should rely on the same shared rules/state logic for gameplay and balance decisions. Duplicated rule implementations between browser and simulation are considered architectural debt to remove, not a target state.

### UI stays out of shared rules
Rendering, modal prose, browser event wiring, and other presentation concerns belong in `ui/` or browser adapter code, not in shared rules modules.

### Shared decisions use one normalized shape
Interactive browser/sim choice flows should prefer a normalized shared decision object shape, with per-flow details attached under `decision.meta` / `option.meta` and stable selection identifiers such as `option.id` and `option.targetIndex`. Frontends may render or choose from that data differently, but they should not depend on ad hoc per-flow field names.

### Shared decision execution should dispatch through one boundary
When an interactive decision has been built, browser and simulation code should submit a chosen `option.id` back through a shared resolver/dispatcher rather than calling per-flow resolver functions directly. The adapter layer may still decide how to present or pick options, but execution and outcome production should flow through one shared decision-running boundary. Event decisions and diplomacy/action decisions may currently dispatch through separate shared boundaries, but direct adapter-to-per-flow execution should continue shrinking over time.

### Browser adapters should centralize post-outcome UI work
`main.js` should prefer shared UI continuation helpers for common post-decision work such as refreshing HUD/render state, showing relationship-change followups, and continuing turn flow. Per-flow browser code may still provide bespoke prose, but repeated refresh / modal-chaining logic should be consolidated rather than reimplemented for each choice flow.

### Transitional wrappers should be removed once decision builders are adopted
When browser/sim callers have moved to shared decision builders plus shared dispatchers, one-off list-wrapper helpers or stale adapter glue that only existed to support older call sites should be removed instead of preserved indefinitely. The target state is a smaller surface area built around decision construction, shared execution, and thin rendering adapters.

### Simulation informs balance, but does not replace playtesting
Automated simulation is a balancing and analysis tool. Manual browser playtests remain necessary for feel, pacing, readability, and player experience.

### Preserve behavior unless intentionally changing design
Refactors and infrastructure work should preserve gameplay behavior unless a design change is deliberate and documented.

### Fruit-tree scope is intentional
The current design is built around fruiting trees, reproduction, and lineage. Expanding beyond that should happen intentionally, not by forcing unrelated tree types into the same assumptions.

### GitHub Issues track progress
Progress tracking, work slices, blockers, and milestone updates belong in GitHub Issues rather than being appended to this spec.

### Build version is repository-driven and auto-bumped on push
The visible app build number is stored in `version.json`. On pushes to `main`, GitHub Actions should automatically increment that file in a follow-up commit from `github-actions[bot]`, after which GitHub Pages deploys the bumped version. Operationally, that means a human-authored push lands first, then the version-bump commit lands, then Pages serves the new version number. When reporting deploy completion, verify the live `version.json` value rather than assuming the branch push alone changed it.

## Forward-Looking Goals

The current high-level goals are:
- use the simulation harness to support balancing decisions
- improve simulation fidelity for interaction-heavy systems where needed
- continue manual browser playtesting alongside simulation
- add new gameplay features on top of shared core rules rather than re-entangling UI and rules
- keep the browser build and simulation harness aligned as the game evolves
