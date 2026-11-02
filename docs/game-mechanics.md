# Implemented mechanics and remaining depth

This matrix describes the actual local game, not a claim of RimWorld parity. `Playable` means the behavior is connected through the authoritative simulation and UI. `Simplified` identifies deliberate limits; `Planned` means absent.

| System | Current implementation | Limits |
| --- | --- | --- |
| Shared world | Playable:8 claim sites, ownership,3 supply-origin variants, separate browser captains | Small invited/local world; public accounts and large populations absent |
| Colonist labor | Playable: priorities, reachable jobs, reservations, construction, salvage, hauling, interruption recovery | No full hourly schedule, work-area zones, equipment loadouts or multi-stage delivery jobs |
| Storage | Playable: finite stockpile capacity, retained cargo, capacity-expansion recovery, trade intake checks | Aggregate item counts; no individual item quality, temperature or container restrictions |
| Production | Playable: staffed bills, quantities, pause/cancel, powered stations,4 recipes | Ingredients consumed from shared stock on completion; no station-input hauling or quality rolls |
| Sustainable resources | Playable: labor-water gardens, rations, medicine, biofuel, components | Small production graph; no livestock/fishing/hunting or diverse food/crop ecology |
| Electricity | Playable: fuel generators, priority pump load, batteries, powered research/production | Aggregate capacity; no cables, switches, per-circuit failure or selectable device priorities |
| Tides and flooding | Playable: periodic tide ingress, storms, pumps, room protection, machinery damage, exposure wounds, food spoilage | Colony-level flood metric; visual pooling is illustrative, not per-cell water physics |
| Water and oxygen | Playable: cistern collection/capacity, hydration consumption, Deep-site atmosphere tied to power | No plumbing/pressure simulation or separate room air volumes |
| Rooms | Playable: true enclosed-space detection using walls and hatches | No roof construction, individual room temperature, beauty or furniture rules |
| Medical care | Playable: injury severity, infection, downing, physical tending, medicine consumption and research bonus | Field care; no organs/limbs, surgery, prostheses, childbirth, or permanent expedition death |
| Needs and mood | Playable: nutrition, rest, hydration, morale, stress and recovery | Needs are a compact model; no recreation variety, clothing comfort or full ideology system |
| Personalities | Playable: deterministic traits, learned skill progress, memories, social relationship scores | No family trees, romance, custom backstories or rich conversations |
| Research | Playable:6 projects, prerequisites, powered staffed lab work, recipe and exploration benefits | Small technology tree; not a civilization-scale progression system |
| Story direction | Simplified: conditions-based bulletins/social memories and one physical emergency cache per colony | No extensive event catalog, quest choices, faction diplomacy events or sophisticated threat budget |
| Diplomacy | Playable: bilateral alliances, revocation, protected separate inventories, allied-fire rules | No permissioned home visits, wars/sieges, NPC faction standings or treaties |
| Trading | Playable: escrow, exact offers, cancellation/expiry, atomic settlement and retry protection | Direct inventory exchange; no merchant economy, physical cargo convoys, contracts or price simulation |
| Expedition travel | Playable: provision costs, crew departure, timed travel, remote activity, withdrawal and return | Three fixed locations; no navigation routes, interception, vehicles, storms at sea or generated regions |
| Tactical combat | Playable:32×32 encounters, obstacles, pathfinding, line of sight, cover, cooldowns, ranged/claw weapons, PvE, explicit PvP and retaliation | Small weapon/AI set; no grenades, fire, suppression, ammunition logistics or large battles |
| Defeat and recovery | Playable: downed crew, emergency extraction, cargo losses, wounds and overflowing dock crates | Recoverable expedition crews; home raiding and permanent PvP loss disabled |
| Safe-home shelter | Playable: home eligibility, no deployed crew or open offers, consumption/output/research pause | Manual immediate local policy; public-world delays, cooldowns, auto-shelter and offline reports absent |
| Persistence | Playable: atomic local snapshots, durable command receipts, writer locks, compatible old-save upgrade, corruption checks | No PostgreSQL journal, cloud backup service, authenticated public hosting or proven disaster recovery |
| Presentation | Playable: full-screen brass HUD, live inspectors, generated portraits/four sprites, tactical controls | Procedural terrain/crew sprites, no complete AAA asset set, audio or broad mobile/Firefox verification |

## What the expansion adds

Seven new structures: bilge pump, saltroot garden, infirmary, research station, accumulator, biorefinery, rain cistern. Existing buildings remain functional. Six research projects and four staffed recipes connect food, water, industry, medicine and expeditions.

Three shared expedition sites have finite loot and persistent defenders. Players explicitly choose PvP inside those sites; allied attacks and home attacks are rejected. Cargo, crew location, injuries, research, queues and retry receipts survive server restart. The browser is a controller/view, not an authority for outcomes.

## Scope that still needs development

The game is not finished at RimWorld-scale. The most important remaining work is:

1. Broaden content and progression: more scenarios, items, weapons, technologies, quests, NPC factions and long-term objectives.
2. Deepen colonist life: schedules, recreation, personal goals, richer relationships, equipment, body-part medicine and permanent-loss rulesets.
3. Complete world logistics: physical trade, contracts, travel routes, faction outposts, new generated expedition maps and renewable world opportunities.
4. Deepen habitats: cables/plumbing, individual room air and heat, roofs, pressure/leaks, richer ecology and weather.
5. Add operations and polish: public identity/membership, durable database/journal, backups/restore, moderation, real unattended soak/load evidence, animation/audio, accessibility and supported-device testing.

These are tracked as unfinished work, not represented by inactive fake controls. See Progress for verification evidence and the playing guide for the current rules.
