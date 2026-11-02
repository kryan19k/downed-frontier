import {
  ensureExpeditions,
  applyExpeditionCommand,
  tickExpeditions,
  getExpeditionView,
} from "./expeditions";
export { getEncounterObstacles } from "./expeditions";
import {
  ensureColonySystems,
  applyColonyCommand,
  tickColonySystems,
  tickColonistSystems,
  selectSystemsJob,
  storageRoom,
  refreshColonyCapacities,
  type SystemHelpers,
} from "./colony-systems";
import {
  ensureMinds,
  applyMindCommand,
  tickMinds,
  workMultiplier,
  skillExperience,
} from "./minds";
export {
  ensureColonySystems,
  storedAmount,
  storageRoom,
} from "./colony-systems";
import {
  BUILDINGS,
  MAP_SIZE,
  type World,
  type Player,
  type Colony,
  type Colonist,
  type Building,
  type Deposit,
  type Terrain,
  type Point,
  type Command,
  type CommandResult,
  type GameView,
  type Resource,
  type Inventory,
  type GameEvent,
} from "@frontier/shared";

const COLORS = [
  "#f0ba75",
  "#72c5bd",
  "#c4a6eb",
  "#dd8e86",
  "#9ebc72",
  "#85a9da",
  "#ddaac4",
  "#ced089",
];
const RESOURCES: Resource[] = [
  "scrap",
  "fiber",
  "rations",
  "components",
  "medicine",
  "fuel",
];
const terrainCache = new Map<number, Terrain[]>();
function random(seed: number) {
  let a = seed | 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(x: number, y: number, seed: number) {
  let a = Math.imul(x + seed, 374761393) ^ Math.imul(y, 668265263);
  a = Math.imul(a ^ (a >>> 13), 1274126177);
  return ((a ^ (a >>> 16)) >>> 0) / 4294967296;
}
export function createTerrain(seed: number): Terrain[] {
  const cached = terrainCache.get(seed);
  if (cached) return cached.slice();
  const tiles: Terrain[] = [];
  const phase = (seed % 1000) / 100;
  for (let y = 0; y < MAP_SIZE; y++)
    for (let x = 0; x < MAP_SIZE; x++) {
      const dx = (x - 31) / 25,
        dy = (y - 32) / 22;
      const angle = Math.atan2(dy, dx);
      const radius = Math.sqrt(dx * dx + dy * dy);
      const edge =
        1 +
        Math.sin(angle * 5 + phase) * 0.1 +
        Math.cos(angle * 3 - phase) * 0.08;
      let t: Terrain =
        radius > edge
          ? "water"
          : radius > edge - 0.12
            ? "sand"
            : hash(x, y, seed) > 0.94 && radius > 0.45
              ? "rock"
              : "grass";
      if (x >= 24 && x <= 39 && y >= 25 && y <= 39) t = "deck";
      if (x >= 31 && x <= 34 && y >= 40 && y <= 54) t = "deck";
      if (x >= 27 && x <= 38 && y >= 53 && y <= 55) t = "deck";
      tiles.push(t);
    }
  terrainCache.set(seed, tiles);
  if (terrainCache.size > 64)
    terrainCache.delete(terrainCache.keys().next().value!);
  return tiles.slice();
}
function id(w: World, prefix: string) {
  return `${prefix}-${w.nextId++}`;
}
function event(
  w: World,
  text: string,
  kind: GameEvent["kind"] = "info",
  c?: Colony,
) {
  const e = { id: id(w, "event"), tick: w.tick, kind, text };
  const list = c ? c.events : w.events;
  list.unshift(e);
  if (list.length > 40) list.length = 40;
}
export function createWorld(seed = 72641): World {
  const names = [
    [
      "Saltwake Reach",
      "An abandoned tide station",
      "Shallows",
      "Corroded machinery",
    ],
    [
      "The Greenward",
      "Roots around an old observatory",
      "Canopy",
      "Territorial wildlife",
    ],
    [
      "Lantern Shoal",
      "A sheltered salvage inlet",
      "Shallows",
      "Seasonal storms",
    ],
    ["Hollow Nine", "A sealed research platform", "Deep", "Failing power"],
    [
      "Wreckwater",
      "A freighter broken on the reef",
      "Shallows",
      "Unstable wreckage",
    ],
    [
      "Crown of Reeds",
      "A fertile island at the trade crossing",
      "Canopy",
      "Sparse minerals",
    ],
    ["The Undertow", "An exposed geothermal station", "Deep", "High pressure"],
    [
      "Pilgrim’s Rest",
      "A quiet outpost beyond the shipping lanes",
      "Shallows",
      "Distant supplies",
    ],
  ];
  return {
    version: 1,
    seed,
    tick: 0,
    nextId: 1,
    players: {},
    colonies: {},
    sites: names.map((n, i) => ({
      id: `site-${i + 1}`,
      name: n[0],
      subtitle: n[1],
      biome: n[2] as "Shallows" | "Canopy" | "Deep",
      hazard: n[3],
      x: [28, 58, 71, 44, 82, 19, 62, 38][i],
      y: [31, 19, 44, 54, 72, 66, 83, 82][i],
      seed: seed + i * 7919,
      richness: 3 + (i % 3),
      ownerId: null,
    })),
    alliances: [],
    allianceRequests: [],
    offers: [],
    events: [],
  };
}
export function joinWorld(w: World, playerId: string, name: string): Player {
  ensureExpeditions(w);
  if (w.players[playerId]) return w.players[playerId];
  const p = {
    id: playerId,
    name: name.trim().slice(0, 24) || "Wayfarer",
    color: COLORS[Object.keys(w.players).length % COLORS.length],
    colonyId: null,
  };
  w.players[playerId] = p;
  return p;
}
function cost(c: Colony, amounts: Partial<Inventory>, direction: -1 | 1) {
  for (const r of RESOURCES) c.resources[r] += (amounts[r] || 0) * direction;
}
function afford(c: Colony, amounts: Partial<Inventory>) {
  return RESOURCES.every((r) => c.resources[r] >= (amounts[r] || 0));
}
function colonyOf(w: World, p: string) {
  const key = w.players[p]?.colonyId;
  return key ? w.colonies[key] : undefined;
}
function terrainFor(w: World, c: Colony) {
  const seed = w.sites.find((s) => s.id === c.siteId)!.seed;
  let t = terrainCache.get(seed);
  if (!t) {
    createTerrain(seed);
    t = terrainCache.get(seed)!;
  }
  return t;
}
function validPoint(p: Point) {
  return (
    Number.isInteger(p.x) &&
    Number.isInteger(p.y) &&
    p.x >= 0 &&
    p.y >= 0 &&
    p.x < MAP_SIZE &&
    p.y < MAP_SIZE
  );
}
function walkable(tiles: Terrain[], c: Colony, x: number, y: number) {
  if (x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE) return false;
  const tile = tiles[y * MAP_SIZE + x];
  return (
    tile !== "water" &&
    tile !== "rock" &&
    !c.buildings.some(
      (b) => b.built && b.type === "wall" && b.x === x && b.y === y,
    )
  );
}
function same(a: Point, b: Point) {
  return a.x === b.x && a.y === b.y;
}
function distance(a: Point, b: Point) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
function navigationGrid(tiles: Terrain[], c: Colony) {
  const grid = new Uint8Array(MAP_SIZE * MAP_SIZE);
  for (let i = 0; i < grid.length; i++)
    grid[i] = tiles[i] !== "water" && tiles[i] !== "rock" ? 1 : 0;
  for (const b of c.buildings)
    if (b.built && b.type === "wall") grid[b.y * MAP_SIZE + b.x] = 0;
  return grid;
}
function reachableTiles(tiles: Terrain[], c: Colony, from: Point) {
  const grid = navigationGrid(tiles, c),
    seen = new Uint8Array(grid.length),
    queue = new Int32Array(grid.length);
  const start = from.y * MAP_SIZE + from.x;
  seen[start] = 1;
  queue[0] = start;
  let head = 0,
    tail = 1;
  while (head < tail) {
    const p = queue[head++],
      x = p % MAP_SIZE,
      y = Math.floor(p / MAP_SIZE);
    for (const [nx, ny] of [
      [x + 1, y],
      [x, y + 1],
      [x - 1, y],
      [x, y - 1],
    ]) {
      const n = ny * MAP_SIZE + nx;
      if (
        nx < 0 ||
        ny < 0 ||
        nx >= MAP_SIZE ||
        ny >= MAP_SIZE ||
        seen[n] ||
        !grid[n]
      )
        continue;
      seen[n] = 1;
      queue[tail++] = n;
    }
  }
  return seen;
}
function reachableTarget(seen: Uint8Array, target: Point, adjacent = true) {
  if (seen[target.y * MAP_SIZE + target.x]) return true;
  if (!adjacent) return false;
  return [
    [target.x + 1, target.y],
    [target.x, target.y + 1],
    [target.x - 1, target.y],
    [target.x, target.y - 1],
  ].some(
    ([x, y]) =>
      x >= 0 &&
      y >= 0 &&
      x < MAP_SIZE &&
      y < MAP_SIZE &&
      seen[y * MAP_SIZE + x],
  );
}
function nearestReachable<T extends Point & { id: string }>(
  tiles: Terrain[],
  c: Colony,
  a: Colonist,
  targets: T[],
  adjacent = true,
): T | undefined {
  const seen = reachableTiles(tiles, c, a);
  return targets
    .filter((t) => reachableTarget(seen, t, adjacent))
    .sort(
      (x, y) => distance(a, x) - distance(a, y) || x.id.localeCompare(y.id),
    )[0];
}
function stepToward(
  tiles: Terrain[],
  c: Colony,
  from: Point,
  to: Point,
  adjacent = false,
): Point | null {
  if (adjacent ? distance(from, to) <= 1 : same(from, to)) return from;
  const grid = navigationGrid(tiles, c);
  const size = MAP_SIZE * MAP_SIZE;
  const start = from.y * MAP_SIZE + from.x;
  const prev = new Int32Array(size);
  prev.fill(-1);
  prev[start] = start;
  const queue = new Int32Array(size);
  queue[0] = start;
  let head = 0,
    tail = 1,
    goal = -1;
  while (head < tail) {
    const p = queue[head++],
      x = p % MAP_SIZE,
      y = Math.floor(p / MAP_SIZE);
    if (
      adjacent
        ? Math.abs(x - to.x) + Math.abs(y - to.y) <= 1
        : x === to.x && y === to.y
    ) {
      goal = p;
      break;
    }
    for (const [nx, ny] of [
      [x + 1, y],
      [x, y + 1],
      [x - 1, y],
      [x, y - 1],
    ]) {
      const n = ny * MAP_SIZE + nx;
      if (
        nx < 0 ||
        ny < 0 ||
        nx >= MAP_SIZE ||
        ny >= MAP_SIZE ||
        prev[n] !== -1 ||
        !grid[n]
      )
        continue;
      prev[n] = p;
      queue[tail++] = n;
    }
  }
  if (goal < 0) return null;
  while (prev[goal] !== start && prev[goal] !== goal) goal = prev[goal];
  return { x: goal % MAP_SIZE, y: Math.floor(goal / MAP_SIZE) };
}
function release(c: Colony, p: Colonist) {
  for (const bill of c.systems?.production ?? [])
    if (bill.workerId === p.id) bill.workerId = null;
  for (const b of c.buildings) if (b.reservedBy === p.id) b.reservedBy = null;
  for (const d of c.deposits) if (d.reservedBy === p.id) d.reservedBy = null;
  p.jobId = null;
  p.target = null;
  p.progress = 0;
}
function reset(c: Colony, p: Colonist, reason?: string) {
  release(c, p);
  p.task = reason ? "Waiting" : "Idle";
  p.progress = reason ? 10 : 0;
  p.blockedReason = reason || null;
}
function createColony(
  w: World,
  player: Player,
  siteId: string,
  name: string,
  scenario: string,
): Colony {
  const cid = id(w, "colony");
  const c: Colony = {
    id: cid,
    ownerId: player.id,
    siteId,
    name: name.trim().slice(0, 32) || "New Anchorage",
    resources: {
      scrap: 75,
      fiber: 35,
      rations: 28,
      components: 14,
      medicine: 8,
      fuel: 24,
    },
    colonists: [],
    buildings: [],
    deposits: [],
    events: [],
    power: 0,
    research: 0,
    autoCraft: true,
    scenario,
    storm: false,
    foundedTick: w.tick,
  };
  const crew = [
    ["Mara Voss", "Engineer", 1.3],
    ["Ivo Reed", "Scavenger", 1.15],
    ["Sera Vale", "Medic", 1],
  ] as const;
  c.colonists = crew.map((n, i) => ({
    id: id(w, "crew"),
    name: n[0],
    role: n[1],
    skill: n[2],
    color: COLORS[i],
    x: 30 + i,
    y: 32,
    health: 100,
    hunger: 88,
    energy: 90,
    morale: 78,
    task: "Idle",
    target: null,
    jobId: null,
    progress: 0,
    drafted: false,
    priority: "balanced",
    blockedReason: null,
    carrying: null,
  }));
  const add = (type: Building["type"], x: number, y: number, health = 100) =>
    c.buildings.push({
      id: id(w, "building"),
      type,
      x,
      y,
      built: true,
      progress: BUILDINGS[type].work,
      health,
      reservedBy: null,
    });
  add("stockpile", 31, 34);
  add("generator", 35, 30, 55);
  add("bed", 28, 28);
  add("foodStation", 29, 35);
  const rng = random(w.sites.find((s) => s.id === siteId)!.seed);
  const tiles = terrainFor(w, c);
  const used = new Set(c.buildings.map((b) => `${b.x},${b.y}`));
  for (let i = 0; i < 48; i++) {
    let x = 0,
      y = 0;
    for (let attempt = 0; attempt < 300; attempt++) {
      x = 8 + Math.floor(rng() * 47);
      y = 8 + Math.floor(rng() * 44);
      const key = `${x},${y}`;
      if (
        tiles[y * 64 + x] !== "water" &&
        tiles[y * 64 + x] !== "rock" &&
        !used.has(key) &&
        !(x >= 25 && x <= 38 && y >= 25 && y <= 39)
      ) {
        used.add(key);
        break;
      }
    }
    const resource: Resource =
      i % 7 === 0
        ? "fuel"
        : i % 5 === 0
          ? "components"
          : i % 3 === 0
            ? "fiber"
            : "scrap";
    c.deposits.push({
      id: id(w, "deposit"),
      x,
      y,
      resource,
      amount:
        resource === "components"
          ? 5
          : resource === "fuel"
            ? 8
            : 16 + Math.floor(rng() * 20),
      reservedBy: null,
    });
  }
  const origin = scenario.includes("lifeboat")
    ? "The Lifeboat"
    : scenario.includes("seedkeepers")
      ? "The Seedkeepers"
      : "The Last Shift";
  event(
    w,
    `${origin}: restore power, add bunks, then build a bilge pump and rain cistern before high tide.`,
    "info",
    c,
  );
  event(
    w,
    "Mara, Ivo and Sera have reached the old tide station. Home waters are protected.",
    "success",
    c,
  );
  ensureColonySystems(w, c);
  ensureMinds(w, c);
  return c;
}
const ok = (message: string): CommandResult => ({ ok: true, message });
const fail = (message: string): CommandResult => ({ ok: false, message });
export function applyCommand(
  w: World,
  actorId: string,
  cmd: Command,
): CommandResult {
  const p = w.players[actorId];
  if (!p) return fail("Unknown player.");
  if (cmd.type === "claim") {
    if (p.colonyId) return fail("You already have a home settlement.");
    const s = w.sites.find((s) => s.id === cmd.siteId);
    if (!s || s.ownerId) return fail("This settlement site is unavailable.");
    if (!cmd.name.trim() || cmd.name.length > 32)
      return fail("Settlement name must contain 1–32 characters.");
    const scenario = cmd.scenario.toLowerCase().replaceAll(" ", "-");
    if (
      ![
        "last-shift",
        "the-last-shift",
        "lifeboat",
        "the-lifeboat",
        "seedkeepers",
        "the-seedkeepers",
      ].includes(scenario)
    )
      return fail("Unknown starting scenario.");
    const c = createColony(w, p, s.id, cmd.name, scenario);
    if (scenario.includes("lifeboat")) {
      c.resources.rations += 12;
      c.resources.medicine += 5;
      c.resources.components -= 5;
    }
    if (scenario.includes("seedkeepers")) {
      c.resources.fiber += 30;
      c.resources.rations += 6;
      c.resources.scrap -= 15;
    }
    w.colonies[c.id] = c;
    p.colonyId = c.id;
    s.ownerId = actorId;
    event(w, `${p.name} founded ${c.name} at ${s.name}.`, "success");
    return ok(`Welcome to ${c.name}.`);
  }
  const c = colonyOf(w, actorId);
  if (!c) return fail("Claim a settlement before issuing colony orders.");
  ensureColonySystems(w, c);
  ensureMinds(w, c);
  const tiles = terrainFor(w, c);
  if (
    c.systems!.sheltered &&
    !(cmd.type === "policy" && cmd.policy === "shelter" && cmd.value === "off")
  )
    return fail("Exit shelter before issuing colony orders.");
  const expeditionResult = applyExpeditionCommand(w, actorId, cmd);
  if (expeditionResult) return expeditionResult;
  const mindResult = applyMindCommand(w, c, cmd);
  if (mindResult) return mindResult;
  const systemResult = applyColonyCommand(w, c, cmd, systemHelpers(tiles));
  if (systemResult) return systemResult;
  if (cmd.type === "move" || cmd.type === "draft" || cmd.type === "priority") {
    const crew = c.colonists.find((a) => a.id === cmd.colonistId);
    if (!crew) return fail("You do not own that colonist.");
    if (crew.away)
      return fail("This survivor is on an expedition. Use expedition orders.");
    if (cmd.type === "move") {
      if (!validPoint(cmd) || !walkable(tiles, c, cmd.x, cmd.y))
        return fail("Choose a reachable land or deck tile.");
      if (!stepToward(tiles, c, crew, cmd))
        return fail("No path to that location.");
      release(c, crew);
      crew.target = { x: cmd.x, y: cmd.y };
      crew.task = "Moving";
      crew.blockedReason = null;
      return ok(`${crew.name.split(" ")[0]} is moving.`);
    }
    if (cmd.type === "draft") {
      release(c, crew);
      crew.drafted = cmd.drafted;
      crew.task = cmd.drafted ? "Standing guard" : "Idle";
      crew.blockedReason = null;
      return ok(
        cmd.drafted ? "Colonist drafted." : "Colonist returned to work.",
      );
    }
    crew.priority = cmd.priority;
    reset(c, crew);
    return ok("Work priority updated.");
  }
  if (cmd.type === "build") {
    const def = BUILDINGS[cmd.building];
    if (!def) return fail("Unknown construction.");
    if (!validPoint(cmd) || !walkable(tiles, c, cmd.x, cmd.y))
      return fail("Build on clear land or deck.");
    if (c.buildings.some((b) => same(b, cmd)))
      return fail("There is already a structure or blueprint here.");
    if (c.deposits.some((d) => d.amount > 0 && same(d, cmd)))
      return fail("Salvage the materials on this tile first.");
    if (c.buildings.length >= 220)
      return fail("Prototype structure limit reached.");
    if (!afford(c, def.cost))
      return fail("Insufficient construction materials.");
    if (cmd.building === "wall" && c.colonists.some((a) => same(a, cmd)))
      return fail("A colonist is standing here.");
    cost(c, def.cost, -1);
    c.buildings.push({
      id: id(w, "building"),
      type: cmd.building,
      x: cmd.x,
      y: cmd.y,
      built: false,
      progress: 0,
      health: 100,
      reservedBy: null,
    });
    return ok(`${def.name} blueprint placed. Materials reserved.`);
  }
  if (cmd.type === "cancelBuild") {
    const b = c.buildings.find((b) => b.id === cmd.buildingId && !b.built);
    if (!b) return fail("Blueprint not found.");
    for (const a of c.colonists) if (a.jobId === b.id) reset(c, a);
    cost(c, BUILDINGS[b.type].cost, 1);
    c.buildings = c.buildings.filter((a) => a !== b);
    return ok("Blueprint canceled; materials returned.");
  }
  if (cmd.type === "deconstruct") {
    const b = c.buildings.find((b) => b.id === cmd.buildingId && b.built);
    if (!b)
      return fail(
        "Owned completed structure not found. Cancel unfinished blueprints instead.",
      );
    for (const a of c.colonists) if (a.jobId === b.id) reset(c, a);
    const refund: Partial<Inventory> = {};
    for (const r of RESOURCES) {
      const amount = Math.floor((BUILDINGS[b.type].cost[r] || 0) / 2);
      if (amount) refund[r] = amount;
    }
    if (b.repairSupplies) refund.scrap = (refund.scrap || 0) + 2;
    cost(c, refund, 1);
    c.buildings = c.buildings.filter((building) => building !== b);
    refreshColonyCapacities(c);
    event(
      w,
      `${BUILDINGS[b.type].name} deconstructed. Half of each construction material (rounded down) recovered; reserved repair supplies returned.`,
      "info",
      c,
    );
    return ok(
      "Structure deconstructed. Recovered 50% of each material, rounded down, plus any reserved repair supplies.",
    );
  }
  if (cmd.type === "craft") {
    c.autoCraft = cmd.enabled;
    return ok(
      cmd.enabled
        ? "Automatic fabrication enabled."
        : "Automatic fabrication paused.",
    );
  }
  if (cmd.type === "repair") {
    const b = c.buildings.find((a) => a.id === cmd.buildingId && a.built);
    if (!b) return fail("Structure not found.");
    if (b.health >= 100) return fail("Structure is already in good repair.");
    if (b.reservedBy)
      return fail("A crew member is already repairing this structure.");
    if (!b.repairSupplies && c.resources.scrap < 2)
      return fail("Repairs need 2 scrap.");
    const a = c.colonists.find((a) => !a.drafted && a.health > 0);
    if (!a) return fail("No available crew member.");
    if (!stepToward(tiles, c, a, b, true))
      return fail("No path to the damaged structure.");
    reset(c, a);
    if (!b.repairSupplies) {
      c.resources.scrap -= 2;
      b.repairSupplies = true;
    }
    b.reservedBy = a.id;
    a.jobId = b.id;
    a.target = { x: b.x, y: b.y };
    a.task = "Repairing";
    return ok(
      `${a.name.split(" ")[0]} assigned to repairs. Supplies stay reserved on the structure if interrupted.`,
    );
  }
  if (cmd.type === "alliance") {
    const target = w.players[cmd.targetId];
    if (!target || target.id === actorId || !target.colonyId)
      return fail("Choose another settled player.");
    const pair = (a: [string, string]) =>
      a.includes(actorId) && a.includes(target.id);
    if (cmd.action === "revoke") {
      w.alliances = w.alliances.filter((a) => !pair(a));
      w.allianceRequests = w.allianceRequests.filter((a) => !pair(a));
      return ok("Alliance and pending requests revoked.");
    }
    if (w.alliances.some(pair)) return fail("You are already allied.");
    if (cmd.action === "accept") {
      const r = w.allianceRequests.find(
        (a) => a[0] === target.id && a[1] === actorId,
      );
      if (!r) return fail("No alliance request from that player.");
      w.allianceRequests = w.allianceRequests.filter((a) => !pair(a));
      w.alliances.push([target.id, actorId]);
      event(w, `${p.name} and ${target.name} formed an alliance.`, "success");
      return ok("Alliance formed. Home inventories remain separately owned.");
    }
    if (w.allianceRequests.some(pair))
      return fail("An alliance request is already pending.");
    w.allianceRequests.push([actorId, target.id]);
    return ok("Alliance request sent.");
  }
  if (cmd.type === "trade") {
    const other = colonyOf(w, cmd.targetId);
    if (other?.systems?.sheltered)
      return fail("This settlement is sheltered and unavailable for trade.");
    if (!other || cmd.targetId === actorId)
      return fail("Choose another settled player.");
    if (
      !RESOURCES.includes(cmd.give) ||
      !RESOURCES.includes(cmd.want) ||
      !Number.isInteger(cmd.giveAmount) ||
      !Number.isInteger(cmd.wantAmount) ||
      cmd.giveAmount < 1 ||
      cmd.wantAmount < 1 ||
      cmd.giveAmount > 999 ||
      cmd.wantAmount > 999
    )
      return fail("Invalid trade quantities.");
    if (c.resources[cmd.give] < cmd.giveAmount)
      return fail("Not enough goods to place in escrow.");
    if (
      w.offers.filter((a) => a.from === actorId && a.status === "open")
        .length >= 5
    )
      return fail("At most five open offers are allowed.");
    c.resources[cmd.give] -= cmd.giveAmount;
    w.offers.push({
      id: id(w, "trade"),
      from: actorId,
      to: cmd.targetId,
      give: cmd.give,
      giveAmount: cmd.giveAmount,
      want: cmd.want,
      wantAmount: cmd.wantAmount,
      status: "open",
      createdTick: w.tick,
    });
    return ok("Offer sent. Goods held in escrow (prototype dock transfer).");
  }
  if (cmd.type === "tradeRespond") {
    const offer = w.offers.find((o) => o.id === cmd.offerId);
    if (
      !offer ||
      offer.status !== "open" ||
      (offer.from !== actorId && offer.to !== actorId)
    )
      return fail("No actionable trade offer.");
    const from = colonyOf(w, offer.from),
      to = colonyOf(w, offer.to);
    if (!from || !to) return fail("Trading settlement unavailable.");
    if (!cmd.accept) {
      from.resources[offer.give] += offer.giveAmount;
      offer.status = "cancelled";
      return ok("Offer canceled and escrow returned.");
    }
    if (offer.to !== actorId) return fail("Only the recipient can accept.");
    if (to.resources[offer.want] < offer.wantAmount)
      return fail("Not enough goods to accept this offer.");
    if (
      storageRoom(from) < offer.wantAmount ||
      storageRoom(to) + offer.wantAmount < offer.giveAmount
    )
      return fail("A trading settlement needs more stockpile capacity.");
    to.resources[offer.want] -= offer.wantAmount;
    from.resources[offer.want] += offer.wantAmount;
    to.resources[offer.give] += offer.giveAmount;
    offer.status = "accepted";
    event(
      w,
      `Dock exchange completed with ${w.players[offer.from].name}.`,
      "success",
      to,
    );
    event(
      w,
      `Dock exchange completed with ${w.players[offer.to].name}.`,
      "success",
      from,
    );
    return ok("Trade settled atomically.");
  }
  return fail("Unsupported command.");
}
function moveForJob(
  tiles: Terrain[],
  c: Colony,
  a: Colonist,
  target: Point,
  adjacent = false,
) {
  if (adjacent ? distance(a, target) <= 1 : same(a, target)) return true;
  const next = stepToward(tiles, c, a, target, adjacent);
  if (!next) {
    reset(c, a, "No path to work location");
    return false;
  }
  a.x = next.x;
  a.y = next.y;
  return false;
}
function selectJob(tiles: Terrain[], c: Colony, a: Colonist) {
  const seen = reachableTiles(tiles, c, a);
  const blueprints = c.buildings.filter((b) => !b.built && !b.reservedBy);
  const deposits = c.deposits.filter((d) => d.amount > 0 && !d.reservedBy);
  const byDistance = (x: Point & { id: string }, y: Point & { id: string }) =>
    distance(a, x) - distance(a, y) || x.id.localeCompare(y.id);
  const b = blueprints
    .filter((b) => reachableTarget(seen, b))
    .sort(byDistance)[0];
  const d = deposits
    .filter((d) => reachableTarget(seen, d))
    .sort(byDistance)[0];
  if (b && (a.priority !== "salvage" || !d)) {
    b.reservedBy = a.id;
    a.jobId = b.id;
    a.target = { x: b.x, y: b.y };
    a.task = "Building";
    a.blockedReason = null;
    return;
  }
  if (d) {
    d.reservedBy = a.id;
    a.jobId = d.id;
    a.target = { x: d.x, y: d.y };
    a.task = "Salvaging";
    a.blockedReason = null;
    return;
  }
  reset(
    c,
    a,
    blueprints.length || deposits.length
      ? "No reachable work — open a route to materials or blueprints"
      : "No eligible work — place a blueprint or explore supplies",
  );
}

function systemHelpers(tiles: Terrain[]): SystemHelpers {
  return {
    tiles,
    release,
    reset,
    move: (c, a, p, adjacent) => moveForJob(tiles, c, a, p, adjacent),
    nearest: <T extends Point & { id: string }>(
      c: Colony,
      a: Colonist,
      t: T[],
      adjacent?: boolean,
    ) => nearestReachable(tiles, c, a, t, adjacent),
    workMultiplier,
    experience: skillExperience,
    reachable: (c, a, p, adjacent) =>
      stepToward(tiles, c, a, p, adjacent) !== null,
  };
}
export function upgradeWorld(w: World) {
  ensureExpeditions(w);
  for (const c of Object.values(w.colonies)) {
    ensureColonySystems(w, c);
    ensureMinds(w, c);
  }
}
function tickColony(w: World, c: Colony) {
  ensureColonySystems(w, c);
  ensureMinds(w, c);
  if (c.systems!.sheltered) return;
  const tiles = terrainFor(w, c);
  const helpers = systemHelpers(tiles);
  tickColonySystems(w, c, helpers);
  if (w.tick % 100 === 0) {
    for (const a of c.colonists) {
      if (a.away) continue;
      a.hunger = Math.max(0, a.hunger - 1);
      a.energy = Math.max(0, a.energy - 1);
      if (a.hunger < 15) a.morale = Math.max(0, a.morale - 1);
      else if (a.energy > 60) a.morale = Math.min(100, a.morale + 1);
      if (a.hunger === 0 && a.health > 5) a.health = Math.max(5, a.health - 1);
    }
  }
  const age = w.tick - (c.foundedTick ?? 0);
  if (age === 900) {
    event(
      w,
      "Weather watch: a squall is moving across the shoal. Check your generator and supplies.",
      "warning",
      c,
    );
  }
  if (age > 1800 && age % 2400 === 0) {
    c.storm = true;
    event(
      w,
      "A passing squall battered the outpost. Exposed machinery needs attention.",
      "warning",
      c,
    );
    for (const b of c.buildings)
      if (b.built && b.type === "generator")
        b.health = Math.max(35, b.health - 20);
  }
  if (c.storm && age % 2400 === 300) c.storm = false;
  if (w.tick % 3 !== 0) return;
  for (const a of c.colonists) {
    if (a.away) continue;
    if (a.health <= 0) {
      reset(c, a, "Incapacitated");
      a.task = "Incapacitated";
      continue;
    }
    if ((a.mind?.breakUntil ?? 0) > w.tick) {
      release(c, a);
      a.task = "Stress recovery";
      continue;
    }
    if (a.task === "Waiting") {
      a.progress--;
      if (a.progress <= 0) {
        a.task = "Idle";
        a.progress = 0;
      }
      continue;
    }
    if (
      a.hunger < (c.systems!.rationing ? 20 : 45) &&
      c.resources.rations > 0 &&
      !a.drafted
    ) {
      reset(c, a);
      c.resources.rations--;
      a.hunger = Math.min(100, a.hunger + (c.systems!.rationing ? 20 : 35));
      a.task = "Eating";
      continue;
    }
    if (a.energy < 25 && !a.drafted && a.task !== "Resting") {
      const bed = nearestReachable(
        tiles,
        c,
        a,
        c.buildings.filter((b) => b.type === "bed" && b.built && !b.reservedBy),
        false,
      );
      if (bed) {
        reset(c, a);
        bed.reservedBy = a.id;
        a.jobId = bed.id;
        a.target = { x: bed.x, y: bed.y };
        a.task = "Resting";
      }
    }
    if (tickColonistSystems(w, c, a, helpers)) continue;
    if (a.task === "Moving" && a.target) {
      if (moveForJob(tiles, c, a, a.target)) {
        reset(c, a);
        if (a.drafted) a.task = "Standing guard";
      }
      continue;
    }
    if (a.drafted) {
      a.task = "Standing guard";
      continue;
    }
    // A full store must not prevent its own expansion. Builders retain carried goods.
    if (a.carrying && storageRoom(c) <= 0 && a.task !== "Building") {
      const expansion = nearestReachable(
        tiles,
        c,
        a,
        c.buildings.filter(
          (b) => !b.built && b.type === "stockpile" && !b.reservedBy,
        ),
      );
      if (expansion) {
        release(c, a);
        expansion.reservedBy = a.id;
        a.jobId = expansion.id;
        a.target = { x: expansion.x, y: expansion.y };
        a.task = "Building";
        a.blockedReason = null;
      }
    }
    const buildingStorage =
      a.task === "Building" &&
      c.buildings.some(
        (b) => b.id === a.jobId && b.type === "stockpile" && !b.built,
      );
    if (a.carrying && !buildingStorage) {
      const stock = nearestReachable(
        tiles,
        c,
        a,
        c.buildings.filter((b) => b.built && b.type === "stockpile"),
      );
      if (!stock) {
        reset(
          c,
          a,
          "No reachable stockpile — build one or open a route to unload supplies",
        );
        continue;
      }
      if (a.task !== "Hauling") {
        release(c, a);
        a.task = "Hauling";
        a.blockedReason = null;
      }
      a.target = { x: stock.x, y: stock.y };
      if (moveForJob(tiles, c, a, stock, true)) {
        const quantity = Math.min(a.carrying.amount, storageRoom(c));
        if (quantity <= 0) {
          a.blockedReason = "Stockpile full — build more storage";
          continue;
        }
        c.resources[a.carrying.resource] += quantity;
        a.carrying.amount -= quantity;
        if (!a.carrying.amount) {
          a.carrying = null;
          reset(c, a);
        } else a.blockedReason = "Stockpile full — remaining cargo retained";
      }
      continue;
    }
    if (a.task === "Resting") {
      const bed = c.buildings.find((b) => b.id === a.jobId);
      if (!bed) {
        reset(c, a);
        continue;
      }
      if (moveForJob(tiles, c, a, bed)) {
        a.energy = Math.min(100, a.energy + 2);
        if (a.energy >= 95) reset(c, a);
      }
      continue;
    }
    if (a.task === "Repairing") {
      const b = c.buildings.find((b) => b.id === a.jobId);
      if (!b) {
        reset(c, a);
        continue;
      }
      if (moveForJob(tiles, c, a, b, true)) {
        b.health = Math.min(100, b.health + 3);
        if (b.health === 100) {
          b.repairSupplies = false;
          event(
            w,
            `${BUILDINGS[b.type].name} repaired. Systems restored.`,
            "success",
            c,
          );
          reset(c, a);
        }
      }
      continue;
    }
    if (a.task === "Building") {
      const b = c.buildings.find((b) => b.id === a.jobId && !b.built);
      if (!b) {
        reset(c, a);
        continue;
      }
      if (moveForJob(tiles, c, a, b, true)) {
        b.progress += workMultiplier(c, a, "construction");
        skillExperience(a, "construction", 0.01);
        a.progress = b.progress / BUILDINGS[b.type].work;
        if (b.progress >= BUILDINGS[b.type].work) {
          if (b.type === "wall" && c.colonists.some((crew) => same(crew, b))) {
            b.progress = BUILDINGS[b.type].work;
            a.blockedReason = "A crew member must leave this bulkhead tile";
            continue;
          }
          b.built = true;
          b.progress = BUILDINGS[b.type].work;
          event(w, `${BUILDINGS[b.type].name} completed.`, "success", c);
          reset(c, a);
        }
      }
      continue;
    }
    if (a.task === "Salvaging") {
      const d = c.deposits.find((d) => d.id === a.jobId && d.amount > 0);
      if (!d) {
        reset(c, a);
        continue;
      }
      if (moveForJob(tiles, c, a, d, true)) {
        a.progress += workMultiplier(c, a, "salvage");
        skillExperience(a, "salvage", 0.01);
        if (a.progress >= 10) {
          const amount = Math.min(4, d.amount);
          d.amount -= amount;
          a.carrying = { resource: d.resource, amount };
          release(c, a);
          a.task = "Hauling";
          a.blockedReason = null;
        }
      }
      continue;
    }
    if (a.task === "Researching") continue;
    const blueprints = c.buildings.some((b) => !b.built && !b.reservedBy);
    if (
      (!blueprints || a.priority === "salvage") &&
      selectSystemsJob(w, c, a, helpers)
    )
      continue;
    selectJob(tiles, c, a);
  }
}
function trimTradeHistory(w: World) {
  const closed = w.offers.filter((o) => o.status !== "open");
  if (closed.length > 200) {
    const retain = new Set(closed.slice(-200).map((o) => o.id));
    w.offers = w.offers.filter((o) => o.status === "open" || retain.has(o.id));
  }
}
export function tickWorld(w: World, steps = 1): void {
  if (!Number.isInteger(steps) || steps < 0 || steps > 36000)
    throw new Error("Tick count must be an integer between 0 and 36000.");
  for (let i = 0; i < steps; i++) {
    w.tick++;
    for (const c of Object.values(w.colonies).sort((a, b) =>
      a.id.localeCompare(b.id),
    )) {
      tickColony(w, c);
      if (!c.systems?.sheltered)
        tickMinds(w, c, systemHelpers(terrainFor(w, c)));
    }
    tickExpeditions(w);
    if (w.tick % 100 === 0) {
      for (const offer of w.offers) {
        if (offer.status === "open" && w.tick - offer.createdTick > 6000) {
          const from = colonyOf(w, offer.from);
          if (from) from.resources[offer.give] += offer.giveAmount;
          offer.status = "cancelled";
        }
      }
      trimTradeHistory(w);
    }
  }
}
export function getPlayerView(w: World, playerId: string): GameView {
  const you = w.players[playerId];
  if (!you) throw new Error("Unknown player");
  return structuredClone({
    version: 1,
    tick: w.tick,
    seed: w.seed,
    you,
    players: Object.values(w.players),
    sites: w.sites,
    colony: colonyOf(w, playerId) || null,
    colonies: Object.values(w.colonies).map((c) => ({
      id: c.id,
      ownerId: c.ownerId,
      siteId: c.siteId,
      name: c.name,
      population: c.colonists.length,
    })),
    alliances: w.alliances,
    allianceRequests: w.allianceRequests.filter((a) => a.includes(playerId)),
    offers: [
      ...w.offers.filter(
        (a) =>
          (a.from === playerId || a.to === playerId) && a.status === "open",
      ),
      ...w.offers
        .filter(
          (a) =>
            (a.from === playerId || a.to === playerId) && a.status !== "open",
        )
        .slice(-20),
    ],
    events: w.events,
    ...getExpeditionView(w, playerId),
  });
}
