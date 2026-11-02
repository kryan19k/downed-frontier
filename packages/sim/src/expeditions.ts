import type {
  World,
  Colony,
  Command,
  CommandResult,
  Expedition,
  ExpeditionSite,
  CombatUnit,
  Point,
  Resource,
} from "@frontier/shared";

const RESOURCES: Resource[] = [
  "scrap",
  "fiber",
  "rations",
  "components",
  "medicine",
  "fuel",
];
const ACTIVE = new Set<Expedition["phase"]>(["combat", "exploring"]);
const TRAVEL = 200;
const ok = (message: string): CommandResult => ({ ok: true, message });
const fail = (message: string): CommandResult => ({ ok: false, message });
const nextId = (w: World, prefix: string) => `${prefix}-${w.nextId++}`;
const distance = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const quantity = (inventory: Partial<Record<Resource, number>>) =>
  RESOURCES.reduce((sum, r) => sum + (inventory[r] || 0), 0);
function colonyOf(w: World, owner: string): Colony | undefined {
  const key = w.players[owner]?.colonyId;
  return key ? w.colonies[key] : undefined;
}
function log(e: Expedition, message: string) {
  e.log.unshift(message);
  e.log = e.log.slice(0, 30);
}
function event(
  w: World,
  c: Colony,
  text: string,
  kind: "info" | "success" | "warning" | "danger" = "info",
) {
  c.events.unshift({ id: nextId(w, "event"), tick: w.tick, kind, text });
  c.events = c.events.slice(0, 40);
}
function allied(w: World, a: string, b: string) {
  return (
    a === b || w.alliances.some((pair) => pair.includes(a) && pair.includes(b))
  );
}
function deterministic(seed: number, tick: number, a: string, b: string) {
  let n = (seed ^ tick) | 0;
  for (const ch of a + b) n = Math.imul(n ^ ch.charCodeAt(0), 16777619);
  return (n >>> 0) % 100;
}

/** These are authoritative cover/LOS tiles, shared with the tactical renderer. */
export function getEncounterObstacles(siteId: string): Point[] {
  const shift =
    siteId === "leviathan-nest" ? 2 : siteId === "drowned-archive" ? 0 : -2;
  return [
    { x: 13 + shift, y: 9 },
    { x: 14 + shift, y: 9 },
    { x: 15 + shift, y: 9 },
    { x: 20, y: 15 },
    { x: 20, y: 16 },
    { x: 8, y: 20 },
    { x: 9, y: 20 },
    { x: 23, y: 23 },
  ];
}
const valid = (p: Point) =>
  Number.isInteger(p.x) &&
  Number.isInteger(p.y) &&
  p.x >= 0 &&
  p.x < 32 &&
  p.y >= 0 &&
  p.y < 32;
