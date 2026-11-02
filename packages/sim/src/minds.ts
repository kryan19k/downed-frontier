import {
  RESEARCH,
  type World,
  type Colony,
  type Colonist,
  type Command,
  type CommandResult,
  type Point,
} from "@frontier/shared";

export type MindHelpers = {
  reachable?: (
    colony: Colony,
    crew: Colonist,
    target: Point,
    adjacent?: boolean,
  ) => boolean;
  release: (colony: Colony, crew: Colonist) => void;
  move: (
    colony: Colony,
    crew: Colonist,
    target: Point,
    adjacent?: boolean,
  ) => boolean;
};
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const ok = (message: string): CommandResult => ({ ok: true, message });
const fail = (message: string): CommandResult => ({ ok: false, message });
function event(
  w: World,
  c: Colony,
  text: string,
  kind: "info" | "success" | "warning" = "info",
) {
  c.events.unshift({ id: `mind-${w.nextId++}`, tick: w.tick, kind, text });
  c.events.length = Math.min(40, c.events.length);
}
function hash(s: string) {
  let n = 2166136261;
  for (const ch of s) {
    n ^= ch.charCodeAt(0);
    n = Math.imul(n, 16777619);
  }
  return n >>> 0;
}
export function ensureMinds(w: World, c: Colony) {
  for (const a of c.colonists) {
    if (!a.mind) {
      const role = a.role.toLowerCase();
      const traits = role.includes("engineer")
        ? ["Industrious", "Steadfast"]
        : role.includes("medic")
          ? ["Compassionate", "Meticulous"]
          : role.includes("scavenger")
            ? ["Outdoorsy", "Reckless"]
            : hash(`${w.seed}:${a.id}`) % 2
              ? ["Industrious", "Reckless"]
              : ["Steadfast", "Compassionate"];
      a.mind = {
        traits,
        memories: [],
        relationships: {},
        stress: 0,
        breakUntil: 0,
        skills: {
          construction: role.includes("engineer") ? 18 : 8,
          salvage: role.includes("scavenger") ? 18 : 8,
          medicine: role.includes("medic") ? 20 : 5,
          research: role.includes("engineer")
            ? 15
            : role.includes("medic")
              ? 12
              : 5,
          combat: role.includes("scavenger") ? 14 : 8,
        },
      };
    }
    for (const other of c.colonists)
      if (other.id !== a.id && a.mind.relationships[other.id] === undefined)
        a.mind.relationships[other.id] =
          5 + (hash(a.id < other.id ? a.id + other.id : other.id + a.id) % 11);
  }
}
export function remember(
  w: World,
  a: Colonist,
  text: string,
  impact: number,
  duration = 1800,
) {
  if (!a.mind) return;
  const existing = a.mind.memories.find((m) => m.text === text);
  if (existing) {
    existing.expiresTick = w.tick + duration;
    existing.impact = clamp(impact, -20, 20);
  } else
    a.mind.memories.push({
      text,
      impact: clamp(impact, -20, 20),
      expiresTick: w.tick + duration,
    });
  a.mind.memories = a.mind.memories.slice(-12);
}
export function skillExperience(a: Colonist, skill: string, amount: number) {
  if (!a.mind || !Number.isFinite(amount) || amount <= 0) return;
  a.mind.skills[skill] = clamp((a.mind.skills[skill] || 0) + amount);
}
/** Bounded aptitude/policy/health modifiers. Core calls this only for actual work. */
export function workMultiplier(c: Colony, a: Colonist, skill = "construction") {
  let rate = 1 + (a.mind?.skills[skill] || 0) / 200;
  if (a.mind?.traits.includes("Industrious")) rate *= 1.12;
  if (
    a.mind?.traits.includes("Meticulous") &&
    ["medicine", "research"].includes(skill)
  )
    rate *= 1.1;
  if (a.mind?.traits.includes("Outdoorsy") && skill === "salvage") rate *= 1.12;
  if (c.systems?.workPolicy === "rest") rate *= 0.7;
  if (c.systems?.workPolicy === "intensive") rate *= 1.2;
  if (a.health < 50) rate *= 0.7;
  if (a.morale < 25) rate *= 0.8;
  return Math.round(clamp(rate, 0.35, 1.8) * 1000) / 1000;
}
function clearResearch(c: Colony, a: Colonist) {
  for (const bill of c.systems?.production || [])
    if (bill.workerId === a.id) bill.workerId = null;
  for (const b of c.buildings) if (b.reservedBy === a.id) b.reservedBy = null;
  for (const d of c.deposits) if (d.reservedBy === a.id) d.reservedBy = null;
  a.task = "Idle";
  a.jobId = null;
  a.target = null;
  a.progress = 0;
  a.blockedReason = null;
}
export function applyMindCommand(
  w: World,
  c: Colony,
  cmd: Command,
): CommandResult | null {
  if (cmd.type !== "research" && cmd.type !== "policy") return null;
  const s = c.systems;
  if (!s) return fail("Colony systems are not initialized.");
  if (cmd.type === "research") {
    if (s.sheltered) return fail("Leave shelter before starting research.");
    const project = RESEARCH.find((r) => r.id === cmd.projectId);
    if (!project) return fail("Unknown research project.");
    if (s.unlocked.includes(project.id))
      return fail("This technology is already researched.");
    if (!project.requires.every((id) => s.unlocked.includes(id)))
      return fail("Complete prerequisite research first.");
    if (s.researchProject === project.id)
      return fail("This research project is already active.");
    const hadProgress = s.researchProgress > 0;
    for (const a of c.colonists)
      if (a.task === "Researching") clearResearch(c, a);
    s.researchProject = project.id;
    s.researchProgress = 0;
    event(
      w,
      c,
      `Research selected: ${project.name}. A crew member needs an accessible powered research station.`,
    );
    return ok(
      `Researching ${project.name}.${hadProgress ? " Previous unfinished project progress was discarded." : ""}`,
    );
  }
  if (cmd.policy === "work") {
    if (!["balanced", "rest", "intensive"].includes(cmd.value))
      return fail("Unknown work policy.");
    s.workPolicy = cmd.value as typeof s.workPolicy;
    return ok(
      `Work policy: ${cmd.value}. Intensive work is faster but increases fatigue and stress; rest policy trades output for recovery.`,
    );
  }
  if (cmd.policy === "rationing") {
    if (!["on", "off"].includes(cmd.value))
      return fail("Rationing must be on or off.");
    s.rationing = cmd.value === "on";
    return ok(
      s.rationing
        ? "Rationing enabled. Smaller meals conserve food but recover less nutrition."
        : "Full meals restored.",
    );
  }
  if (cmd.policy === "shelter") {
    if (!["on", "off"].includes(cmd.value))
      return fail("Shelter must be on or off.");
    const enter = cmd.value === "on";
    if (s.sheltered === enter)
      return fail(
        enter ? "Colony is already sheltered." : "Colony is already active.",
      );
    if (enter) {
      if (
        c.colonists.some((a) => a.away) ||
        w.expeditions?.some(
          (e) => e.ownerId === c.ownerId && e.phase !== "complete",
        )
      )
        return fail(
          "All expedition crew must return before shelter can start.",
        );
      if (
        w.offers.some(
          (o) =>
            o.status === "open" && (o.from === c.ownerId || o.to === c.ownerId),
        )
      )
        return fail("Settle or cancel pending trade offers before sheltering.");
      for (const a of c.colonists) {
        clearResearch(c, a);
        a.drafted = false;
      }
    }
    s.sheltered = enter;
    event(
      w,
      c,
      enter
        ? "Safe-home shelter engaged. Production, research, needs and environmental harm are suspended."
        : "Shelter lifted. Crew return to normal operations.",
      enter ? "info" : "success",
    );
    return ok(
      enter
        ? "Shelter engaged. No production or research occurs while sheltered."
        : "Colony reactivated.",
    );
  }
  return fail("Unknown colony policy.");
}
function available(a: Colonist, w: World) {
  return (
    !a.away &&
    !a.drafted &&
    a.health > 20 &&
    (a.mind?.breakUntil || 0) <= w.tick &&
    !a.carrying &&
    a.hunger >= 30 &&
    a.energy >= 20
  );
}
function tickResearch(w: World, c: Colony, h?: MindHelpers) {
  const s = c.systems;
  if (!s?.researchProject) return;
  const project = RESEARCH.find((r) => r.id === s.researchProject);
  if (!project) {
    s.researchProject = null;
    s.researchProgress = 0;
    return;
  }
  const labs = c.buildings
    .filter((b) => b.built && b.type === "lab" && b.health >= 35)
    .sort((a, b) => a.id.localeCompare(b.id));
  // Invalidated workers relinquish their lab before choosing another candidate.
  for (const person of c.colonists)
    if (person.task === "Researching" && !available(person, w))
      clearResearch(c, person);
  for (const lab of labs)
    if (
      lab.reservedBy &&
      !c.colonists.some(
        (a) =>
          a.id === lab.reservedBy &&
          a.task === "Researching" &&
          a.jobId === lab.id,
      )
    )
      lab.reservedBy = null;
  let worker = c.colonists.find(
    (a) => a.task === "Researching" && available(a, w),
  );
  if (!worker && c.power > 0 && h) {
    const candidates = c.colonists
      .filter(
        (a) =>
          available(a, w) && ["Idle", "Salvaging", "Eating"].includes(a.task),
      )
      .sort(
        (a, b) =>
          (b.mind?.skills.research || 0) - (a.mind?.skills.research || 0) ||
          a.id.localeCompare(b.id),
      );
    for (const candidate of candidates) {
      const lab = labs
        .filter(
          (l) =>
            !l.reservedBy &&
            (!h.reachable || h.reachable(c, candidate, l, true)),
        )
        .sort(
          (a, b) =>
            Math.abs(a.x - candidate.x) +
              Math.abs(a.y - candidate.y) -
              (Math.abs(b.x - candidate.x) + Math.abs(b.y - candidate.y)) ||
            a.id.localeCompare(b.id),
        )[0];
      if (!lab) continue;
      worker = candidate;
      h.release(c, worker);
      worker.task = "Researching";
      worker.jobId = lab.id;
      worker.target = { x: lab.x, y: lab.y };
      worker.progress = 0;
      worker.blockedReason = null;
      lab.reservedBy = worker.id;
      break;
    }
  }
  if (!worker) return;
  const lab = labs.find(
    (b) => b.id === worker!.jobId && b.reservedBy === worker!.id,
  );
  if (!lab) {
    clearResearch(c, worker);
    return;
  }
  if (!h) {
    worker.blockedReason =
      "Research requires a reachable lab and assigned worker.";
    return;
  }
  if (w.tick % 3 !== 0) return;
  if (c.power <= 0) {
    worker.blockedReason = "Research station has no power";
    return;
  }
  if (!h.move(c, worker, lab, true)) return;
  worker.blockedReason = null;
  const work = 0.45 * workMultiplier(c, worker, "research");
  s.researchProgress = Math.min(project.cost, s.researchProgress + work);
  worker.progress = s.researchProgress / project.cost;
  skillExperience(worker, "research", 0.025);
  if (s.researchProgress >= project.cost) {
    if (!s.unlocked.includes(project.id)) s.unlocked.push(project.id);
    c.research += project.cost;
    s.researchProject = null;
    s.researchProgress = 0;
    for (const a of c.colonists) {
      remember(w, a, `Breakthrough: ${project.name}`, 5, 2400);
      if (a.task === "Researching") clearResearch(c, a);
    }
    event(
      w,
      c,
      `Research completed: ${project.name}. ${project.description}`,
      "success",
    );
  }
}
export function tickMinds(w: World, c: Colony, h?: MindHelpers) {
  ensureMinds(w, c);
  if (c.systems?.sheltered) return;
  for (const a of c.colonists) {
    const mind = a.mind!;
    mind.memories = mind.memories
      .filter((m) => m.expiresTick > w.tick)
      .slice(-12);
    if (a.away || a.health <= 0) continue;
    if (mind.breakUntil > w.tick) {
      if (h && a.task !== "Stress recovery") {
        h.release(c, a);
        a.task = "Stress recovery";
        a.blockedReason = "Taking time to recover from stress";
      }
      if (w.tick % 30 === 0) {
        a.energy = clamp(a.energy + 1);
        a.morale = clamp(a.morale + 0.8);
        mind.stress = clamp(mind.stress - 1);
      }
      continue;
    }
    if (mind.breakUntil > 0 && mind.breakUntil <= w.tick) {
      mind.breakUntil = 0;
      if (a.task === "Stress recovery" || a.task === "Taking a break")
        clearResearch(c, a);
      mind.stress = Math.min(45, mind.stress);
      remember(w, a, "Time to recover", 4);
      event(w, c, `${a.name} feels ready to return to work.`, "success");
    }
    if (w.tick % 100 !== 0) continue;
    let mood = 75 + mind.memories.reduce((n, m) => n + m.impact, 0);
    if (mind.traits.includes("Steadfast")) mood += 5;
    if (a.hunger < 30) mood -= 18;
    if (a.energy < 25) mood -= 15;
    if (a.health < 50) mood -= 12;
    if ((a.thirst ?? 100) < 30) mood -= 15;
    if ((c.systems?.flood || 0) > 40) mood -= 12;
    if (c.systems?.workPolicy === "intensive") {
      mind.stress = clamp(mind.stress + 2);
      a.energy = clamp(a.energy - 1);
      mood -= 4;
    }
    if (c.systems?.workPolicy === "rest") {
      mind.stress = clamp(mind.stress - 3);
      a.energy = clamp(a.energy + 1);
      mood += 5;
    }
    a.morale = clamp(a.morale + Math.sign(clamp(mood) - a.morale));
    mind.stress = clamp(
      mind.stress + (a.morale < 25 ? 3 : a.morale > 55 ? -1 : 0),
    );
    if (
      mind.stress >= 90 &&
      !a.drafted &&
      a.health > 20 &&
      !["Recovering", "Tending"].includes(a.task)
    ) {
      mind.breakUntil = w.tick + 300;
      if (h) h.release(c, a);
      a.task = "Stress recovery";
      a.blockedReason = "Taking time to recover from stress";
      remember(w, a, "Overwhelmed by frontier life", -4, 900);
      event(
        w,
        c,
        `${a.name} is overwhelmed and needs a short recovery break.`,
        "warning",
      );
    }
  }
  if (w.tick % 600 === 0) {
    const people = c.colonists
      .filter(
        (a) =>
          !a.away &&
          a.health > 0 &&
          !a.drafted &&
          (a.mind?.breakUntil || 0) <= w.tick,
      )
      .sort((a, b) => a.id.localeCompare(b.id));
    for (let i = 0; i < people.length; i++)
      for (let j = i + 1; j < people.length; j++) {
        const a = people[i],
          b = people[j];
        if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 6) continue;
        const disagreement =
          hash(`${w.seed}:${w.tick}:${a.id}:${b.id}`) % 7 === 0;
        const delta = disagreement
          ? -3
          : a.mind!.traits.includes("Compassionate") ||
              b.mind!.traits.includes("Compassionate")
            ? 3
            : 2;
        a.mind!.relationships[b.id] = clamp(
          (a.mind!.relationships[b.id] || 0) + delta,
          -100,
          100,
        );
        b.mind!.relationships[a.id] = clamp(
          (b.mind!.relationships[a.id] || 0) + delta,
          -100,
          100,
        );
        remember(
          w,
          a,
          disagreement
            ? `Disagreement with ${b.name}`
            : `Shared a quiet moment with ${b.name}`,
          disagreement ? -2 : 2,
          1200,
        );
        remember(
          w,
          b,
          disagreement
            ? `Disagreement with ${a.name}`
            : `Shared a quiet moment with ${a.name}`,
          disagreement ? -2 : 2,
          1200,
        );
        if (w.tick % 1200 === 0)
          event(
            w,
            c,
            disagreement
              ? `${a.name} and ${b.name} argued about life on the frontier.`
              : `${a.name} and ${b.name} strengthened their friendship.`,
          );
      }
  }
  tickResearch(w, c, h);
  tickDirector(w, c, h);
}

