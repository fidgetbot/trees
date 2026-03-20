# Trees - Game Specification

A browser-based game where you play as a tree, balancing growth, reproduction, and survival in a competitive forest ecosystem.

## Life Stages

Trees progress automatically through stages based on in-game time and activity. When all conditions are met, a popup announces your growth — trees don't decide to grow, they simply become.

| Stage | Requirements | Growth Popup | Unlocks | Vulnerabilities |
|-------|--------------|--------------|---------|-----------------|
| **Seed** | — | — | Basic growth only | All threats fatal |
| **Sprout** | After first action (grow roots) | *"Your shell cracks. You push outward into the unknown."* | First leaves, basic photosynthesis | Drought, herbivory |
| **Seedling** | 1 season + 2 root zones + 2 leaf growths | *"Your taproot finds rich soil. You feel sturdy."* | Root extension, fungal connections | Aphids, browsing animals |
| **Sapling** | 4 seasons + survive 1 major event | *"Your woody fibers harden. You have become a Sapling!"* | Branch growth, chemical defense | Wind, competition |
| **Small Tree** | 2 years + 2 branches | *"You yearn skyward. Your canopy reaches for the light."* | Flowers, reproduction | Lightning, disease |
| **Mature Tree** | 3 years + first fruit | *"Fruits of your own hang heavy. The cycle turns."* | Full canopy, ally support | Fire, beetle swarms, **ally betrayal** |
| **Ancient** | 3 years + survive 2 major events + 1 ally | *"Lightning scar and fire ash — you endure. Ancient patience fills you."* | Victory condition | None (resilient) |

**Stage Effects:**
- **Seed/Sprout/Seedling:** Underground focus, no canopy competition, vulnerable to surface events
- **Sapling/Small Tree:** Enter canopy wars, shading competition begins, chemical warfare unlocks
- **Mature/Ancient:** Established position, can support allies, immune to most minor threats

### Growth Nudges

When you're close to growth (2 of 3 conditions met), occasional flavor text hints at the change to come:

| Missing Requirement | Nudge Message |
|---------------------|---------------|
| More time needed | *"Your roots feel restless... something shifts slowly within."* |
| Need deeper roots | *"Your taproot probes deeper, seeking something it cannot name."* |
| Need survival event | *"You sense storms approaching. Endurance will bring change."* |
| Need branches | *"Your crown yearns skyward. Space awaits above."* |
| Need fruit | *"Flowers spent, your branches await the weight of purpose."* |
| Need allies | *"Your roots touch others in the dark. Connection calls."* |

Nudges appear randomly every 3–4 turns until growth occurs.

## Platform & Format

- **Platform:** Web-based HTML5
- **Graphics:** HTML5 Canvas, 2D
- **Hosting:** GitHub Pages from `fidgetbot/trees` repository
- **Resolution:** 900×600 (wider to fit 5 trees side by side)

## Game Structure

- **Game Length:** Endless lineage play until no offspring remain
- **Turn Structure:** 3 turns per season, 4 seasons per year (12 turns/year)
- **Phases per Turn:**
  1. **Resource Phase:** Pop-up shows resources collected, click to dismiss
  2. **Action Phase:** Player takes actions via interface
  3. **Event Phase:** Pop-up shows event, click to dismiss

## Current Build Status

This spec reflects the current playable build, which is now beginning a phased refactor out of `main.js` into shared core modules.

### Implemented now
- Full seasonal loop with resource collection, action phase, and event phase
- Automatic life-stage progression based on stage-specific requirements
- Six playable fruit-tree species: Plum, Peach, Apricot, Pear, Citrus, Cherry
- Four persistent neighboring trees with relationship states: Ally, Friendly, Neutral, Rival, Hostile
- Targeted diplomacy actions: root connection, aid ally, request help, shade rival, root dominion
- Reproduction chain: flowers → pollinated flowers → developing fruit → seeds → spring seed fate → offspring trees
- Warning/response fruit-threat chain in summer before seed maturity
- Warning/response/delayed-consequence chemical-defense threat chain for pests and blight
- Ally health tracking, repeated ally crisis requests, and ally death when neglected too long
- Nutrient-heavy growth/defense choices that act as late-game sinks
- Succession choice on death when offspring remain, with multiple heir archetypes to continue the lineage
- Local grove-record leaderboard saved in browser storage
- Live scoring, victory popup on reaching Ancient, and continued endless play after victory

