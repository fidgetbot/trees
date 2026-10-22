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
- **Resolution:** responsive viewport-sized Canvas with device-pixel scaling
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
- **4 turns per season**
- **4 seasons per year**
- **16 turns per year**

A typical run is about:
- surviving early fragility
- building enough structure to keep growing
- reaching reproduction
- enduring major threats
- either dying or stabilizing into an Ancient lineage

## Core Systems

### Life Stages

Trees progress automatically when their stage requirements are met. Growth is not an action; it is a consequence of development and survival.

| Stage | Requirements | Unlocks | Vulnerabilities |
|-------|--------------|---------|-----------------|
| **Seed** | — | Basic growth only | All threats fatal |
| **Sprout** | After first action (grow roots) | First leaves, basic photosynthesis | Drought, herbivory |
| **Seedling** | 1 season + 2 root zones + 2 leaf growths | Root extension, fungal connections, height growth, directional shading, then trunk bracing; ally actions appear only after the first alliance | Aphids, browsing animals |
| **Sapling** | 4 seasons + survive 1 major event | Branch growth immediately; taproot, canopy, and rhizosphere emerge gradually across the first five Sapling seasons | Wind, competition |
| **Young Tree** | 2 years + 2 branches | Flowers immediately; thorns and toxic foliage emerge over the next two seasons | Lightning, disease, first human surveys |
| **Mature Tree** | 3 years + first fruit | Mass flowering immediately; offspring nurture, grove shelter, and root dominion emerge across the first three Mature Tree seasons | Fire, beetle swarms, ally betrayal, logging pressure |
| **Ancient** | 3 years + survive 2 major events + 1 allied or child tree | Long-term resilience and protected-grove endgame | Repeated human attention |

Current score thresholds in implementation:
- Mature Tree: 3300
- Ancient: 10200

#### Growth nudges

When the player is close to growth, the game can surface flavor nudges indicating what is still missing. These are presentation cues, not separate mechanics.

### Resources

Resources persist between turns and represent stored biological capital. Storage is finite and grows through biological investment rather than allowing unlimited late-game stockpiles: trunk and branches expand stored-energy capacity, trunk/roots/taproots expand water capacity, and roots/rhizosphere enrichment expand nutrient capacity. Collection beyond capacity returns to the grove and is reported in the gathering summary.

#### Sunlight
Generated primarily from leaves and canopy exposure, modified by season and competition. Saplings and larger trees spend a portion of stored energy on respiration each turn; winter dormancy reduces that demand.

#### Water
Generated from trunk storage, roots, taproot depth, and connected allies, modified by season and drought pressure. An ordinary root improves water storage and nutrient gathering; a taproot adds an ordinary root zone plus extra deep-water and nutrient access. Established crowns also spend water through transpiration, especially in Summer, while dormancy sharply reduces that demand.

#### Nutrients
Generated from roots, taproots, fungal/allied support, and soil quality, reduced by tissue upkeep and adverse conditions. Directional shading also claims one nutrient per turn from the contested soil beneath the shaded neighbor.

The economy is designed to keep every resource strategically relevant without making a well-managed tree die solely because one reserve briefly reaches zero. A shortage restricts affordable actions and triggers escalating, stage-aware guidance; it does not directly damage health. Later-stage upkeep is distributed across sunlight, water, and nutrients rather than falling almost entirely on nutrients.

Enrich Rhizosphere is a repeatable shared-soil investment. Each use permanently adds 0.5 to the player's nutrient uptake, expands nutrient storage, and gives allies connected at the time a permanent growth bonus, support credit, and greater warmth toward the player.

Leaves, canopy spread, roots, and taproots provide full gathering value for their early investments, then diminishing marginal returns as those structures become extensive. This preserves meaningful growth while preventing very large crowns and root systems from producing effectively unlimited resources.

Season directly modifies gathering: Spring produces 100% normal sunlight and 100% water, Summer 120% sunlight and 60% water, Autumn 60% sunlight and 80% water, and Winter 20% sunlight and 40% water. Nutrients have no direct seasonal multiplier. A compact expandable guide beneath Resources exposes these values and highlights the current season. A seed that ends its first turn before extending a root gathers nothing that night and receives a botanical prompt to begin growing. Repeated gathering of one or fewer units of a resource produces a gentle structural-growth suggestion after three turns and a stronger warning after six.

### Action Economy

- **Base actions per turn:** 3
- High gathering yields award one additional action per complete five resources gathered, capped at three bonus actions and six total actions per turn; one authoritative award sets both the gathering summary and the overall action tally, and that exact award is committed again when the gathering sheet hands control to the playable turn
- Actions spend combinations of sunlight, water, and nutrients
- Multi-step actions remain pending until the player confirms a final target or investment; backing out, declining confirmation, or losing every valid target spends no resources and no action
- Costs scale upward by life stage so later growth and defense decisions remain meaningful. Mature and Ancient costs shift modestly toward sunlight and water and away from nutrients, turning late-game surplus into useful growth rather than deepening a single nutrient bottleneck
- If the player cannot afford any currently available action, the browser UI keeps the end-turn path available instead of auto-advancing immediately
- When a chemical-defense threat appears and the player cannot afford the response, the UI now presents a single acknowledgement button that explicitly shows the missing resources instead of offering a misleading unusable defend option

Growth actions are intentionally differentiated:
- **Grow Leaf** is the cheapest direct sunlight-increase action and adds one leaf per use
- **Grow Branch** adds structure and a larger burst of new foliage, making it a stronger but pricier way to improve future sunlight collection
- **Extend Root** improves both water storage and nutrient gathering, while **Deepen Taproot** adds a root zone plus additional deep water, nutrients, health, and drought resilience

