import { describe, it, expect } from "vitest";
import type { World, Colony, ColonySystems, Point } from "@frontier/shared";
import { createWorld, joinWorld, applyCommand } from "./index";
import {
  ensureMinds,
  applyMindCommand,
  tickMinds,
  remember,
  workMultiplier,
  skillExperience,
  type MindHelpers,
} from "./minds";
function fixture() {
  const w = createWorld(719);
  joinWorld(w, "alice", "Alice");
  applyCommand(w, "alice", {
    type: "claim",
    siteId: w.sites[0].id,
    name: "Quiet Anchorage",
    scenario: "last-shift",
  });
  const c = w.colonies[w.players.alice.colonyId!];
  const systems: ColonySystems = {
    water: 100,
    waterCapacity: 200,
    storageCapacity: 1000,
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
    lastDirectorTick: 0,
  };
  c.systems = systems;
  ensureMinds(w, c);
  return { w, c, s: systems };
}
const helpers: MindHelpers = {
  release(c, a) {
    for (const b of c.buildings) if (b.reservedBy === a.id) b.reservedBy = null;
    for (const d of c.deposits) if (d.reservedBy === a.id) d.reservedBy = null;
    a.jobId = null;
    a.target = null;
    a.progress = 0;
  },
  move(_c, a, p, adjacent = false) {
    const distance = Math.abs(a.x - p.x) + Math.abs(a.y - p.y);
    if (distance <= (adjacent ? 1 : 0)) return true;
    if (a.x !== p.x) a.x += Math.sign(p.x - a.x);
    else a.y += Math.sign(p.y - a.y);
    return false;
  },
};
function advance(w: World, c: Colony, ticks: number, h?: MindHelpers) {
  for (let i = 0; i < ticks; i++) {
    w.tick++;
    tickMinds(w, c, h);
  }
}
describe("colonist minds, policies and staffed research", () => {
  it("initializes stable traits and reciprocal relationships without duplicate or destructive migration", () => {
    const a = fixture(),
      b = fixture();
    expect(a.c.colonists.map((c) => c.mind)).toEqual(
      b.c.colonists.map((c) => c.mind),
    );
    const mind = a.c.colonists[0].mind!;
    mind.stress = 41;
    ensureMinds(a.w, a.c);
    expect(mind.stress).toBe(41);
    expect(mind.traits).toContain("Industrious");
    expect(mind.relationships[a.c.colonists[1].id]).toBe(
      a.c.colonists[1].mind!.relationships[a.c.colonists[0].id],
    );
  });
  it("uses aptitude, traits and work policy for bounded actual work rates and skills improve with earned experience", () => {
    const { c, s } = fixture(),
      crew = c.colonists[0];
    const base = workMultiplier(c, crew, "construction");
    s.workPolicy = "rest";
    expect(workMultiplier(c, crew, "construction")).toBeLessThan(base);
    s.workPolicy = "intensive";
    expect(workMultiplier(c, crew, "construction")).toBeGreaterThan(base);
    const old = crew.mind!.skills.construction;
    skillExperience(crew, "construction", 5);
    expect(crew.mind!.skills.construction).toBe(old + 5);
    skillExperience(crew, "construction", 999);
    expect(crew.mind!.skills.construction).toBe(100);
    skillExperience(crew, "construction", -99);
    expect(crew.mind!.skills.construction).toBe(100);
  });
  it("bounds repeated memories and removes expired mood effects deterministically", () => {
    const { w, c } = fixture(),
      a = c.colonists[0];
    remember(w, a, "Warm meal", 4, 10);
    remember(w, a, "Warm meal", 5, 10);
    expect(a.mind!.memories).toHaveLength(1);
    for (let i = 0; i < 30; i++) remember(w, a, `Moment ${i}`, 2, 20);
    expect(a.mind!.memories).toHaveLength(12);
    advance(w, c, 21);
    expect(a.mind!.memories).toHaveLength(0);
  });
  it("nearby crew develop reciprocal relationships and memories, while away crew do not socialize locally", () => {
    const { w, c } = fixture(),
      a = c.colonists[0],
      b = c.colonists[1],
      away = c.colonists[2];
    away.away = "voyage";
    const before = a.mind!.relationships[b.id],
      distant = a.mind!.relationships[away.id];
    advance(w, c, 600);
    expect(a.mind!.relationships[b.id]).not.toBe(before);
    expect(a.mind!.relationships[b.id]).toBe(b.mind!.relationships[a.id]);
    expect(a.mind!.relationships[away.id]).toBe(distant);
    expect(a.mind!.memories.some((m) => m.text.includes(b.name))).toBe(true);
  });
  it("stress causes a bounded recovery break and releases reservations without destroying crew or cargo", () => {
    const { w, c } = fixture(),
      a = c.colonists[0],
      bed = c.buildings.find((b) => b.type === "bed")!;
    a.mind!.stress = 95;
    a.morale = 1;
    a.task = "Resting";
    a.jobId = bed.id;
    bed.reservedBy = a.id;
    a.carrying = { resource: "scrap", amount: 3 };
    advance(w, c, 100, helpers);
    expect(a.task).toBe("Stress recovery");
    expect(a.mind!.breakUntil).toBe(w.tick + 300);
    expect(bed.reservedBy).toBeNull();
    expect(a.carrying?.amount).toBe(3);
    const health = a.health;
    advance(w, c, 300, helpers);
    expect(a.task).toBe("Idle");
    expect(a.health).toBe(health);
    expect(a.mind!.stress).toBeLessThan(90);
  });
  it("rejects unknown and prerequisite-locked research without mutating its project", () => {
    const { w, c, s } = fixture();
    const before = structuredClone(s);
    expect(
      applyMindCommand(w, c, { type: "research", projectId: "industry" })?.ok,
    ).toBe(false);
    expect(
      applyMindCommand(w, c, { type: "research", projectId: "unknown" })?.ok,
    ).toBe(false);
    expect(s).toEqual(before);
  });
  it("research never progresses without a powered lab, an available worker and physical arrival", () => {
    const { w, c, s } = fixture();
    expect(
      applyMindCommand(w, c, { type: "research", projectId: "hydraulics" })?.ok,
    ).toBe(true);
    advance(w, c, 300, helpers);
    expect(s.researchProgress).toBe(0);
    c.buildings.push({
      id: "lab-test",
      type: "lab",
      x: 48,
      y: 35,
      built: true,
      health: 100,
      progress: 90,
      reservedBy: null,
    });
    c.power = 100;
    for (const a of c.colonists) a.drafted = true;
    advance(w, c, 100, helpers);
    expect(s.researchProgress).toBe(0);
    const worker = c.colonists[0];
    worker.drafted = false;
    advance(w, c, 1, helpers);
    expect(worker.task).toBe("Researching");
    expect(s.researchProgress).toBe(0);
    advance(w, c, 90, helpers);
    expect(s.researchProgress).toBeGreaterThan(0);
  });
  it("completes staffed research exactly once and unlocks dependent technology", () => {
    const { w, c, s } = fixture();
    c.power = 100;
    c.buildings.push({
      id: "lab-test",
      type: "lab",
      x: 30,
      y: 31,
      built: true,
      health: 100,
      progress: 90,
      reservedBy: null,
    });
    expect(
      applyMindCommand(w, c, { type: "research", projectId: "hydraulics" })?.ok,
    ).toBe(true);
    advance(w, c, 1000, helpers);
    expect(s.unlocked).toContain("hydraulics");
    expect(s.researchProject).toBeNull();
    expect(c.research).toBe(80);
    advance(w, c, 300, helpers);
    expect(c.research).toBe(80);
    expect(
      applyMindCommand(w, c, { type: "research", projectId: "industry" })?.ok,
    ).toBe(true);
    expect(
      applyMindCommand(w, c, { type: "research", projectId: "hydraulics" })?.ok,
    ).toBe(false);
  });
  it("shelter cannot erase an expedition or pending escrow and suspends research and minds safely", () => {
    const { w, c, s } = fixture(),
      a = c.colonists[0];
    a.away = "voyage";
    expect(
      applyMindCommand(w, c, { type: "policy", policy: "shelter", value: "on" })
        ?.ok,
    ).toBe(false);
    a.away = null;
    w.offers.push({
      id: "escrow",
      from: "alice",
      to: "bob",
      give: "scrap",
      giveAmount: 2,
      want: "fiber",
      wantAmount: 2,
      status: "open",
      createdTick: 0,
    });
    expect(
      applyMindCommand(w, c, { type: "policy", policy: "shelter", value: "on" })
        ?.ok,
    ).toBe(false);
    w.offers = [];
    a.carrying = { resource: "scrap", amount: 2 };
    expect(
      applyMindCommand(w, c, { type: "policy", policy: "shelter", value: "on" })
        ?.ok,
    ).toBe(true);
    expect(s.sheltered).toBe(true);
    const before = structuredClone(c);
    advance(w, c, 1000, helpers);
    expect(c).toEqual(before);
    expect(
      applyMindCommand(w, c, { type: "research", projectId: "hydraulics" })?.ok,
    ).toBe(false);
    expect(
      applyMindCommand(w, c, {
        type: "policy",
        policy: "shelter",
        value: "off",
      })?.ok,
    ).toBe(true);
    expect(a.carrying?.amount).toBe(2);
  });
  it("policies validate paired values and apply real state changes", () => {
    const { w, c, s } = fixture();
    expect(
      applyMindCommand(w, c, { type: "policy", policy: "work", value: "rest" })
        ?.ok,
    ).toBe(true);
    expect(s.workPolicy).toBe("rest");
    expect(
      applyMindCommand(w, c, {
        type: "policy",
        policy: "rationing",
        value: "on",
      })?.ok,
    ).toBe(true);
    expect(s.rationing).toBe(true);
    const before = structuredClone(s);
    expect(
      applyMindCommand(w, c, { type: "policy", policy: "work", value: "on" })
        ?.ok,
    ).toBe(false);
    expect(s).toEqual(before);
  });
  it("never mistakes medically recovering patients for a finished stress break", () => {
    const { w, c } = fixture(),
      patient = c.colonists[0];
    patient.task = "Recovering";
    patient.jobId = "medical-bed";
    patient.health = 35;
    patient.mind!.breakUntil = 0;
    const beforeEvents = c.events.length;
    advance(w, c, 30, helpers);
    expect(patient.task).toBe("Recovering");
    expect(patient.jobId).toBe("medical-bed");
    expect(c.events.length).toBe(beforeEvents);
  });
  it("chooses a reachable alternate research station and releases an invalidated researcher", () => {
    const { w, c, s } = fixture();
    c.power = 100;
    c.buildings.push(
      {
        id: "blocked-lab",
        type: "lab",
        x: 30,
        y: 31,
        built: true,
        health: 100,
        progress: 90,
        reservedBy: null,
      },
      {
        id: "open-lab",
        type: "lab",
        x: 32,
        y: 31,
        built: true,
        health: 100,
        progress: 90,
        reservedBy: null,
      },
    );
    applyMindCommand(w, c, { type: "research", projectId: "hydraulics" });
    const h = {
      ...helpers,
      reachable: (_c: Colony, _a: unknown, p: Point) => p.x !== 30,
    };
    advance(w, c, 30, h);
    expect(s.researchProgress).toBeGreaterThan(0);
    expect(
      c.buildings.find((b) => b.id === "blocked-lab")?.reservedBy,
    ).toBeNull();
    const researcher = c.colonists.find((a) => a.task === "Researching")!;
    expect(researcher.jobId).toBe("open-lab");
    researcher.health = 10;
    advance(w, c, 1, h);
    expect(c.buildings.find((b) => b.id === "open-lab")?.reservedBy).not.toBe(
      researcher.id,
    );
    expect(researcher.task).not.toBe("Researching");
  });
  it("provides only one contextual physical emergency cache and does not award inventory directly", () => {
    const { w, c, s } = fixture();
    c.resources.rations = 0;
    const stock = structuredClone(c.resources);
    const before = c.deposits.length;
    advance(w, c, 1200, helpers);
    const aid = c.deposits.find((d) => d.id.startsWith("aid-"));
    expect(aid?.resource).toBe("rations");
    expect(aid?.amount).toBe(8);
    expect(c.deposits.length).toBe(before + 1);
    expect(c.resources).toEqual(stock);
    expect(s.aidReceived).toBe(true);
    advance(w, c, 12000, helpers);
    expect(c.deposits.filter((d) => d.id.startsWith("aid-"))).toHaveLength(1);
  });
  it("does not create rescue caches while sheltered or while a crew expedition is away", () => {
    const { w, c, s } = fixture();
    c.resources.rations = 0;
    s.sheltered = true;
    advance(w, c, 1200, helpers);
    expect(s.aidReceived).toBeFalsy();
    s.sheltered = false;
    c.colonists[0].away = "voyage";
    advance(w, c, 1200, helpers);
    expect(s.aidReceived).toBeFalsy();
  });
  it("shelter releases production worker reservations without erasing progress or duplicating ingredients", () => {
    const { w, c, s } = fixture(),
      a = c.colonists[0];
    a.task = "Producing";
    a.jobId = "active-bill";
    s.production.push({
      id: "active-bill",
      recipeId: "rations",
      remaining: 2,
      progress: 15,
      workerId: a.id,
    });
    const resources = structuredClone(c.resources);
    expect(
      applyMindCommand(w, c, { type: "policy", policy: "shelter", value: "on" })
        ?.ok,
    ).toBe(true);
    expect(s.production[0].workerId).toBeNull();
    expect(s.production[0].progress).toBe(15);
    expect(s.production[0].remaining).toBe(2);
    expect(c.resources).toEqual(resources);
    expect(a.task).toBe("Idle");
    expect(
      applyMindCommand(w, c, {
        type: "policy",
        policy: "shelter",
        value: "off",
      })?.ok,
    ).toBe(true);
    expect(s.production[0].workerId).toBeNull();
  });
  it("medical recovery has priority over a new stress break", () => {
    const { w, c } = fixture(),
      patient = c.colonists[0];
    patient.task = "Recovering";
    patient.health = 35;
    patient.morale = 1;
    patient.mind!.stress = 95;
    advance(w, c, 100, helpers);
    expect(patient.task).toBe("Recovering");
    expect(patient.mind!.breakUntil).toBe(0);
  });
});
