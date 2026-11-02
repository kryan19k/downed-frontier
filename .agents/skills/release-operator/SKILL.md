---
name: release-operator
description: Prepare and verify Drowned Frontier release candidates, invited pilots, migrations, backups, and rollback.
---

# Release operator

Use when preparing a build, deployment, persistent pilot, or operational change.

1. Read milestone evidence, known defects, target environment, and the user's existing deployment authorization.
2. Produce a reproducible candidate from the actual repository toolchain. Record version/content/protocol/save compatibility and release notes.
3. Verify required checks and basic two-client flows. Block public readiness on unresolved data-loss, ownership, hidden-state, or economic duplication defects.
4. Before a persistent pilot, verify identity and membership, removal of development bypasses, transport security, rate bounds, metrics, logs without secrets, and configured operational access.
5. Prepare and rehearse backup restore, migration, downtime messaging, and rollback. Clearly identify schema changes that prevent binary-only rollback.
6. Complete all local/reversible preparation before requesting any genuinely missing deployment authorization. Do not add confirmation steps when the user has already authorized the action.
7. Execute only within that authorization; verify health and core flows after deployment, then record actual URL/version/status. If not deployed, say candidate prepared rather than released.

Output: reviewable candidate, compatibility and recovery notes, checks, and actual deployment status. A successful build is not proof of production readiness.
