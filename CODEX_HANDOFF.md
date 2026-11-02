# Desktop Codex handoff — The Drowned Frontier

## Start here

This folder is the complete source project created in the ChatGPT cloud workspace. Open the folder containing this file and `package.json` as a project in the Codex desktop app. The desktop app needs this local folder; the cloud conversation does not copy these files to your computer automatically.

Read `AGENTS.md`, `docs/progress.md`, `docs/game-mechanics.md`, and `docs/playing.md` before changing behavior. Project-local workflow skills are in `.agents/skills/`.

## User's goals and latest requests

- Build a deep original browser multiplayer colony survival game, The Drowned Frontier.
- Keep the full-screen dark/brass HUD inspired by the user's supplied reference, with a left survivor roster, top resources, right command panel and bottom controls.
- Publish to a new GitHub repository on the `Kryan19k` account, import into the user's Vercel account, and verify real gameplay live.
- Next major visual task: improve the entire world and assets. Recommended direction is Blender as the master 3D asset source, baked into a coherent 2.5D sprite pipeline; see `docs/asset-production.md`. The Blender production pack has NOT been created yet.

## What works

Authoritative TypeScript simulation with claims, crews, construction/dismantling, physical hauling, finite storage, staffed recipes, water/gardens, tides/flooding/pumps, oxygen, batteries, injuries/infection/tending, traits/memories/relationships, stress, research, work/rationing/shelter policies, alliances/escrow trade, and shared tactical expeditions with PvE/PvP, retreat and recovery.

The normal local runtime is Node/WebSockets with atomic JSON saves, command receipts, compatible migrations, corruption checks and single-writer locks. The game is not RimWorld-complete; the mechanics matrix explicitly tracks missing depth and operational work.

## Local launch on Windows

Install Node.js 22+ if needed. In the project terminal:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open http://localhost:5173. The game server runs on 3001 and Vite proxies its WebSocket. An incognito window or different browser creates a second captain. Normal tabs share one captain.

Built-client alternative:

```powershell
npm.cmd run build
npm.cmd start
```

Then open http://localhost:3001. Do not set `NODE_ENV=production` for the local unauthenticated server: it deliberately refuses that mode.

## Verification

```powershell
npm.cmd run verify
```

This runs unit/server tests, builds, and both browser scenarios. Playwright needs Chromium; if no installed compatible browser is found, run `npx.cmd playwright install chromium` first. Set `CHROMIUM_PATH` only if selecting a known browser executable. The tests use isolated temporary worlds and do not reset the normal save.

The mechanics expansion passed 92tests and two Chromium browser scenarios. The pending hosted adapter raises current unit coverage to 115tests. It has passed local checks but has NOT been verified on a live Vercel deployment or real Redis service.

## Publishing status and access blockers

The connected GitHub user is `kryan19k`. The user created and explicitly identified the public repository `https://github.com/kryan19k/downed-frontier` (note the missing r in the repository name). Keep the game title The Drowned Frontier. This is the authorized target; do not rename it or push to an invented similar repository. Check `git remote -v` and compare HEAD with origin/main before resuming synchronization.

Vercel login is connected, but listing teams returns empty and accessing the user's default team returns 403. Native team authorization must be completed by the user through a fresh `authorize_team_access` link. A login alone is insufficient; expired links must be refreshed. Do not work around the denial by selecting another account or token.

Vercel project import and live deployment have not been confirmed yet. Do not claim otherwise; use native service results to verify publication. GitHub synchronization status is visible in the local repository and remote.

## Hosted adaptation already prepared

`vercel.json` builds the Vite frontend with `VITE_GAME_TRANSPORT=http` and includes `/api/game`. Hosted state uses an Upstash Redis compare-and-swap adapter so autoscaling instances do not trust in-memory world state. Local development still defaults to WebSockets.

Relevant files:

- `apps/server/src/hosted.ts`, `apps/server/src/hosted.test.ts`
- `api/game.ts`
- `apps/web/src/hostedTransport.ts`, its tests, and `useFrontier.ts`

A real Upstash Redis store must be connected through Vercel Marketplace, providing `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (or the supported KV aliases). Never paste secrets into chat or commit `.env` files. The API returns 503 when storage is not configured; it never pretends to persist to function memory.

This is a small private pilot: eight identities, bounded command receipts,500 ms sequential polling, and at most five seconds of request-driven catch-up after inactivity. Production and preview state are separated. It is not the final public-world simulation/identity architecture. Keep Vercel's deployment protection; public beta authentication and operational work remain unfinished.

## Data and art

Runtime saves belong under `data/` and are excluded from source and archives. Keep browser resume tokens with the matching save. The source archive contains no runtime session secrets.

Generated portraits and four building sprites live in `apps/web/public/art/`. Terrain/crew art is still largely procedural. Concept art in `artifacts/concepts/` is a visual target, not a screenshot of implemented 3D graphics. New Blender assets must share scale, camera, lighting, anchors, palette and export metadata.

## Suggested first desktop prompt

Read CODEX_HANDOFF.md and AGENTS.md. Inspect the project and continue the existing Drowned Frontier work without restarting. First confirm the GitHub remote and Vercel team access, finish the real Redis-backed hosted deployment and test it. Then plan and build one cohesive Blender coastal-outpost asset slice before expanding the full asset library.
