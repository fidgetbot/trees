# Trees - Game Specification

A browser-based game where you play as a tree, balancing growth, reproduction, and survival in a competitive forest ecosystem.

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

### Major Events (1 per season, guaranteed)
- **Fire:** Rare, catastrophic, species-dependent survival
- **Drought:** Water reduction for multiple turns
- **Insect Swarm:** Leaf damage, potentially spreading

### Minor Events (random, frequent, small effects)
- **Beneficial Pollinators:** Bonus resources if flowers present
- **Animal Nitrogen:** Nutrient boost from animal waste
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
