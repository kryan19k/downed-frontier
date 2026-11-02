---
name: persistence-engineer
description: Preserve Drowned Frontier state across saves, retries, crashes, schema changes, and economic transactions.
---

# Persistence engineer

Use whenever changes affect saved state, command receipts, claims, escrow, durable inventory, migrations, or restore.

1. Read the architecture persistence section and existing schemas/adapters before mutation.
2. Define the transaction boundary, acknowledgment point, command ID lifetime, and canonical state owner. Distinguish in-memory acceptance from durable commit.
3. Persist dependent state and economic receipts atomically. A retry after a lost acknowledgment must return the recorded outcome rather than repeat the transfer.
4. Version snapshots and content references. Plan journal replay and migration across both snapshot and outstanding journal data.
5. Reject unsupported versions explicitly. Preserve a known-good source before migration and define rollback compatibility.
6. Verify round-trip state, duplicate requests, concurrent competing transactions, before-write failure, after-commit/before-ack failure, and restart replay as relevant.
7. Rehearse restore from an actual backup before claiming operational readiness. Record any data-loss window and incompatible rollback boundary.

Output: atomicity/compatibility explanation, implemented adapter or migration, recovery evidence, and documented failure behavior. Do not destructively rewrite existing user data without authorization.
