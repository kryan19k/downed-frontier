# Playing The Drowned Frontier

## Launch

Requires Node.js 22+ and npm. In the project root run:

```sh
npm ci
npm run build
npm start
```

Visit http://localhost:3001. For development use `npm run dev` and http://localhost:5173. A different browser or an incognito window creates an independent captain on the same server; normal tabs share one captain. Choose a site, origin, and settlement name. Origins change supplies; eight sites have different terrain/lore and Deep sites require powered air support.

This remains a trusted local/LAN game prototype. Device resume tokens are not public accounts. Public production mode is deliberately disabled. For trusted LAN only, `HOST=0.0.0.0 npm start` exposes the host's port 3001 to permitted devices; open the host LAN IP from those devices. Do not expose the unauthenticated prototype directly to the Internet.

## Establish a sustainable home

You start with three survivors, one bunk, a galley, stockpile, and damaged generator. Restore the generator, build two more bunks, then build a **bilge pump and rain cistern** before high tide. Your starting supplies cover critical infrastructure. The objectives card provides direct placement actions.

- Crew choose reachable jobs, reserve work, carry gathered goods, eat, drink, and sleep. Inspect their task and blocked reason when work stalls.
- Each stockpile adds200 storage slots above a 200 base. Full storage blocks intake rather than deleting cargo. Crew can build a storage expansion while retaining loaded goods. Destroying storage never deletes existing inventory; refunds can temporarily exceed capacity.
- Cisterns increase freshwater capacity and replenish water. Crew drink automatically. Saltroot gardens use water and crew labor to create renewable fiber.
- Generators consume fuel. Accumulators store surplus power and bridge outages. Pumps reserve power before workshops/labs; build sufficient generation for both.
- High tides and storms raise flooding. Enclosed wall-and-hatch rooms reduce ingress; powered pumps drain it. Severe flooding damages machinery, exposes crew to injuries, and can spoil food.
- Deep sites lose breathable atmosphere without power. Water, flooding, oxygen, and electricity are colony-wide service models; this is not per-cell fluid or pressure physics.

## Production and research

Open **Frontier** on the bottom bar. The Production tab lists four recipes: rations, components, medicine, and biofuel. Queue 1–20 batches, inspect progress, or cancel a bill. A reachable station and a real worker are required. Ingredients are consumed atomically when a batch completes; they are drawn from colony inventory rather than physically hauled to the station. Paused production makes no goods. Automatic production queues basic rations/components when stock runs low, using the same staffed jobs.

Medicine requires an infirmary and Marine medicine research. Biofuel requires a biorefinery and Closed-loop industry research. Both provide longer-term renewable production paths alongside gardens.

Build a powered research station, then select a project in Frontier → Research. A worker must physically reach the lab. Projects have prerequisites and unlock hydraulics, agriculture, marine medicine, industry, ballistics, and abyssal exploration benefits. Changing an unfinished project discards its progress; completed discoveries persist.

## People, injuries, and policies

Frontier → People exposes traits, learned skills, relationships, recent memories, stress, hydration, and injuries. Traits and skills affect work; shared experiences affect mood and relationships. Intensive work increases output and strain; recovery focus trades output for rest. Ration conservation delays and reduces meals.

Cuts, fractures, exposure, and infection have severity and treatment state. Choose **Assign medical care** on a wounded survivor. Another healthy reachable crew member performs field treatment and consumes medicine on completion; the medic role and medical research help. Untended injuries can worsen. Incapacitated crew need care, not ordinary job assignments. This is a simplified medical model, not a body-part/organ simulation.

Stress breaks temporarily stop work and allow recovery; they do not randomly destroy a colony. Memories expire and remain bounded. A small state-aware director can provide one physical emergency cache per colony, plus environmental and social bulletins. Cache contents must be hauled normally and cannot be repeatedly farmed by the same colony.

## Expeditions and tactical combat

