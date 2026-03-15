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
| **Produce flower** | Spring only | Trees flower in spring |
| **Produce seed/fruit** | Summer (fruit), Autumn (seeds) | Fruit ripens in summer, seeds drop in autumn |
| **All other actions** | All seasons | Year-round growth possible |

**UI:** Off-season actions appear grayed out with tooltip explaining the seasonal restriction.

- **Base Actions:** 3 per turn
- **Bonus Actions:** +1 for every 5 total resources collected
- **Action Costs:**

| Action | Sunlight | Water | Nutrients | Notes |
|--------|----------|-------|-----------|-------|
| Grow branch | 2 | 1 | 1 | Adds leaf cluster |
| Extend root | 1 | 0 | 0 | Adds root zone |
| Grow leaves | 1 | 1 | 1 | On existing branch |
| Produce flower | 3 | 2 | 2 | Prerequisite for fruit |
| Produce seed/fruit | 4 | 2 | 2 | Requires flower first |
| Thicken trunk | 5 | 2 | 2 | Increases strength |
| Chemical defense | 3 | 1 | 2 | Allelopathy/toxins |
| Repair damage | 2-5 | 1-3 | 1-3 | Scales with severity |

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

### Redwood
- **Starting network:** Yes (other redwoods nearby)
- **Network behavior:** Clonal, automatic allies
- **Starting branches:** 2
- **Starting roots:** 3
- **Growth rate:** Slow (×0.7)
- **Max height:** Very high
- **Lifespan:** 500+ years
- **Fire resistance:** High (thick bark, serotiny)
- **Reproduction:** Late, few seeds (fire-dependent)
- **Special:** Serotiny (seeds need fire to germinate)

### Plum
- **Starting network:** No
- **Network behavior:** Family networks (offspring connect automatically)
- **Starting branches:** 1
- **Starting roots:** 2
- **Growth rate:** Fast (×1.3)
- **Max height:** Medium
- **Lifespan:** 30-50 years
- **Fire resistance:** Low
- **Reproduction:** Early, many seeds
- **Special:** Animal-dispersed fruits, high viability

### Oak
- **Starting network:** No
- **Network behavior:** Must persuade others
- **Starting branches:** 1
- **Starting roots:** 2
- **Growth rate:** Medium (×1.0)
- **Max height:** High
- **Lifespan:** 200-300 years
- **Fire resistance:** Medium
- **Reproduction:** Mid, mast years (variable)
- **Special:** Allelopathy (chemical warfare)

**Oak Network Persuasion:**
- 40%: Accept connection
- 40%: Ignore (can retry)
- 20%: Reject and become hostile

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
| **Send resources** | Variable | +10 relationship, ally gains resources |
| **Chemical help** | 3/1/2 | +20 relationship, ally gains defense |
| **Shade competitor** | Passive | -5 relationship per turn, reduces their sunlight |
| **Release allelopathy** | 4/2/2 | -20 relationship, damages rival's roots |

### Diplomatic Events
- **Ally under attack:** "The Plum faces aphids! Help with chemicals?" (+20 relation, -3/1/2 cost)
- **Rival aggression:** "The Oak is shading your leaves!" (-10% sunlight, choose: endure, grow taller, or chemical counter)
- **Competition warning:** "The Redwood is growing fast — 30% of your leaves now shaded"

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

- **Establish:** Grow roots until they touch another tree's roots
- **Shared:** Resources + action plans (what they're planning)
- **Mutual Aid:** Can send resources to help allies (disease, drought)
- **Sever:** Free, but roll for hostility (former ally may become hostile)

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
- **Rain:** Extra water (consecutive = root rot risk)
- **Lightning/Wind:** Branch damage
- **(More from real forest ecology)**

## Win/Loss & Succession

**Offspring Flow:**
1. Produce flower (costs resources)
2. Produce seed/fruit (costs resources, requires flower)
3. **Spring:** All seeds roll for viability
4. Viable seeds = offspring options for succession

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

- 3 species (Redwood, Plum, Oak)
- Basic geometric visuals (silhouettes)
- Core resource/action/event loop
- Fungal network (connect, share, sever)
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