Action categories currently include:
- growth and structure
- defense and resilience
- reproduction
- diplomacy and rivalry
- advanced late-game sinks

Late-game defensive actions include repeatable permanent investments in **Thorns** and **Toxic Leaves**. Every layer adds general defense and stacks against ordinary browsing pressure, fruit threats, conflict, and human encounters. Either type can turn Hungry Browsers away without another resource payment. During an active human encounter the player may also sacrifice a branch, grow emergency thorns as a lasting defense, release temporary irritating leaf oils, or draw realistic physiological support through an allied fungal network. Network support represents shared water/minerals and primed resin chemistry, never fantastical tree movement.

Directional shade also affects the player's own nearby offspring on that side. The target chooser warns before commitment, newly sprouted children caught beneath an existing lean are called out in the Spring result, their map art darkens, and their seasonal growth slows until the player shades the other direction or the arrangement ends.

Adjacent rival and hostile trees exert persistent underground competition even when they are too short to shade the player. Rivals reduce nutrient gathering; hostile trees also reduce water gathering. These losses appear as red gathering factors, and shorter contested neighbors remain eligible to initiate root-zone encounters rather than becoming harmless simply because the player is taller.

Current browser HUD behavior:
- species summaries focus on the description and functional gameplay bonus, omitting the flavor-only pollinator list and the redundant starting-edge line
- **Grove Mode is a single-screen scene**, sized to the actual viewport at device-pixel resolution. A translucent warm-paper selection dock floats above its lower edge on phone and desktop; ordinary selection, actions, and ending a turn require no page scrolling. Longer content scrolls only inside modal sheets.
- Year/season and resource/health totals appear once in top capsules. The Year/Season capsule includes a season-colored pie and explicit “Turn N of 4” copy, advancing in quarters to full across the four turns of each season. Tapping resources opens the details sheet. The selected subject is named once in the dock; the player has no duplicate over-scene label.
- Canvas objects are directly selectable. Player, persistent neighbors, living offspring, event wildlife, and active human encounters expose stable typed hit targets. A subtle ground halo identifies the selection. The keyboard-accessible Focus selector also reaches off-screen subjects; selecting a subject frames it, with a short focus transition that respects reduced-motion preferences.
- the player-tree command surface presents every currently usable action as a mini-card in one horizontally scrollable carousel. At most two complete cards and a clipped third are visible, making the continuation discoverable without crowding the dock. Cards retain their relative order and remembered scroll position throughout the run, support touch, trackpad, a persistent draggable scrollbar, arrow-key navigation, and direct mouse click-drag scrolling; a drag never activates the card beneath it. The carousel does not add an instructional label or increase the dock height as more actions unlock. Other selected objects still show only actions relevant to that exact subject. Selecting a neighbor retains its persistent state index; selecting an offspring routes nurture directly to that child ID; selecting wildlife or people surfaces only preparations that concern that encounter. The player tree remains the fallback whenever a selected object disappears
- **Future Actions** opens the unavailable and future action catalog in a modal sheet with an always-accessible Close control and native Escape/focus containment. Every usable player action remains directly reachable from the carousel, while the sheet explains unmet and future requirements.
- **Info** opens a details sheet with selected-object context and clearly identified player-tree health, species, growth requirements, statistics, seasonal guidance, and history.
- The dock shows a subject heading, the horizontally scrollable usable-action carousel with exact costs, an action count, Future Actions, and a secondary but always-reachable End turn control. Its established compact geometry is shared across viewport sizes. All interface text—including small labels, metadata, costs, overlays, dialogs, detail sheets, and Canvas tree tags—uses a 14 px minimum, while tablet and desktop viewports may enlarge it without proportionally enlarging their containers or controls. Empty selections are not padded with irrelevant actions. The catalog separates unavailable-at-this-stage and future actions.
- fractional species growth rates are rounded to one decimal place in the Next Growth progress display, without changing the exact underlying stage timer
- each life-stage transition announces every newly unlocked real action with a complete, natural sentence explaining what the action lets the player do, and records the same unlock in the log; season-locked actions wait until the first season in which they can actually be used, so Mass Flowering is first introduced in Spring
- capabilities are intentionally staggered instead of arriving in large stage-transition bundles: Seedling introduces Grow Taller and Shade Neighbor together, then trunk bracing one season later; Request Help and Offer Aid appear only when the player forms a first alliance. Sapling discoveries continue for five seasons, Young Tree discoveries for two seasons, and Mature Tree discoveries for three seasons; each delayed action uses the normal unlock announcement when it becomes available
- Closing a progressive-action unlock announcement settles the currently active subject onto its canonical camera after the underlying action completes. This is required when the first alliance adds ally actions and resizes the phone dock: the grove must remain visible even if a prior camera transition was interrupted or its selected object became stale.
- The normal camera frames a prominent species-tinted seed and its radicle against softly graded soil with sparse small pebbles. A quiet row of hedges sits at the soil horizon in shared world scale: the Seed camera is surrounded by hedge foliage, while a mature trunk rises far above the same low band. The repeating painted hedge changes from light spring growth to deep summer green, muted autumn color, and snow-covered bare winter branches. Its source colors are constrained to 40% gray or lighter, then composited translucently, so the foreground tree remains clearly dominant. Runtime sampling trims the source's transparent edge gutters, preserves its aspect ratio, and gives adjacent mirrored tiles exact shared pixel boundaries. The painted baseline extends slightly behind the soil, which is rendered over that hidden overscan; this closes the sky gap without exposing hedge artwork underground. Framing uses both viewport dimensions and unobscured space above the dock; later stages and selected neighboring trees use shared world scale with subject-appropriate camera zoom.
- every fruiting species has a dedicated transparent painted structure for Seed, rooted Seed, Sprout, Seedling, Sapling, Young Tree, Mature Tree, and Ancient presentation. These assets preserve a continuous natural root-flare-to-trunk silhouette instead of joining a decorative root base to a separate narrow stem. The stage painting is the single authority for major roots and branch scaffolds: broad procedural ribbons never duplicate that anatomy. Root and branch investments made within the current stage add small persistent species-painted terminal modules beneath the base specimen; juvenile roots visibly progress from a first radicle through lateral forks to a compact fan, while terminal shoots remain woody in winter. Their 650 ms reveal ends in the same persistent geometry, and the next stage painting absorbs accumulated modules. Branch, trunk, canopy, and height investments still expand the painted geometry while leaf count controls separately painted species foliage modules. Player, neighbor, and offspring foliage all anchor against opaque tissue in the exact painted structure they use, and each supporting twig terminates inside its foliage cluster rather than leaving detached crowns. Blossoms and fruit reuse those exact foliage attachment points and are layered over the painted canopy, never positioned by a separate procedural crown. Winter exposes the bare painted structure. Living plants have no procedural polygon fallback: structure, foliage, blossom, and fruit modules wait for their painted assets and each successful lazy load redraws independently without suppressing other trees. During the first-root transition, the already-loaded Seed painting remains visible until the rooted-Seed painting finishes decoding, so growth announcements never erase the player from the grove. A transient structure-image failure receives one delayed cache-bypassing retry, so an unrooted Seed can recover without repeatedly decoding a failed cached image or waiting for the player to change stages
- Root investments add persistent painted lateral networks attached to opaque pixels in the current stage specimen. Sprout and Seedling use a pale ivory, fine-root family; Sapling through Ancient use a thinner reddish-brown woody family with lighter growing tips. Each new network begins narrower than its parent root, grows outward from the concealed join over 900 ms, and remains after the action. The first root is already represented by the rooted-seed painting; subsequent ordinary roots and taproots add visible networks. The former whole-specimen root deformation and transient soil marks are retired.
- Root development is derived from cumulative root and taproot investment rather than the current stage's entry baseline. A stage transition replaces the major root painting but carries the same development level into stage-appropriate extension artwork, preserving or increasing visible spread, depth, and substantial root mass without retaining every individual old root. Up to eight distinct painted networks remain individually legible; later investment continues to expand the measured root envelope. Growth within a stage keeps the camera fixed. Additional juvenile leaves attach their own painted petiole directly to the stem anchor, without an offset and redundant procedural connector. Dormant juvenile extraction preserves the connected central shoot and terminal bud while trimming leaf-petiole remnants that would otherwise appear as detached shards in Winter.
- Focused-tree framing derives its safe rectangle from the live minimap and action/stat card. Portrait layouts reserve the vertical space above the bottom dock; short landscape layouts reserve the horizontal space left of the side dock, so an overlapping card cannot collapse the usable scene to a narrow strip or hide the selected tree. The camera measures the selected tree's actual painted pixels on a transparent pass, but scale follows a monotonic life-stage band rather than normalizing every specimen to fill the frame: Seed through Ancient respectively occupy at most 24%, 34%, 46%, 60%, 72%, 84%, and 92% of the limiting safe dimension. Measured bounds act as the crop-prevention constraint, preserving a readable progression in relative biological scale while keeping the complete canopy and deformed roots inside a small margin. Switching trees uses one unified motion: pan, absolute world zoom, and soil line interpolate together under quintic smootherstep acceleration and deceleration. Duration follows the trees' separation across the grove, with a smaller allowance for a large scale change and a bounded 450–950 ms range, so nearby trees move faster than edge-to-edge selections. The full grove remains visible during travel and a neighbor or offspring isolates only after arrival. Initial load and reduced-motion mode use final framing immediately. Every user-directed tree selection, including return to the player tree, establishes transition state before its first animation frame so layout or artwork refits retarget the live motion rather than snapping to the endpoint. Camera results are valid only for the target, stage, species, and viewport that requested them; target/stage/layout changes cancel stale animation, asset-load refits ignore obsolete state, and a new selection continues from the currently displayed transition view. Invalid measurements fall back to the canonical camera. Growth within a stage does not trigger compensating zoom. The isolated subject is exempt from ordinary off-screen grove culling so its artwork can load or retry even after a stale camera estimate. The minimap remains available for switching subjects.
- Comparison-camera translation is solved from the selected trunk's screen-space anchor at each frame's absolute zoom. The anchor moves monotonically between its displayed starting position and final framed position, including off-center left/right neighbors. Independently blending screen offsets and zoom is prohibited because their combined projection can overshoot, leave the viewport, and bounce back even when zoom itself is monotonic. The final animation frame and canonical camera must agree.
- after the first root extends but before the first leaf grows, the young player remains visibly a seed with one small radicle emerging below it; the stem and leaves do not appear early. This leafless Sprout occupies about 26% of the safe scene dimension—slightly above the Seed baseline and below the established Sprout and Seedling bands. Its scale is normalized against each species' own two-leaf Sprout geometry rather than using one universal multiplier, so differently proportioned rooted-seed paintings retain a consistent progression. The root collar stays fixed at the soil line.
- Sprout and Seedling foliage uses eighteen dedicated juvenile watercolor specimens (three per species): first leaves, a second unfolding pair, and a small juvenile plant. The first leaf action reveals a soft green shoot with an intact growing tip and residual seed, never a blunt woody stem or miniature adult branch. Selection follows leaf actions, independently of root investment; later leaves use a juvenile leaf cutout and connected petiole. Their attachment points are resolved against the foliage-free shoot layer, so overlapping leaves never become support surfaces for newer leaves. The pictured growth is not double-counted. Each specimen has a reviewed root-collar anchor and above-ground height; same-stage camera framing is stable, including complete leaf loss. All three images preload from the seed, and pending images retain an available earlier specimen. Seasonal layers retain the exact painted shoot/bud/seed/roots while hiding foliage in winter or after total leaf loss; autumn filters affect foliage only. The foliage/stem separation pass uses one shared module instance and a phone-safe 384 px working height, avoiding duplicate full-resolution pixel buffers when the second-leaf painting is first revealed. Growth-chapter portraits use the matching juvenile image. Masters, prompt specifications, and runtime hashes are preserved.
- Grow Taller and Shade Neighbor unlock immediately upon reaching Seedling. Grow Taller lengthens the trunk, provides one additional point of sunlight gathering, and raises the player's competitive canopy height; each unbraced level adds one storm damage, at most three levels may remain unbraced, and Fortify Bark unlocks one season later to brace one level while also improving trunk strength, health, water storage, and resistance to drought, storms, insects, fire, and woodpeckers
- A full-width fruit minimap forms the second control row above the grove. It preserves each tree's left-to-right order, spaces the markers evenly with the player centered, and uses a painted fruit specimen for every playable species. Each fruit is a keyboard-accessible target that performs the scale-comparison pan and then fits that tree. Selecting a neighbor replaces the action surface with read-only Relationship and Current effects cards: they reuse the action cards' radius, spacing, strong title hierarchy, and regular-weight body copy, while retaining a muted green informational palette and no hover or click affordance. Action count, Future Actions, and End turn remain hidden until the player returns to their own tree. That card provides the same comparison transition back to the player's tree. Tapping empty scene space also returns to the player.
- Action count stays visible beside the dock controls rather than inside a lengthy end-turn label.
- End turn stays outside the action carousel and requirements catalog; the fixed dock remains reachable at small phone sizes and in landscape.
- a compact live resource-and-health strip sits directly beneath the Actions heading; action cards show only their required amounts with a small `cost` label, while shortages receive a stronger warning treatment, avoiding repeated `cost / yours` figures now that current totals remain visible beside the list
- the stats groups follow the action list without a redundant top-level **Status** heading
- the status panel can be minimized with its top-right corner control and restored with a compact chip; it starts expanded at the beginning of a run
- health is repeated prominently in the live Actions strip as well as under Resources; allies remain under Resources instead of a separate Ecology section
- Offer Aid unlocks with the first alliance and is usable only while a living ally has less than full health; targeting is also validated again at resolution time so healthy trees and non-allies cannot slip through if UI state gets out of sync
- Request Help also unlocks with the first alliance, always costs exactly one nutrient, and asks the player to choose health, water, or nutrients; every valid transfer provides at least two units, and the ally's response and the awarded resource must match that choice exactly. Health cannot be requested when fewer than two health points are missing. The selected ally decides a variable amount according to its life stage, health, crises, request history, and remembered reciprocity. Repeated requests reduce relationship warmth, while previously withheld aid is explicitly remembered and reduces later help. Backing out of the initial request chooser returns silently with no resources or action spent. Offspring count toward lineage and grove-protection goals but do not masquerade as connected allies in diplomacy or resource sharing
- diplomacy choices retain each neighbor's persistent state index after filtering; action results, relationship text, map labels, and fungal root links must all resolve to that same neighbor and map slot
- fungal connection lines remain in full grove coordinates while focused specimen art is isolated, so their clipped dotted path stays visible when focused on the ally endpoint or on a tree between the player and that ally—not only during camera movement
- trees whose ground anchors are outside the scene viewport are not painted, preventing disconnected canopy fragments from distant grove slots; fauna and human encounter art use a responsive, camera-independent display scale so they do not shrink or grow while focus moves between life stages. Grounded fauna retain stable grove coordinates through camera pan and zoom instead of following the selected tree or sticking to a viewport edge
- pollination event text now capitalizes the named visitor and uses singular/plural grammar correctly for “flower was/were pollinated”
- the log now captures more of the turn-to-turn simulation state, including resource income, action outcomes, pollination/event text, offspring establishment, and narrative popups such as A Quiet Urge; aggregate resource/event screens are excluded to avoid duplicating their already-recorded details
- all visible trees on the map use compact, collision-aware tags: the player keeps species and growth stage on the primary line with “(You)” beneath it, while neighbors place species above a shorter stage-and-relationship line; tags move into separate rows when their measured text widths would overlap, and type scales up at narrow display widths for phone readability
- living allies and offspring include their current and maximum health in their green map tag, updating from the same persistent health state used by crises and aid; non-allied neighbors omit health to keep the grove readable
- resident grove trees are spaced closely enough that adjacent crowns can physically overlap; player and neighbor tree scale is derived from the same life-stage and structure rules so the map's apparent height agrees with canopy competition
- Shade Neighbor is limited to one immediate left/right target at a time and establishes a persistent visible canopy arrangement rather than a one-time payout; choosing another target releases the first. It succeeds only when the player's effective height is strictly greater than the target's. The chooser keeps each tree's name as the primary label, describes shorter trees as shadeable, and leaves taller/equal trees visibly disabled with “You'd need to grow taller first.” On success the player's trunk and crown bend strongly toward the target, while a tapered dappled shadow stays entirely below the soil horizon and reaches the target's base; the shaded foliage, trunk, and exposed roots become conspicuously darker. This directional competition shadow is the only cast shadow in the grove and scales with the current map zoom; no tree casts a shadow while no shading relationship is active. The player gains +2 sunlight and +1 nutrient each turn by exploiting the contested canopy and soil, while the target receives less light and grows at 60% speed.
- canopy pressure is rechecked whenever either tree grows: an equal-height tree can no longer be shaded, a rival that overtops the player reverses the arrangement and begins crowding, and a player who catches up escapes incoming shade; the player receives a clear notice naming Grow Taller and diplomacy as responses
- beginning at Seedling, each event phase has a small chance for an adjacent neutral or rival tree to turn hostile and attempt to lean into the player's canopy; it establishes persistent crowding only when it is strictly taller, while a shorter hostile tree merely warns of the attempt; successful diplomacy returns it to Neutral and clears canopy pressure
- connected living neighbor allies contribute both water and nutrients each turn and strengthen a Mycorrhizal Bloom; their contribution scales with their life stage, so a large allied tree shares more than a seed or sapling; offspring do not receive or grant these ally-only bonuses; the gathering summary compares each gain against a neutral-grove baseline and names positive allied/canopy effects or negative crowding effects
- the gathering summary presents its arithmetic as compact color-coded factors: structural baselines and current storage/capacity in gray, bonuses such as canopy, height, taproot, allies, soil, and dormancy in green, and penalties such as poor seasons, crowding, drought, disease, respiration, transpiration, tissue upkeep, and overflow in red. Leaf exposure explicitly reports the 8-point penalty for each trunk level below four and the 12-point penalty for each tree actively crowding the player
- the initial grove places the player and the immediately adjacent left/right neighbors at Seed stage; only the two outer trees begin established, allowing the three central trees to grow together
- pending human survey or cutting encounters remain visible on the Canvas as people at the player's trunk; survey encounters use the two approved serious watercolor surveyor sprites, while cutting encounters use the two approved serious logger/tool sprites (one felling axe, one traditional bow saw); both families use stable left/right placement and shared foot anchors, painted marks and accumulated cutting scars persist visually, and thorns and toxic foliage are reflected in the player tree's art. Animal placement follows the pose in each approved cutout: standing or sitting robins, squirrels, deer, rabbits, and beavers meet the ground plane; woodpeckers grip the trunk; only genuinely airborne pollinators float in open space. One authoritative per-species size family keeps large mammals visibly larger than beavers, small mammals, birds, and pollinators; the responsive size remains independent of camera focus, with deer and rabbit large enough to read proportionately beside a Seedling
- event-driven watercolor fauna complete the persistent grove scene for relevant event phases: woodpeckers cling to the trunk; beavers and browsing animals occupy the soil line and lower growth; robins and squirrels visit the fruiting canopy; each named pollinator family appears beside blossoms; and aphid, mite, or surface-crawler clusters occupy the affected canopy or soil zone. Every sprite is independently preloaded and a failed asset falls back by omission without suppressing the grove or other visitors
- Winter adds a seamless painted snow texture as a thin surface cap resting primarily above the soil horizon. Its irregular edge overlaps the horizon at both viewport edges, then feathers only slightly into the soil instead of becoming a deep cross-section or ending as a rectangular strip; snow, icicle melt, and rain remain part of precipitation messages, and heavy accumulation has a rare chance to break a branch on Sapling-or-larger trees. Grounded wildlife may naturally enter or leave the viewport as the camera reframes, but its ground contact remains fixed in the grove.

