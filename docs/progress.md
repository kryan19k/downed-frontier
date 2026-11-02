# Progress

Last updated: 2026-11-02.

## Current state

**Expanded playable local multiplayer game.** The original connected-world foundation now includes staffed production, finite storage, sustainable crops/water, tides/flooding/pumps, Deep-site oxygen, injuries/tending/infection, traits/memories/relationships, research and policies, and remote tactical expeditions with PvE/PvP, retreat and recovery.

This is substantial working depth, not a completed RimWorld-equivalent game. See [the mechanics matrix](game-mechanics.md) for implemented systems and exact limits, and [the playing guide](playing.md) for controls and rules. No public deployment exists.

| Gate | Status | Actual coverage / remaining work |
| --- | --- | --- |
| M0 Blueprint | done | Design, rules, decisions, backlog and 12 local workflow skills |
| M1 Connected world | done | Authoritative commands, claims, filtered snapshots, two independent browser captains, saved reconnect |
| M2 Living outpost | in_review | Survival, staffed jobs/recipes, finite storage/overflow, medical care, energy/water/tides/rooms all playable; richer diagnostic inspector and broader first-hour observations remain |
| M3 Durable colony | in_progress | Compatible JSON saves, receipts, locks, corruption checks, new-state restart tests; PostgreSQL journal, migrations/restore and full crash-boundary verification remain |
| M4 Neighbor and rival | in_progress | Alliances, escrow trade, shared expeditions, tactical encounters and extraction playable; physical dock trade, permissioned visits and richer world logistics remain |
| M5 Playable alpha | in_progress | Full-screen HUD, generated portraits/buildings, objectives, two browser suites, benchmark; art/audio/content, representative network soak and broader devices remain |
| M6 Persistent pilot | in_progress | Manual eligible-home shelter and policies work; public auth, automatic offline policies/reports, release operations and unattended fairness are not done |
| M7 Depth expansion | in_progress | Compact personalities, relationships, research, tides, oxygen and gardens; full factions/contracts, biome ecology, wars and mobile outposts remain |

## Verification for the mechanics expansion

- Full TypeScript check and optimized browser build pass.
- Domain/server suite covers 92 tests: deterministic replay, resource conservation, staffed recipes, interruption, storage overflow and expansion recovery, water/battery capacity changes, tides/pumps/rooms, medical tending/infection, traits/memory/stress, lab research, policy/shelter, one-time emergency caches, expedition combat/visibility/retreat/recovery, sessions/receipts, compatible old saves and corrupt-state refusal.
- Original two-context Chromium scenario checks separate claims, canvas building, repairs, alliance, exchange, refresh identity, direct movement/priorities, dismantling, camera/grid, fullscreen-stage dimensions and guide controls.
- Additional prepared-colony Chromium scenario checks queued staffed production, powered research completion, physical medical treatment, work policy, shelter/exit, deployment/travel, tactical movement, retreat and returned crew. Completed stations are a documented QA fixture; normal station construction is covered separately.
- Browser scenarios report no page runtime errors. Visual inspection covered the live colony, system management and tactical screenshots in `artifacts/`.
- Updated accelerated headless benchmark: 4 colonies/12 crew/36,000 ticks (one simulated hour) in 10.141 seconds on the recorded machine. Tick p95 = 1.7286 ms and p99 = 2.1393 ms. Inventory/position/reservation invariants passed. This is not a live four-client network capacity claim or an hour-long wall-clock soak. Full details in `artifacts/performance.json`.
- CI is configured but no remote CI run is claimed. Firefox, real mobile play, public deployment, live prolonged network load, cloud operations and PostgreSQL recovery remain unverified.

## Important limits

Environment services are colony aggregates; flooding visuals are illustrative. Recipe inputs come from shared stock at batch completion. Medical care has no limb/organ model, and expeditions do not permanently kill crew. Shared caches are finite and do not replenish. Trades remain direct escrow exchanges. Shelter is manual and immediate, not the planned public-world delayed/automatic protection scheme.

Storage remains atomic local JSON with success receipts committed before command acknowledgment and five-second autonomous autosaves. Hard crashes can lose up to five seconds of unacknowledged tick progress. Browser storage holds the resume token; this is trusted local/LAN access, not public-account security. Closing a tab does not stop an active expedition or colony. Server downtime freezes simulation time.

## Fixes found during review

- Loaded haulers can now build a needed storage expansion without dropping or duplicating cargo.
- Dismantling cisterns/accumulators clamps excess service reserves so legal play cannot create an unloadable save; stored inventory remains preserved.
- Medical recovery and stress recovery use distinct states.
- Shelter releases production reservations without consuming pending ingredients.
- Expedition landing cells do not overlap across parties; attacked neutrals can retaliate without automatic aggression against untouched players.
- Downed crew are not revived accidentally by a survival-damage floor.

## Development history

- Planning pass: world/design/rules, 24 implementation items, 10 expansion candidates, 12 workflow skills.
- First implementation: connected colony, hauling, construction, basic needs, repair, direct trade/alliance, atomic saves and two-browser checks.
- Reference-led visual pass: full-screen brass/dark HUD, persistent roster, collapsible panels, image-generated portraits and four building sprites. Cinematic concept art remains a visual target, not an implemented 3D engine.
- Mechanics expansion: interconnected colony services, staffed industry, medicine, colonist psychology/research/policies, and shared tactical expeditions; expanded regression and browser coverage.

## Next work

Use the mechanics matrix and backlog to continue missing depth and content. Do not report the whole game complete until its outstanding gameplay, operational and verification requirements are actually met.

## GitHub and desktop delivery

Source is pushed to the user-created public repository https://github.com/kryan19k/downed-frontier (repository spelling is intentional). The initial GitHub Actions Verify workflow passed. Windows desktop continuation instructions and task context are in CODEX_HANDOFF.md.

Hosted adaptation is prepared in vercel.json, api/game.ts and the Redis compare-and-swap/HTTP transport modules. Local unit coverage is now 115 passing tests; TypeScript, build, and both normal browser scenarios pass. Real Upstash storage and live Vercel execution have NOT been verified. Vercel team authorization remains missing; no live deployment has been confirmed.

The Windows local server skips unsupported directory fsync while retaining file flush and atomic rename. Actual native Windows gameplay still needs verification in the desktop environment.
