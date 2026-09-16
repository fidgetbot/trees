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
| **Seedling** | 1 season + 2 root zones + 2 leaf growths | Root extension, fungal connections, then height growth and trunk bracing | Aphids, browsing animals |
| **Sapling** | 4 seasons + survive 1 major event | Branch growth immediately; taproot, canopy, ally aid, shading, and rhizosphere emerge across the first five Sapling seasons | Wind, competition |
| **Small Tree** | 2 years + 2 branches | Flowers immediately; thorns and toxic foliage emerge over the next two seasons | Lightning, disease, first human surveys |
| **Mature Tree** | 3 years + first fruit | Mass flowering immediately; offspring nurture, grove shelter, and root dominion emerge across the first three Mature Tree seasons | Fire, beetle swarms, ally betrayal, logging pressure |
| **Ancient** | 3 years + survive 2 major events + 1 allied or child tree | Long-term resilience and protected-grove endgame | Repeated human attention |

Current score thresholds in implementation:
- Mature Tree: 3300
- Ancient: 10200

#### Growth nudges

When the player is close to growth, the game can surface flavor nudges indicating what is still missing. These are presentation cues, not separate mechanics.

### Resources

Resources persist between turns and represent stored biological capital.

#### Sunlight
Generated primarily from leaves and canopy exposure, modified by season and competition.

#### Water
Generated from trunk storage, roots, taproot depth, and connected allies, modified by season and drought pressure. An ordinary root improves water storage and nutrient gathering; a taproot adds an ordinary root zone plus extra deep-water and nutrient access.

#### Nutrients
Generated from roots, taproots, fungal/allied support, and persistent canopy advantages, reduced by upkeep, hostile crowding, and adverse conditions.

The current implementation intentionally treats nutrients as a meaningful limiting resource, especially for later-stage trees.

Season directly modifies gathering: Spring produces 80% normal sunlight and 100% water, Summer 120% sunlight and 60% water, Autumn 60% sunlight and 80% water, and Winter 20% sunlight and 40% water. Nutrients have no direct seasonal multiplier. A compact expandable guide beneath Resources exposes these values and highlights the current season.

### Action Economy

- **Base actions per turn:** 3
- High gathering yields award one additional action per complete five resources gathered, capped at three bonus actions and six total actions per turn; the gathering summary reports the exact number earned
- Actions spend combinations of sunlight, water, and nutrients
- Multi-step actions remain pending until the player confirms a final target or investment; backing out, declining confirmation, or losing every valid target spends no resources and no action
- Costs scale upward by life stage so later growth and defense decisions remain meaningful
- If the player cannot afford any currently available action, the browser UI keeps the end-turn path available instead of auto-advancing immediately
- When a chemical-defense threat appears and the player cannot afford the response, the UI now presents a single acknowledgement button that explicitly shows the missing resources instead of offering a misleading unusable defend option

Growth actions are intentionally differentiated:
- **Grow Leaves** is the cheapest direct sunlight-increase action
- **Grow Branch** adds structure and a larger burst of new foliage, making it a stronger but pricier way to improve future sunlight collection
- **Extend Root** improves both water storage and nutrient gathering, while **Deepen Taproot** adds a root zone plus additional deep water, nutrients, health, and drought resilience

Action categories currently include:
- growth and structure
- defense and resilience
- reproduction
- diplomacy and rivalry
- advanced late-game sinks

Late-game defensive actions include permanent investments in **Thorns** and **Toxic Leaves**. During an active human encounter the player may also sacrifice a branch for an immediate defense or call through the fungal network for help.