### Not fully implemented / simplified
- Seasonal action locking is implemented for flowering actions; most other actions remain year-round
- Succession choices are currently archetypal heirs rather than fully simulated per-offspring individuals
- Neighbor life stages are used mainly for scaling/visualization rather than a fully simulated parallel life cycle
- Ally crises are tracked consistently, but allies are still simplified characters rather than full mirror copies of the player tree
- There is no online/shared leaderboard yet; records are local to the browser

## Refactor Roadmap: Engine, UI, Simulation

The codebase is moving toward a three-layer architecture:

1. **Core engine** (`core/`)
   - Shared game rules and state helpers
   - No DOM dependencies
   - Eventually used by both browser play and headless simulation

2. **Browser UI** (`ui/`)
   - Rendering, modals, input wiring, and presentation text
   - Thin client over the core engine

3. **Simulation harness** (`sim/`)
   - Headless Node-based playtests
   - Seeded runs, strategy bots, structured logs, and balance reporting

### Refactor principles
- Preserve **v30 gameplay behavior** during extraction unless separation forces a change
- Use a **single rules engine** for browser and simulation
- Centralize randomness behind a **seedable RNG**
- Prefer **structured event payloads** over UI-only prose in the engine
- Keep the browser build playable throughout the migration

### Current refactor status
- `core/constants.js` created for seasons, stages, relationship bands, and shared constants
- `core/species.js` created for species definitions and species-rule helpers
- `core/stages.js` created for stage requirement/progression helpers
- `core/random.js` created as the first seedable-RNG utility layer
- `core/actions.js` created for the action catalog, category metadata, and shared action-availability/locking helpers
- `core/events.js` now covers the major-event catalog, event rolling helper, minor-event rolling, fruit-threat resolution, seasonal reproduction flow, and seed-fate resolution
- `core/diplomacy.js` created for shared relationship/alliance helpers and ally-threat logic
- `core/engine.js` created as the first shared state-transition layer (season lookup, resource collection/exposure math, event application, action execution, post-event continuation, spring viability, turn advancement, death handling)
- `main.js` now imports the extracted rule modules
- `ui/actions.js` now exists as the first browser-only rendering helper, handling action-panel DOM construction and button wiring
- `ui/events.js` now handles event-phase modal body rendering for browser play
- `ui/modal.js` now handles the standard browser modal display helper
- `ui/choice-modal.js` now handles browser choice-modal rendering
- `ui/` and `sim/` directories are scaffolded for later phases

### Planned next phases
- Move the remaining interaction-trigger logic behind shared event/core interfaces
- Move the rest of diplomacy actions and interaction flows behind shared core interfaces
- Continue expanding `core/engine.js` from wrapper-level orchestration into the primary public engine API, with event-phase continuation and action execution as the next likely candidates
- Move browser-only rendering/modal behavior into `ui/`
- Add seeded headless playtests and reporting in `sim/`

## Seasonal Action Locks

Certain actions are restricted by season to reflect real tree biology:

| Action | Available Seasons | Notes |
|--------|-------------------|-------|
| **Produce flower** | Spring only | Only available at Small Tree stage or above |
| **Mass flowering / Mast year** | Spring only | Seasonal bloom surges follow the same spring flowering window |
| **All other actions** | All seasons | Year-round growth possible if unlocked by life stage |

**UI:** Off-season actions appear grayed out with tooltip explaining the seasonal restriction.

## Action Economy

- **Base Actions:** 3 per turn
- **Bonus Actions:** None currently implemented
- **Action Costs:** Base costs are multiplied by current life-stage rank (minimum ×1), so later-stage actions become more expensive as the tree grows

| Action | Sunlight | Water | Nutrients | Notes |
|--------|----------|-------|-----------|-------|
| Grow branch | 2 | 1 | 1 | Adds leaf cluster |
| Extend root | 1 | 0 | 0 | Adds root zone |
| Grow leaves | 1 | 1 | 1 | On existing branch |
| Produce flower | 3 | 2 | 2 | Prerequisite for fruit |
| Thicken trunk | 5 | 2 | 2 | Increases strength |
| Chemical defense | 3 | 1 | 2 | Allelopathy/toxins |

