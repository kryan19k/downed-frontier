# Decision register

`agreed` means supported by the user's direction. `working` means a reversible default chosen to make planning concrete. `open` means discovery or a user preference is still needed; open items below do not block M1.

| ID | Status | Decision | Reason / revisit trigger |
| --- | --- | --- | --- |
| D-001 | agreed | Original colony simulation with deep interacting systems | User wants colony depth, not just a city-building UI |
| D-002 | agreed | Browser-first multiplayer | Shared access and player-run settlements are central |
| D-003 | agreed | One shared world with site selection, origins, alliances, and battles | User's explicit multiplayer direction |
| D-004 | agreed | Drowned Frontier setting combining environments | User endorsed the previous setting proposal |
| D-005 | working | Provisional title: The Drowned Frontier | Revisit branding before publication |
| D-006 | working | Top-down 2D, painterly ocean-industrial look | Readability and feasible rendering; revisit after art prototype |
| D-007 | working | Regional map plus detailed local maps | One logical world without rendering the entire planet |
| D-008 | working | Shallows first; 2–4 players, eight sites, three crew each | Prove full loop before population and biome expansion |
| D-009 | working | Protected homes, contested salvage, later optional scheduled wars | Encourage rivalry without overnight home loss |
| D-010 | working | No permanent PvP crew death in first slice | Keep defeat recoverable while tuning stakes |
| D-011 | working | Fixed shared clock; no player fast-forward or global pause | Consistent real multiplayer |
| D-012 | working | Hosted-session persistence before 24/7 worlds | Offline fairness and operations are release requirements |
| D-013 | working | Explicit shelter mode for persistent homes | Bounded absence risk without offline production advantage; revisit if exploited |
| D-014 | working | TypeScript, React/Canvas 2D, Node/WebSockets; PostgreSQL later | Implemented browser/server stack; Canvas meets first-slice art needs without WebGL dependency; revisit from profiling |
| D-015 | working | Single authoritative world writer and seeded fixed-step simulation | Clear ordering, testability, replay, and conservation |
| D-016 | working | No purchased gameplay advantage | Fair prototype; monetization is not needed to validate the loop |
| D-017 | working | Invited worlds before public matchmaking/chat | Focus on core mechanics and observable fairness |
| D-018 | open | Co-op-only and harsher conquest rulesets | Revisit after Frontier combat and recovery playtests |
| D-019 | open | Long-term victory, world seasons, and reset policy | Need evidence from progression and economy |
| D-020 | open | Hosting provider, recurring budget, public player target | Decide from measured capacity and operational needs |
| D-021 | open | Mobile/touch support and minimum hardware | Desktop browsers first; benchmark before promising broad support |
| D-022 | open | Final lore tone and horror intensity | Does not block prototype mechanics; resolve before narrative production |
| D-023 | working | npm workspace with pinned versions | Implemented and locked; avoids adding another required package-manager installation |
| D-024 | working | Atomic JSON save and filtered full snapshots for local prototype | Implemented stepping stone; does not fulfill PostgreSQL/journal or delta-replication gates |
| D-025 | working | Prototype trades transfer via direct escrow | Implemented atomic transfer without expedition logistics; physical dock delivery remains deferred |
| D-026 | working | Immediate dismantling returns half material cost rounded down | Implemented recovery from blocked structures; worker demolition jobs deferred |
| D-027 | working | Device resume tokens, trusted local/LAN only, public production guard | Implemented session continuity; no authenticated public accounts or deployment yet |

| D-028 | working | CI gate means committed workflow plus locally verified command parity | Remote CI execution requires a configured remote/push; no remote CI run is claimed |

## Change process

Add or update a decision with the player outcome, reason, affected documents, migration impact, and verification needed. Update the actual rule as well as this register. Never silently recast a proposed default as a user-approved requirement.
