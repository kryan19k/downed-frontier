---
name: simulation-engineer
description: Implement deterministic headless Drowned Frontier systems with explicit state transitions and resource invariants.
---

# Simulation engineer

Use for simulation state, ticks, movement, work, needs, production, hazards, and combat outcomes.

1. Read `docs/architecture.md`, the relevant rule, and the task acceptance check.
2. Define serializable state, stable IDs, update order, seeded random streams, and tick cadence. Keep rendering, transport, and wall-clock APIs outside the simulation.
3. Express transitions with explicit preconditions and completion/cancellation behavior. Distinguish reserved resources from consumed resources.
4. Preserve resource conservation and unique entity/location ownership. Make invalid commands return useful reasons without partial mutation.
5. Bound searches and retries. Track expensive work and surface blocked behavior through debug data.
6. Verify the meaningful invariants: same seed/log yields canonical equal state; interruptions do not duplicate goods; invalid transitions leave state consistent.
7. Check save compatibility and protocol changes with the relevant workflow before changing serialized shapes.

Output: headless implementation, reproducible seed/commands, invariant checks, and measured limitations. Determinism means a pinned build/content version unless compatibility is explicitly established.