## Resources

Resources accumulate turn-to-turn (stored in trunk/root reserves).

**Sunlight (per turn):**
```
Sunlight = (LeafClusters + CanopyBonus) × Exposure% × SeasonFactor
```
- **Exposure:** 100% full sun, 50% shaded, 0% fully shaded
- **CanopyBonus:** Expand Canopy gives stronger sunlight scaling than ordinary leaf growth
- **Seasonal:** Spring ×0.8, Summer ×1.2, Autumn ×0.6, Winter ×0.2

**Water (per turn):**
```
Water = (TrunkStorage + RootSupport + TaprootBonus) × SeasonFactor × DroughtModifier
```
- **TaprootBonus:** Deepen Taproot gives stronger water scaling than ordinary roots and visibly softens drought events
- **Seasonal:** Spring ×1.0, Summer ×0.6, Autumn ×0.8, Winter ×0.4
- **Drought:** Reduced during drought events, but deep taproots mitigate the loss

**Nutrients (per turn):**
```
Nutrients = max(1, floor((0.7 × RootZones + cappedAllyBonus + SoilBonus) × DiseaseModifier) - MaintenanceCost)
```
- Roots now provide a lower base nutrient flow than before
- Ally nutrient support is intentionally soft-capped to prevent runaway snowballing
- Larger trees pay nutrient upkeep for maintaining trunk, branches, leaves, flowers, fruit, and seeds
- This keeps nutrients useful as stored biological capital instead of becoming effortless surplus

**Stressors:** Disease (-20% all), drought, pests (direct damage)

## Species

Current focus: **fruiting trees only**. Non-fruiting trees like oak and redwood should return later with distinct reproduction systems.

### Plum
- **Bonus:** Fast growth — +20% stage progression speed
- Soft fruit, high reproduction potential
- Moderate drought resilience
- Pollinators: bumblebees, mason bees, hoverflies

### Peach
- **Bonus:** Resilient — +1 starting max health
- Tender but productive
- Benefits from careful defense of fruit
- Pollinators: honeybees, bumblebees, butterflies

### Apricot
- **Bonus:** Early bloomer — flowering actions cost -1 sunlight
- Early-blooming and frost-sensitive
- Can reproduce quickly if spring goes well
- Pollinators: mason bees, honeybees, beetles

### Pear
- **Bonus:** Durable wood — starts with +1 trunk
- Slower, steadier, more durable wood
- Better drought tolerance through sturdier structure
- Pollinators: hoverflies, honeybees, solitary bees

### Citrus
- **Bonus:** Fragrant — 2× pollinator attraction (capped for sanity)
- Water-hungry but flavorful
- Fragrant blossoms and vulnerable fruit
- Pollinators: honeybees, small native bees, hoverflies

### Cherry
- **Bonus:** Alluring — +25% positive relationship gain
- Graceful, showy blossoms
- Fruit attracts birds strongly
- Pollinators: bumblebees, mason bees, butterflies

### Species Baselines
Beyond the marquee bonus text shown in the UI, each species also carries baseline tuning for:
- **Growth rate:** affects life-stage progression speed
- **Drought resistance:** softens drought penalties and damage

These are part of species identity, but the named bonus above is the primary differentiator surfaced to players.

The player chooses one of these fruiting trees at game start. Four neighboring trees are then randomized from the same fruiting species pool.

## Tree Diplomacy & Competition

The 4 neighboring trees are persistent characters with evolving relationships.

### Relationship States
- **Ally** (+50 to +100): Share resources, warn of threats, mutual aid
- **Friendly** (+10 to +49): Open to alliance, minor resource sharing
- **Neutral** (-10 to +10): No interaction
- **Rival** (-50 to -11): Compete for light, chemical skirmishes
- **Hostile** (-100 to -51): Active warfare, shading, allelopathy

