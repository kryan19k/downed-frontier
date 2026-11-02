import { describe, expect, it } from "vitest";
import {
  BUILDINGS,
  MAP_SIZE,
  type Colony,
  type Command,
  type Resource,
  type World,
} from "@frontier/shared";
import {
  applyCommand,
  createTerrain,
  createWorld,
  getPlayerView,
  joinWorld,
  tickWorld,
} from "./index";

function setup(seed = 719) {
  const world = createWorld(seed);
  joinWorld(world, "alice", "Alice");
  joinWorld(world, "bob", "Bob");
  expect(
    applyCommand(world, "alice", {
      type: "claim",
      siteId: world.sites[0].id,
      name: "Amber Reach",
      scenario: "last-shift",
    }).ok,
  ).toBe(true);
  expect(
    applyCommand(world, "bob", {
      type: "claim",
      siteId: world.sites[1].id,
      name: "Blue Haven",
      scenario: "last-shift",
    }).ok,
  ).toBe(true);
  return world;
}

function colony(world: World, playerId = "alice"): Colony {
  return world.colonies[world.players[playerId].colonyId!];
}

function freeCell(world: World, home = colony(world)) {
  const site = world.sites.find((site) => site.id === home.siteId)!;
  const terrain = createTerrain(site.seed);
  for (let y = 15; y < MAP_SIZE - 15; y++) {
    for (let x = 15; x < MAP_SIZE - 15; x++) {
      if (!["grass", "sand", "deck"].includes(terrain[y * MAP_SIZE + x]))
        continue;
      if (
        [...home.buildings, ...home.deposits, ...home.colonists].some(
          (item) => item.x === x && item.y === y,
        )
      )
        continue;
      return { x, y };
    }
  }
  throw new Error("Seed has no free interior build cell");
}

function command(world: World, actor: string, cmd: Command) {
  const result = applyCommand(world, actor, cmd);
  expect(result.ok, result.message).toBe(true);
}

