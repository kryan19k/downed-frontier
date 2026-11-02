import { describe, expect, it } from "vitest";
import { createWorld, joinWorld, applyCommand } from "@frontier/sim";
import type { ColonySystems, Expedition, World } from "@frontier/shared";
import { validateExtendedWorld } from "./save-validation";
function fixture() {
  const world = createWorld(87);
  joinWorld(world, "captain", "Captain");
  expect(
    applyCommand(world, "captain", {
      type: "claim",
      siteId: world.sites[0].id,
      name: "Safe Harbor",
      scenario: "last-shift",
    }).ok,
  ).toBe(true);
  const colony = world.colonies[world.players.captain.colonyId!];
  return { world, colony, crew: colony.colonists[0] };
}
function addSystems(world: World) {
  const colony = Object.values(world.colonies)[0];
  colony.systems = {
    water: 70,
    waterCapacity: 120,
    storageCapacity: 400,
    battery: 0,
    flood: 0,
    tide: 20,
    oxygen: 100,
    roomCount: 0,
    foodSpoilProgress: 0,
    production: [
      {
        id: "bill-test",
        recipeId: "rations",
        remaining: 2,
        progress: 5,
        workerId: null,
      },
    ],
    researchProject: "hydraulics",
    researchProgress: 12,
    unlocked: [],
    sheltered: false,
    workPolicy: "balanced",
    rationing: false,
    lastDirectorTick: 0,
  } satisfies ColonySystems;
  return colony.systems;
}
function addExpedition(world: World) {
  const colony = Object.values(world.colonies)[0],
    crew = colony.colonists[0];
  const e: Expedition = {
    id: "exp-test",
    ownerId: colony.ownerId,
    siteId: "salvage-reef",
    colonistIds: [crew.id],
    phase: "outbound",
    departTick: world.tick,
    arrivalTick: world.tick + 200,
    cargo: { scrap: 3 },
    units: [
      {
        id: "unit-test",
        colonistId: crew.id,
        ownerId: colony.ownerId,
        name: crew.name,
        x: 2,
        y: 3,
        health: 95,
        maxHealth: 100,
        cooldown: 0,
        targetId: null,
        moveTarget: null,
        weapon: "carbine",
        downed: false,
      },
    ],
    log: ["Departure"],
    retreating: false,
    losses: 0,
  };
  world.expeditions = [e];
  world.expeditionSites = [
    {
      id: "salvage-reef",
      name: "Salvage reef",
      description: "Test site",
      risk: 1,
      x: 20,
      y: 30,
      kind: "salvage",
      loot: { scrap: 20 },
    },
  ];
  crew.away = e.id;
  return e;
}
describe("compatible mechanics save validation", () => {
  it("accepts a legacy snapshot without additive mechanics state", () => {
    const { world, colony } = fixture();
    delete colony.systems;
    delete world.expeditions;
    delete world.expeditionSites;
    for (const crew of colony.colonists) {
      delete crew.mind;
      delete crew.injuries;
      delete crew.thirst;
      delete crew.away;
    }
    expect(() => validateExtendedWorld(world)).not.toThrow();
  });
  it("preserves queues, wounds, personality and deployed cargo through serialization", () => {
    const { world, crew } = fixture();
    addSystems(world);
    addExpedition(world);
    crew.injuries = [
      { id: "inj-test", kind: "cut", severity: 12, tended: true, infection: 0 },
    ];
    crew.mind = {
      traits: ["steadfast"],
      memories: [{ text: "Rescued a friend", impact: 8, expiresTick: 500 }],
      relationships: {},
      stress: 15,
      breakUntil: 0,
      skills: { medicine: 14 },
    };
    const saved = JSON.parse(JSON.stringify(world));
    expect(() => validateExtendedWorld(saved)).not.toThrow();
    expect(saved).toEqual(world);
  });
  it("rejects invalid queues, hidden nonfinite data, and impossible resource quantities", () => {
    const { world, colony, crew } = fixture();
    const systems = addSystems(world);
    const bad = (mutate: (w: World) => void) => {
      const copy = structuredClone(world);
      mutate(copy);
      expect(() => validateExtendedWorld(copy)).toThrow(/Corrupt/);
    };
    bad((w) => (Object.values(w.colonies)[0].resources.scrap = -1));
    bad((w) => (Object.values(w.colonies)[0].systems!.water = Infinity));
    bad(
      (w) =>
        (Object.values(w.colonies)[0].systems!.production[0].recipeId =
          "duplication"),
    );
    bad(
      (w) =>
        (Object.values(w.colonies)[0].systems!.production[0].remaining = 1000),
    );
    bad(
      (w) =>
        (Object.values(w.colonies)[0].systems!.production[0].workerId =
          "foreign-crew"),
    );
    bad(
      (w) =>
        (Object.values(w.colonies)[0].systems!.water =
          systems.waterCapacity + 1),
    );
    crew.injuries = [
      {
        id: "inj-test",
        kind: "infection",
        severity: 20,
        tended: false,
        infection: Number.NaN,
      },
    ];
    expect(() => validateExtendedWorld(world)).toThrow(/Corrupt/);
  });
  it("rejects duplicated away locations, forged ownership, bad combat bounds, and negative cargo", () => {
    const { world } = fixture();
    addExpedition(world);
    const bad = (mutate: (w: World) => void) => {
      const copy = structuredClone(world);
      mutate(copy);
      expect(() => validateExtendedWorld(copy)).toThrow(/Corrupt/);
    };
    bad((w) => (w.expeditions![0].cargo.scrap = -1));
    bad((w) => (w.expeditions![0].units[0].x = 32));
    bad((w) => (w.expeditions![0].units[0].ownerId = "foreign-player"));
    bad((w) =>
      w.expeditions!.push({
        ...structuredClone(w.expeditions![0]),
        id: "another-trip",
      }),
    );
    bad(
      (w) => (Object.values(w.colonies)[0].colonists[0].away = "missing-trip"),
    );
    bad((w) => (w.expeditions![0].siteId = "missing-site"));
  });
});