### Diplomatic Actions
| Action | Cost | Effect |
|--------|------|--------|
| **Seek root connection** | 1/0/1 | Attempt underground friendship with a chosen neighboring tree |
| **Chemical defense** | 3/1/2 | Protect fruit, leaves, and offspring; may also deter hostility |

### Diplomatic Events
- **Targeted connection:** Choose a named neighboring fruit tree and risk acceptance, indifference, or hostility
- **Ally in trouble:** Contextual events ask whether to help an ally tree with chemistry or support, now with tracked ally health and repeated unresolved requests
- **Ally betrayal:** Neglected allies can begin to sour and betray you starting at the **Sapling** stage; before **Mature Tree**, only one ally-related punishment can trigger per event phase, but that cap is removed once you reach Mature Tree. Fungal-network blight remains a later-run threat
- **Hostile shading:** Hostile trees can worsen your light exposure over time

### Neighbor Progression
Neighboring trees also advance through life stages, creating dynamic difficulty:
- Young neighbors: Easy allies, low threat
- Mature rivals: Aggressive competition for canopy space
- Ancient neighbors: Stable, predictable

## Visual Design

- **View:** Cross-section (sky above, soil below)
- **Aesthetic:** Silhouette style, minimal geometric shapes
- **Trees:** 5 visible (player center, 2 neighbors each side)
- **Shapes:**
  - Trunk: Vertical rectangle
  - Canopy: Circle or ellipse per branch cluster
  - Roots: Lines branching downward
  - Fungal network: Thin glowing lines between roots

### Seasonal Palettes

| Season | Top Color | Bottom Color |
|--------|-----------|--------------|
| Spring | #FFE4E1 (soft pink) | #E6F3FF (light blue) |
| Summer | #FFD700 (gold) | #90EE90 (green) |
| Autumn | #FF8C00 (orange) | #8B4513 (brown) |
| Winter | #D3D3D3 (grey) | #F0F8FF (pale white) |

## Fungal Network

- **Establish:** Available once you reach 3 root zones
- **Targeted:** Player chooses which neighboring tree to approach
- **Chance-based:** Deeper roots improve acceptance odds
- **Tense outcomes:** Trees may accept, ignore, or become insulted and hostile

## Events

Events scale with life stage — threats that matter to seedlings don't bother ancient trees.

### Life Stage Event Modifiers

| Stage | Event Effects |
|-------|---------------|
| **Seed** | All damage ×3, no beneficial events |
| **Sprout** | Damage ×2, drought fatal |
| **Seedling** | Aphids worse, browsing animals appear |
| **Sapling** | Wind damage increased, competition begins |
| **Small Tree** | Lightning risk, full event pool |
| **Mature Tree** | Fire/beetle swarms, resistant to minor threats |
| **Ancient** | Immune to minor events, fire resistant |

### Major Events (1 per season, guaranteed)

| Event | Seed | Sprout | Seedling | Sapling | Small | Mature | Ancient |
|-------|------|--------|----------|---------|-------|--------|---------|
| **Fire** | Fatal | Fatal | Severe | Dangerous | Risky | Manageable | Survivable |
| **Drought** | Fatal | Severe | Dangerous | Risky | Manageable | Minor | Negligible |
| **Aphid Swarm** | — | — | Severe | Dangerous | Risky | Minor | Negligible |
| **Wind Storm** | — | — | — | Dangerous | Risky | Manageable | Minor |
| **Lightning** | — | — | — | — | Risky | Dangerous | Manageable |
| **Beetle Swarm** | — | — | — | — | — | Dangerous | Risky |
| **Late Frost** | Fatal | Severe | Dangerous | Risky | Manageable | Minor | — |
| **Fungal Blight** | — | — | Severe | Dangerous | Risky | Manageable | Minor |

### Minor Events (random, frequent, small effects)
- **Beneficial Pollinators:** Bonus resources if flowers present
- **Animal Nitrogen:** Nutrient boost from animal waste
- **Rain:** Extra water (consecutive = root rot risk)
- **Lightning/Wind:** Branch damage (stage-scaled)
- **Bird Dispersal:** Nutrients + pollination chance
- **Mycorrhizal Bloom:** Nutrient boost from fungal network
- **Beaver Activity:** Water table changes

