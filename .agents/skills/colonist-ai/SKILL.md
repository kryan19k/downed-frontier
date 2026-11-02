---
name: colonist-ai
description: Build explainable colonist priorities, job selection, pathfinding, and interruption recovery for Drowned Frontier.
---

# Colonist AI

Use for needs-driven behavior, work priorities, reservations, navigation, drafting, and idle-state problems.

1. Read the colonist/job rules in `docs/game-design.md` and the simulation update order.
2. Define eligible jobs and the reason each candidate can be rejected. Use deterministic scoring and stable tie-breakers.
3. Make urgency, player priority, skill, distance, and personal preference explicit. Define when survival or draft orders preempt work.
4. Reserve input quantities and destinations before execution. Revalidate paths and targets at meaningful boundaries rather than every frame.
5. Handle destroyed targets, full storage, blocked doors, missing inputs, injury, downing, cancellation, and unreachable destinations.
6. Add bounded retry/backoff and no-progress detection. Release abandoned reservations and avoid rapid job oscillation.
7. Expose current goal, candidate scores, blocking reason, reserved entities, and last interruption in the inspector.
8. Verify two workers competing for one resource, a route becoming blocked, and urgent hunger interrupting ordinary work.

Output: observable behavior, a reproducible scenario, interruption evidence, and remaining limitations. Do not hide stuck behavior behind random job switching.