function open(site: string, p: Point) {
  return (
    valid(p) &&
    !getEncounterObstacles(site).some((o) => o.x === p.x && o.y === p.y)
  );
}
function hasLineOfSight(site: string, a: Point, b: Point) {
  let x = a.x,
    y = a.y;
  const dx = Math.abs(b.x - x),
    sx = x < b.x ? 1 : -1,
    dy = -Math.abs(b.y - y),
    sy = y < b.y ? 1 : -1;
  let err = dx + dy;
  for (let i = 0; i < 64; i++) {
    if (x === b.x && y === b.y) return true;
    if ((x !== a.x || y !== a.y) && !open(site, { x, y })) return false;
    const twice = 2 * err;
    if (twice >= dy) {
      err += dy;
      x += sx;
    }
    if (twice <= dx) {
      err += dx;
      y += sy;
    }
  }
  return false;
}
function step(site: string, from: Point, target: Point): Point | null {
  if (from.x === target.x && from.y === target.y) return from;
  const start = from.y * 32 + from.x,
    prev = new Int16Array(1024);
  prev.fill(-1);
  prev[start] = start;
  const queue = [start];
  let end = -1;
  for (let head = 0; head < queue.length; head++) {
    const p = queue[head],
      x = p % 32,
      y = Math.floor(p / 32);
    if (x === target.x && y === target.y) {
      end = p;
      break;
    }
    for (const n of [
      { x: x + 1, y },
      { x, y: y + 1 },
      { x: x - 1, y },
      { x, y: y - 1 },
    ]) {
      if (!open(site, n)) continue;
      const key = n.y * 32 + n.x;
      if (prev[key] !== -1) continue;
      prev[key] = p;
      queue.push(key);
    }
  }
  if (end < 0) return null;
  while (prev[end] !== start && prev[end] !== end) end = prev[end];
  return { x: end % 32, y: Math.floor(end / 32) };
}
export function ensureExpeditions(w: World): void {
  w.expeditions ??= [];
  w.expeditionSites ??= [
    {
      id: "salvage-reef",
      name: "Wreckwater Salvage",
      description: "A contested wreck shoal. Light feral scavenger activity.",
      risk: 1,
      x: 77,
      y: 61,
      kind: "salvage",
      loot: { scrap: 72, components: 15, fuel: 16 },
    },
    {
      id: "drowned-archive",
      name: "The Drowned Archive",
      description: "A submerged research platform defended by reefstalkers.",
      risk: 2,
      x: 48,
      y: 48,
      kind: "ruin",
      loot: { components: 35, medicine: 18, scrap: 36 },
    },
    {
      id: "leviathan-nest",
      name: "Leviathan Nursery",
      description: "A dangerous nest near a rich biological cache.",
      risk: 3,
      x: 22,
      y: 79,
      kind: "nest",
      loot: { fiber: 80, medicine: 30, fuel: 24 },
    },
  ];
}
function siteUnits(w: World, site: string): CombatUnit[] {
  return (w.expeditions || [])
    .filter((e) => e.siteId === site)
    .flatMap((e) =>
      e.units.filter((u) => u.ownerId === "wildlife" || ACTIVE.has(e.phase)),
    );
}
function ownUnits(e: Expedition) {
  return e.units.filter(
    (u) => u.ownerId === e.ownerId && u.colonistId !== null,
  );
}
function releaseForDeparture(c: Colony, id: string) {
  const crew = c.colonists.find((a) => a.id === id)!;
  for (const b of c.buildings) if (b.reservedBy === id) b.reservedBy = null;
  for (const d of c.deposits) if (d.reservedBy === id) d.reservedBy = null;
  for (const b of c.systems?.production || [])
    if (b.workerId === id) b.workerId = null;
  crew.jobId = null;
  crew.target = null;
  crew.progress = 0;
  crew.drafted = false;
  crew.blockedReason = null;
}
export function applyExpeditionCommand(
  w: World,
  actorId: string,
  cmd: Command,
): CommandResult | null {
  if (
    ![
      "expeditionLaunch",
      "expeditionOrder",
      "expeditionAttack",
      "expeditionRetreat",
    ].includes(cmd.type)
  )
    return null;
  ensureExpeditions(w);
  const c = colonyOf(w, actorId);
  if (!c) return fail("Claim a home settlement before deploying.");
  if (cmd.type === "expeditionLaunch") {
    const site = w.expeditionSites!.find((s) => s.id === cmd.siteId);
    if (!site) return fail("Unknown expedition destination.");
    if (c.systems?.sheltered)
      return fail("Leave shelter before dispatching an expedition.");
    if (
      !Array.isArray(cmd.colonistIds) ||
      cmd.colonistIds.length < 1 ||
      cmd.colonistIds.length > 3 ||
      new Set(cmd.colonistIds).size !== cmd.colonistIds.length
    )
      return fail("Choose one to three distinct crew members.");
    if (
      w.expeditions!.some(
        (e) => e.ownerId === actorId && e.phase !== "complete",
      )
    )
      return fail("Return your active expedition before launching another.");
    const crew = cmd.colonistIds.map((id) =>
      c.colonists.find((a) => a.id === id),
    );
    if (crew.some((a) => !a || a.away || a.health < 25))
      return fail(
        "Expedition crew must belong to you, be at home, and have at least 25 health.",
      );
    const provision = cmd.colonistIds.length * 2;
    if (c.resources.fuel < provision || c.resources.rations < provision)
      return fail(
        `Expedition needs ${provision} fuel and ${provision} rations.`,
      );
    // Every condition is checked before reserving crew or consuming provisions.
    const eid = nextId(w, "expedition");
    c.resources.fuel -= provision;
    c.resources.rations -= provision;
    const e: Expedition = {
      id: eid,
      ownerId: actorId,
      siteId: site.id,
      colonistIds: cmd.colonistIds.slice(),
      phase: "outbound",
      departTick: w.tick,
      arrivalTick:
        w.tick +
        (site.kind !== "salvage" && c.systems?.unlocked.includes("abyss")
          ? 150
          : TRAVEL),
      cargo: {},
      units: [],
      log: [],
      retreating: false,
      losses: 0,
    };
    const occupied = new Set(
      w
        .expeditions!.filter(
          (other) =>
            other.siteId === site.id &&
            other.phase !== "complete" &&
            other.phase !== "returning",
        )
        .flatMap((other) => other.units.map((u) => `${u.x},${u.y}`)),
    );
    const landing: Point[] = [];
    for (let x = 3; x <= 28; x += 3) landing.push({ x, y: 3 }, { x, y: 28 });
    for (let y = 6; y <= 25; y += 3) landing.push({ x: 3, y }, { x: 28, y });
    for (const [i, a] of crew.entries()) {
      releaseForDeparture(c, a!.id);
      a!.away = eid;
      a!.task = "On expedition";
      const position = landing.find((p) => !occupied.has(`${p.x},${p.y}`)) || {
        x: 5 + i * 2,
        y: 5,
      };
      occupied.add(`${position.x},${position.y}`);
      e.units.push({
        id: nextId(w, "unit"),
        colonistId: a!.id,
        ownerId: actorId,
        name: a!.name,
        x: position.x,
        y: position.y,
        health: a!.health,
        maxHealth: 100,
        cooldown: 0,
        targetId: null,
        moveTarget: null,
        weapon: "carbine",
        downed: false,
      });
    }
    log(
      e,
      `Departed for ${site.name}; arrival in ${(e.arrivalTick - w.tick) / 10} seconds. The site is contested and carried loot can be lost.`,
    );
    w.expeditions!.push(e);
    event(w, c, `Expedition departed for ${site.name}.`, "info");
    return ok("Crew deployed. Home jobs released; supplies consumed once.");
  }
  if (
    cmd.type !== "expeditionOrder" &&
    cmd.type !== "expeditionAttack" &&
    cmd.type !== "expeditionRetreat"
  )
    return null;
  const e = w.expeditions!.find(
    (e) => e.id === cmd.expeditionId && e.ownerId === actorId,
  );
  if (!e || e.phase === "complete")
    return fail("Owned active expedition not found.");
  if (cmd.type === "expeditionRetreat") {
    if (e.phase === "returning")
      return fail("Expedition is already returning.");
    if (ACTIVE.has(e.phase)) {
      e.retreating = true;
      e.phase = "combat";
      ownUnits(e)
        .filter((u) => !u.downed)
        .forEach((u, i) => {
          u.targetId = null;
          u.moveTarget = { x: 4 + i, y: 4 };
        });
      log(
        e,
        "Withdrawing to the extraction point. Enemies can still attack until the able crew reach safety.",
      );
    } else beginReturn(w, e, true);
    return ok(
      "Retreat ordered. Reach extraction before the twenty-second voyage home.",
    );
  }
  if (!ACTIVE.has(e.phase))
    return fail("Tactical orders require arrival at the expedition site.");
  if (e.retreating) return fail("The party is withdrawing to extraction.");
  const unit = e.units.find(
    (u) =>
      u.id === cmd.unitId &&
      u.ownerId === actorId &&
      u.colonistId !== null &&
      !u.downed,
  );
  if (!unit) return fail("Choose an able unit in your expedition.");
  if (cmd.type === "expeditionOrder") {
    if (!open(e.siteId, cmd))
      return fail("Choose a clear tactical tile within the 32×32 encounter.");
    if (
      siteUnits(w, e.siteId).some(
        (other) =>
          other.id !== unit.id &&
          !other.downed &&
          other.x === cmd.x &&
          other.y === cmd.y,
      )
    )
      return fail("That tactical tile is occupied.");
    if (!step(e.siteId, unit, cmd))
      return fail("No tactical route to that tile.");
    unit.moveTarget = { x: cmd.x, y: cmd.y };
    unit.targetId = null;
    return ok(`${unit.name.split(" ")[0]} moving to cover.`);
  }
  const target = siteUnits(w, e.siteId).find(
    (u) => u.id === cmd.targetId && !u.downed,
  );
  if (!target) return fail("Target is not visible in this encounter.");
  if (allied(w, actorId, target.ownerId))
    return fail("You cannot attack your crew or an allied expedition.");
  unit.targetId = target.id;
  unit.moveTarget = null;
  e.phase = "combat";
  const targetExp = w.expeditions!.find(
    (other) =>
      other.units.some((u) => u.id === target.id) &&
      other.ownerId === target.ownerId,
  );
  if (targetExp && ACTIVE.has(targetExp.phase)) {
    targetExp.phase = "combat";
    log(
      targetExp,
      `${w.players[actorId]?.name || "A rival"} opened fire. Your crew will defend themselves.`,
    );
  }
  log(e, `${unit.name} ordered to engage ${target.name}.`);
  return ok(
    "Target designated. Range, cover and cooldown resolve on the server.",
  );
}
function beginReturn(w: World, e: Expedition, retreating: boolean) {
  if (e.phase === "returning" || e.phase === "complete") return;
  e.retreating = retreating;
  if (retreating) {
    for (const r of RESOURCES) {
      const amount = e.cargo[r] || 0;
      const loss = Math.floor(amount * 0.25);
      e.cargo[r] = amount - loss;
      e.losses += loss;
    }
  }
  e.phase = "returning";
  e.arrivalTick = w.tick + TRAVEL;
  for (const u of ownUnits(e)) {
    u.targetId = null;
    u.moveTarget = null;
  }
  log(
    e,
    retreating
      ? "Retreating: 20 seconds to home. A quarter of carried loot (rounded down) was abandoned."
      : "Salvage secured. Returning home in 20 seconds.",
  );
}
function spawnDefenders(w: World, e: Expedition, site: ExpeditionSite) {
  if (
    w.expeditions!.some(
      (other) =>
        other.siteId === site.id &&
        other.units.some((u) => u.ownerId === "wildlife"),
    )
  )
    return;
  for (let i = 0; i < site.risk; i++)
    e.units.push({
      id: nextId(w, "hostile"),
      colonistId: null,
      ownerId: "wildlife",
      name: site.kind === "nest" ? "Reef leviathan" : "Reefstalker",
      x: 18 + i * 3,
      y: 18 + (i % 2) * 3,
      health: 40 + site.risk * 8,
      maxHealth: 40 + site.risk * 8,
      cooldown: 0,
      targetId: null,
      moveTarget: null,
      weapon: "claws",
      downed: false,
    });
}
function cover(site: string, target: Point) {
  return getEncounterObstacles(site).some((p) => distance(p, target) === 1);
}
function attack(w: World, site: string, a: CombatUnit, b: CombatUnit) {
  if (a.cooldown > w.tick) return;
  a.cooldown = w.tick + (a.weapon === "carbine" ? 12 : 18);
  const owner = colonyOf(w, a.ownerId);
  const bonus = owner?.systems?.unlocked.includes("ballistics") ? 12 : 0;
  const chance =
    a.weapon === "carbine" ? 85 + bonus - (cover(site, b) ? 25 : 0) : 95;
  if (deterministic(w.seed, w.tick, a.id, b.id) >= chance) return;
  const sourceCrew = owner?.colonists.find((crew) => crew.id === a.colonistId);
  const reckless = sourceCrew?.mind?.traits.includes("Reckless");
  const targetCrew = colonyOf(w, b.ownerId)?.colonists.find(
    (crew) => crew.id === b.colonistId,
  );
  const exposed = targetCrew?.mind?.traits.includes("Reckless");
  const damage =
    (a.weapon === "carbine" ? 13 : 5) + (reckless ? 2 : 0) + (exposed ? 1 : 0);
  b.health = Math.max(0, b.health - damage);
  if (sourceCrew?.mind)
    sourceCrew.mind.skills.combat = Math.min(
      100,
      (sourceCrew.mind.skills.combat || 0) + 0.2,
    );
  b.downed = b.health === 0;
  if (
    b.ownerId !== "wildlife" &&
    a.ownerId !== "wildlife" &&
    !allied(w, a.ownerId, b.ownerId)
  )
    b.targetId = a.id;
}
function finishReturn(w: World, e: Expedition) {
  const c = colonyOf(w, e.ownerId);
  if (!c) return;
  for (const u of ownUnits(e)) {
    const a = c.colonists.find((a) => a.id === u.colonistId && a.away === e.id);
    if (!a) continue;
    a.away = null;
    a.task = "Idle";
    a.jobId = null;
    a.target = null;
    a.progress = 0;
    a.health = Math.max(25, Math.min(a.health, u.health));
    a.drafted = false;
    if (u.health < 80) {
      a.injuries ??= [];
      a.injuries.push({
        id: nextId(w, "injury"),
        kind: u.downed ? "fracture" : "cut",
        severity: Math.max(5, Math.floor((100 - u.health) / 4)),
        tended: false,
        infection: 0,
      });
    }
    if (a.mind) {
      a.mind.memories.push({
        text: u.downed
          ? "Rescued from the reef"
          : "Returned from an expedition",
        impact: u.downed ? -8 : 5,
        expiresTick: w.tick + 6000,
      });
    }
  }
  let remaining = Math.max(
    0,
    (c.systems?.storageCapacity ?? 100000) - quantity(c.resources),
  );
  for (const r of RESOURCES) {
    const amount = e.cargo[r] || 0;
    if (!amount) continue;
    const stored = Math.min(amount, remaining);
    c.resources[r] += stored;
    remaining -= stored;
    if (stored < amount)
      c.deposits.push({
        id: nextId(w, "delivery"),
        x: 31,
        y: 36,
        resource: r,
        amount: amount - stored,
        reservedBy: null,
      });
  }
  log(
    e,
    "Crew and salvage delivered home. Overflow cargo was unloaded beside the dock.",
  );
  e.phase = "complete";
  e.arrivalTick = w.tick;
  event(
    w,
    c,
    `Expedition returned: ${quantity(e.cargo)} supplies recovered${e.losses ? `, ${e.losses} lost during retreat` : ""}.`,
    "success",
  );
  // Keep cargo as a historical manifest. Completion is terminal and can never deliver twice.
}
export function tickExpeditions(w: World): void {
  ensureExpeditions(w);
  for (const e of w
    .expeditions!.slice()
    .sort((a, b) => a.id.localeCompare(b.id))) {
    const site = w.expeditionSites!.find((s) => s.id === e.siteId);
    if (!site) continue;
    if (e.phase === "outbound" && w.tick >= e.arrivalTick) {
      e.phase = "combat";
      spawnDefenders(w, e, site);
      log(e, `Arrived at ${site.name}. Hold position or give tactical orders.`);
    }
    if (e.phase === "returning" && w.tick >= e.arrivalTick) {
      finishReturn(w, e);
      continue;
    }
    if (!ACTIVE.has(e.phase)) continue;
    const own = ownUnits(e).filter((u) => !u.downed);
    if (!own.length) {
      log(
        e,
        "The party is down. Emergency extraction brings every crew member home with injuries.",
      );
      beginReturn(w, e, true);
      continue;
    }
    if (e.retreating && own.every((u) => u.x <= 7 && u.y <= 7)) {
      beginReturn(w, e, true);
      continue;
    }
    const all = siteUnits(w, e.siteId);
    const npc = all.filter((u) => u.ownerId === "wildlife" && !u.downed);
    const engaged = own.some(
      (u) =>
        u.targetId &&
        all.some(
          (t) =>
            t.id === u.targetId &&
            !t.downed &&
            !allied(w, u.ownerId, t.ownerId),
        ),
    );
    if (e.phase === "exploring" && (npc.length > 0 || engaged))
      e.phase = "combat";
    if (e.phase === "combat" && !e.retreating && !npc.length && !engaged) {
      e.phase = "exploring";
      e.arrivalTick = w.tick + 100;
      log(e, "Threats cleared. Gathering the finite salvage cache.");
    }
    if (e.phase === "exploring" && w.tick % 20 === 0) {
      let space = Math.max(0, e.colonistIds.length * 12 - quantity(e.cargo));
      for (const r of RESOURCES) {
        const amount = Math.min(
          site.loot[r] || 0,
          Math.min(space, own.length * 2),
        );
        if (amount > 0) {
          site.loot[r] = (site.loot[r] || 0) - amount;
          e.cargo[r] = (e.cargo[r] || 0) + amount;
          space -= amount;
        }
      }
      if (space === 0 || quantity(site.loot) === 0 || w.tick >= e.arrivalTick)
        beginReturn(w, e, false);
    }
  }
  if (w.tick % 3 === 0) {
    const activeSites = new Set(
      w.expeditions!.filter((e) => ACTIVE.has(e.phase)).map((e) => e.siteId),
    );
    for (const site of activeSites) {
      const units = siteUnits(w, site).sort((a, b) => a.id.localeCompare(b.id));
      for (const u of units) {
        if (u.downed) continue;
        if (u.moveTarget) {
          if (u.x === u.moveTarget.x && u.y === u.moveTarget.y)
            u.moveTarget = null;
          else {
            const n = step(site, u, u.moveTarget);
            if (n) {
              u.x = n.x;
              u.y = n.y;
            } else u.moveTarget = null;
          }
          continue;
        }
        let target = u.targetId
          ? units.find(
              (t) =>
                t.id === u.targetId &&
                !t.downed &&
                !allied(w, u.ownerId, t.ownerId),
            )
          : undefined;
        if (!target) {
          u.targetId = null;
          const candidates = units.filter(
            (t) =>
              !t.downed &&
              (u.ownerId === "wildlife"
                ? t.ownerId !== "wildlife"
                : t.ownerId === "wildlife"),
          );
          target = candidates.sort(
            (a, b) =>
              distance(u, a) - distance(u, b) || a.id.localeCompare(b.id),
          )[0];
        }
        if (!target) continue;
        const range = u.weapon === "carbine" ? 6 : 1;
        if (distance(u, target) <= range && hasLineOfSight(site, u, target))
          attack(w, site, u, target);
        else {
          const n = step(site, u, target);
          if (
            n &&
            !units.some(
              (other) =>
                other.id !== u.id &&
                !other.downed &&
                other.x === n.x &&
                other.y === n.y,
            )
          ) {
            u.x = n.x;
            u.y = n.y;
          }
        }
      }
    }
  }
  // Bound history while retaining the site defender record and every active party.
  const completed = w.expeditions!.filter((e) => e.phase === "complete");
  if (completed.length > 60) {
    const keep = new Set(completed.slice(-60).map((e) => e.id));
    w.expeditions = w.expeditions!.filter(
      (e) =>
        e.phase !== "complete" ||
        keep.has(e.id) ||
        e.units.some((u) => u.ownerId === "wildlife"),
    );
  }
}
export function getExpeditionView(
  w: World,
  actorId: string,
): { expeditions: Expedition[]; expeditionSites: ExpeditionSite[] } {
  ensureExpeditions(w);
  const mine = w.expeditions!.filter((e) => e.ownerId === actorId);
  const visibleSites = new Set(
    mine.filter((e) => ACTIVE.has(e.phase)).map((e) => e.siteId),
  );
  const visible = w.expeditions!.filter(
    (e) =>
      e.ownerId === actorId ||
      (visibleSites.has(e.siteId) &&
        (ACTIVE.has(e.phase) ||
          e.units.some((u) => u.ownerId === "wildlife" && !u.downed))),
  );
  return structuredClone({
    expeditions: visible.map((e) =>
      e.ownerId === actorId
        ? e
        : {
            ...e,
            cargo: {},
            log: [],
            colonistIds: [],
            units: e.units
              .filter((u) => u.ownerId === "wildlife" || ACTIVE.has(e.phase))
              .map((u) => ({ ...u, colonistId: null })),
          },
    ),
    expeditionSites: w.expeditionSites!,
  });
}
