import { describe, it, expect } from "vitest";
import { createWorld, joinWorld, applyCommand } from "./index";
import {
  ensureExpeditions,
  applyExpeditionCommand,
  tickExpeditions,
  getExpeditionView,
  getEncounterObstacles,
} from "./expeditions";
import type { World, Expedition } from "@frontier/shared";
function setup() {
  const w = createWorld(551);
  for (const [i, p] of ["alice", "bob"].entries()) {
    joinWorld(w, p, p);
    expect(
      applyCommand(w, p, {
        type: "claim",
        siteId: w.sites[i].id,
        name: p,
        scenario: "last-shift",
      }).ok,
    ).toBe(true);
  }
  ensureExpeditions(w);
  return w;
}
function colony(w: World, p = "alice") {
  return w.colonies[w.players[p].colonyId!];
}
function launch(w: World, p = "alice", site = "salvage-reef", count = 1) {
  const c = colony(w, p);
  const response = applyExpeditionCommand(w, p, {
    type: "expeditionLaunch",
    siteId: site,
    colonistIds: c.colonists.slice(0, count).map((a) => a.id),
  });
  expect(response?.ok, response?.message).toBe(true);
  return w.expeditions!.find((e) => e.ownerId === p && e.phase !== "complete")!;
}
function ticks(w: World, n: number) {
  for (let i = 0; i < n; i++) {
    w.tick++;
    tickExpeditions(w);
  }
}
function own(e: Expedition) {
  return e.units.filter((u) => u.ownerId === e.ownerId);
}
function arrive(w: World, e: Expedition) {
  ticks(w, e.arrivalTick - w.tick);
  expect(["combat", "exploring"]).toContain(e.phase);
}
function noWildlife(w: World) {
  for (const e of w.expeditions!)
    for (const u of e.units)
      if (u.ownerId === "wildlife") {
        u.health = 0;
        u.downed = true;
      }
}

