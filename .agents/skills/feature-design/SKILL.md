---
name: feature-design
description: Turn a Drowned Frontier mechanic into an implementable rule set with interactions and acceptance checks.
---

# Feature design

Use before a new mechanic or a significant change in player-visible rules.

1. Read `docs/vision.md`, the relevant design/rules section, and the milestone scope.
2. Describe one player decision the feature enables. Give a concrete trigger and observable outcome.
3. Define state, inputs, outputs, costs, eligibility, timing, failure, cancellation, recovery, and information shown to each player.
4. Identify interactions with jobs, resources, health, permissions, persistence, offline behavior, and the shared clock as relevant.
5. Write a happy-path example and the most consequential adversarial/interruption example. Specify conservation and ownership invariants.
6. Choose the smallest version that proves the decision. Put richer variants in expansion candidates.
7. Update the canonical rule, decision register when consequential, and backlog acceptance check. Mark untested constants as working defaults.

Output: a concise spec in the relevant existing document, acceptance examples, dependencies, and deferred scope. Avoid creating a second conflicting rule document.
