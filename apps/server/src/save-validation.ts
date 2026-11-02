import { z } from "zod";
import { BUILDINGS, RECIPES, RESEARCH, type World } from "@frontier/shared";

const finite = z.number().finite();
const nonnegative = finite.min(0);
const count = nonnegative.int();
const percentage = finite.min(0).max(100);
const key = z.string().min(1).max(100);
const nullableKey = key.nullable();
const point = z.object({
  x: z.number().int().min(0).max(63),
  y: z.number().int().min(0).max(63),
});
const resources = [
  "scrap",
  "fiber",
  "rations",
  "components",
  "medicine",
  "fuel",
] as const;
const resource = z.enum(resources);
const inventory = z.object({
  scrap: count,
  fiber: count,
  rations: count,
  components: count,
  medicine: count,
  fuel: count,
});
const cargo = inventory.partial().strict();
const recipe = z.enum(RECIPES.map((r) => r.id) as [string, ...string[]]);
const research = z.enum(RESEARCH.map((r) => r.id) as [string, ...string[]]);
const injury = z.object({
  id: key,
  kind: z.enum(["cut", "fracture", "infection", "exposure"]),
  severity: percentage,
  tended: z.boolean(),
  infection: percentage,
});
const mind = z.object({
  traits: z.array(z.string()).max(20),
  memories: z
    .array(
      z.object({
        text: z.string(),
        impact: finite.min(-100).max(100),
        expiresTick: count,
      }),
    )
    .max(100),
  relationships: z.record(finite.min(-100).max(100)),
  stress: percentage,
  breakUntil: count,
  skills: z.record(percentage),
});
const systems = z.object({
  water: nonnegative,
  waterCapacity: nonnegative,
  storageCapacity: count,
  battery: nonnegative,
  flood: percentage,
  tide: percentage,
  oxygen: percentage,
  roomCount: count.max(4096),
  foodSpoilProgress: nonnegative,
  production: z
    .array(
      z.object({
        id: key,
        recipeId: recipe,
        remaining: count.max(20),
        progress: nonnegative,
        workerId: nullableKey,
      }),
    )
    .max(100),
  researchProject: research.nullable(),
  researchProgress: nonnegative,
  unlocked: z.array(research).max(RESEARCH.length),
  sheltered: z.boolean(),
  workPolicy: z.enum(["balanced", "rest", "intensive"]),
  rationing: z.boolean(),
  lastDirectorTick: count,
});
const colonist = point.extend({
  id: key,
  name: z.string(),
  health: percentage,
  hunger: percentage,
  energy: percentage,
  morale: percentage,
  skill: nonnegative,
  task: z.string(),
  target: point.nullable(),
  jobId: nullableKey,
  progress: nonnegative,
  drafted: z.boolean(),
  priority: z.enum(["balanced", "build", "salvage"]),
  blockedReason: z.string().nullable(),
  carrying: z
    .object({ resource, amount: count.min(1) })
    .nullable()
    .optional(),
  injuries: z.array(injury).max(100).optional(),
  mind: mind.optional(),
  thirst: percentage.optional(),
  away: nullableKey.optional(),
});
const building = point.extend({
  id: key,
  type: z.enum(
    Object.keys(BUILDINGS) as [
      keyof typeof BUILDINGS,
      ...(keyof typeof BUILDINGS)[],
    ],
  ),
  built: z.boolean(),
  progress: nonnegative,
  health: percentage,
  reservedBy: nullableKey,
  repairSupplies: z.boolean().optional(),
});
const deposit = point.extend({
  id: key,
  resource,
  amount: count,
  reservedBy: nullableKey,
});
const combatPoint = z.object({
  x: z.number().int().min(0).max(31),
  y: z.number().int().min(0).max(31),
});
const unit = combatPoint.extend({
  id: key,
  colonistId: nullableKey,
  ownerId: key,
  name: z.string(),
  health: nonnegative,
  maxHealth: nonnegative.min(1),
  cooldown: nonnegative,
  targetId: nullableKey,
  moveTarget: combatPoint.nullable(),
  weapon: z.enum(["carbine", "claws"]),
  downed: z.boolean(),
});
const expedition = z.object({
  id: key,
  ownerId: key,
  siteId: key,
  colonistIds: z.array(key).min(1).max(3),
  phase: z.enum(["outbound", "exploring", "combat", "returning", "complete"]),
  departTick: count,
  arrivalTick: count,
  cargo,
  units: z.array(unit).max(100),
  log: z.array(z.string()).max(100),
  retreating: z.boolean(),
  losses: nonnegative,
});
const expeditionSite = z.object({
  id: key,
  name: z.string(),
  description: z.string(),
  risk: nonnegative,
  x: finite,
  y: finite,
  kind: z.enum(["salvage", "ruin", "nest"]),
  loot: cargo,
});
function requireValid<T>(schema: z.ZodType<T>, value: unknown, label: string) {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new Error(
      `Corrupt ${label}: ${result.error.issues[0]?.path.join(".") || "invalid value"}`,
    );
}
/** Validates additive mechanics without replacing old saves or discarding unknown compatible fields. */
export function validateExtendedWorld(world: World): void {
  const allIds = new Set<string>();
  for (const colony of Object.values(world.colonies)) {
    requireValid(inventory, colony.resources, "resource inventory");
    for (const member of colony.colonists)
      requireValid(colonist, member, "colonist state");
    for (const member of colony.buildings)
      requireValid(building, member, "building state");
    for (const member of colony.deposits)
      requireValid(deposit, member, "deposit state");
    for (const entity of [
      ...colony.colonists,
      ...colony.buildings,
      ...colony.deposits,
    ]) {
      if (allIds.has(entity.id))
        throw new Error("Corrupt duplicate entity identity");
      allIds.add(entity.id);
    }
    for (const item of [...colony.buildings, ...colony.deposits]) {
      if (
        item.reservedBy &&
        !colony.colonists.some((c) => c.id === item.reservedBy)
      )
        throw new Error("Corrupt work reservation owner");
    }
    if (colony.systems !== undefined) {
      requireValid(systems, colony.systems, "colony systems");
      if (colony.systems.water > colony.systems.waterCapacity)
        throw new Error("Corrupt freshwater capacity");
      if (
        new Set(colony.systems.unlocked).size !== colony.systems.unlocked.length
      )
        throw new Error("Corrupt duplicate research unlock");
      const bills = new Set<string>();
      for (const bill of colony.systems.production) {
        if (bills.has(bill.id))
          throw new Error("Corrupt duplicate production bill");
        bills.add(bill.id);
        if (
          bill.workerId &&
          !colony.colonists.some((c) => c.id === bill.workerId)
        )
          throw new Error("Corrupt production worker reference");
      }
    }
  }
  if (world.expeditionSites !== undefined) {
    requireValid(
      z.array(expeditionSite).max(100),
      world.expeditionSites,
      "expedition sites",
    );
    if (
      new Set(world.expeditionSites.map((s) => s.id)).size !==
      world.expeditionSites.length
    )
      throw new Error("Corrupt duplicate expedition site");
  }
  if (world.expeditions !== undefined) {
    requireValid(
      z.array(expedition).max(1000),
      world.expeditions,
      "expedition state",
    );
    const ids = new Set<string>();
    const activeCrew = new Set<string>();
    for (const e of world.expeditions) {
      if (ids.has(e.id))
        throw new Error("Corrupt duplicate expedition identity");
      ids.add(e.id);
      const owner = world.players[e.ownerId],
        colony = owner?.colonyId ? world.colonies[owner.colonyId] : null;
      if (!colony || !world.expeditionSites?.some((s) => s.id === e.siteId))
        throw new Error("Corrupt expedition ownership or site");
      if (new Set(e.colonistIds).size !== e.colonistIds.length)
        throw new Error("Corrupt repeated expedition crew");
      const unitIds = new Set<string>();
      for (const u of e.units) {
        if (unitIds.has(u.id) || u.health > u.maxHealth)
          throw new Error("Corrupt combat unit state");
        unitIds.add(u.id);
        if (
          u.colonistId &&
          (u.ownerId !== e.ownerId || !e.colonistIds.includes(u.colonistId))
        )
          throw new Error("Corrupt combat crew ownership");
      }
      for (const crewId of e.colonistIds) {
        const crew = colony.colonists.find((c) => c.id === crewId);
        if (!crew) throw new Error("Corrupt expedition crew reference");
        if (e.phase !== "complete") {
          if (activeCrew.has(crewId) || crew.away !== e.id)
            throw new Error("Corrupt active expedition crew location");
          activeCrew.add(crewId);
        }
      }
    }
    for (const colony of Object.values(world.colonies))
      for (const crew of colony.colonists)
        if (
          crew.away &&
          !world.expeditions.some(
            (e) =>
              e.id === crew.away &&
              e.ownerId === colony.ownerId &&
              e.phase !== "complete" &&
              e.colonistIds.includes(crew.id),
          )
        )
          throw new Error("Corrupt away crew reference");
  } else {
    for (const colony of Object.values(world.colonies))
      if (colony.colonists.some((c) => c.away))
        throw new Error("Corrupt away crew without expeditions");
  }
}
