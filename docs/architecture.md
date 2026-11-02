# Technical architecture

## Implemented prototype

The running build uses an npm TypeScript workspace, React 19, Vite 6, procedural Canvas 2D rendering, Node.js, WebSockets, and Zod command validation. The server runs ten ticks/second and sends filtered full snapshots five times/second. It uses a single-writer lock and atomic JSON saves containing world state, hashed device sessions, and command receipts. Commands persist before acknowledgment; autonomous changes autosave every five seconds. Downtime freezes simulation time.

Public accounts, revisioned delta replication, PostgreSQL, migrations, full journal replay, and offline shelter are **target architecture**, not implemented. Current protocol validates version, IDs, ownership, types, and bounds; it does not yet use the full proposed client-sequence/revision envelope. Performance targets below remain targets unless explicitly measured in the progress record.

## Working stack

Longer-term stack: TypeScript, Vite/React, accessible DOM panels, Node/WebSockets, and PostgreSQL for persistent worlds. Canvas 2D is the current renderer; consider PixiJS only if profiling or art requirements justify migration. npm is the implemented workspace manager. Versions are pinned in package manifests/lockfile; actual commands are documented in the README. Vitest covers domain/server checks and Playwright covers browser flows.

Use standard libraries for authentication and cryptography. A local-only development identity is sufficient for M1. Verified identity and world membership become mandatory before any public deployment.

## Proposed layout

```text
apps/web/                 UI, input, renderer, connection state
apps/server/              sessions, command gateway, world host, persistence
packages/sim/             deterministic domain state and systems
packages/protocol/        versioned runtime schemas and typed messages
packages/content/         validated items, buildings, origins, scenarios
packages/test-support/    seeds, fixtures, simulated clients
docs/                     design, rules, backlog, evidence
.agents/skills/           project workflow skills
```

This is the target layout. `apps/web`, `apps/server`, `packages/sim`, and `packages/shared` exist; the latter currently combines types, protocol types, and building definitions. Separate protocol/content/test-support packages when their complexity warrants it.

## Authority and simulation

The browser submits intent → gateway authenticates, authorizes, validates, deduplicates, and bounds it → command queue applies it at a tick boundary → simulation changes state → visibility filtering produces player-specific updates → browser interpolates presentation.

One host process owns a world in the prototype. Do not split one region across workers before profiling demonstrates a need. Loading only visible art must never unload essential authoritative simulation or make an unattended colony immune.

Proposed fixed step: 10 ticks/second. Movement and encounters use that step; needs, planning, and distant economy may run on documented tick multiples. No wall-clock reads or unseeded random calls inside the simulation. Fixed point or bounded integer values are preferred for authoritative quantities.

Update order: admitted commands → needs and hazards → job selection and reservations → movement → work → combat and health → completion/resource transactions → events → state publication. Specify tie-breaking by stable ID and test it. Network arrival only determines the assigned command sequence, not hidden execution races.

Determinism target is replay within a pinned server/content version. Cross-version replay requires migrations or recorded compatible builds; do not promise universal replay compatibility.

## Protocol and visibility

Command envelope: protocol version, command ID, client sequence, known server revision, type, and validated payload. Actor identity comes from the session, never an editable payload field. Acknowledgment includes command ID, applied tick or rejection code, and authoritative revision.

On join or reconnect: authorize membership → send a filtered snapshot with baseline revision → send ordered deltas after that baseline. Detect gaps, expired command deduplication windows, incompatible versions, and stale entity references; request a fresh baseline instead of inventing local repairs. No execution of an old disconnected command queue without fresh validation.

Subscribe only to authorized home, regional public data, and relevant expedition areas. Never send a full world snapshot and depend on the UI to hide secrets. Initial limits for command rate, maximum payload, queue length, and entity subscriptions must be explicit configurable budgets and measured under load.

## Persistence

Begin with versioned local snapshots for fast development, then add PostgreSQL before persistent multiplayer acceptance. Data model covers worlds, memberships, claims, colony state, expedition state, escrow, revisions, snapshots, and command/transaction receipts.

Store periodic full snapshots and a durable journal of accepted commands since the snapshot. A command is acknowledged as committed only after its required durable write succeeds. Rebuild from snapshot plus journal using the pinned simulation/content version. Economic transactions and their deduplication receipts commit together; memory must not report an exchange successful before persistence succeeds. A single world writer avoids contradictory concurrent state.

Exactly which journal operations share a database transaction is designed in DF-013 before implementation. Crash tests must cover before-write, after-write/before-ack, and mid-reconnect cases. Snapshot timing, retention, and journal compaction are measured, not guessed. PostgreSQL plus a journal is a plan, not automatic crash safety.

Server downtime freezes simulation time. Browser-hidden-tab time does not. Public deployment needs backup and restore rehearsal, migrations, authenticated membership, rate limiting, metrics, and an operator rollback path.

## Content and tooling

Definitions are data-driven with stable IDs, schema versions, costs, recipes, prerequisites, and localization keys. Validate missing references, negative costs, unreachable tutorial resources, and accidental production loops.

Build a debug inspector early: selected entity state, job choice reasons, reservations, recent commands, tick cost, and seed. Keep debug mutation controls gated to development worlds.

## Initial performance budgets

Targets to verify on a recorded reference machine and browser:

| Measure | Initial test target |
| --- | --- |
| Client frame time | p95 below 33 ms at 1080p, one visible 64×64 map |
| Server tick | p95 below 50 ms, p99 below the 100 ms tick interval |
| Starter load | Four connected clients, 12 colonists total, eight sites, one active contested map |
| Reconnect | Usable filtered snapshot within five seconds on the recorded test network |
| Long session | One-hour soak without unbounded queue, reservation, or memory growth |

These are acceptance targets, not results. Desktop Chrome and Firefox are first; touch layout and mobile support require a separate pass. Record hardware, build, seed, duration, entity count, network conditions, and percentile method with measurements.
