import { describe, expect, it } from "vitest";
import { type Colony, type World } from "@frontier/shared";
import {
  applyCommand,
  createWorld,
  getPlayerView,
  joinWorld,
  tickWorld,
} from "./index";

function isolatedOutpost() {
  const world = createWorld(719);
  joinWorld(world, "alice", "Alice");
  const result = applyCommand(world, "alice", {
    type: "claim",
    siteId: world.sites[0].id,
    name: "Systems Lab",
    scenario: "last-shift",
  });
  expect(result.ok, result.message).toBe(true);
  const colony = world.colonies[world.players.alice.colonyId!];
  colony.autoCraft = false;
  const crew = colony.colonists[0];
  for (const person of colony.colonists) {
    person.hunger = 100;
    person.energy = 100;
    if (person !== crew)
      expect(
        applyCommand(world, "alice", {
          type: "draft",
          colonistId: person.id,
          drafted: true,
        }).ok,
      ).toBe(true);
  }
  colony.deposits = [];
  return { world, colony, crew };
}

function until(world: World, condition: () => boolean, maxTicks = 1000) {
  for (let i = 0; i < maxTicks && !condition(); i++) tickWorld(world);
  expect(condition(), `Condition was not met by tick ${world.tick}`).toBe(true);
}

function scrapTotal(colony: Colony) {
  return (
    colony.resources.scrap +
    colony.deposits
      .filter((deposit) => deposit.resource === "scrap")
      .reduce((sum, item) => sum + item.amount, 0) +
    colony.colonists.reduce(
      (sum, crew) =>
        sum + (crew.carrying?.resource === "scrap" ? crew.carrying.amount : 0),
      0,
    )
  );
}