### Seasonal Constraints

Some actions are season-locked to reflect tree biology.

Current notable lock:
- flowering actions are **Spring-only**
- **Grow Leaf** is unavailable during Winter dormancy and returns in Spring; dormancy compensates by reducing sunlight, water, and nutrient upkeep during Winter

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
- root connection with variable outcomes, including rare immediate breakthroughs or sharp setbacks; young trees (Seed through Seedling) add 15 percentage points and established trees (Sapling through Young Tree) add a smaller 7-point advantage to the chance of a favorable response, while Mature and Ancient trees are the hardest but most immediately productive allies. Contacting a tree of the player's own species independently adds another 15 percentage points, and each favorable modifier gives a smaller increase to immediate breakthroughs alongside root development and Cherry's positive-relationship bonus. Friendly trees are also more likely than neutral trees to welcome contact and move toward allyship; each Friendly candidate says so briefly beneath its own name. The chooser groups candidates by age band, states each age risk/reward tradeoff once rather than repeating it on every tree, and gives each neighbor card its species' painted fruit specimen
- aid to injured allies after the first alliance
- requesting health, water, or nutrients from allies after the first alliance
- shading one immediately adjacent left/right tree starting alongside Grow Taller in the Seedling stage, including proactive aggression against neutral, friendly, or allied neighbors; canopy advantage/crowding persists in both rules and Canvas geometry
- confirmation warnings before attacking friendly or allied neighbors, since aggression immediately turns them into rivals
- proactive aggression is intentionally less rewarding on the first strike than pressing an existing rivalry, so hostile play is viable without making betrayal the dominant opener
- root domination starting in the mature stage, with direct resource theft from targeted neighbors and proactive escalation into rivalry
- ally crises and ally neglect consequences
- betrayal pressure in hostile or strained long-term relationships
- aid contributes directly to the recipient's growth and records whether the player began supporting it before maturity; this support history determines whether a large ally can help satisfy the protected-grove victory
- Offer Aid descriptions state this full strategic role: spending water/nutrients heals and grows an injured ally, strengthens the bond/favor history, and builds protection-goal support
- neighbor life state is tracked separately from relationship state: zero health means death, but the relationship at death is retained for history; dead trees cannot act, threaten, compete, contribute resources, qualify for protection, or appear in action targets. Their map art retains that species and life stage's approved painted root-and-branch structure under a muted deadwood treatment, becomes a low painted stump with an organic root flare after four turns, and is replaced three turns later by a random-species Seedling in the same grove slot. Dead-tree, stump, and human-encounter loading never exposes flat geometric or stick-figure placeholders

