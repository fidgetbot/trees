# Trees - Game Specification

A browser-based game where you play as a tree, balancing growth, reproduction, and survival in a competitive forest ecosystem.

## Life Stages

Trees progress through stages based on total score. Each stage unlocks new capabilities and changes vulnerability to threats.

| Stage | Score Threshold | Unlocks | Vulnerabilities |
|-------|-----------------|---------|-----------------|
| **Seed** | 0 | Basic growth only | All threats fatal |
| **Sprout** | 100 | First leaves, basic photosynthesis | Drought, herbivory |
| **Seedling** | 300 | Root extension, fungal connections | Aphids, browsing animals |
| **Sapling** | 600 | Branch growth, chemical defense | Wind, competition |
| **Small Tree** | 1000 | Flowers, reproduction | Lightning, disease |
| **Mature Tree** | 2000 | Full canopy, ally support | Fire, beetle swarms |
| **Ancient** | 5000 | Victory condition | None (resilient) |

**Stage Effects:**
- **Seed/Sprout/Seedling:** Underground focus, no canopy competition, vulnerable to surface events
- **Sapling/Small Tree:** Enter canopy wars, shading competition begins, chemical warfare unlocks
- **Mature/Ancient:** Established position, can support allies, immune to most minor threats

## Platform & Format

- **Platform:** Web-based HTML5
- **Graphics:** HTML5 Canvas, 2D
- **Hosting:** GitHub Pages from `fidgetbot/trees` repository
- **Resolution:** 900×600 (wider to fit 5 trees side by side)

## Game Structure

- **Game Length:** Endless until death (of original tree and all offspring)
- **Turn Structure:** 3 turns per season, 4 seasons per year (12 turns/year)
- **Phases per Turn:**
  1. **Resource Phase:** Pop-up shows resources collected, click to dismiss
  2. **Action Phase:** Player takes actions via interface
  3. **Event Phase:** Pop-up shows event, click to dismiss

## Seasonal Action Locks

Certain actions are restricted by season to reflect real tree biology:

| Action | Available Seasons | Notes |
|--------|-------------------|-------|
| **Produce flower** | Spring only | Only available at Small Tree stage or above |
| **All other actions** | All seasons | Year-round growth possible if unlocked by life stage |

**UI:** Off-season actions appear grayed out with tooltip explaining the seasonal restriction.

## Action Economy

- **Base Actions:** 3 per turn
- **Bonus Actions:** +1 for every 5 total resources collected
- **Action Costs:**

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
Sunlight = LeafClusters × Exposure% × SeasonFactor
```
- **Exposure:** 100% full sun, 50% shaded, 0% fully shaded
- **Seasonal:** Spring ×0.8, Summer ×1.2, Autumn ×0.6, Winter ×0.2

**Water (per turn):**
```
Water = RootZones × SeasonFactor × DroughtModifier
```
- **Seasonal:** Spring ×1.0, Summer ×0.6, Autumn ×0.8, Winter ×0.4
- **Drought:** ×0.3 during drought events

**Nutrients (per turn):**
```
Nutrients = RootZones + (0.2 × AlliedRootZones)
```
- Includes 20% of allied trees' nutrient income via fungal network

**Stressors:** Disease (-20% all), drought, pests (direct damage)

## Species

Current focus: **fruiting trees only**. Non-fruiting trees like oak and redwood should return later with distinct reproduction systems.

### Plum
- Fast-growing and prolific
- Soft fruit, high reproduction potential
- Moderate drought resilience
- Pollinators: bumblebees, mason bees, hoverflies

### Peach
- Tender but productive
- Benefits from careful defense of fruit
- Pollinators: honeybees, bumblebees, butterflies

### Apricot
- Early-blooming and frost-sensitive
- Can reproduce quickly if spring goes well
- Pollinators: mason bees, honeybees, beetles

### Pear
- Slower, steadier, more durable wood
- Better drought tolerance through sturdier structure
- Pollinators: hoverflies, honeybees, solitary bees

### Citrus
- Water-hungry but flavorful
- Fragrant blossoms and vulnerable fruit
- Pollinators: honeybees, small native bees, hoverflies

### Cherry
- Graceful, showy blossoms
- Fruit attracts birds strongly
- Pollinators: bumblebees, mason bees, butterflies

Neighbor tree species are randomized from these fruiting trees at game start.

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
- **Ally in trouble:** Contextual events ask whether to help an ally tree with chemistry or support
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

- **Establish:** Only available after enough root growth
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
- On death, pick one viable offspring to continue as
- Other offspring become AI-controlled allies

**Game End:**
- When original tree AND all offspring die (any cause: lack of resources, fire, disease, etc.)
- Mode: Endless survival with high score tracking

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

## Future Ideas

- More species (Birch, Pine, Maple, etc.)
- More events (flood, frost, beaver attack)
- Seasonal animations (leaves falling, snow)
- Sound design (wind, rain, birds)
- Achievements/leaderboards
- Tutorial mode with botany facts