Frontier → Expeditions offers three shared locations: Wreckwater Salvage, The Drowned Archive, and Leviathan Nursery. Choose 1–3 healthy crew. Each deployed crew member costs two rations and two fuel. Their home jobs release immediately and they remain in exactly one location. Travel normally takes 20 server seconds; abyssal research shortens outward travel to deeper sites.

These sites are contested. Wildlife defends finite salvage caches; other players can enter too. Neutral players are not attacked automatically. Explicit attacks against nonallied players are possible inside the encounter, and defenders retaliate. Allied fire is rejected. Homes cannot be attacked.

Open the tactical view after arrival:

- Select a friendly unit, then click an empty tile to move or an enemy to attack.
- Arrow keys move the selected unit when the tactical canvas has focus.
- Obstacles affect pathfinding and line of sight; cover, range, cooldowns, traits, experience, and research affect combat.
- Crew defend themselves against wildlife automatically. Both sides' units resolve on the server.
- Order retreat to withdraw toward extraction. The party remains vulnerable until able crew reach the landing zone, then returns by sea. Closing the tab does not extract a party.
- Defeated/downed crews receive emergency recovery with injuries and can lose carried salvage. Expedition deaths are not permanent in this ruleset.
- Successful parties gather from the shared finite cache and return. Full home storage causes excess cargo to be unloaded as recoverable dock crates. Caches do not currently replenish.

## Alliances and trade

Diplomacy requires bilateral alliance consent. Inventories remain separately owned. Trade offers place goods into escrow; accepting transfers exact quantities atomically, while decline/cancel/expiry returns them. Full receiving storage can prevent acceptance. Retried committed commands do not settle twice. Trade still uses direct home-inventory exchange; physical trade convoys, contracts, and permissioned home visits are future work.

## Shelter and absence

Frontier → Systems allows safe-home shelter. All expeditions must be home and pending offers must be settled/canceled first. Shelter stops productive work, research, survival consumption, and environmental harm; it creates no resources. Resume to continue. This is a manual, immediate local-session policy, not the final public-world auto-shelter, delay/cooldown, or offline-report design.

Closing a tab while the server runs leaves the world active. Server shutdown freezes world time; restarting creates no retrospective production or consumption.

## Controls

| Action | Control |
| --- | --- |
| Inspect/move crew | Select roster/map crew, click land; draft to retain direct control |
| Build | Choose any of 15 structures, then click a clear map tile |
| Quick construction | Keys 1–8 for the original eight structures |
| Cancel placement/selection | Escape |
| Pan / zoom | Right/middle drag or Space+drag / mouse wheel |
| Camera keyboard | Arrow keys and plus/minus with world canvas focused |
| Grid | G |
| Regional map/home | M |
| Command panel | I or Show/Hide panel |
| Browser fullscreen | Fullscreen icon at top |
| Help | ? or Field guide |

Dismantle built structures from Outpost → Structures to recover half of each material cost rounded down and unused repair supplies. Cancel an unfinished blueprint to recover all prepaid construction materials. Excess water/battery reserve spills when its capacity is removed; existing stored inventory is preserved.

## Saves and verification

`data/world.json` holds the authoritative world, hashed resume sessions, command receipts, and new system states. Keep both this save and browser storage to retain access. Old saves receive compatible optional fields without new starting goods. Corrupt saves are refused and preserved. A single-writer lock prevents simultaneous hosts from overwriting one save. Stop with Ctrl+C for a clean save; ambiguous stale locks require host inspection.

Commands persist before success acknowledgment. Autonomous work autosaves every five seconds, so a hard crash can lose up to five seconds of unacknowledged tick progress. This is atomic local storage, not the planned PostgreSQL journal and operational backup service.

`npm run verify` checks domain/server tests, builds the client, runs the original two-browser scenario, and runs a prepared-colony mechanics browser scenario. The latter supplies completed stations as a QA fixture; it tests manufacturing, research, medicine, shelter, deployment, tactical movement, and return without waiting for every station to be constructed. Screenshot scenarios are test worlds, not changes to a player's normal save.