describe("deterministic authoritative simulation", () => {
  it("generates stable 64×64 terrain with water and inhabitable land", () => {
    const a = createTerrain(719);
    expect(a).toHaveLength(MAP_SIZE * MAP_SIZE);
    expect(createTerrain(719)).toEqual(a);
    expect(a).toContain("water");
    expect(a.some((tile) => tile === "grass" || tile === "deck")).toBe(true);
    expect(createTerrain(720)).not.toEqual(a);
  });

  it("replays a seed, command sequence and tick count to identical state", () => {
    const a = setup();
    const b = setup();
    const point = freeCell(a);
    command(a, "alice", { type: "build", building: "bed", ...point });
    command(b, "alice", { type: "build", building: "bed", ...point });
    tickWorld(a, 1200);
    for (let i = 0; i < 1200; i++) tickWorld(b);
    expect(a).toEqual(b);
    for (const home of Object.values(a.colonies)) {
      for (const quantity of Object.values(home.resources)) {
        expect(Number.isInteger(quantity)).toBe(true);
        expect(quantity).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("grants a site and starting crew exactly once", () => {
    const world = createWorld(719);
    joinWorld(world, "alice", "Alice");
    joinWorld(world, "bob", "Bob");
    const siteId = world.sites[0].id;
    command(world, "alice", {
      type: "claim",
      siteId,
      name: "Amber Reach",
      scenario: "last-shift",
    });
    const before = JSON.stringify(world);
    expect(
      applyCommand(world, "alice", {
        type: "claim",
        siteId: world.sites[1].id,
        name: "Second colony",
        scenario: "last-shift",
      }).ok,
    ).toBe(false);
    expect(
      applyCommand(world, "bob", {
        type: "claim",
        siteId,
        name: "Stolen colony",
        scenario: "last-shift",
      }).ok,
    ).toBe(false);
    expect(JSON.stringify(world)).toBe(before);
    expect(colony(world).colonists).toHaveLength(3);
    expect(world.sites[0].ownerId).toBe("alice");
    expect(world.players.bob.colonyId).toBeNull();
  });

  it("rejects foreign crew orders and out-of-bounds destinations without mutation", () => {
    const world = setup();
    const before = JSON.stringify(world);
    const foreign = colony(world, "bob").colonists[0];
    expect(
      applyCommand(world, "alice", {
        type: "move",
        colonistId: foreign.id,
        x: 32,
        y: 32,
      }).ok,
    ).toBe(false);
    expect(
      applyCommand(world, "alice", {
        type: "move",
        colonistId: colony(world).colonists[0].id,
        x: -1,
        y: 32,
      }).ok,
    ).toBe(false);
    expect(JSON.stringify(world)).toBe(before);
  });

  it("sends public colony metadata without exposing another colony inventory or crew", () => {
    const world = setup();
    colony(world, "bob").resources.scrap = 987654;
    const view = getPlayerView(world, "alice");
    expect(view.colony?.ownerId).toBe("alice");
    const neighbor = view.colonies.find((item) => item.ownerId === "bob")!;
    expect(neighbor).toBeDefined();
    expect(neighbor).not.toHaveProperty("resources");
    expect(neighbor).not.toHaveProperty("colonists");
    expect(neighbor).not.toHaveProperty("deposits");
    expect(JSON.stringify(view)).not.toContain("987654");
    expect(JSON.stringify(view)).not.toContain(
      colony(world, "bob").colonists[0].id,
    );
  });
});

describe("construction and interruption conservation", () => {
  it("reserves building costs once and refunds cancellation at most once", () => {
    const world = setup();
    const home = colony(world);
    const before = { ...home.resources };
    const point = freeCell(world);
    command(world, "alice", { type: "build", building: "bed", ...point });
    for (const [resource, cost] of Object.entries(BUILDINGS.bed.cost)) {
      expect(home.resources[resource as Resource]).toBe(
        before[resource as Resource] - cost!,
      );
    }
    const building = home.buildings.find(
      (item) => item.x === point.x && item.y === point.y,
    )!;
    expect(building.built).toBe(false);
    command(world, "alice", { type: "cancelBuild", buildingId: building.id });
    expect(home.resources).toEqual(before);
    const afterCancel = JSON.stringify(world);
    expect(
      applyCommand(world, "alice", {
        type: "cancelBuild",
        buildingId: building.id,
      }).ok,
    ).toBe(false);
    expect(JSON.stringify(world)).toBe(afterCancel);
  });

  it("rejects unaffordable construction and overlapping placement without spending twice", () => {
    const world = setup();
    const home = colony(world);
    const point = freeCell(world);
    command(world, "alice", { type: "build", building: "bed", ...point });
    let before = JSON.stringify(world);
    expect(
      applyCommand(world, "alice", { type: "build", building: "bed", ...point })
        .ok,
    ).toBe(false);
    expect(JSON.stringify(world)).toBe(before);
    home.resources.scrap = 0;
    before = JSON.stringify(world);
    expect(
      applyCommand(world, "alice", {
        type: "build",
        building: "wall",
        ...freeCell(world),
      }).ok,
    ).toBe(false);
    expect(JSON.stringify(world)).toBe(before);
  });

  it("releases a worker reservation when the player drafts that colonist", () => {
    const world = setup();
    const home = colony(world);
    tickWorld(world, 20);
    const reserved = [...home.buildings, ...home.deposits].find(
      (item) => item.reservedBy !== null,
    );
    expect(
      reserved,
      "At least one colonist should begin a reserved task",
    ).toBeDefined();
    const crew = home.colonists.find(
      (item) => item.id === reserved!.reservedBy,
    )!;
    expect(crew).toBeDefined();
    command(world, "alice", {
      type: "draft",
      colonistId: crew.id,
      drafted: true,
    });
    expect(
      [...home.buildings, ...home.deposits].some(
        (item) => item.reservedBy === crew.id,
      ),
    ).toBe(false);
    expect(crew.jobId).toBeNull();
    expect(crew.drafted).toBe(true);
  });
});

describe("trade and alliance state changes", () => {
  it("escrows offered goods and settles an exchange only once", () => {
    const world = setup();
    const alice = colony(world);
    const bob = colony(world, "bob");
    const aBefore = { ...alice.resources };
    const bBefore = { ...bob.resources };
    command(world, "alice", {
      type: "trade",
      targetId: "bob",
      give: "scrap",
      giveAmount: 3,
      want: "fiber",
      wantAmount: 2,
    });
    expect(alice.resources.scrap).toBe(aBefore.scrap - 3);
    const offer = world.offers[0];
    expect(offer.status).toBe("open");
    command(world, "bob", {
      type: "tradeRespond",
      offerId: offer.id,
      accept: true,
    });
    expect(alice.resources.scrap).toBe(aBefore.scrap - 3);
    expect(alice.resources.fiber).toBe(aBefore.fiber + 2);
    expect(bob.resources.scrap).toBe(bBefore.scrap + 3);
    expect(bob.resources.fiber).toBe(bBefore.fiber - 2);
    const after = JSON.stringify(world);
    expect(
      applyCommand(world, "bob", {
        type: "tradeRespond",
        offerId: offer.id,
        accept: true,
      }).ok,
    ).toBe(false);
    expect(JSON.stringify(world)).toBe(after);
  });

  it("returns cancelled escrow once and forbids unrelated players accepting it", () => {
    const world = setup();
    joinWorld(world, "eve", "Eve");
    const home = colony(world);
    const before = { ...home.resources };
    command(world, "alice", {
      type: "trade",
      targetId: "bob",
      give: "scrap",
      giveAmount: 3,
      want: "fiber",
      wantAmount: 2,
    });
    const offer = world.offers[0];
    expect(
      applyCommand(world, "eve", {
        type: "tradeRespond",
        offerId: offer.id,
        accept: true,
      }).ok,
    ).toBe(false);
    command(world, "alice", {
      type: "tradeRespond",
      offerId: offer.id,
      accept: false,
    });
    expect(home.resources).toEqual(before);
    expect(
      applyCommand(world, "alice", {
        type: "tradeRespond",
        offerId: offer.id,
        accept: false,
      }).ok,
    ).toBe(false);
    expect(home.resources).toEqual(before);
  });

  it("requires a bilateral request before an alliance and revokes cleanly", () => {
    const world = setup();
    expect(
      applyCommand(world, "bob", {
        type: "alliance",
        targetId: "alice",
        action: "accept",
      }).ok,
    ).toBe(false);
    command(world, "alice", {
      type: "alliance",
      targetId: "bob",
      action: "request",
    });
    expect(world.alliances).toHaveLength(0);
    expect(world.allianceRequests).toHaveLength(1);
    command(world, "bob", {
      type: "alliance",
      targetId: "alice",
      action: "accept",
    });
    expect(world.alliances).toHaveLength(1);
    expect(world.alliances[0]).toContain("alice");
    expect(world.alliances[0]).toContain("bob");
    command(world, "alice", {
      type: "alliance",
      targetId: "bob",
      action: "revoke",
    });
    expect(world.alliances).toHaveLength(0);
  });
});
