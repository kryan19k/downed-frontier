---
name: project-steward
description: Select and track Drowned Frontier work, maintain scope and decisions, and report evidence honestly.
---

# Project steward

Use when starting a task, revising scope, completing work, or reporting progress.

1. Read `docs/progress.md`, `docs/roadmap.md`, and the relevant rows in `docs/backlog.md`.
2. Identify the earliest incomplete gate and a task that can advance it. Honor current user steering.
3. State the player outcome and acceptance check. Separate agreed direction from working defaults using `docs/decisions.md`.
4. Select only relevant local skills from `docs/workflows.md`. Do not invoke every workflow or introduce unnecessary approval steps.
5. Mark actively started work `in_progress`. If blocked, record the specific missing dependency and useful independent work.
6. At completion, record actual commands/checks, outcomes, limitations, and changed decisions. Use `in_review` until the acceptance check passes, then `done`.
7. Update backlog and progress together; update design/rules when behavior changes. Do not estimate game completeness from the fraction of files or tasks created.

Output: backlog ID, status, evidence, unresolved risk, next action. Never fabricate a runnable build, test result, deployment, or acceptance by the user.