Neighbors are persistent actors, but they are still simplified relative to the player tree.

### Reproduction and Lineage

The current reproduction chain is:
- flowers
- pollinated flowers
- developing fruit
- seeds
- spring seed-fate resolution
- offspring pool / offspring trees

Established offspring are persistent lightweight tree records rather than only a count. Each child has its own species, growth score, health, nurture history, support history, and active crises. The Resources panel exposes a compact inspectable list of living children with life stage, health, progress toward the next stage, and nurture/aid counts. **Nurture Offspring** opens a child selector with those same measurements, supports the chosen child, and reports exact before/after growth and health instead of silently choosing a target or creating additional offspring. Children can ask directly for water or nutrients during aphid, drought, and blight crises using the same full/partial/withhold aid structure as allied neighbors; partial aid buys time, while an unresolved crisis continues to damage the child.

Pear's **Dependable fruit** species bonus reduces each developing fruit's chance of being lost to pests or human harvest by 20%. This modifies fruit retention rather than pollination, keeping Pear distinct from Citrus's pollinator-attraction bonus.

Player death always ends the current run. The normal interface is replaced by a full-screen ending with lifetime, cause of death, final score, a short nature quotation, and a Try Again control.

### Threats, Events, and Survival

Every ecological occurrence that affects the player is represented by one serializable **Incident** record. Major scheduling tiers remain internal for balance and stage progression, but do not create a separate player-facing presentation path. An incident has stable identity, subject, severity/priority, title, summary, artwork, effects, lifecycle state, response timing, deadline, data-only decision key, and outcome. Its lifecycle is `opened → awaiting response or ongoing → resolved or expired`.

