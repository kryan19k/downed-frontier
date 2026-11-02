import { describe, expect, it } from "vitest";
import { commandSchema } from "./server";
import { BUILDINGS, RECIPES, RESEARCH } from "@frontier/shared";

describe("mechanics protocol boundary", () => {
  it("accepts supported buildings, recipes, projects and valid policy pairs", () => {
    for (const building of Object.keys(BUILDINGS))
      expect(
        commandSchema.safeParse({ type: "build", building, x: 32, y: 32 })
          .success,
      ).toBe(true);
    for (const r of RECIPES)
      expect(
        commandSchema.safeParse({
          type: "queueRecipe",
          recipeId: r.id,
          quantity: 2,
        }).success,
      ).toBe(true);
    for (const r of RESEARCH)
      expect(
        commandSchema.safeParse({ type: "research", projectId: r.id }).success,
      ).toBe(true);
    for (const value of ["balanced", "rest", "intensive"])
      expect(
        commandSchema.safeParse({ type: "policy", policy: "work", value })
          .success,
      ).toBe(true);
    for (const policy of ["rationing", "shelter"])
      for (const value of ["on", "off"])
        expect(
          commandSchema.safeParse({ type: "policy", policy, value }).success,
        ).toBe(true);
  });
  it("rejects unsupported content, policy confusion and manufacturing payload abuse", () => {
    for (const packet of [
      { type: "queueRecipe", recipeId: "free-money", quantity: 1 },
      { type: "queueRecipe", recipeId: "rations", quantity: 0 },
      { type: "queueRecipe", recipeId: "rations", quantity: 21 },
      { type: "queueRecipe", recipeId: "rations", quantity: 1.5 },
      {
        type: "queueRecipe",
        recipeId: "rations",
        quantity: 1,
        actorId: "someone-else",
      },
      { type: "research", projectId: "instant-victory" },
      { type: "policy", policy: "work", value: "on" },
      { type: "policy", policy: "shelter", value: "intensive" },
      { type: "policy", policy: "rationing", value: true },
    ])
      expect(
        commandSchema.safeParse(packet).success,
        JSON.stringify(packet),
      ).toBe(false);
  });
  it("bounds tactical orders and unique deployment rosters", () => {
    expect(
      commandSchema.safeParse({
        type: "expeditionLaunch",
        siteId: "salvage-reef",
        colonistIds: ["crew-1", "crew-2"],
      }).success,
    ).toBe(true);
    expect(
      commandSchema.safeParse({
        type: "expeditionOrder",
        expeditionId: "e-1",
        unitId: "u-1",
        x: 31,
        y: 0,
      }).success,
    ).toBe(true);
    expect(
      commandSchema.safeParse({
        type: "expeditionAttack",
        expeditionId: "e-1",
        unitId: "u-1",
        targetId: "u-2",
      }).success,
    ).toBe(true);
    for (const packet of [
      { type: "expeditionLaunch", siteId: "salvage-reef", colonistIds: [] },
      {
        type: "expeditionLaunch",
        siteId: "salvage-reef",
        colonistIds: ["crew-1", "crew-1"],
      },
      {
        type: "expeditionLaunch",
        siteId: "salvage-reef",
        colonistIds: ["a", "b", "c", "d"],
      },
      {
        type: "expeditionOrder",
        expeditionId: "e-1",
        unitId: "u-1",
        x: 32,
        y: 0,
      },
      {
        type: "expeditionOrder",
        expeditionId: "e-1",
        unitId: "u-1",
        x: 0,
        y: -1,
      },
      {
        type: "expeditionAttack",
        expeditionId: "e-1",
        unitId: "u-1",
        targetId: "u-2",
        damage: 1000,
      },
    ])
      expect(
        commandSchema.safeParse(packet).success,
        JSON.stringify(packet),
      ).toBe(false);
  });
});
