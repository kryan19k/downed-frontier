# Multiplayer rules — Frontier ruleset v0.1

These are proposed defaults for a friendly but competitive world. Constants must live in server configuration and be visible to players. This document is the behavioral contract for implementation, not a claim that these systems exist.

## World and ownership

- One logical regional world contains claimed local settlement maps and shared locations. The prototype has eight eligible home sites and supports 2–4 invited players.
- A player may hold one home claim in a world. Claim creation is atomic; simultaneous requests for the same site produce one winner and a clear rejection for the other.
- Players inspect resource and hazard summaries before choosing. Starting sites have comparable opportunity, not identical terrain.
- Site selection creates the crew, starting inventory, and ownership exactly once. Reconnecting or retrying cannot grant another starting package.
- Unclaimed sites do not permit free resource extraction in the first slice. Claim release, inactivity reclamation, multiple accounts, and shared colony ownership require later explicit rules.
- Clients receive their owned state, authorized allied information, public map information, and observed contested-area state. Hidden inventories and unexplored enemies are not replicated.

## Diplomacy and permissions

- Neutral is the default relationship. Alliances require acceptance by both players and can be left by either.
- Permissions are separate: visit, view selected information, use shared dock, and assist defense. Alliance membership never grants inventory withdrawal or building demolition by itself.
- Initial home visits are noncombat. Revocation removes future authorization immediately; guests return through a safe exit and never gain ownership of local items.
- Both parties see alliance and permission changes in their event history. Public chat and open matchmaking are out of scope for the invited prototype.

## Trade

- Either party proposes exact items and quantities; both see location and delivery terms before accepting.
- Goods must be at the shared dock. The server reserves offered goods in escrow. Accepted exchange transfers both sides atomically.
- Expiry or cancellation returns escrow to its owner. Retrying an acceptance cannot settle it twice. Insufficient space or stale inventory rejects or delays settlement explicitly; goods never vanish.
- No premium currency or purchased combat advantage is planned. Pricing is negotiated by players in the slice; market orders and NPC traders come later.

## Combat and territory

- **Homes are protected in the initial Frontier ruleset.** Hostile commands, projectile damage, theft, and blocking grief against a home are rejected server-side.
- The shared salvage site is a clearly marked PvP location. Before dispatch, show the possible loss of carried expedition goods and the crew recovery rule.
- Leaving a safe entrance gives a short non-attacking arrival shield; an attack order ends it. Exact duration is a tuning value. It cannot be refreshed inside an encounter by reconnecting.
- Server time, range, cover, visibility, ammunition, and cooldown determine outcomes. Client animation has no authority over a hit.
- Defeat can lose carried salvage and damage expedition equipment. It cannot transfer the home claim or stored home inventory. Downed crew have an extraction route; initial PvP cannot permanently kill them.
- Disconnecting does not remove deployed units. Standing orders continue, then the configured retreat policy applies when possible. Reconnecting restores the same party.
- Tactical retreat takes in-world movement; there is no instant safe teleport triggered by closing the tab.
- No home siege in the slice. Later scheduled wars require mutual opt-in, an announced UTC window, explicit objectives, capped home damage, and withdrawal terms. Unrestricted conquest would be a separate opt-in world type.

## Time, offline play, and server downtime

**Invited prototype:** simulation advances while the host process is running. There is no client fast-forward or global player pause. Closing a tab does not stop the server. A shutdown restores the saved tick on restart; wall-clock downtime does not retroactively consume resources, resolve battles, or generate goods. This is session persistence, not a finished 24/7 service.

**Persistent public-world release:** requires all of the following before launch:

1. Standing work, defense, rationing, and retreat policies are configurable and inspectable.
2. An owner can put an eligible home into shelter mode. Safe residents produce nothing, research nothing, trade nothing, and consume no survival resources. The mode is visible publicly and available online as well as offline.
3. Shelter cannot start during an expedition or hostile engagement. Default entry delay is five active server minutes, canceled by offensive actions or new deployments. It never cancels incoming effects, trades, reservations, or encounters; these must settle first. Unresolved server state blocks entry with a reason.
4. Auto-shelter is a server-side policy after ten minutes disconnected, subject to the same eligibility and entry delay. Essential care continues during the delay. Emergency reserve warnings appear before dispatching or logging out.
5. Exiting shelter has a five-minute production/deployment cooldown; activation cannot be used to manufacture resources or evade a contested encounter. Inventory and all other resource changes remain recorded.
6. Timers, minimum reserves, interruption cases, reconnects, and incentive abuse have been playtested. If the policy fails, keep the game in hosted-session mode until it is replaced.

Shelter delays are working values, not established balance. A disconnect during a dangerous expedition remains dangerous; explain that before departure. The offline summary must identify consumed resources, injuries, work completed, and the cause of every major loss.

## Fairness and conduct

- No gameplay purchases or paid protection. Anti-cheat relies on authoritative commands, authorization, bounds, rate limits, and audit evidence.
- New arrivals receive a safe home and a tutorial route that does not require PvP. Alliances cannot remove those protections.
- Cross-account collusion and real-money trading cannot be solved by a one-account rule alone. Public release needs abuse handling and economic monitoring; do not claim these are solved in the prototype.
- Player-facing public communication requires mute, report, access control, and moderation before release. Start with invited worlds and preset trade/diplomacy messages.
- Player identifiers are not secrets that grant access. Local development identities must be conspicuously marked and unavailable in a public build.

## Required abuse checks

Reject forged ownership, hidden-target attacks, trade duplication, simultaneous claim races, stale orders, oversized payloads, rapid command floods, alliance-permission bypasses, shelter evasion, reconnect-based immunity, and client-clock manipulation. Retain sufficient event context to explain each rejection without logging credentials or private chat.