Night Falls presents one ordered **Night Journal**. Each incident appears exactly once with artwork, title, concise prose, and effect chips. An immediate encounter that can be answered shows one “A response is available.” chip in its own row; the shared response button is the only additional response prompt, with no separate status label or queue-summary sentence. Ongoing, deadline, and expired incidents retain their distinct statuses. The former major-card/Forest Whispers split is removed. Stat-free ambient flavor observations are not generated. When no player response is available, warning context and unavoidable stat outcome are combined immediately in one illustrated journal row; only incidents with a real response or action window retain a later resolution step. Warning and outcome update the same incident identity; woodpeckers, beavers, and other cause/outcome pairs therefore never duplicate their illustration or journal entry.

Semantically distinct journal events use dedicated painted specimens rather than borrowing life-stage art. Forest Gift shows a small cluster of rabbit droppings, while Mycorrhizal Bloom shows feeder roots and their beneficial fungal network; the rooted-seed painting remains reserved for actual tree growth.

When an action-window incident reaches its deadline, its delayed consequence is acknowledged before the next gathering sheet. The outcome surface reuses the incident's title and artwork, places the original warning directly above what happened, and remains until the player continues; it never relies on a timed toast that can be obscured by the next modal.

Incidents use one of three response modes: `none` resolves automatically, `immediate` enters the shared Encounter Queue after the journal, and `action-window` remains in the grove through the documented action phase and deadline. The Encounter Queue handles multiple decisions sequentially on one reusable surface, reports progress, refreshes affordability immediately before display, and replaces choices with the result in place. Runtime state contains incident IDs and data only—never callbacks or resolver functions.

