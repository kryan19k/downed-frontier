---
name: performance-investigator
description: Measure and improve Drowned Frontier frame time, simulation ticks, memory, network traffic, and hosting capacity.
---

# Performance investigator

Use for observed slowness, failed budgets, leaks, or proposed population/world scale increases.

1. Read the budgets in `docs/architecture.md` and define a representative workload.
2. Record build, hardware, browser, seed, clients, entities, map size, network conditions, warmup, and sample duration.
3. Measure p50/p95/p99 tick or frame time as relevant, memory trend, payload sizes, queue depth, and costly systems. Do not infer capacity from an empty map.
4. Identify the dominant bottleneck with a profiler or targeted instrumentation. Separate client rendering, server simulation, database, and transport costs.
5. Make one targeted change. Preserve authority, visibility filtering, and resource correctness; do not optimize by silently dropping required simulation.
6. Repeat the same workload and compare results. Check that improvements do not introduce another budget failure or replay change.
7. Run a soak when investigating leaks or unbounded growth. Report extrapolations explicitly as estimates.

Output: reproducible workload, baseline, bottleneck, change, measured comparison, and remaining limit. No player-count promises without representative evidence.
