---
name: playtest-and-qa
description: Verify Drowned Frontier features and milestone demos with reproducible evidence and prioritized defects.
---

# Playtest and QA

Use for feature acceptance, regression investigation, first-hour usability, and milestone verification.

1. Read the backlog acceptance check and relevant milestone demo in `docs/roadmap.md`.
2. Record build/version, seed, server tick/state, browser, player sessions, and exact reproduction actions where applicable.
3. Run the happy path plus the highest-risk interruption or misuse case. For state-changing systems, verify ownership and resource conservation rather than only screenshots.
4. Use two independent sessions for multiplayer. Include rejection, disconnect, reconnect, and restart when the feature promises those behaviors.
5. For first-hour playtests, observe actual decisions and confusion; avoid coaching away every usability failure. Distinguish tester observations from predictions.
6. Classify defects: data loss/security, blocker, major behavior, usability, cosmetic. Give reproducible steps and expected versus actual outcome.
7. Record checks actually run, failures, limitations, and acceptance status in `docs/progress.md`; keep unfinished items `in_review` or `blocked`.

Output: concise evidence and prioritized findings. Do not rerun broad suites without a new change, failure, or unresolved concern; never mark skipped checks as passed.