describe("physical hauling and survival systems", () => {
  it("automatic production queues require real staff even with power", () => {
    const { world, colony } = isolatedOutpost();
    for (const crew of colony.colonists)
      applyCommand(world, "alice", {
        type: "draft",
        colonistId: crew.id,
        drafted: true,
      });
    colony.autoCraft = true;
    colony.resources.fiber = 6;
    colony.resources.rations = 0;
    colony.buildings.push({
      id: "test-fabricator",
      type: "workshop",
      x: 36,
      y: 35,
      built: true,
      progress: 80,
      health: 100,
      reservedBy: null,
    });
    const scrap = colony.resources.scrap,
      components = colony.resources.components;
    tickWorld(world, 150);
    expect(colony.resources.fiber).toBe(6);
    expect(colony.resources.rations).toBe(0);
    expect(colony.resources.components).toBe(components);
    expect(colony.resources.scrap).toBe(scrap);
    colony.buildings.find((b) => b.type === "generator")!.health = 100;
    tickWorld(world, 150);
    expect(colony.resources.fiber).toBe(6);
    expect(colony.resources.rations).toBe(0);
    expect(colony.resources.components).toBe(components);
    expect(colony.resources.scrap).toBe(scrap);
    expect(
      applyCommand(world, "alice", { type: "craft", enabled: false }).ok,
    ).toBe(true);
    const inventory = structuredClone(colony.resources);
    tickWorld(world, 150);
    expect(colony.resources).toEqual(inventory);
  });

  it("gives late arrivals the same warning and weather interval from their own founding", () => {
    const world = createWorld(719);
    tickWorld(world, 10000);
    joinWorld(world, "alice", "Alice");
    expect(
      applyCommand(world, "alice", {
        type: "claim",
        siteId: world.sites[0].id,
        name: "Late Outpost",
        scenario: "last-shift",
      }).ok,
    ).toBe(true);
    const colony = world.colonies[world.players.alice.colonyId!];
    tickWorld(world, 899);
    expect(colony.events.some((e) => e.text.includes("Weather watch"))).toBe(
      false,
    );
    tickWorld(world, 1);
    expect(colony.events.some((e) => e.text.includes("Weather watch"))).toBe(
      true,
    );
    tickWorld(world, 1500);
    expect(colony.storm).toBe(true);
    expect(colony.buildings.find((b) => b.type === "generator")!.health).toBe(
      35,
    );
  });
  it("keeps old actionable escrow offers visible while bounding closed trade history", () => {
    const { world } = isolatedOutpost();
    joinWorld(world, "bob", "Bob");
    world.offers.push({
      id: "old-open-escrow",
      from: "alice",
      to: "bob",
      give: "scrap",
      giveAmount: 3,
      want: "fiber",
      wantAmount: 2,
      status: "open",
      createdTick: 0,
    });
    for (let index = 0; index < 60; index++) {
      world.offers.push({
        id: `closed-trade-${index}`,
        from: "alice",
        to: "bob",
        give: "scrap",
        giveAmount: 1,
        want: "fiber",
        wantAmount: 1,
        status: index % 2 ? "accepted" : "cancelled",
        createdTick: index + 1,
      });
    }
    const view = getPlayerView(world, "alice");
    expect(
      view.offers.some(
        (offer) => offer.id === "old-open-escrow" && offer.status === "open",
      ),
    ).toBe(true);
    expect(
      view.offers.filter((offer) => offer.status !== "open").length,
    ).toBeLessThanOrEqual(20);
  });

  it("hauls to a reachable stockpile when the original stockpile is enclosed", () => {
    const { world, colony, crew } = isolatedOutpost();
    for (const [index, [x, y]] of [
      [30, 34],
      [32, 34],
      [31, 33],
      [31, 35],
    ].entries()) {
      colony.buildings.push({
        id: `stockpile-enclosure-${index}`,
        type: "wall",
        x,
        y,
        built: true,
        progress: 35,
        health: 100,
        reservedBy: null,
      });
    }
    colony.buildings.push({
      id: "reachable-stockpile",
      type: "stockpile",
      x: 35,
      y: 34,
      built: true,
      progress: 20,
      health: 100,
      reservedBy: null,
    });
    crew.x = 38;
    crew.y = 34;
    crew.carrying = { resource: "scrap", amount: 4 };
    crew.task = "Hauling";
    const stored = colony.resources.scrap;
    tickWorld(world, 150);
    expect(colony.resources.scrap).toBe(stored + 4);
    expect(crew.carrying).toBeNull();
  });

  it("skips an inaccessible preferred blueprint instead of starving reachable salvage work", () => {
    const { world, colony, crew } = isolatedOutpost();
    for (const [index, [x, y]] of [
      [30, 31],
      [32, 31],
      [31, 30],
      [31, 32],
    ].entries()) {
      colony.buildings.push({
        id: `blueprint-enclosure-${index}`,
        type: "wall",
        x,
        y,
        built: true,
        progress: 35,
        health: 100,
        reservedBy: null,
      });
    }
    colony.buildings.push({
      id: "unreachable-blueprint",
      type: "bed",
      x: 31,
      y: 31,
      built: false,
      progress: 0,
      health: 100,
      reservedBy: null,
    });
    colony.deposits.push({
      id: "reachable-scrap",
      x: 38,
      y: 34,
      resource: "scrap",
      amount: 16,
      reservedBy: null,
    });
    crew.x = 32;
    crew.y = 32;
    crew.priority = "build";
    const stored = colony.resources.scrap;
    const total = scrapTotal(colony);
    tickWorld(world, 500);
    expect(colony.resources.scrap).toBeGreaterThan(stored);
    expect(scrapTotal(colony)).toBe(total);
    expect(
      colony.buildings.find(
        (building) => building.id === "unreachable-blueprint",
      )?.built,
    ).toBe(false);
  });

  it("takes salvage into carried inventory before delivering it to a stockpile", () => {
    const { world, colony, crew } = isolatedOutpost();
    colony.deposits.push({
      id: "test-scrap",
      x: 38,
      y: 34,
      resource: "scrap",
      amount: 20,
      reservedBy: null,
    });
    const stored = colony.resources.scrap;
    const total = scrapTotal(colony);
    until(world, () => !!crew.carrying);
    expect(crew.carrying?.resource).toBe("scrap");
    const amount = crew.carrying!.amount;
    expect(amount).toBeGreaterThan(0);
    expect(colony.resources.scrap).toBe(stored);
    expect(colony.deposits[0].amount).toBe(20 - amount);
    expect(scrapTotal(colony)).toBe(total);
    until(world, () => !crew.carrying);
    expect(colony.resources.scrap).toBe(stored + amount);
    expect(scrapTotal(colony)).toBe(total);
    const stockpile = colony.buildings.find(
      (building) => building.type === "stockpile",
    )!;
    expect(
      Math.abs(crew.x - stockpile.x) + Math.abs(crew.y - stockpile.y),
    ).toBeLessThanOrEqual(1);
  });

  it("keeps carried salvage through drafting and delivers it after returning to work", () => {
    const { world, colony, crew } = isolatedOutpost();
    colony.deposits.push({
      id: "test-scrap",
      x: 38,
      y: 34,
      resource: "scrap",
      amount: 20,
      reservedBy: null,
    });
    const total = scrapTotal(colony);
    until(world, () => !!crew.carrying);
    const cargo = { ...crew.carrying! };
    expect(
      applyCommand(world, "alice", {
        type: "draft",
        colonistId: crew.id,
        drafted: true,
      }).ok,
    ).toBe(true);
    tickWorld(world, 30);
    expect(crew.carrying).toEqual(cargo);
    expect(scrapTotal(colony)).toBe(total);
    expect(
      colony.deposits.every((deposit) => deposit.reservedBy !== crew.id),
    ).toBe(true);
    expect(
      applyCommand(world, "alice", {
        type: "draft",
        colonistId: crew.id,
        drafted: false,
      }).ok,
    ).toBe(true);
    until(world, () => !crew.carrying);
    expect(scrapTotal(colony)).toBe(total);
  });

  it("requires crew work to finish a repair before the generator restores power", () => {
    const { world, colony } = isolatedOutpost();
    const generator = colony.buildings.find(
      (building) => building.type === "generator",
    )!;
    generator.health = 55;
    colony.power = 0;
    const scrap = colony.resources.scrap;
    expect(
      applyCommand(world, "alice", { type: "repair", buildingId: generator.id })
        .ok,
    ).toBe(true);
    expect(generator.health).toBe(55);
    expect(colony.resources.scrap).toBe(scrap - 2);
    expect(generator.reservedBy).not.toBeNull();
    until(world, () => generator.health === 100);
    tickWorld(world, 10);
    expect(colony.power).toBeGreaterThan(0);
    expect(generator.reservedBy).toBeNull();
    expect(colony.resources.scrap).toBe(scrap - 2);
  });

  it("keeps prepaid repair supplies through an interruption without charging twice", () => {
    const { world, colony, crew } = isolatedOutpost();
    const generator = colony.buildings.find(
      (building) => building.type === "generator",
    )!;
    generator.health = 55;
    const scrap = colony.resources.scrap;
    expect(
      applyCommand(world, "alice", { type: "repair", buildingId: generator.id })
        .ok,
    ).toBe(true);
    expect(colony.resources.scrap).toBe(scrap - 2);
    expect(generator.repairSupplies).toBe(true);
    expect(
      applyCommand(world, "alice", {
        type: "draft",
        colonistId: crew.id,
        drafted: true,
      }).ok,
    ).toBe(true);
    expect(generator.reservedBy).toBeNull();
    expect(generator.repairSupplies).toBe(true);
    expect(
      applyCommand(world, "alice", {
        type: "draft",
        colonistId: crew.id,
        drafted: false,
      }).ok,
    ).toBe(true);
    expect(
      applyCommand(world, "alice", { type: "repair", buildingId: generator.id })
        .ok,
    ).toBe(true);
    expect(colony.resources.scrap).toBe(scrap - 2);
    until(world, () => generator.health === 100);
    expect(generator.repairSupplies).toBeFalsy();
    expect(colony.resources.scrap).toBe(scrap - 2);
  });

  it("consumes one available ration to recover hunger and cannot eat missing goods", () => {
    const { world, colony, crew } = isolatedOutpost();
    crew.hunger = 20;
    const rations = colony.resources.rations;
    tickWorld(world, 3);
    expect(colony.resources.rations).toBe(rations - 1);
    expect(crew.hunger).toBeGreaterThan(20);
    colony.resources.rations = 0;
    crew.hunger = 20;
    tickWorld(world, 3);
    expect(colony.resources.rations).toBe(0);
    expect(crew.hunger).toBe(20);
  });

  it("reserves a real bed, rests there, and releases it when recovered", () => {
    const { world, colony, crew } = isolatedOutpost();
    const bed = colony.buildings.find((building) => building.type === "bed")!;
    crew.x = bed.x;
    crew.y = bed.y;
    crew.energy = 10;
    tickWorld(world, 3);
    expect(crew.task).toBe("Resting");
    expect(bed.reservedBy).toBe(crew.id);
    expect(crew.energy).toBeGreaterThan(10);
    until(world, () => crew.energy >= 95, 500);
    expect(bed.reservedBy).toBeNull();
    expect(crew.jobId).toBeNull();
  });
});
