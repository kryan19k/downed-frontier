import { describe, it, expect } from "vitest";
import { type BuildingType, type World } from "@frontier/shared";
import { createWorld, joinWorld, applyCommand, tickWorld } from "./index";
import { storedAmount, refreshColonyCapacities } from "./colony-systems";
function fixture() {
  const world = createWorld(430);
  joinWorld(world, "a", "Alice");
  expect(
    applyCommand(world, "a", {
      type: "claim",
      siteId: "site-1",
      name: "Test Outpost",
      scenario: "last-shift",
    }).ok,
  ).toBe(true);
  const colony = world.colonies[world.players.a.colonyId!];
  colony.deposits = [];
  colony.autoCraft = false;
  for (const a of colony.colonists) {
    a.hunger = 100;
    a.energy = 100;
    a.thirst = 100;
  }
  return { world, colony };
}
function until(w: World, condition: () => boolean, max = 1000) {
  for (let i = 0; i < max && !condition(); i++) tickWorld(w);
  expect(condition()).toBe(true);
}
function building(
  f: ReturnType<typeof fixture>,
  type: BuildingType,
  x: number,
  y: number,
) {
  const b = {
    id: `test-building-${f.world.nextId++}`,
    type,
    x,
    y,
    built: true,
    progress: 100,
    health: 100,
    reservedBy: null,
  };
  f.colony.buildings.push(b);
  return b;
}
function singleWorker(f: ReturnType<typeof fixture>) {
  for (const a of f.colony.colonists.slice(1))
    expect(
      applyCommand(f.world, "a", {
        type: "draft",
        colonistId: a.id,
        drafted: true,
      }).ok,
    ).toBe(true);
  return f.colony.colonists[0];
}
describe("staffed production and environmental colony systems", () => {
  it("requires a staffed reachable powered workshop and consumes ingredients only on batch completion", () => {
    const f = fixture(),
      a = singleWorker(f);
    building(f, "workshop", 36, 35);
    a.x = 36;
    a.y = 34;
    f.colony.autoCraft = true;
    const before = { ...f.colony.resources };
    expect(
      applyCommand(f.world, "a", {
        type: "queueRecipe",
        recipeId: "components",
        quantity: 1,
      }).ok,
    ).toBe(true);
    tickWorld(f.world, 100);
    expect(f.colony.resources.components).toBe(before.components);
    expect(f.colony.resources.scrap).toBe(before.scrap);
    f.colony.buildings.find((b) => b.type === "generator")!.health = 100;
    until(f.world, () => f.colony.resources.components > before.components);
    expect(f.colony.resources.components).toBe(before.components + 1);
    expect(f.colony.resources.scrap).toBe(before.scrap - 5);
    expect(a.mind!.skills.fabrication).toBeGreaterThan(0);
  });
  it("cancels partial production without charging ingredients or leaving worker/station reservations", () => {
    const f = fixture(),
      a = singleWorker(f);
    a.x = 29;
    a.y = 34;
    f.colony.autoCraft = true;
    const before = { ...f.colony.resources };
    expect(
      applyCommand(f.world, "a", {
        type: "queueRecipe",
        recipeId: "rations",
        quantity: 2,
      }).ok,
    ).toBe(true);
    const bill = f.colony.systems!.production[0];
    until(f.world, () => bill.progress > 0, 50);
    expect(f.colony.resources).toEqual(before);
    expect(
      applyCommand(f.world, "a", { type: "cancelRecipe", billId: bill.id }).ok,
    ).toBe(true);
    expect(a.jobId).toBeNull();
    expect(f.colony.buildings.every((b) => b.reservedBy !== a.id)).toBe(true);
    expect(f.colony.resources).toEqual(before);
  });
  it("keeps overflow on the carrier and lets all carrying workers expand full storage", () => {
    const f = fixture();
    for (const key of Object.keys(
      f.colony.resources,
    ) as (keyof typeof f.colony.resources)[])
      f.colony.resources[key] = 0;
    f.colony.resources.scrap = 400;
    for (const a of f.colony.colonists) {
      a.carrying = { resource: "scrap", amount: 4 };
      a.task = "Hauling";
      a.x = 31;
      a.y = 34;
    }
    expect(
      applyCommand(f.world, "a", {
        type: "build",
        building: "stockpile",
        x: 33,
        y: 35,
      }).ok,
    ).toBe(true);
    until(
      f.world,
      () =>
        !!f.colony.buildings.find(
          (b) => b.type === "stockpile" && b.x === 33 && b.y === 35,
        )?.built,
      600,
    );
    until(f.world, () => f.colony.colonists.every((a) => !a.carrying), 200);
    expect(f.colony.resources.scrap).toBe(410);
    expect(storedAmount(f.colony)).toBe(410);
    expect(f.colony.systems!.storageCapacity).toBe(600);
  });
  it("does not delete cargo when a full stockpile has no new capacity", () => {
    const f = fixture(),
      a = singleWorker(f);
    for (const key of Object.keys(
      f.colony.resources,
    ) as (keyof typeof f.colony.resources)[])
      f.colony.resources[key] = 0;
    f.colony.resources.scrap = 400;
    a.carrying = { resource: "fiber", amount: 4 };
    a.task = "Hauling";
    a.x = 31;
    a.y = 34;
    tickWorld(f.world, 90);
    expect(a.carrying).toEqual({ resource: "fiber", amount: 4 });
    expect(a.blockedReason).toContain("full");
    expect(storedAmount(f.colony)).toBe(400);
  });
  it("charges medicine after physical tending and releases treatment on an interrupted medic", () => {
    const f = fixture(),
      patient = f.colony.colonists[0],
      medic = f.colony.colonists[2];
    f.colony.colonists[1].drafted = true;
    patient.health = 45;
    patient.x = 30;
    patient.y = 32;
    medic.x = 32;
    medic.y = 32;
    patient.injuries = [
      { id: "cut", kind: "cut", severity: 20, tended: false, infection: 30 },
    ];
    const medicine = f.colony.resources.medicine;
    expect(
      applyCommand(f.world, "a", { type: "tend", colonistId: patient.id }).ok,
    ).toBe(true);
    expect(f.colony.resources.medicine).toBe(medicine);
    tickWorld(f.world, 6);
    expect(
      applyCommand(f.world, "a", {
        type: "draft",
        colonistId: medic.id,
        drafted: true,
      }).ok,
    ).toBe(true);
    expect(f.colony.resources.medicine).toBe(medicine);
    expect(medic.jobId).toBeNull();
    expect(
      applyCommand(f.world, "a", {
        type: "draft",
        colonistId: medic.id,
        drafted: false,
      }).ok,
    ).toBe(true);
    expect(
      applyCommand(f.world, "a", { type: "tend", colonistId: patient.id }).ok,
    ).toBe(true);
    until(f.world, () => f.colony.resources.medicine < medicine);
    expect(f.colony.resources.medicine).toBe(medicine - 1);
    expect(patient.health).toBeGreaterThan(45);
    expect(patient.injuries!.every((i) => i.tended)).toBe(true);
  });
  it("freshwater replenishes from a cistern and restores thirst through actual consumption", () => {
    const f = fixture();
    building(f, "reservoir", 36, 34);
    const a = singleWorker(f);
    f.colony.systems!.water = 10;
    a.thirst = 20;
    tickWorld(f.world, 3);
    expect(f.colony.systems!.water).toBe(9);
    expect(a.thirst).toBe(55);
    a.drafted = true;
    tickWorld(f.world, 197);
    expect(f.colony.systems!.water).toBeGreaterThan(9);
  });
  it("harvests renewable garden fiber using crew labor and freshwater", () => {
    const f = fixture(),
      a = singleWorker(f);
    building(f, "farm", 36, 35);
    a.x = 36;
    a.y = 34;
    f.colony.resources.fiber = 0;
    const water = f.colony.systems!.water;
    until(f.world, () => f.colony.resources.fiber > 0, 600);
    expect(f.colony.resources.fiber).toBe(6);
    expect(f.colony.systems!.water).toBe(water - 3);
  });
  it("recomputes removed water and battery storage without writing out-of-capacity values", () => {
    const f = fixture(),
      cistern = building(f, "reservoir", 36, 34),
      battery = building(f, "battery", 37, 34);
    tickWorld(f.world, 10);
    f.colony.systems!.water = 200;
    f.colony.systems!.battery = 90;
    expect(
      applyCommand(f.world, "a", {
        type: "deconstruct",
        buildingId: cistern.id,
      }).ok,
    ).toBe(true);
    expect(
      applyCommand(f.world, "a", {
        type: "deconstruct",
        buildingId: battery.id,
      }).ok,
    ).toBe(true);
    tickWorld(f.world, 40);
    expect(f.colony.systems!.waterCapacity).toBe(120);
    expect(f.colony.systems!.water).toBeLessThanOrEqual(120);
    expect(f.colony.systems!.battery).toBe(0);
    const copy = JSON.parse(JSON.stringify(f.world));
    expect(copy.colonies[f.colony.id].systems.water).toBeLessThanOrEqual(
      copy.colonies[f.colony.id].systems.waterCapacity,
    );
  });
  it("preserves stored inventory when physical stockpile capacity is removed", () => {
    const f = fixture();
    f.colony.resources.scrap = 500;
    const before = { ...f.colony.resources };
    const stock = f.colony.buildings.find((b) => b.type === "stockpile")!;
    f.colony.buildings = f.colony.buildings.filter((b) => b !== stock);
    refreshColonyCapacities(f.colony);
    expect(f.colony.systems!.storageCapacity).toBe(200);
    expect(f.colony.resources).toEqual(before);
  });
  it("powered pumps reduce floodwater and batteries supply an outage", () => {
    const f = fixture();
    f.colony.buildings.find((b) => b.type === "generator")!.health = 100;
    building(f, "pump", 36, 34);
    building(f, "battery", 37, 34);
    f.colony.systems!.flood = 60;
    tickWorld(f.world, 100);
    expect(f.colony.systems!.flood).toBeLessThan(60);
    expect(f.colony.systems!.battery).toBeGreaterThan(0);
    f.colony.resources.fuel = 0;
    tickWorld(f.world, 10);
    expect(f.colony.power).toBeGreaterThan(0);
  });
  it("natural high tides warn about rising water and a powered pump prevents the accumulating damage", () => {
    const exposed = fixture(),
      pumped = fixture();
    pumped.colony.buildings.find((b) => b.type === "generator")!.health = 100;
    building(pumped, "pump", 36, 34);
    tickWorld(exposed.world, 1000);
    tickWorld(pumped.world, 1000);
    expect(exposed.colony.systems!.flood).toBeGreaterThanOrEqual(40);
    expect(
      exposed.colony.events.some((e) => e.text.includes("High water")),
    ).toBe(true);
    expect(pumped.colony.systems!.flood).toBeLessThan(20);
    tickWorld(exposed.world, 2000);
    tickWorld(pumped.world, 2000);
    expect(exposed.colony.systems!.flood).toBeGreaterThanOrEqual(70);
    expect(
      exposed.colony.colonists.some((a) =>
        a.injuries!.some((i) => i.kind === "exposure"),
      ),
    ).toBe(true);
    expect(pumped.colony.systems!.flood).toBeLessThan(20);
  });
  it("counts genuine enclosed rooms rather than arbitrary wall quantity", () => {
    const f = fixture();
    for (let x = 25; x <= 28; x++) {
      building(f, "wall", x, 25);
      building(f, "wall", x, 28);
    }
    for (let y = 26; y <= 27; y++) {
      building(f, "wall", 25, y);
      building(f, "wall", 28, y);
    }
    tickWorld(f.world, 100);
    expect(f.colony.systems!.roomCount).toBe(1);
    f.colony.buildings = f.colony.buildings.filter(
      (b) => !(b.type === "wall" && b.x === 25 && b.y === 26),
    );
    tickWorld(f.world, 100);
    expect(f.colony.systems!.roomCount).toBe(0);
  });
});

// Hunger and thirst have a nonlethal floor; that floor must never resurrect a downed patient.
it("does not revive incapacitated crew through survival-damage floors", () => {
  const w = createWorld(717);
  joinWorld(w, "care", "Care");
  applyCommand(w, "care", {
    type: "claim",
    siteId: w.sites[0].id,
    name: "Care test",
    scenario: "last-shift",
  });
  const c = w.colonies[w.players.care.colonyId!];
  const a = c.colonists[0];
  a.health = 0;
  a.hunger = 0;
  a.thirst = 0;
  w.tick = 99;
  tickWorld(w, 3);
  expect(a.health).toBe(0);
  expect(a.task).toBe("Incapacitated");
});