describe("authoritative expeditions and tactical encounters", () => {
  it("charges once, uniquely deploys owned crew and releases all home reservations", () => {
    const w = setup(),
      c = colony(w),
      a = c.colonists[0];
    c.buildings[0].reservedBy = a.id;
    c.deposits[0].reservedBy = a.id;
    a.jobId = c.buildings[0].id;
    const food = c.resources.rations,
      fuel = c.resources.fuel;
    const e = launch(w);
    expect(c.resources.rations).toBe(food - 2);
    expect(c.resources.fuel).toBe(fuel - 2);
    expect(a.away).toBe(e.id);
    expect(a.jobId).toBeNull();
    expect(c.buildings[0].reservedBy).toBeNull();
    expect(c.deposits[0].reservedBy).toBeNull();
    expect(
      applyExpeditionCommand(w, "alice", {
        type: "expeditionLaunch",
        siteId: "salvage-reef",
        colonistIds: [a.id],
      })?.ok,
    ).toBe(false);
    expect(c.resources.fuel).toBe(fuel - 2);
  });
  it("rejects foreign, duplicated, sick or unprovisioned launch without mutation", () => {
    const w = setup(),
      c = colony(w),
      foreign = colony(w, "bob").colonists[0].id;
    const before = structuredClone(w);
    expect(
      applyExpeditionCommand(w, "alice", {
        type: "expeditionLaunch",
        siteId: "salvage-reef",
        colonistIds: [foreign],
      })?.ok,
    ).toBe(false);
    expect(w).toEqual(before);
    const id = c.colonists[0].id;
    expect(
      applyExpeditionCommand(w, "alice", {
        type: "expeditionLaunch",
        siteId: "salvage-reef",
        colonistIds: [id, id],
      })?.ok,
    ).toBe(false);
    c.resources.fuel = 0;
    expect(
      applyExpeditionCommand(w, "alice", {
        type: "expeditionLaunch",
        siteId: "salvage-reef",
        colonistIds: [id],
      })?.ok,
    ).toBe(false);
    expect(c.colonists[0].away).toBeFalsy();
  });
  it("takes server ticks to arrive and assigns nonoverlapping party landings", () => {
    const w = setup(),
      a = launch(w, "alice", "salvage-reef", 3),
      b = launch(w, "bob", "salvage-reef", 3);
    const points = [...own(a), ...own(b)].map((u) => `${u.x},${u.y}`);
    expect(new Set(points).size).toBe(6);
    ticks(w, 199);
    expect(a.phase).toBe("outbound");
    ticks(w, 1);
    expect(a.phase).toBe("combat");
    expect(b.phase).toBe("combat");
    expect(
      w.expeditions!.flatMap((e) =>
        e.units.filter((u) => u.ownerId === "wildlife"),
      ).length,
    ).toBe(1);
  });
  it("uses abyss research for shorter deep travel and leaves ordinary travel unchanged", () => {
    const w = setup(),
      c = colony(w);
    if (!c.systems) throw Error("systems not initialized");
    c.systems.unlocked.push("abyss");
    const e = launch(w, "alice", "drowned-archive");
    expect(e.arrivalTick - e.departTick).toBe(150);
    const b = launch(w, "bob");
    expect(b.arrivalTick - b.departTick).toBe(200);
  });
  it("rejects foreign orders, obstacles, out of bounds and home targets", () => {
    const w = setup(),
      e = launch(w);
    arrive(w, e);
    const u = own(e)[0];
    expect(
      applyExpeditionCommand(w, "bob", {
        type: "expeditionOrder",
        expeditionId: e.id,
        unitId: u.id,
        x: 7,
        y: 7,
      })?.ok,
    ).toBe(false);
    const obstacle = getEncounterObstacles(e.siteId)[0];
    expect(
      applyExpeditionCommand(w, "alice", {
        type: "expeditionOrder",
        expeditionId: e.id,
        unitId: u.id,
        ...obstacle,
      })?.ok,
    ).toBe(false);
    expect(
      applyExpeditionCommand(w, "alice", {
        type: "expeditionOrder",
        expeditionId: e.id,
        unitId: u.id,
        x: 32,
        y: 4,
      })?.ok,
    ).toBe(false);
    expect(
      applyExpeditionCommand(w, "alice", {
        type: "expeditionAttack",
        expeditionId: e.id,
        unitId: u.id,
        targetId: colony(w, "bob").colonists[0].id,
      })?.ok,
    ).toBe(false);
  });
  it("never autoattacks neutral players and blocks attacks against allies", () => {
    const w = setup(),
      a = launch(w),
      b = launch(w, "bob");
    arrive(w, a);
    noWildlife(w);
    const au = own(a)[0],
      bu = own(b)[0];
    au.x = 8;
    au.y = 8;
    bu.x = 9;
    bu.y = 8;
    ticks(w, 15);
    expect(au.health).toBe(100);
    expect(bu.health).toBe(100);
    w.alliances.push(["alice", "bob"]);
    expect(
      applyExpeditionCommand(w, "alice", {
        type: "expeditionAttack",
        expeditionId: a.id,
        unitId: au.id,
        targetId: bu.id,
      })?.ok,
    ).toBe(false);
  });
  it("resolves explicit PvP on the server and the defender retaliates", () => {
    const w = setup(),
      a = launch(w),
      b = launch(w, "bob");
    arrive(w, a);
    noWildlife(w);
    const au = own(a)[0],
      bu = own(b)[0];
    au.x = 8;
    au.y = 8;
    bu.x = 9;
    bu.y = 8;
    expect(
      applyExpeditionCommand(w, "alice", {
        type: "expeditionAttack",
        expeditionId: a.id,
        unitId: au.id,
        targetId: bu.id,
      })?.ok,
    ).toBe(true);
    ticks(w, 40);
    expect(bu.health).toBeLessThan(100);
    expect(au.health).toBeLessThan(100);
    expect(bu.targetId).toBe(au.id);
  });
  it("honors ranged cooldowns and blocked line of sight", () => {
    const w = setup(),
      e = launch(w);
    arrive(w, e);
    const u = own(e)[0],
      enemy = e.units.find((u) => u.ownerId === "wildlife")!;
    u.x = 11;
    u.y = 9;
    enemy.x = 15;
    enemy.y = 9;
    enemy.weapon = "carbine";
    u.targetId = enemy.id;
    enemy.moveTarget = { x: 15, y: 9 };
    u.moveTarget = null;
    // A reef barrier at x11..13,y9 prevents a shot; long cooldown stops enemy interference.
    enemy.cooldown = 100000;
    const health = enemy.health;
    ticks(w, 1);
    expect(enemy.health).toBe(health);
  });
  it("enforces weapon cooldown between successful shots and grants combat experience", () => {
    const w = setup(),
      e = launch(w);
    arrive(w, e);
    const u = own(e)[0],
      enemy = e.units.find((u) => u.ownerId === "wildlife")!;
    u.x = 8;
    u.y = 8;
    enemy.x = 9;
    enemy.y = 8;
    enemy.health = 10000;
    enemy.maxHealth = 10000;
    enemy.cooldown = 100000;
    u.targetId = enemy.id;
    const hits: number[] = [];
    let health = enemy.health;
    for (let i = 0; i < 180; i++) {
      ticks(w, 1);
      if (enemy.health < health) {
        hits.push(w.tick);
        health = enemy.health;
      }
    }
    expect(hits.length).toBeGreaterThan(0);
    for (let i = 1; i < hits.length; i++)
      expect(hits[i] - hits[i - 1]).toBeGreaterThanOrEqual(12);
    expect(colony(w).colonists[0].mind!.skills.combat).toBeGreaterThan(0);
  });

  it("extracts finite loot once and delivers overflowing cargo as recoverable dock crates", () => {
    const w = setup(),
      c = colony(w),
      e = launch(w);
    arrive(w, e);
    noWildlife(w);
    const total = Object.values(w.expeditionSites![0].loot).reduce(
      (s, n) => s + (n || 0),
      0,
    );
    ticks(w, 101);
    expect(e.phase).toBe("returning");
    const collected = Object.values(e.cargo).reduce((s, n) => s + (n || 0), 0);
    expect(collected).toBeGreaterThan(0);
    expect(collected).toBeLessThanOrEqual(12);
    expect(
      Object.values(w.expeditionSites![0].loot).reduce(
        (s, n) => s + (n || 0),
        0,
      ),
    ).toBe(total - collected);
    c.systems!.storageCapacity = 0;
    const stored = c.resources.scrap;
    const cratesBefore = c.deposits.length;
    ticks(w, 200);
    expect(e.phase).toBe("complete");
    expect(c.resources.scrap).toBe(stored);
    expect(c.deposits.length).toBeGreaterThan(cratesBefore);
    expect(c.colonists[0].away).toBeNull();
    const state = structuredClone(c);
    ticks(w, 300);
    expect(c).toEqual(state);
  });
  it("withdraws through the encounter before transit and rescue returns downed crew with injuries", () => {
    const w = setup(),
      e = launch(w);
    arrive(w, e);
    const u = own(e)[0];
    u.x = 15;
    u.y = 15;
    expect(
      applyExpeditionCommand(w, "alice", {
        type: "expeditionRetreat",
        expeditionId: e.id,
      })?.ok,
    ).toBe(true);
    expect(e.phase).toBe("combat");
    expect(e.retreating).toBe(true);
    u.downed = true;
    u.health = 0;
    ticks(w, 1);
    expect(e.phase).toBe("returning");
    ticks(w, 200);
    const a = colony(w).colonists[0];
    expect(a.away).toBeNull();
    expect(a.health).toBe(25);
    expect(a.injuries?.some((i) => i.kind === "fracture")).toBe(true);
  });
  it("filters rival cargo and remote encounters but reveals colocated units only", () => {
    const w = setup(),
      a = launch(w),
      b = launch(w, "bob");
    b.cargo.components = 12;
    expect(
      getExpeditionView(w, "alice").expeditions.some((e) => e.id === b.id),
    ).toBe(false);
    arrive(w, a);
    const rival = getExpeditionView(w, "alice").expeditions.find(
      (e) => e.id === b.id,
    )!;
    expect(rival).toBeDefined();
    expect(rival.cargo).toEqual({});
    expect(rival.colonistIds).toEqual([]);
    expect(rival.units.every((u) => u.colonistId === null)).toBe(true);
  });
  it("replays tactical outcomes deterministically", () => {
    const a = setup(),
      b = setup();
    launch(a);
    launch(b);
    ticks(a, 600);
    ticks(b, 600);
    expect(a).toEqual(b);
  });
});