Current browser HUD behavior:
- species summaries focus on the description and functional gameplay bonus, omitting the flavor-only pollinator list and the redundant starting-edge line
- the map is a fixed foreground layer at the top of the viewport while status, actions, and the log scroll beneath it; score, year, season, and life stage are part of the map layer as a compact overlay inside the picture
- immediately below the fixed map, Next Growth appears directly above Actions; usable actions come first, followed by subdued compact summaries of other actions unlocked at the current stage with their full scaled costs and a specific explanation of the current shortage or prerequisite; future-stage actions remain separately collapsed
- each life-stage transition announces every newly unlocked real action with a complete, natural sentence explaining what the action lets the player do, and records the same unlock in the log
- capabilities are intentionally staggered instead of arriving in large stage-transition bundles: Seedling introduces height growth and then trunk bracing one season later, Sapling discoveries continue for five seasons, Small Tree discoveries for two seasons, and Mature Tree discoveries for three seasons; each delayed action uses the normal unlock announcement when it becomes available
- the map camera begins at a macro scale with the painterly, species-tinted seed and soil horizon centered both horizontally and vertically; sparse clusters of tiny, irregular pebbles provide readable soil texture while every individual mark remains much smaller and less prominent than the seed; it pulls back as the player grows, and later stages keep the upper edge just above the player's current height so neighboring trees reveal progressively more structure as the player grows
- structural growth is persistent and visually inspectable on the Canvas: root zones add lateral roots, taproot growth deepens the central root, leaves add foliage, branches add stable shoots, trunk growth thickens the wood, and canopy growth widens the crown; producing flowers adds conspicuous blossoms only while the player actually has open flowers, and the map redraws immediately after each completed growth action
- Grow Taller unlocks after two Seedling seasons, lengthens the trunk, provides one additional point of sunlight gathering, and raises the player's competitive canopy height; each unbraced level adds one storm damage, at most three levels may remain unbraced, and Fortify Bark unlocks one season later to brace one level while also improving trunk strength, health, water storage, and resistance to drought, storms, insects, fire, and woodpeckers
- the fixed map no longer has a minimize control; clicking it opens a larger grove explorer with accelerated panning, button/keyboard/trackpad/pinch zoom from 3% to 300%, and a reset control; continuous pinch and Ctrl/⌘-scroll gestures use a GPU-transformed live preview and redraw the detailed grove only when the gesture settles, avoiding full 4096×1200 Canvas repaints on every Android pointer event; closing the explorer always returns to the centered stage-appropriate default map
- the Actions heading contains the live action count in the compact form **Actions (3 remaining)** and updates through zero without a separate banner
- a compact live resource-and-health strip sits directly beneath the Actions heading; action cards show only their required amounts with a small `cost` label, while shortages receive a stronger warning treatment, avoiding repeated `cost / yours` figures now that current totals remain visible beside the list
- the stats groups follow the action list without a redundant top-level **Status** heading
- the status panel can be minimized with its top-right corner control and restored with a compact chip; it starts expanded at the beginning of a run
- health is repeated prominently in the live Actions strip as well as under Resources; allies remain under Resources instead of a separate Ecology section
- ally-aid is only offered when there is at least one real allied neighbor available to target, and targeting is also validated again at resolution time so non-allies cannot slip through even if UI state gets out of sync
- requesting help likewise requires a living allied neighbor; offspring count toward lineage and grove-protection goals but do not masquerade as connected allies in diplomacy or resource sharing
- diplomacy choices retain each neighbor's persistent state index after filtering; action results, relationship text, map labels, and fungal root links must all resolve to that same neighbor and map slot
- pollination event text now capitalizes the named visitor and uses singular/plural grammar correctly for “flower was/were pollinated”
- the log now captures more of the turn-to-turn simulation state, including resource income, action outcomes, pollination/event text, and offspring establishment
- all visible trees on the map use compact, collision-aware tags: the player keeps species and growth stage on the primary line with “(You)” beneath it, while neighbors place species above a shorter stage-and-relationship line; tags move into separate rows when their measured text widths would overlap, and type scales up at narrow display widths for phone readability
- living allies and offspring include their current and maximum health in their green map tag, updating from the same persistent health state used by crises and aid; non-allied neighbors omit health to keep the grove readable
- Shade Neighbor is limited to the immediate left/right trees and establishes a persistent visible canopy arrangement rather than a one-time payout; it succeeds only when the player is at least as tall as the target, and otherwise explains that more height is needed; on success the player's trunk and crown bend strongly over the target while the shaded tree is pushed aside, shading improves sunlight and nutrient gathering each turn, and a neighboring rival that crowds the player reduces both until the arrangement changes, the relationship is repaired, or one tree dies
- connected living neighbor allies contribute both water and nutrients each turn and strengthen a Mycorrhizal Bloom; their contribution scales with their life stage, so a large allied tree shares more than a seed or sapling; offspring do not receive or grant these ally-only bonuses; the gathering summary compares each gain against a neutral-grove baseline and names positive allied/canopy effects or negative crowding effects
- the gathering summary presents its arithmetic as compact color-coded factors: structural baselines in gray, bonuses such as canopy, height, taproot, allies, soil, and dormancy in green, and penalties such as poor seasons, crowding, drought, disease, and upkeep in red
- the initial grove places the player and the immediately adjacent left/right neighbors at Seed stage; only the two outer trees begin established, allowing the three central trees to grow together
- pending human survey or cutting encounters remain visible on the Canvas as people at the player's trunk; painted marks and accumulated cutting scars persist visually, while thorns and toxic foliage are reflected in the player tree's art
- Winter adds visible snow to the Canvas and mixes snow, icicle melt, and rain into precipitation messages; heavy accumulation has a rare chance to break a branch on Sapling-or-larger trees

