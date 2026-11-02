# Workflows and custom skills

These are reusable project-local skill instructions, stored as `.agents/skills/<name>/SKILL.md`. They are readable by people and coding assistants. They are not cloud plugins, running services, or proof that any feature exists. `AGENTS.md` routes work here; if an assistant does not auto-discover local skills, read the relevant file explicitly.

## Skill catalog

| Skill | When to use | Expected output |
| --- | --- | --- |
| [project-steward](../.agents/skills/project-steward/SKILL.md) | Start work, change scope, update milestones | Current task, honest tracker, decision updates |
| [feature-design](../.agents/skills/feature-design/SKILL.md) | Specify a mechanic or significant change | Player outcome, interactions, rules, acceptance checks |
| [simulation-engineer](../.agents/skills/simulation-engineer/SKILL.md) | State transitions, resources, jobs, deterministic systems | Headless implementation and invariant evidence |
| [colonist-ai](../.agents/skills/colonist-ai/SKILL.md) | Work priorities, needs, pathfinding, behavior | Explainable job decisions and interruption checks |
| [multiplayer-engineer](../.agents/skills/multiplayer-engineer/SKILL.md) | Protocol, replication, permissions, reconnect | Server-authoritative two-client behavior |
| [browser-experience](../.agents/skills/browser-experience/SKILL.md) | Rendering, controls, panels, accessibility | Readable usable client verified against real state |
| [scenario-author](../.agents/skills/scenario-author/SKILL.md) | Origins, events, recipes, world content | Validated data and playable recovery path |
| [economy-and-conflict](../.agents/skills/economy-and-conflict/SKILL.md) | Trade, scarcity, alliances, PvP balance | Incentive analysis, bounded stakes, exploit checks |
| [persistence-engineer](../.agents/skills/persistence-engineer/SKILL.md) | Saves, journal, escrow, migration | Durable state, retry safety, restore evidence |
| [playtest-and-qa](../.agents/skills/playtest-and-qa/SKILL.md) | Verify a feature or milestone | Reproducible results and prioritized defects |
| [performance-investigator](../.agents/skills/performance-investigator/SKILL.md) | Slow frames/ticks, memory, network, scaling | Measured bottleneck, targeted fix, comparison |
| [release-operator](../.agents/skills/release-operator/SKILL.md) | Prepare a build, pilot, or deployment | Checked release candidate, backup and rollback plan |

## Standard feature workflow

project-steward → feature-design if rules need work → relevant engineering/content skill → playtest-and-qa → project-steward.

Use persistence-engineer whenever a change can lose or duplicate committed state. Use economy-and-conflict for changes affecting another player or the resource economy. Use performance-investigator when measurements or new scale justify it, not as a mandatory ceremony for every edit.

## Bug workflow

Capture build/seed/tick/commands → reproduce → classify ownership and affected invariants → use the relevant engineering skill → add a regression check where valuable → verify the original failure → update the tracker.

## Content workflow

Define the player decision → scenario-author → economy-and-conflict if resources or PvP change → playtest-and-qa → record balance observations. Do not add special-case engine code when a validated content definition can express the behavior cleanly.

## Release workflow

project-steward checks milestone evidence → playtest-and-qa checks the candidate → release-operator prepares the build and recovery materials → execute only the deployment already authorized by the user → record actual result. Routine local builds, tests, documentation, and reversible fixes do not need extra permission.

## Skill maintenance

Keep skills procedural and narrow. Update a skill when a real failure reveals a missing step. Link to canonical rules rather than copying balance constants into multiple places. Adding a skill does not advance game implementation progress.