### Diplomatic Events
- **Ally under attack:** Help with chemicals? (+20 relation)
- **Rival aggression:** Being shaded/chemically attacked
- **Competition warning:** Neighbor growing fast, shading increasing
- **Alliance offer:** Neighbor requests formal alliance
- **Chemical truce:** Rival offers to de-escalate
- **Ally betrayal:** Neglected allies may turn hostile (late-game threat)
- **Fungal network collapse:** Blight spreads through ally connections (year 8+)
- **Spring seed fate:** Each seed may be eaten, lost in shade, dispersed poorly, or sprout successfully
- **Offspring trouble:** Young offspring may face aphids or drought and ask for help
- **(More from real forest ecology)**

## Win/Loss & Succession

**Offspring Flow:**
1. **Spring / Small Tree+**: Player may spend resources to produce flowers
2. **Spring/Summer**: Pollinator events may convert flowers into pollinated flowers
3. **Summer**: Pollinated flowers automatically become fruit
4. **Summer warning events**: Humans, birds, or chewing animals may threaten fruit before seed maturity
5. **Player response window**: Chemical Defense can reduce fruit loss
6. **Autumn**: Each surviving fruit becomes exactly one seed
7. **Spring**: Each seed rolls through dispersal, landing, and germination fate
8. Successfully sprouted seeds become visible offspring trees and succession options

**Design Rule:** Important reproductive threats should usually appear as **warning → response → outcome** chains rather than surprise losses.

**Succession:**
- On death, if at least one offspring remains, the player chooses which surviving heir archetype continues the lineage
- Chosen heirs inherit a reduced but distinct stat profile (rooted, leafy, or balanced)
- Surviving offspring contribute to ally count and can appear in the grove visualization

**Game End:**
- When the current tree dies and no offspring remain in the lineage pool
- Mode: Endless survival with live score display
- Reaching **Ancient** triggers a victory milestone popup, records the run in the local grove records, and play continues afterward

## Scoring

**Composite Score (live display):**
- **Age:** 10 points per year survived
- **Biomass:** 1 point per branch + root + trunk unit
- **Offspring:** 50 points per viable seed produced
- **Network:** 20 points per allied tree in fungal network

**Example:** 50-year-old oak, 30 biomass, 3 offspring, 2 allies = 500 + 30 + 150 + 40 = **720**

## MVP Scope

- 6 fruit-tree identities with shared mechanics
- Basic geometric visuals (silhouettes)
- Core resource/action/event loop
- Fungal network through targeted connection attempts
- Major events: Fire, drought, insect swarm
- Minor events: Pollinators, rain, animals, lightning
- Succession system
- Live scoring

## New Mechanics (Implemented)

### Last Stand
When health drops below 20%, players can sacrifice a branch to survive fatal damage. This reflects real botanical strategy — trees auto-prune to conserve resources in crisis.

### Ally Warning System
Players receive escalating warnings when they approach stages requiring allies:
- **Sapling:** Gentle hints about the fungal network
- **Small Tree:** Clear warnings that Ancient requires connection
- **Mature Tree:** Urgent alerts that time is running out

### Accelerated Aging
After year 15, stage progression speeds up (+50%) to prevent endless games.

### Escalating Threats
Events become more dangerous after year 10 (+10% damage per year), keeping late-game challenging.

### Species Bonuses
Each species has unique starting advantages displayed in the UI:
- **Plum:** Fast growth (+20% stage progress)
- **Peach:** Resilient (+1 max health)
- **Apricot:** Early bloomer (flowers cost -1 sunlight)
- **Pear:** Durable wood (starts with +1 trunk)
- **Citrus:** Fragrant (2× pollinator attraction)
- **Cherry:** Alluring (+25% ally relationship gain)

### Late-Game Ally Threats
- **Ally Betrayal:** Neglected allies (help refused > help given) can turn hostile
- **Fungal Network Collapse:** Blight spreads through ally connections after year 8

## Future Ideas

- More species (Birch, Pine, Maple, etc.)
- More events (flood, frost, beaver attack)
- Seasonal animations (leaves falling, snow)
- Sound design (wind, rain, birds)
- Achievements/leaderboards
- Tutorial mode with botany facts