Current systems include:
- seasonal minor events
- major environmental threats filtered by explicit ecological seasons; season-named events such as Summer Drought, Autumn Storm, Winter Gale, and Late Frost cannot appear outside their matching season
- fruit-threat warning/response chains
- chemical-defense threat chains that resolve after an unanswered warning; the warning says only that the threat was not contained, and the subsequent consequence supplies the logical damage conclusion without redundantly forecasting an immediately following message
- damage tracking and death flavoring
- health warning thresholds as the tree approaches collapse
- a staged fungal-rumor narrative in which distant forests fall silent and logging pressure moves closer; every chapter is presented on its own card before the ordinary Night Journal, its felling chapters use a distinctly dark, ominous treatment, and the final protected-grove coda returns to the normal presentation
- closing Future Actions or the Grove notebook through any native-dialog dismissal path rebuilds canvas-derived tree layers from the retained decoded PNGs, refits the active subject, and redraws the map after dismissal, including when the viewport dimensions have not changed. Reselecting a tree, returning to a visible tab, and main-canvas context restoration also rebuild discarded layers; species-shared juvenile layers and deformed root/wood caches must not make a blank specimen self-sustaining. Gameplay state and growth attachments are preserved.
- human survey and cutting encounters whose probability rises with tree size, trunk/branch mass, repeated attention, and regional pressure
- delayed human threats that remain on the map for an action phase before resolution, giving time to invest in thorns, toxic foliage, or other defenses
- persistent threat messages use natural in-world conclusions that clearly say whether danger is gathering, easing, passed, or left damage behind; allied help clears an active chemical threat such as aphids in addition to restoring health
- immediate chemical, hostile-tree, ally, offspring, human, and conservation decisions use the same serialized response queue and refresh affordability from current resources immediately before display, so preceding outcomes cannot leave stale choices on screen
- action-window fruit threats and chemical threats deliberately left unresolved by the player persist as ongoing incidents until their deadline; their grove artwork is derived from incident state and disappears automatically on resolution
- all incidents have artwork through a reusable visual vocabulary: existing fauna/human/pathology specimens, treated weather/ecology specimens, or a target tree portrait composed with a shared condition specimen. Warning, response, and outcome reuse the same visual identity
- every Night Journal entry reports a real state change, actionable danger, ongoing threat, or resolved outcome; stat-free ambient flavor rolls are omitted
- cumulative cutting wounds; logging normally requires three unresolved deep cuts rather than a single unlucky instant-death roll

### Scoring, Victory, and Continuation

