# Development rules

## Product intent

Build the original browser multiplayer colony game described in `docs/vision.md`. Use original names, code, art, audio, and interface design. Preserve the goal of simulation depth through interacting systems.

## Scope and decisions

- Read `docs/progress.md`, the relevant backlog item, and the relevant design document before changing behavior.
- Work toward the earliest incomplete milestone unless the user steers elsewhere.
- Treat agreed direction, working defaults, and open questions differently; see `docs/decisions.md`.
- Resolve reversible implementation choices directly. Record consequential changes with reasons and affected rules. Ask only when missing information materially blocks the work or the action needs authorization.
- Do not add late-game systems to the first slice because they sound exciting. Record them in the backlog.
- Use only workflow skills relevant to the current task. Do not spawn agents unless the user or applicable instructions explicitly request delegation.

## Engineering rules

- The server owns simulation state, inventory, claims, permissions, combat, clocks, and random outcomes. Clients submit intent.
- Keep simulation code independent of rendering, UI, wall-clock time, and network transport.
- Use stable IDs, seeded randomness, explicit simulation ticks, integer resource quantities, and serializable state.
- Validate every externally supplied command at runtime, including ownership and visibility. Never send hidden world state to unauthorized clients.
- Define a stable update order. Reserve resources and destinations before starting work. Release reservations on cancellation, injury, death, and disconnect where relevant.
- Make retryable commands idempotent. Apply inventory exchanges atomically. Bound commands, queues, paths, and payload sizes.
- Version save data and content definitions. Preserve known-good saves during migration work.
- Instrument decisions and failures: a colonist's blocked task must have an inspectable reason.
- Build accessible DOM controls around the canvas: keyboard actions, readable contrast, tooltips, and settings. Do not rely only on color.
- Do not commit secrets, downloaded proprietary assets, generated dependency directories, or unrelated files.

## Workflow and definition of done

1. Identify the backlog item, player outcome, and acceptance check.
2. Read the relevant `.agents/skills/<skill>/SKILL.md` listed in `docs/workflows.md`.
3. Implement the smallest end-to-end behavior that meets that check.
4. Run checks appropriate to the risk. State-changing simulation, persistence, permissions, and networking require meaningful automated checks. Cosmetic or documentation changes need focused inspection, not redundant tests.
5. Verify affected browser behavior when a runnable client exists. For multiplayer work, use two independent sessions.
6. Record evidence, known limitations, and any rule changes in the existing docs. Never claim a test or playtest ran when it did not.
7. Update backlog and progress together. A task is done only when its acceptance check passes; implementation without verification is `in_review`.

Do not invent commands before the toolchain exists. Once added, document actual setup and verification commands in the README. Never substitute a mock economy or fake multiplayer UI for a working feature without labeling it as a prototype.