### Seasonal Constraints

Some actions are season-locked to reflect tree biology.

Current notable lock:
- flowering actions are **Spring-only**
- **Grow Leaves** is unavailable during Winter dormancy and returns in Spring; dormancy compensates by halving nutrient upkeep during Winter

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
- shading the immediately adjacent left/right trees starting in the sapling stage, including proactive aggression against neutral, friendly, or allied neighbors; canopy advantage/crowding persists in both rules and Canvas geometry
- confirmation warnings before attacking friendly or allied neighbors, since aggression immediately turns them into rivals
- proactive aggression is intentionally less rewarding on the first strike than pressing an existing rivalry, so hostile play is viable without making betrayal the dominant opener
- root domination starting in the mature stage, with direct resource theft from targeted neighbors and proactive escalation into rivalry
- ally crises and ally neglect consequences
- betrayal pressure in hostile or strained long-term relationships
- aid contributes directly to the recipient's growth and records whether the player began supporting it before maturity; this support history determines whether a large ally can help satisfy the protected-grove victory
- Offer Aid descriptions state this full strategic role: spending water/nutrients heals and grows the ally, strengthens the bond/favor history, and builds protection-goal support
- neighbor life state is tracked separately from relationship state: zero health means death, but the relationship at death is retained for history; dead trees cannot act, threaten, compete, contribute resources, qualify for protection, or appear in action targets, and their death receives a dedicated message explaining the loss and its impact

Neighbors are persistent actors, but they are still simplified relative to the player tree.

### Reproduction and Lineage

The current reproduction chain is:
- flowers
- pollinated flowers
- developing fruit
- seeds
- spring seed-fate resolution
- offspring pool / offspring trees

Established offspring are persistent lightweight tree records rather than only a count. Each child has its own species, growth score, health, and nurture history. **Nurture Offspring** supports one actual child, improving its growth and health instead of creating additional offspring.

Pear's **Dependable fruit** species bonus reduces each developing fruit's chance of being lost to pests or human harvest by 20%. This modifies fruit retention rather than pollination, keeping Pear distinct from Citrus's pollinator-attraction bonus.

If the current tree dies but viable lineage remains, the game can continue through succession rather than ending immediately.

### Threats, Events, and Survival

The game includes both major and minor events, along with delayed consequence chains.