- Score updates continuously during play
- Reaching **Ancient** is a major milestone, not an automatic victory
- Victory requires two additional Mature-or-Ancient trees that the player materially helped: allied neighbors need a real history of aid, while children need repeated nurture investment
- Once the player and two supported companions qualify, conservation-minded humans inspect the grove and designate it as a protected ecosystem
- Runs may continue after victory
- Death ends the run and opens the full-screen game-over summary

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
- persistent, species-shaped Canvas trees with connected curved branches and tapered branching root systems; Seedlings use a slender single leader with sparse lateral leaves, Saplings open into a visible scaffold, Young Trees develop a crown, and Mature/Ancient trees gain progressively broader silhouettes; trunk continuations retain their parent width at joins before tapering smoothly into thinner limbs; all six playable fruit trees layer stable-seeded transparent botanical-watercolor variants for airy foliage, spring blossoms, and summer fruit while preserving gameplay-driven growth, autumn color, shading, and bare winter silhouettes; Peach, Apricot, Pear, Cherry, and Citrus use species-specific open-canopy scaffolds with tapered wood and attachment-aware fruit placement
- player growth is assembled from the approved stage specimen plus action-sized painted parts: root extensions and taproots use curved strips of the specimen's own paint texture, branches attach to opaque trunk tissue, and each leaf cluster has a persistent attachment. New branch foliage belongs to that branch; existing leaves never jump to a newer branch. Counts and attachment identities survive stage changes. Roots reveal over 900 ms with transient new-edge and soil-tip emphasis; other tissue reveals over 650 ms (all instant with reduced motion). The persistent endpoint is unchanged, and the within-stage camera stays steady rather than zooming away each gain. Winter suppresses foliage while retaining roots and branches.
- the compact top resource bar uses the same sunlight (sun), water (droplet), nutrients (sprout), and health (heart) glyphs as the detailed stat panel and corresponding action costs; score retains its star, and resource totals/behavior are unchanged
- isolated typography studies at `design-studies/whimsy/` preserve the current layout, cream backgrounds, and painted artwork while comparing Soft serif (Fraunces/Nunito), Gentle handwriting (Kalam/Nunito), and Light & rounded (Nunito with a Caveat footnote). Introduction, gathering, and growth previews reuse game styles/renderers with identical sample data and a pre-change-style comparison toggle. Gaea selected option 3, Light & rounded: production now uses Nunito typography, warm brown ink, clay primary buttons, and sentence-case small labels. The opening subtitle reads “Put down roots.” directly beneath the title, with no duplicate lower footnote. Fonts and licenses are self-hosted in `assets/fonts/`; the isolated `theme-light-rounded.css` leaves layout, artwork, game rules, and semantic resource/warning colors intact. The gallery retains the pre-change comparison
- scene selection is identified by the Focus control and contextual action dock, without an oval or halo drawn over the botanical artwork
- automatic life-stage progression
- botanical introduction and chapter dialogs share the grove's warm paper palette, approved clay controls, rounded Nunito headings, and existing painted species artwork; the introduction presents the assigned species and its exact gameplay bonus, while growth chapters show the new stage, unlocked actions, and seven-stage progression. Unlock cards begin directly with the unlocked action announcement, without a redundant “New possibilities” kicker. Every season transition pauses on a dedicated warm-paper card with its approved Spring, Summer, Autumn, or Winter branch specimen, a short biological transition, and the new gathering/dormancy conditions. The updated grove and Year/Season indicator are visible behind the card; acknowledgement occurs before Spring seed settlement, progressive unlock notices, or gathering. The scene and status refresh before a growth chapter opens. Growth retains its species/stage reference scale; only genuine safe-region overflow starts a minimal containment adjustment with the tissue reveal, so the completed plant remains visible without requiring another tap. Standard messages and choice dialogs wait for both the active growth reveal and its camera refit to finish, then hold the completed canvas frame unobscured for 1,000 ms before opening; background controls stay inert during that wait to prevent overlapping actions. Reduced-motion or non-animated updates open immediately, and dialog continuations keep their existing order. The seasonal Resources sheet shows resource gains, stored/capacity meters, overflow notices, and available actions on warm paper; per-resource disclosures retain the complete calculation and grove comparison without crowding the summary. Dialogs contain keyboard focus, keep background controls inert, and scroll internally on short viewports.
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
- nighttime chemical threats appear first as one compact illustrated status row. Unaffordable threats state only the missing resources and proceed directly to play while remaining on the tree; they do not open a redundant decision or outcome modal. Affordable threats open one focused response sheet, and the chosen result replaces that sheet's contents in place rather than opening a third surface
- fruit-threat warnings persist through a full action phase before resolution, and a resolved threat cannot be replaced by another warning in the same event phase
- wildfire records fire as its sole damage cause and can be fully resisted by sufficient bark/shelter protection
- escalating fungal rumors, visible human encounters, permanent human deterrence, cutting scars, and distinct branch/thorn/oil/fungal-support encounter responses
- ally crises and neglect consequences
- persistent individual offspring with growth, health, and nurture history
- full-screen game-over summary with lifetime, cause, score, quotation, and retry
- scoring, protected-ecosystem victory, and post-victory continuation
- headless seeded simulation for automated playtests and balance analysis

### Current simplifications / limitations

The current build still simplifies several systems:
- flowering is season-locked, but most other actions are still available year-round
- each playable fruit species has an approved painted botanical module kit with four foliage clusters, three blossom sprays, and three fruit clusters; stable tree-and-placement seeds retain each selection across redraws and seasons, while missing or failed individual assets fall back without suppressing the rest of a family
- living offspring persist individually for growth, nurture, map display, and victory qualification, but player death ends the run rather than transferring control
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
- the serializable Incident registry, legacy-state migration, event normalization, stable response queues, derived scene-art selection, and shared event/decision resolvers
- shared human-pressure and conservation rules, including fungal-rumor sequencing, offspring records, encounter decisions, cutting resolution, and protected-grove qualification
- diplomacy and survival helpers, including shared relationship-resolution plus normalized decision-object builders for connection, ally aid, ally help, and aggression, alongside the corresponding shared resolution logic and shared diplomacy-decision dispatch
- shared engine turn/state flow

