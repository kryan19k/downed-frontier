import {
  RECIPES,
  type World,
  type Colony,
  type Colonist,
  type Command,
  type CommandResult,
  type Building,
  type Point,
  type Terrain,
  type Resource,
  type Inventory,
} from "@frontier/shared";

export type SystemHelpers = {
  release: (c: Colony, a: Colonist) => void;
  reset: (c: Colony, a: Colonist, reason?: string) => void;
  move: (c: Colony, a: Colonist, p: Point, adjacent?: boolean) => boolean;
  nearest: <T extends Point & { id: string }>(
    c: Colony,
    a: Colonist,
    targets: T[],
    adjacent?: boolean,
  ) => T | undefined;
  reachable?: (c: Colony, a: Colonist, p: Point, adjacent?: boolean) => boolean;
  tiles: Terrain[];
  workMultiplier?: (c: Colony, a: Colonist, skill: string) => number;
  experience?: (a: Colonist, skill: string, amount: number) => void;
};
const resources: Resource[] = [
  "scrap",
  "fiber",
  "rations",
  "components",
  "medicine",
  "fuel",
];
const ok = (message: string): CommandResult => ({ ok: true, message });
const fail = (message: string): CommandResult => ({ ok: false, message });
function event(
  w: World,
  c: Colony,
  text: string,
  kind: "info" | "success" | "warning" | "danger" = "info",
) {
  c.events.unshift({ id: `event-${w.nextId++}`, tick: w.tick, text, kind });
  c.events = c.events.slice(0, 40);
}
export function storedAmount(c: Colony) {
  return resources.reduce((n, r) => n + c.resources[r], 0);
}
export function storageRoom(c: Colony) {
  return Math.max(0, (c.systems?.storageCapacity ?? 400) - storedAmount(c));
}
export function refreshColonyCapacities(c: Colony) {
  const s = c.systems;
  if (!s) return;
  s.storageCapacity =
    200 +
    200 * c.buildings.filter((b) => b.built && b.type === "stockpile").length;
  s.waterCapacity =
    120 +
    100 * c.buildings.filter((b) => b.built && b.type === "reservoir").length;
  // Removing physical storage spills excess fluid/charge, never inventory goods.
  s.water = Math.max(0, Math.min(s.water, s.waterCapacity));
  s.battery = Math.max(
    0,
    Math.min(
      s.battery,
      100 * c.buildings.filter((b) => b.built && b.type === "battery").length,
    ),
  );
}
export function ensureColonySystems(w: World, c: Colony) {
  c.systems ??= {
    water: 90,
    waterCapacity: 120,
    storageCapacity: 400,
    battery: 0,
    flood: 0,
    tide: 0,
    oxygen: 100,
    roomCount: 0,
    foodSpoilProgress: 0,
    production: [],
    researchProject: null,
    researchProgress: 0,
    unlocked: [],
    sheltered: false,
    workPolicy: "balanced",
    rationing: false,
    lastDirectorTick: w.tick,
  };
  for (const a of c.colonists) {
    a.injuries ??= [];
    a.thirst ??= 90;
    a.away ??= null;
  }
}
export function applyColonyCommand(
  w: World,
  c: Colony,
  cmd: Command,
  h: SystemHelpers,
): CommandResult | null {
  if (cmd.type === "queueRecipe") {
    const recipe = RECIPES.find((r) => r.id === cmd.recipeId);
    if (!recipe) return fail("Unknown recipe.");
    if (
      !Number.isInteger(cmd.quantity) ||
      cmd.quantity < 1 ||
      cmd.quantity > 20
    )
      return fail("Queue between 1 and 20 batches.");
    if (c.systems!.production.length >= 12)
      return fail("Production queue is full.");
    if (recipe.research && !c.systems!.unlocked.includes(recipe.research))
      return fail("Research this recipe first.");
    if (!c.buildings.some((b) => b.built && b.type === recipe.station))
      return fail(`Build the required ${recipe.station} station first.`);
    c.systems!.production.push({
      id: `bill-${w.nextId++}`,
      recipeId: recipe.id,
      remaining: cmd.quantity,
      progress: 0,
      workerId: null,
    });
    return ok(
      "Production bill queued. Crew must reach the station and perform the work.",
    );
  }
  if (cmd.type === "cancelRecipe") {
    const bill = c.systems!.production.find((b) => b.id === cmd.billId);
    if (!bill) return fail("Production bill not found.");
    for (const a of c.colonists) if (a.jobId === bill.id) h.reset(c, a);
    c.systems!.production = c.systems!.production.filter((b) => b !== bill);
    return ok(
      "Bill canceled. No ingredients are consumed before a batch completes.",
    );
  }
  if (cmd.type === "tend") {
    const patient = c.colonists.find((a) => a.id === cmd.colonistId);
    if (!patient || patient.away)
      return fail("Choose an owned survivor at home.");
    if (patient.health >= 100 && !patient.injuries!.some((i) => i.severity > 0))
      return fail("This survivor does not need treatment.");
    if (c.resources.medicine < 1)
      return fail("Treatment requires one medicine.");
    if (c.colonists.some((a) => a.task === "Tending" && a.jobId === patient.id))
      return fail("Treatment is already assigned.");
    const medic = c.colonists
      .filter(
        (a) =>
          a.id !== patient.id &&
          !a.away &&
          !a.drafted &&
          a.health > 25 &&
          a.task !== "Tending",
      )
      .sort(
        (a, b) =>
          (b.role === "Medic" ? 1 : 0) - (a.role === "Medic" ? 1 : 0) ||
          a.id.localeCompare(b.id),
      )
      .find((a) => !!h.nearest(c, a, [patient]));
    if (!medic)
      return fail("No healthy available survivor can reach this patient.");
    h.reset(c, patient);
    patient.task = "Recovering";
    h.reset(c, medic);
    medic.task = "Tending";
    medic.jobId = patient.id;
    medic.target = { x: patient.x, y: patient.y };
    return ok(
      `${medic.name.split(" ")[0]} assigned to medical care. Medicine is used when treatment completes.`,
    );
  }
  return null;
}
function sealedRooms(tiles: Terrain[], c: Colony) {
  const blocked = new Uint8Array(4096);
  for (const b of c.buildings)
    if (b.built && (b.type === "wall" || b.type === "door"))
      blocked[b.y * 64 + b.x] = 1;
  const seen = new Uint8Array(4096);
  let rooms = 0;
  for (let start = 0; start < 4096; start++) {
    if (seen[start] || blocked[start]) continue;
    const q = [start];
    seen[start] = 1;
    let touchesEdge = false,
      land = 0;
    for (let head = 0; head < q.length; head++) {
      const n = q[head],
        x = n % 64,
        y = Math.floor(n / 64);
      if (x === 0 || y === 0 || x === 63 || y === 63) touchesEdge = true;
      if (tiles[n] !== "water") land++;
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        const v = ny * 64 + nx;
        if (nx < 0 || ny < 0 || nx >= 64 || ny >= 64 || seen[v] || blocked[v])
          continue;
        seen[v] = 1;
        q.push(v);
      }
    }
    if (!touchesEdge && land >= 2) rooms++;
  }
  return rooms;
}
export function tickColonySystems(w: World, c: Colony, h: SystemHelpers) {
  const s = c.systems!;
  if (s.sheltered) return;
  if (w.tick % 10 === 0) {
    refreshColonyCapacities(c);
    const gens = c.buildings.filter(
      (b) => b.built && b.type === "generator" && b.health >= 65,
    );
    let available = gens.length && c.resources.fuel > 0 ? 100 * gens.length : 0;
    const batteries = c.buildings.filter(
      (b) => b.built && b.type === "battery",
    ).length;
    if (available) {
      if (w.tick % 600 === 0)
        c.resources.fuel = Math.max(0, c.resources.fuel - gens.length);
      s.battery = Math.min(batteries * 100, s.battery + 2);
    } else if (batteries && s.battery > 0) {
      available = 60;
      s.battery = Math.max(0, s.battery - 1);
    }
    let pumps = 0;
    for (const b of c.buildings)
      if (b.built && b.type === "pump" && b.health > 35 && available >= 25) {
        available -= 25;
        pumps++;
      }
    c.power = available;
    const phase = (w.tick - (c.foundedTick ?? 0)) % 2400;
    s.tide = Math.round(50 + 50 * Math.sin((phase * Math.PI) / 1200));
    if (w.tick % 100 === 0) {
      s.roomCount = sealedRooms(h.tiles, c);
      const old = s.flood;
      const rise = (s.tide > 70 ? 7 : 0) + (c.storm ? 4 : 0);
      s.flood = Math.max(
        0,
        Math.min(
          100,
          s.flood +
            Math.max(0, rise - Math.min(s.roomCount, 2)) -
            1 -
            pumps * (s.unlocked.includes("hydraulics") ? 7 : 5),
        ),
      );
      if (old < 40 && s.flood >= 40)
        event(
          w,
          c,
          "High water is entering the outpost. Restore power and build bilge pumps.",
          "warning",
        );
      if (s.flood >= 70) {
        const exposed = c.buildings
          .filter((b) => b.built && b.type !== "floor" && b.type !== "wall")
          .sort((a, b) => a.id.localeCompare(b.id));
        for (const b of exposed) b.health = Math.max(10, b.health - 1);
        const crew = c.colonists.find((a) => !a.away && a.health > 25);
        if (crew) {
          crew.health = Math.max(5, crew.health - 1);
          if (!crew.injuries!.some((i) => i.kind === "exposure"))
            crew.injuries!.push({
              id: `injury-${w.nextId++}`,
              kind: "exposure",
              severity: 8,
              tended: false,
              infection: 0,
            });
        }
      }
      const deep =
        w.sites.find((site) => site.id === c.siteId)?.biome === "Deep";
      s.oxygen = deep
        ? Math.max(0, Math.min(100, s.oxygen + (available > 0 ? 2 : -1)))
        : 100;
      for (const a of c.colonists) {
        if (a.away) continue;
        a.thirst = Math.max(0, a.thirst! - 1);
        if ((a.thirst === 0 || s.oxygen < 20) && a.health > 5)
          a.health = Math.max(5, a.health - 1);
        for (const injury of a.injuries!) {
          if (!injury.tended) {
            injury.infection = Math.min(100, injury.infection + 1);
            if (injury.infection >= 60) a.health = Math.max(0, a.health - 1);
          } else {
            injury.severity = Math.max(0, injury.severity - 1);
            injury.infection = Math.max(0, injury.infection - 2);
            a.health = Math.min(100, a.health + 1);
          }
        }
        a.injuries = a.injuries!.filter((i) => i.severity > 0);
      }
    }
    const cisterns = c.buildings.filter(
      (b) => b.built && b.type === "reservoir",
    ).length;
    if (w.tick % 200 === 0)
      s.water = Math.min(
        s.waterCapacity,
        s.water +
          cisterns *
            (c.storm ? 6 : 3) *
            (s.unlocked.includes("hydraulics") ? 2 : 1),
      );
    if (w.tick % 600 === 0 && s.flood > 40 && c.resources.rations > 0) {
      c.resources.rations--;
      event(
        w,
        c,
        "Floodwater spoiled one stored ration. Pump out the outpost.",
        "warning",
      );
    }
    if (c.autoCraft && w.tick % 100 === 0) {
      for (const rid of ["rations", "components"]) {
        const r = RECIPES.find((r) => r.id === rid)!;
        if (
          (rid === "rations"
            ? c.resources.rations < 20
            : c.resources.components < 18) &&
          !s.production.some((b) => b.recipeId === rid) &&
          c.buildings.some((b) => b.built && b.type === r.station) &&
          Object.entries(r.inputs).every(
            ([k, n]) => c.resources[k as Resource] >= n!,
          )
        )
          s.production.push({
            id: `bill-${w.nextId++}`,
            recipeId: rid,
            remaining: 1,
            progress: 0,
            workerId: null,
          });
      }
    }
  }
}
export function tickColonistSystems(
  w: World,
  c: Colony,
  a: Colonist,
  h: SystemHelpers,
): boolean {
  const s = c.systems!;
  if (a.thirst! < 45 && s.water > 0 && !a.drafted) {
    h.reset(c, a);
    s.water--;
    a.thirst = Math.min(100, a.thirst! + 35);
    a.task = "Drinking";
    return true;
  }
  if (c.colonists.some((m) => m.task === "Tending" && m.jobId === a.id)) {
    a.task = "Recovering";
    return true;
  }
  if (a.task === "Tending") {
    const patient = c.colonists.find((p) => p.id === a.jobId && !p.away);
    if (!patient || !c.resources.medicine) {
      h.reset(c, a, "Treatment needs a patient and medicine");
      return true;
    }
    if (h.move(c, a, patient, true)) {
      a.progress += a.role === "Medic" ? 2 : 1;
      if (a.progress >= 40) {
        c.resources.medicine--;
        const bonus = s.unlocked.includes("medicine") ? 40 : 25;
        patient.health = Math.min(100, patient.health + bonus);
        for (const injury of patient.injuries!) {
          injury.tended = true;
          injury.severity = Math.max(0, injury.severity - bonus);
          injury.infection = Math.max(0, injury.infection - 40);
        }
        patient.injuries = patient.injuries!.filter((i) => i.severity > 0);
        h.experience?.(a, "medicine", 1);
        patient.task = "Idle";
        h.reset(c, a);
        event(
          w,
          c,
          `${patient.name.split(" ")[0]} received medical treatment.`,
          "success",
        );
      }
    }
    return true;
  }
  if (a.task === "Producing") {
    const bill = s.production.find((b) => b.id === a.jobId);
    const recipe = RECIPES.find((r) => r.id === bill?.recipeId);
    const station = c.buildings.find(
      (b) => b.built && b.type === recipe?.station && b.reservedBy === a.id,
    );
    if (!bill || !recipe || !station || !c.autoCraft) {
      h.reset(c, a);
      return true;
    }
    if (recipe.station !== "foodStation" && c.power <= 0) {
      a.blockedReason = "Production station needs power";
      return true;
    }
    if (!h.move(c, a, station, true)) return true;
    if (
      !Object.entries(recipe.inputs).every(
        ([r, n]) => c.resources[r as Resource] >= n!,
      )
    ) {
      a.blockedReason = "Waiting for recipe ingredients";
      return true;
    }
    const output = Object.values(recipe.outputs).reduce(
        (n, x) => n + (x ?? 0),
        0,
      ),
      input = Object.values(recipe.inputs).reduce((n, x) => n + (x ?? 0), 0);
    if (storageRoom(c) + input < output) {
      a.blockedReason = "Storage full — build another stockpile";
      return true;
    }
    bill.progress += h.workMultiplier?.(c, a, "fabrication") ?? a.skill;
    a.progress = bill.progress / recipe.work;
    a.blockedReason = null;
    if (bill.progress >= recipe.work) {
      for (const [r, n] of Object.entries(recipe.inputs))
        c.resources[r as Resource] -= n!;
      for (const [r, n] of Object.entries(recipe.outputs))
        c.resources[r as Resource] += n!;
      bill.remaining--;
      bill.progress = 0;
      h.experience?.(a, "fabrication", 1);
      h.reset(c, a);
      if (bill.remaining <= 0)
        s.production = s.production.filter((b) => b !== bill);
      event(w, c, `${recipe.name} batch completed.`, "success");
    }
    return true;
  }
  if (a.task === "Farming") {
    const farm = c.buildings.find(
      (b) => b.id === a.jobId && b.built && b.type === "farm",
    );
    if (!farm) {
      h.reset(c, a);
      return true;
    }
    if (s.water < 3) {
      h.reset(c, a, "Garden needs freshwater");
      return true;
    }
    if (storageRoom(c) < 6) {
      h.reset(c, a, "Storage full — garden harvest waiting");
      return true;
    }
    if (h.move(c, a, farm, true)) {
      a.progress += h.workMultiplier?.(c, a, "agriculture") ?? a.skill;
      if (a.progress >= 60) {
        const yieldAmount = s.unlocked.includes("agriculture") ? 9 : 6;
        if (storageRoom(c) < yieldAmount) {
          a.blockedReason = "Storage full";
          return true;
        }
        s.water -= 3;
        c.resources.fiber += yieldAmount;
        h.experience?.(a, "agriculture", 1);
        h.reset(c, a);
        event(w, c, `Saltroot harvested: ${yieldAmount} fiber.`, "success");
      }
    }
    return true;
  }
  return false;
}
export function selectSystemsJob(
  w: World,
  c: Colony,
  a: Colonist,
  h: SystemHelpers,
): boolean {
  if (
    a.away ||
    a.drafted ||
    a.carrying ||
    a.health <= 0 ||
    a.task === "Researching"
  )
    return false;
  const s = c.systems!;
  for (const bill of s.production) {
    if (bill.workerId) continue;
    const recipe = RECIPES.find((r) => r.id === bill.recipeId);
    if (!recipe || !c.autoCraft) continue;
    if (recipe.station !== "foodStation" && c.power <= 0) continue;
    if (
      !Object.entries(recipe.inputs).every(
        ([r, n]) => c.resources[r as Resource] >= n!,
      )
    )
      continue;
    const station = h.nearest(
      c,
      a,
      c.buildings.filter(
        (b) => b.built && b.type === recipe.station && !b.reservedBy,
      ),
    );
    if (!station) continue;
    h.release(c, a);
    bill.workerId = a.id;
    station.reservedBy = a.id;
    a.jobId = bill.id;
    a.task = "Producing";
    a.target = { x: station.x, y: station.y };
    a.blockedReason = null;
    return true;
  }
  if (c.resources.fiber < 45 && s.water >= 3 && storageRoom(c) >= 6) {
    const farm = h.nearest(
      c,
      a,
      c.buildings.filter((b) => b.built && b.type === "farm" && !b.reservedBy),
    );
    if (farm) {
      h.release(c, a);
      farm.reservedBy = a.id;
      a.jobId = farm.id;
      a.task = "Farming";
      a.target = { x: farm.x, y: farm.y };
      a.blockedReason = null;
      return true;
    }
  }
  return false;
}