/** A deliberately thin, contextual director: one physical emergency cache per home. */
function tickDirector(w: World, c: Colony, h?: MindHelpers) {
  const s = c.systems;
  if (!s || s.sheltered || c.colonists.some((a) => a.away)) return;
  if (
    w.tick - (c.foundedTick ?? 0) < 1200 ||
    w.tick % 1200 !== 0 ||
    w.tick - s.lastDirectorTick < 1200
  )
    return;
  s.lastDirectorTick = w.tick;
  const medicineCrisis =
    c.resources.medicine < 1 &&
    c.colonists.some(
      (a) =>
        a.health < 60 || a.injuries?.some((i) => !i.tended && i.severity > 0),
    );
  const foodCrisis = c.resources.rations < 6;
  if (!s.aidReceived && (medicineCrisis || foodCrisis)) {
    const homes = c.colonists.filter((a) => !a.away && a.health > 0);
    let point: Point | null = null;
    for (let y = 25; y <= 39 && !point; y++)
      for (let x = 25; x <= 39 && !point; x++) {
        if (
          c.buildings.some((b) => b.x === x && b.y === y) ||
          c.deposits.some((d) => d.x === x && d.y === y && d.amount > 0)
        )
          continue;
        if (
          homes.some((a) =>
            h?.reachable
              ? h.reachable(c, a, { x, y }, true)
              : Math.abs(a.x - x) + Math.abs(a.y - y) <= 1,
          )
        )
          point = { x, y };
      }
    if (point) {
      const resource = medicineCrisis ? "medicine" : "rations";
      const amount = medicineCrisis ? 2 : 8;
      c.deposits.push({
        id: `aid-${w.nextId++}`,
        x: point.x,
        y: point.y,
        resource,
        amount,
        reservedBy: null,
      });
      s.aidReceived = true;
      event(
        w,
        c,
        `A coastwatch buoy washed an emergency ${resource} cache onto the old deck. Crew must salvage and haul it. This is the outpost's one emergency reserve.`,
        "success",
      );
      return;
    }
  }
  if (s.flood > 40)
    event(
      w,
      c,
      "Coastwatch bulletin: rising water threatens this outpost. Restore power and bilge pumps before expanding.",
      "warning",
    );
  else if (c.storm)
    event(
      w,
      c,
      "Coastwatch bulletin: shelter damaged equipment and keep medical supplies available through the squall.",
      "warning",
    );
  else {
    for (const a of c.colonists)
      if (!a.away && a.health > 0)
        remember(w, a, "A quiet watch over the frontier", 2, 1200);
    event(
      w,
      c,
      "A quiet watch: the crew share a moment of calm between tides.",
    );
  }
}
