# Backlog

Statuses: `planned`, `in_progress`, `in_review`, `done`, `blocked`. Acceptance checks belong to the item, and evidence belongs in [Progress](progress.md). Status reflects the implemented local prototype; `in_review` means a usable subset exists but the full acceptance check remains unmet. See Progress for evidence and limitations.

## Ordered implementation

| ID | Gate | Status | Deliverable | Acceptance check |
| --- | --- | --- | --- | --- |
| DF-001 | M1 | done | Workspace, pinned toolchain, scripts, CI basics | Fresh setup builds shared packages and starts web/server using documented commands; committed CI workflow runs the same locally verified checks |
| DF-002 | M1 | done | Seeded state, IDs, fixed-step simulation | Same seed and command log yield equal canonical state; core runs without DOM/network |
| DF-003 | M1 | done | Runtime protocol, local identity, authorization | Malformed/foreign/stale commands rejected; legal command acknowledged once; dev identity cannot enter a public build |
| DF-004 | M1 | done | Region, local renderer, input, selection | Inspect eight sites and a 64×64 map; pan/zoom/select/move; display authoritative state and connection status |
| DF-005 | M1 | done | Claims, filtered replication, reconnect | Two independent clients claim and move; same-site race has one winner; hidden state absent; refresh retains ownership |
| DF-006 | M2 | done | Job scheduler and reservations | Crew chooses eligible work; two workers cannot spend one input; interruption releases reservations with a visible reason |
| DF-007 | M2 | done | Salvage, stockpile, inventory, hauling | Items move between source, carrier, and destination with conserved quantities; full stockpile handled |
| DF-008 | M2 | done | Construction, collision, pathfinding | Preview costs; build wall/door/bed; blocked routes explain failure; cancellation cannot duplicate inputs |
| DF-009 | M2 | done | Needs and autonomous survival | Crew eats/rests from available facilities; shortages are visible; deterministic progression under a known seed |
| DF-010 | M2 | done | Recipes, power, generator repair | Valid inputs produce one recipe result; unpowered work waits; repair restores generator behavior |
| DF-011 | M2 | done | Health and first failure scenario | A telegraphed failure affects work; injured worker can be treated; recovery does not require unavailable resources |
| DF-012 | M2 | in_review | Simulation inspector | Inspect current job, eligibility failures, reservations, recent events, seed, and tick cost |
| DF-013 | M3 | in_review | Persistence transaction design and versioned saves | Document journal/snapshot/receipt atomicity and compatibility; save/load canonical state round-trip passes |
| DF-014 | M3 | planned | PostgreSQL adapter, migrations, crash recovery | Interrupted writes and after-commit retries preserve ownership and quantities; unsupported saves rejected explicitly |
| DF-015 | M4 | in_review | Shared dock, escrow, trade settlement | Accept/cancel/expire/retry settle at most once; simultaneous inventory changes cannot create or lose goods |
| DF-016 | M4 | in_review | Alliances and scoped permissions | Bilateral acceptance required; revocation blocks access; neutral/ally cannot withdraw ungranted inventory |
| DF-017 | M4 | done | Expeditions and travel | Inventory and crew are in exactly one location; arrival uses server ticks; disconnect does not cancel deployment |
| DF-018 | M4 | done | Contested-site combat and recovery | Range/visibility/cooldowns checked server-side; home damage rejected; defeat permits extraction without permanent crew loss |
| DF-019 | M5 | in_review | First-hour tutorial and recovery | New player completes survival, a trade, and expedition; instructions accept alternate valid solutions |
| DF-020 | M5 | in_review | Art, audio, responsive and accessible UI pass | Consistent original look, readable game state, keyboard operations, audio settings, no color-only alerts |
| DF-021 | M5 | in_review | Performance, soak, abuse and reconnect suite | Meet or document exceptions to architecture budgets; record four-client run and one-hour soak evidence |
| DF-022 | M6 | in_review | Standing orders, shelter, offline summaries | Eligibility/delay/cooldown enforced; no battle evasion; unattended low-resource case and reconnect summary verified |
| DF-023 | M6 | planned | Pilot auth, membership, operational controls | Nonmembers denied; no dev bypass; backup restore and migration/rollback rehearsed; rate limits and metrics demonstrated |
| DF-024 | M6 | planned | Invited persistent pilot playtest | Fairness, stability, and recovery observations logged; known critical defects resolved before public expansion |

Implementation order within a gate can change for dependency reasons. Do not defer authorization or resource conservation until a later polish pass.

## Expansion candidates — not committed to the first slice

| ID | Capability | Required discovery |
| --- | --- | --- |
| EX-001 | Traits, relationships, memories | Explainability, event limits, player agency |
| EX-002 | Five origin scenarios | Comparable opportunity, challenge labeling, recovery paths |
| EX-003 | Research and specialization | Useful trade dependencies without hard solo dead ends |
| EX-004 | Factions and contracts | Server-enforceable obligations and cancellation |
| EX-005 | Deep habitats, oxygen, leaks | Contained room simulation and readable risk |
| EX-006 | Canopy ecology | Bounded regrowth and sustainable material loops |
| EX-007 | Scheduled home wars | Mutual opt-in, UTC scheduling, protected core, capped losses |
| EX-008 | Ships and interception | Travel pacing, offline exposure, route visibility |
| EX-009 | Walking outposts | Map transfer, mass/power limits, land ownership |
| EX-010 | Higher population and worlds | Profiling, world hosting capacity, economics, operational cost |