### `ui/`
Browser-only rendering, modal presentation, HUD updates, and browser setup helpers.

Current responsibilities include:
- action panel rendering
- resource, Night Journal, Encounter Queue, and outcome bodies
- species selection UI
- a visible build number on both the opening species screen and the in-game map
- explicit source bounds for all six Seed and rooted-Seed sprites exclude neighboring sprite-sheet fragments without altering the painted masters; seed aspect ratios and connected radicles are preserved in both the Canvas scene and chapter portraits
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

### Growth framing

The player's normal camera scale is fitted from a species/stage reference specimen, excluding incremental roots, taproots, branches, foliage, and height/canopy investments. That stage occupancy is a starting size, not a growth ceiling. Ordinary growth and within-stage juvenile artwork changes retain scale and the root-collar/soil anchor. Complete grown tissue is measured separately: translate minimally when it reaches a safe viewport edge, and zoom out only when the full bounds cannot fit. Stage/viewport changes and focus restoration recompute the same baseline plus containment, so closing menus or late image loads cannot renormalize growth away.

### Turn handoff and recovery

Spring seed settlement reports its result once before advancing into gathering. Post-advance growth and ally warnings receive an explicit gathering continuation; dismissing them must never reroll Night Falls or retain the previous turn's action award. Only an unopened, unrooted Seed skips gathering. Established trees that lose all roots continue through normal gathering so surviving foliage can fund root recovery.

### Test scope

The Node suite protects rule outcomes, incident identity/response lifecycles, action transactions, selection/camera geometry, persistent growth attachments, and asset availability/loading recovery. Repeated loader cases share a small serial Image fixture with fresh module caches and guaranteed cleanup. Tests should assert behavior or data integrity, not source-code substrings, editorial wording, or copied configuration tables. Overlapping scenarios belong in one owning test where their distinct assertions can be preserved.

Node geometry and HTML-output checks do not establish browser layout, Canvas visibility, or dialog/camera handoff correctness. Those need focused browser checks when affected; balance simulations are a separate tool, not a compulsory gate for test-only or copy-only edits. See `tests/README.md` for commands and coverage boundaries.

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

### Illustrated encounter messages and gathering continuation

- Every Incident carries artwork. Fauna and human encounters reuse the same approved specimens used in the grove; pathology uses the pest/fungal family; weather, resource, reproduction, relationship, and ambient incidents use shared treated specimens. Neighbor and offspring incidents reuse the exact target tree portrait and may compose it with one condition specimen for drought, aphids, mites, blight, rot, or branch damage. The same artwork identity persists through warning, response, and resolution.
- Night Falls uses one field-journal hierarchy: season/year eyebrow, large title, moon-and-dark-branches specimen with an asymmetric, softly broken watercolor perimeter rather than a geometric vignette, quiet introductory prose, and one separated row per Incident. Lead priority preserves the drama of major threats; quiet styling preserves atmospheric observations. There is no Forest Whispers category and no major/minor rendering split. If decisions are queued, one “Respond to N encounters” continuation opens the shared Encounter Queue.
- The gathering sheet’s actions-available panel is its single continuation button. Its headline shows the base allowance, with earned high-yield actions listed separately as a bonus; its accessible label states the resulting total. The separate Continue button is hidden only on gathering; mouse, touch and keyboard activate the existing continuation exactly once without re-awarding resources.

### Feeding pests attached to tissue

- Surface crawlers feed against the painted root collar and shallow root/seed tissue, aphids attach to the stem, and mites attach to actual leaf paint (bark when leafless or dormant). Individual specimens are isolated in memory from the approved cluster images, with their feeding ends anchored to opaque tissue. They inherit the plant’s species geometry, scale, shade lean, pan and zoom; no detached pest-cluster billboard is drawn. Pests remain selectable, and no extra damage or action cost is invented by the illustration.
- Grove encounter artwork is derived exclusively from unresolved, scene-persistent Incidents. Successful defense, delayed resolution, aid, expiry, or target loss removes only that incident’s artwork; conserved or unaffordable threats remain visible until resolved, and unrelated wildlife is untouched.

- The action dock distinguishes the remaining action budget from usable moves. While moves are available, it reports “N actions remaining”; Future Actions remains available to explain locked and unaffordable actions. If no action is currently legal or affordable, End turn becomes the prominent next step and the explanatory sentence above it gives the reason. Empty object-specific lists instead direct the player to the player tree's available moves. Zero-action states still allow End turn.

- Encounter dialogs omit the generic “Life in the grove” kicker; chapter and gathering dialogs may retain a specific contextual kicker. Completed actions rely on their visible animation, specific outcome dialog, and history entry rather than a generic “Action succeeded” toast.

- Info is a restrained botanical notebook: the painted species specimen and exact species description/bonus lead the sheet, followed by score, growth requirements, statistics, seasons, offspring and log. Redundant selection/“Your tree” labels and inspector/group toggle headings are removed. All Info sections are always open, with one internal sheet scrollbar; the action catalog keeps its separate behavior.
- Every action card writes its concise verb-first effect beneath the action name; carousel descriptions use regular weight beneath the heavier action title, while the phone dock, available catalog, temporarily unavailable list, and future-action list all use the same authoritative description without hover or disclosure controls.

- The notebook is opened by a book-icon button between the year/season and resource bar (or by tapping the resource bar), not from the action/End turn dock. Top controls shrink within narrow viewports without hiding the notebook.
