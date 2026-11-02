# Roadmap

Status is tracked in [Progress](progress.md). Milestones are capability gates, not calendar promises. Do not count a milestone complete merely because its files exist.

| Gate | Outcome | Depends on | Exit criteria |
| --- | --- | --- | --- |
| M0 — Blueprint | Reviewable rules, plan, tracker, and reusable workflows | None | Documents agree on scope; skills and links checked; implementation honestly marked unstarted |
| M1 — Connected world | Two browser sessions inhabit one authoritative world | M0 | Both select distinct sites; duplicate claims rejected; order, selection, and movement visible; unauthorized orders rejected; reconnect restores ownership |
| M2 — Living outpost | Three colonists sustain a starter settlement | M1 | Gathering, hauling, reservations, construction, food, rest, power, and repairs complete a playable loop; idle reasons visible; seeded replay check passes |
| M3 — Durable colony | A session can stop, restart, and reconnect correctly | M2 | Versioned saves, PostgreSQL journal, durable receipts, migrations, and crash recovery checked; no duplicate starting goods or lost committed exchanges |
| M4 — Neighbor and rival | Trade, alliances, and a contested expedition work | M3 | Two real clients settle one atomic dock trade, accept/revoke an alliance permission, travel to a contested site, fight, extract, and reconnect without duplication |
| M5 — Playable alpha | The first hour is understandable and engaging | M4 | Guided scenario, original visual direction pass, sound/settings, keyboard flows, recovery paths, four-client performance and soak evidence |
| M6 — Persistent pilot | A small invited world can run unattended fairly | M5 | Tested shelter/standing orders, offline reports, auth, access controls, backup restore, monitoring, migration and rollback rehearsal; abuse cases pass |
| M7 — Depth expansion | Systems produce richer stories and specialization | M6 | Individually accepted additions: more origins, relationships, research, regional specialization, contracts, factions, then additional biomes |

## Milestone demonstration scripts

- **M1:** A and B open separate browser sessions. A claims a site; B's concurrent attempt fails safely. B claims another. Each moves their crew; forged control of the other crew fails. Refresh both.
- **M2:** Start The Last Shift from a known seed. Establish beds, stockpile, food, generator, and workshop; diagnose and repair a failure. Interrupt a worker and verify reservations and goods are conserved.
- **M3:** Record inventories and ownership, commit a command, terminate the server at selected persistence boundaries, restart, and retry the same command. State and receipts remain consistent.
- **M4:** Trade at the shared dock, change alliance permissions, dispatch two parties, contest salvage, disconnect one client, resolve the encounter, and reconnect. Home inventories remain protected.
- **M5:** A first-time player completes the intended loop without developer commands. Observe confusion and decision-making; collect performance evidence on documented hardware.
- **M6:** Leave colonies unattended under normal and low-resource conditions, trigger disconnects and restarts, restore a backup, and rehearse a failed release. Verify no shelter loophole evades an active battle.

## Expansion order

1. Add colonist relationships, memories, and event recovery logic.
2. Add multiple balanced starting scenarios and meaningful regional trade goods.
3. Add research, contracts, faction attitudes, and cooperative expeditions.
4. Prototype Deep oxygen/flooding as a contained new loop; only then connect it to the economy.
5. Add Canopy ecology and living construction.
6. Evaluate scheduled wars, naval travel, and crawler outposts separately.

New systems must earn their complexity through player decisions and measurable interaction with existing systems.
