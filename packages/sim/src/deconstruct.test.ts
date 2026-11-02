import { describe, it, expect } from "vitest";
import { BUILDINGS, type Building, type Resource } from "@frontier/shared";
import { applyCommand, createWorld, joinWorld, tickWorld } from "./index";
function home() {
  const world = createWorld(719);
  joinWorld(world, "alice", "Alice");
  applyCommand(world, "alice", {
    type: "claim",
    siteId: "site-1",
    name: "Reclamation",
    scenario: "last-shift",
  });
  const colony = world.colonies[world.players.alice.colonyId!];
  colony.autoCraft = false;
  return { world, colony, crew: colony.colonists[0] };
}
describe("owned structure deconstruction", () => {
  it("returns floor-half construction materials and cannot refund a structure twice", () => {
    const { world, colony } = home();
    const bed = colony.buildings.find((b) => b.type === "bed")!;
    const before = { ...colony.resources };
    expect(
      applyCommand(world, "alice", { type: "deconstruct", buildingId: bed.id })
        .ok,
    ).toBe(true);
    for (const key of Object.keys(before) as Resource[])
      expect(colony.resources[key]).toBe(
        before[key] + Math.floor((BUILDINGS.bed.cost[key] || 0) / 2),
      );
    const after = structuredClone(world);
    expect(
      applyCommand(world, "alice", { type: "deconstruct", buildingId: bed.id })
        .ok,
    ).toBe(false);
    expect(world).toEqual(after);
  });
  it("releases a reserved resting bed safely without losing carried cargo", () => {
    const { world, colony, crew } = home();
    const bed = colony.buildings.find((b) => b.type === "bed")!;
    bed.reservedBy = crew.id;
    crew.jobId = bed.id;
    crew.task = "Resting";
    crew.target = { x: bed.x, y: bed.y };
    crew.carrying = { resource: "scrap", amount: 4 };
    expect(
      applyCommand(world, "alice", { type: "deconstruct", buildingId: bed.id })
        .ok,
    ).toBe(true);
    expect(crew.jobId).toBeNull();
    expect(crew.target).toBeNull();
    expect(crew.carrying).toEqual({ resource: "scrap", amount: 4 });
    expect(colony.buildings.some((b) => b.id === bed.id)).toBe(false);
  });
  it("returns prepaid repair supplies and releases the assigned repair worker", () => {
    const { world, colony } = home();
    const generator = colony.buildings.find((b) => b.type === "generator")!;
    const scrap = colony.resources.scrap;
    expect(
      applyCommand(world, "alice", { type: "repair", buildingId: generator.id })
        .ok,
    ).toBe(true);
    expect(colony.resources.scrap).toBe(scrap - 2);
    const worker = colony.colonists.find((p) => p.jobId === generator.id)!;
    expect(
      applyCommand(world, "alice", {
        type: "deconstruct",
        buildingId: generator.id,
      }).ok,
    ).toBe(true);
    expect(colony.resources.scrap).toBe(scrap + 6);
    expect(worker.jobId).toBeNull();
    expect(worker.target).toBeNull();
  });
  it("rejects foreign structures and unfinished blueprints without mutation", () => {
    const { world, colony } = home();
    joinWorld(world, "bob", "Bob");
    applyCommand(world, "bob", {
      type: "claim",
      siteId: "site-2",
      name: "Other home",
      scenario: "last-shift",
    });
    const foreign = world.colonies[world.players.bob.colonyId!].buildings[0];
    colony.buildings.push({
      id: "unfinished",
      type: "wall",
      x: 37,
      y: 37,
      built: false,
      progress: 10,
      health: 100,
      reservedBy: null,
    });
    const before = structuredClone(world);
    expect(
      applyCommand(world, "alice", {
        type: "deconstruct",
        buildingId: foreign.id,
      }).ok,
    ).toBe(false);
    expect(
      applyCommand(world, "alice", {
        type: "deconstruct",
        buildingId: "unfinished",
      }).ok,
    ).toBe(false);
    expect(world).toEqual(before);
  });
  it("reopens a sealed stockpile so stranded cargo can be delivered", () => {
    const { world, colony, crew } = home();
    for (const p of colony.colonists) p.drafted = true;
    crew.drafted = false;
    crew.x = 36;
    crew.y = 34;
    crew.carrying = { resource: "scrap", amount: 4 };
    crew.task = "Hauling";
    colony.deposits = [];
    for (const [i, [x, y]] of [
      [30, 34],
      [32, 34],
      [31, 33],
      [31, 35],
    ].entries())
      colony.buildings.push({
        id: `seal-${i}`,
        type: "wall",
        x,
        y,
        built: true,
        progress: 35,
        health: 100,
        reservedBy: null,
      } as Building);
    tickWorld(world, 30);
    expect(crew.carrying?.amount).toBe(4);
    expect(crew.blockedReason).toContain("stockpile");
    const before = colony.resources.scrap;
    expect(
      applyCommand(world, "alice", {
        type: "deconstruct",
        buildingId: "seal-1",
      }).ok,
    ).toBe(true);
    tickWorld(world, 150);
    expect(crew.carrying).toBeNull();
    expect(colony.resources.scrap).toBe(before + 2 + 4);
  });
});
