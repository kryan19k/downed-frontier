# Game design

All numerical values here are working defaults for the first prototype.

## Core loop

Inspect needs → assign priorities and construction → gather and produce → respond to a complication → trade or explore → improve the colony → choose the next risk.

Players manage priorities and issue tactical orders. Colonists choose eligible jobs and execute movement and work. The UI explains both orders and refusals. Local inspection can pause visually, but it never pauses the shared world.

## The first hour

| Approximate active play | Experience | Visible evidence of success |
| --- | --- | --- |
| 0–5 minutes | Inspect available sites, choose one, meet the crew | Understand site resources, risks, and each survivor's strongest skill |
| 5–15 minutes | Mark stockpile, salvage materials, build beds and a food station | Crew hauls, builds, eats, and rests without individual click management |
| 15–30 minutes | Restore a generator and workshop | Power availability changes which jobs can run |
| 30–45 minutes | Resolve a telegraphed equipment failure | Diagnose the failure, prioritize repairs, recover |
| 45–60 minutes | Reach a shared salvage site or exchange goods with a neighbor | A real server transaction or encounter affects both players |

Timing is a playtest hypothesis. Tutorial tasks must accept alternate valid solutions and can be dismissed.

## Colonists and work

Initial skills: construction, salvage, fabrication, medicine, and combat. Initial needs: food, rest, health, and morale. Traits modify preferences with bounded bonuses and explicit drawbacks; traits never silently override direct orders.

Start with two traits per colonist and simple work priorities. Later add personal goals, relationships, memories, disease, and nuanced breakdowns.

Job flow: discover eligible work → score priority, urgency, suitability, and distance → reserve resources and work location → travel → perform work → commit results → release reservations.

Emergency survival can preempt ordinary work. Drafted combat orders preempt ordinary jobs but do not remove physiological needs. A failed path or missing input produces a visible reason and bounded retry delay. Tasks must survive interruption without duplicating resources.

## Resources and production

| Item | Source | Main uses |
| --- | --- | --- |
| Scrap | Wreck salvage | Structures, basic tools |
| Fiber | Shore growth | Beds, filters, repair supplies |
| Rations | Starting stores, food station | Hunger recovery, expeditions |
| Components | Salvage, later fabrication | Generator, workshop, equipment |
| Medicine | Starting stores, later production | Treat injuries |
| Fuel | Limited salvage | Generator operation |

Quantities are integer units. Work consumes defined inputs and produces defined outputs at a completed transaction boundary. UI previews costs and deficiencies before placement. Electricity is a network service, not a transferable inventory item.

Initial buildables: floor, wall, door, stockpile zone, bed, food station, generator, workshop, and repair target. Initial recipes: rations and repair supplies. The technical prototype uses a small abstract electricity network; cable routing, batteries, and detailed grids follow later.

## Health, combat, and recovery

The first model uses health, a wounded condition, downing, treatment, and evacuation. No detailed organ simulation yet. In first-slice PvP, downed crew are incapacitated and recover through extraction or rescue; permanent PvP death is disabled. PvE lethality and optional harsher worlds require a separate balance pass.

Combat uses server-resolved movement, range, line of sight, cooldowns, cover, and seeded hit outcomes. Start with one ranged weapon and one environmental cover type. No friendly fire in the initial ruleset. Morale and suppression are later additions.

Recovery must leave a viable path forward: basic labor remains possible without specialized equipment, and tutorial-critical resources have a bounded fallback source. Fallback supplies cannot be traded or farmed for profit.

## World interaction

Routes connect settlements and shared locations. The server tracks departure, carried inventory, route, arrival tick, and return. A disconnected browser does not teleport a party home. Initial travel uses known regional connections; sea navigation and interception are later work.

Trade starts with direct escrow-backed offers at a shared dock. No automatic instant delivery between distant inventories. Alliances grant explicit scoped permissions rather than merging ownership.

## Scenarios and story direction

First scenario: **The Last Shift** — three stranded engineers, a damaged outpost, useful tools, little food, and a repairable generator. The opening failure is scripted and telegraphed for learning; subsequent events use a seeded director.

Later origins: The Lifeboat, The Broken Company, The Seedkeepers, and The Inheritance. Origins and locations are separate choices. Each origin defines crew, supplies, obligations, hazards, recovery path, and difficulty label.

The event director tracks recent harm, resources, recovery, and colony strength. It provides downtime and cannot trigger a second catastrophe just because the first made the colony weaker. Shared-region events use region conditions, not a hidden roll targeting a particular offline player.

## Progression

Survive → stabilize → specialize → cooperate → establish influence. Research unlocks capabilities and tradeoffs instead of unlimited stat growth. The initial slice ends at a working outpost, a completed trade, and a salvage expedition. Longer-term objectives and victory conditions remain open.