Current systems include:
- seasonal minor events
- major environmental threats
- fruit-threat warning/response chains
- chemical-defense threat chains that resolve after an unanswered warning; the warning says only that the threat was not contained, and the subsequent consequence supplies the logical damage conclusion without redundantly forecasting an immediately following message
- damage tracking and death flavoring
- health warning thresholds as the tree approaches collapse
- a staged fungal-rumor narrative in which distant forests fall silent and logging pressure moves closer
- human survey and cutting encounters whose probability rises with tree size, trunk/branch mass, repeated attention, and regional pressure
- delayed human threats that remain on the map for an action phase before resolution, giving time to invest in thorns, toxic foliage, or other defenses
- persistent threat messages use natural in-world conclusions that clearly say whether danger is gathering, easing, passed, or left damage behind; allied help clears an active chemical threat such as aphids in addition to restoring health
- queued chemical and hostile-tree defense decisions refresh their affordability from current resources immediately before display, so preceding event interactions cannot leave a stale “not enough resources” choice on screen
- ambient flavor is selected from stage-specific pools so seed-only observations do not appear after germination
- cumulative cutting wounds; logging normally requires three unresolved deep cuts rather than a single unlucky instant-death roll

### Scoring, Victory, and Continuation

- Score updates continuously during play
- Reaching **Ancient** is a major milestone, not an automatic victory
- Victory requires two additional Mature-or-Ancient trees that the player materially helped: allied neighbors need a real history of aid, while children need repeated nurture investment
- Once the player and two supported companions qualify, conservation-minded humans inspect the grove and designate it as a protected ecosystem
- Runs may continue after victory
- Death may end the run or transition into succession if offspring remain

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
- the full seasonal resource → action → event loop, with the opening turn ready for inspection and play without a forced resource-summary modal
- persistent, species-shaped Canvas trees with connected curved branches, tapered branching root systems, layered painterly foliage, spring blossoms, summer fruit, autumn color, and bare winter silhouettes
- automatic life-stage progression
- six playable fruit-tree species
- a rebalanced pear profile that no longer starts with an extra trunk and no longer sits above the roster as the default strongest survival pick
- citrus pollination snowball has been trimmed repeatedly so its reproductive edge remains flavorful without overwhelming the rest of the cast
- peach resilience has also been softened so it reads as sturdy rather than quietly top-tier
- stronger midgame and late-game environmental pressure, especially from drought, storms, frost, and blight, so defensive investment matters more than pure snowball growth
- late-stage survival now asks more of trunk/roots/defense before the game consistently hands out Ancient victories in simulation
- lineage and alliance systems tuned to be more rewarding without letting them trivialize score-based advancement
- persistent neighboring trees with relationship states
- diplomacy/rivalry actions and ally-state tracking
- reproduction through flowers, fruit, seeds, and spring seed fate
- threat-response chains for fruit threats and chemical defense
- fruit-threat warnings persist through a full action phase before resolution, and a resolved threat cannot be replaced by another warning in the same event phase
- wildfire records fire as its sole damage cause and can be fully resisted by sufficient bark/shelter protection
- escalating fungal rumors, visible human encounters, permanent human deterrence, cutting scars, and branch/network encounter responses
- ally crises and neglect consequences
- persistent individual offspring with growth, health, and nurture history
- succession on death when lineage remains
- scoring, protected-ecosystem victory, and post-victory continuation
- headless seeded simulation for automated playtests and balance analysis

### Current simplifications / limitations

The current build still simplifies several systems:
- flowering is season-locked, but most other actions are still available year-round
- succession still uses curated heir archetypes, although living offspring now persist individually for growth, nurture, map display, and victory qualification
- neighbors are persistent and meaningful, but not fully mirrored player-equivalents
- some diplomacy/interaction-heavy flows still use simplified handling in headless simulation

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
- shared human-pressure and conservation rules, including fungal-rumor sequencing, offspring records, encounter decisions, cutting resolution, and protected-grove qualification
- diplomacy and survival helpers, including shared relationship-resolution plus normalized decision-object builders for connection, ally aid, ally help, and aggression, alongside the corresponding shared resolution logic and shared diplomacy-decision dispatch
- shared engine turn/state flow

### `ui/`
Browser-only rendering, modal presentation, HUD updates, and browser setup helpers.

Current responsibilities include:
- action panel rendering
- resource/event/outcome modal bodies
- species selection UI
- a visible build number on both the opening species screen and the in-game map
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

Filtering ineligible or dead neighbors must never renumber targets. `option.targetIndex` remains the selected neighbor's index in persistent `state.neighbors`, so later resolution and rendering cannot silently substitute another species.

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
