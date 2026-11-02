# The Drowned Frontier

A browser colony simulator in a shared, flooded world. Build a home, care for a small crew, explore ruins, and form alliances or rivalries with other player settlements.

**Current state: expanded playable local multiplayer game.** The authoritative server now runs staffed production, finite storage, renewable gardens, water/tides/flooding/pumps, oxygen, batteries, injuries and medical care, traits/memories/relationships, research, policies/shelter, and shared tactical expeditions with PvE/PvP and extraction. This remains a developing game, not a completed RimWorld-equivalent release. Public hosting, full factions/contracts, richer medical/body-part systems, and many long-term features remain unfinished.

The latest visual pass uses a full-screen world with weathered brass/dark overlays, a survivor roster, generated portraits and four generated building sprites. See [art direction](docs/art-direction.md). Terrain and animation remain prototype assets.

## Play

Requires Node.js 22 or newer and npm. From this folder:

```sh
npm ci
npm run build
npm start
```

Open **http://localhost:3001**. Enter a captain name, inspect a site, and establish a settlement. Open an incognito window or a different browser for a second independent captain on the same server. Normal tabs in the same browser share one captain.

For development, run `npm run dev` and open **http://localhost:5173**. Vite proxies the WebSocket connection to the server on port 3001. See the [playing guide](docs/playing.md) for controls, trusted-LAN play, and save handling.

This is a trusted local/LAN prototype with device resume tokens, not authenticated public accounts. It is deliberately disabled under `NODE_ENV=production`. No live public website has been deployed.

## Verify

```sh
npm test
npm run build
npm run test:e2e
```

The browser check uses `/usr/bin/chromium` when available, `CHROMIUM_PATH` when set, or Playwright's installed Chromium. If needed, install it with `npx playwright install chromium`. `npm run test:mechanics` runs the additional prepared-colony browser scenario. `npm run verify` runs all checks. CI is configured for unit/integration tests and the build; it has not been run on a remote CI host in this session.

The E2E script starts an isolated temporary server and drives two independent browser contexts. It never resets the normal `data/world.json` save. Generated screenshots are in `artifacts/`.

## Start here

| Document | Purpose |
| --- | --- |
| [Vision](docs/vision.md) | Identity, world, experience, and scope |
| [Game design](docs/game-design.md) | Core loop, colonists, resources, progression, and first hour |
| [Multiplayer rules](docs/multiplayer-rules.md) | Claims, alliances, trade, combat, offline play, and fairness |
| [Architecture](docs/architecture.md) | Browser client, authoritative server, simulation, and persistence |
| [Roadmap](docs/roadmap.md) | Milestones with dependencies and exit criteria |
| [Backlog](docs/backlog.md) | Ordered work and acceptance checks |
| [Progress](docs/progress.md) | Honest status, evidence, risks, and next actions |
| [Decisions](docs/decisions.md) | Agreed direction, proposed defaults, and open questions |
| [Workflows and custom skills](docs/workflows.md) | Repeatable development workflows and skill catalog |
| [Development rules](AGENTS.md) | Instructions for people and coding assistants working here |
| [Mechanics matrix](docs/game-mechanics.md) | Implemented mechanics and remaining depth |
| [Playing guide](docs/playing.md) | Launching, controls, saves, limitations, and multiplayer |

## Planning contract

The user endorsed the Drowned Frontier direction: a browser game, one shared world, player-selected settlements, unique starts, alliances, and battles. Specific numbers, implementation choices, and detailed rules below are **working defaults**, not individually approved requirements or finished features. Revise them when playtesting provides evidence.

Use the project-steward skill to keep the tracker current. Detailed skills live in `.agents/skills/`; these are project-local workflow files, not installed account-wide plugins. The backlog distinguishes completed foundational capabilities from partial milestone coverage.

No calendar delivery estimates are assigned yet. Estimate milestone effort after the first running multiplayer prototype exposes the main technical risks.
