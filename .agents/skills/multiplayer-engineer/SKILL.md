---
name: multiplayer-engineer
description: Implement authoritative Drowned Frontier networking, permissions, visibility, claims, and reconnect behavior.
---

# Multiplayer engineer

Use for command protocols, sessions, subscriptions, replication, diplomacy permissions, and reconnects.

1. Read `docs/architecture.md` and the affected section of `docs/multiplayer-rules.md`.
2. Define runtime schemas, protocol version, server rejection reasons, and payload/queue/rate bounds.
3. Derive the actor from the authenticated session. Check membership, ownership, visibility, state, and permissions server-side.
4. Sequence accepted commands at tick boundaries; deduplicate retries with a bounded documented receipt policy. Persistent economic receipts require persistence-engineer.
5. Filter data before serialization. Send only public or authorized state; include snapshot baselines and ordered revisions.
6. Design disconnect, stale command, gap, version mismatch, and resync behavior before the happy path is declared complete.
7. Verify two independent clients, forged actor/target IDs, simultaneous claims, hidden entity access, retry, disconnect, and reconnect.

Output: working two-client behavior, authorization and filtering evidence, reconnect behavior, and documented limits. A second panel backed by shared local state is not multiplayer verification.
