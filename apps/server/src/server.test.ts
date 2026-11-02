import { afterEach, describe, expect, test } from "vitest";
import { WebSocket } from "ws";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGameServer, type GameServer } from "./server.js";
import type {
  Command,
  CommandResult,
  GameView,
  ServerMessage,
} from "@frontier/shared";

const servers: GameServer[] = [];
const sockets: WebSocket[] = [];
const directories: string[] = [];
afterEach(async () => {
  for (const ws of sockets.splice(0)) ws.terminate();
  for (const server of servers.splice(0)) await server.close();
  for (const path of directories.splice(0))
    rmSync(path, { recursive: true, force: true });
});
async function server(savePath: string | null = null) {
  const result = await createGameServer({ port: 0, savePath });
  servers.push(result);
  return result;
}
function port(s: GameServer) {
  const address = s.address();
  if (!address || typeof address === "string")
    throw new Error("No listening port");
  return address.port;
}
async function connect(s: GameServer, token?: string) {
  const ws = new WebSocket(
    `ws://127.0.0.1:${port(s)}/socket?${token ? `token=${token}` : "name=Test-Captain"}`,
  );
  sockets.push(ws);
  const messages: ServerMessage[] = [];
  ws.on("message", (raw) =>
    messages.push(JSON.parse(raw.toString()) as ServerMessage),
  );
  async function wait<T extends ServerMessage>(
    predicate: (message: ServerMessage) => message is T,
  ): Promise<T>;
  async function wait(
    predicate: (message: ServerMessage) => boolean,
  ): Promise<ServerMessage>;
  async function wait(predicate: (message: ServerMessage) => boolean) {
    const start = Date.now();
    while (Date.now() - start < 5000) {
      const index = messages.findIndex(predicate);
      if (index !== -1) return messages.splice(index, 1)[0]!;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(
      `Timed out; received ${JSON.stringify(messages.map((m) => m.type))}`,
    );
  }
  const welcome = await wait(
    (m): m is Extract<ServerMessage, { type: "welcome" }> =>
      m.type === "welcome",
  );
  const first = await wait(
    (m): m is Extract<ServerMessage, { type: "state" }> => m.type === "state",
  );
  let sequence = 0;
  async function command(
    command: Command,
    id = `command-${++sequence}`,
  ): Promise<CommandResult> {
    ws.send(JSON.stringify({ type: "command", id, version: 1, command }));
    const ack = await wait(
      (m): m is Extract<ServerMessage, { type: "ack" }> =>
        m.type === "ack" && m.id === id,
    );
    return ack.result;
  }
  async function state(
    predicate: (v: GameView) => boolean = () => true,
  ): Promise<GameView> {
    return (
      await wait(
        (m): m is Extract<ServerMessage, { type: "state" }> =>
          m.type === "state" && predicate(m.view),
      )
    ).view;
  }
  return { ws, welcome, first: first.view, wait, command, state };
}

describe("authoritative multiplayer server", () => {
  test("two independent clients race a claim; ownership and hidden state stay isolated", async () => {
    const s = await server();
    const a = await connect(s);
    const b = await connect(s);
    const site = a.first.sites[0]!.id;
    const claim: Command = {
      type: "claim",
      siteId: site,
      name: "First Light",
      scenario: "The Last Shift",
    };
    const [one, two] = await Promise.all([a.command(claim), b.command(claim)]);
    expect([one.ok, two.ok].filter(Boolean)).toHaveLength(1);
    const winner = one.ok ? a : b;
    const loser = one.ok ? b : a;
    const won = await winner.state((v) => Boolean(v.colony));
    const otherSite = a.first.sites.find((s) => s.id !== site)!.id;
    expect((await loser.command({ ...claim, siteId: otherSite })).ok).toBe(
      true,
    );
    const lost = await loser.state((v) => Boolean(v.colony));
    const foreignId = won.colony!.colonists[0]!.id;
    expect(
      (
        await loser.command({
          type: "move",
          colonistId: foreignId,
          x: 32,
          y: 32,
        })
      ).ok,
    ).toBe(false);
    expect(JSON.stringify(lost)).not.toContain(foreignId);
    expect(lost.colony!.ownerId).toBe(loser.welcome.playerId);
    expect(lost.colonies).toHaveLength(2);
  });

  test("rejects malformed, forged actor, unsupported version, and out-of-range commands", async () => {
    const s = await server();
    const a = await connect(s);
    const packets = [
      {
        type: "command",
        id: "malformed",
        version: 1,
        command: { type: "build", building: "wall", x: -1, y: 5 },
      },
      {
        type: "command",
        id: "forged",
        version: 1,
        actorId: "other-player",
        command: { type: "craft", enabled: true },
      },
      {
        type: "command",
        id: "future",
        version: 2,
        command: { type: "craft", enabled: true },
      },
    ];
    for (const packet of packets) {
      a.ws.send(JSON.stringify(packet));
      expect((await a.wait((m) => m.type === "error")).type).toBe("error");
    }
    expect(Object.keys(s.world.colonies)).toHaveLength(0);
  });

  test("demolition can remove only an owned built structure and cannot refund it twice", async () => {
    const s = await server();
    const a = await connect(s);
    const b = await connect(s);
    expect(
      (
        await a.command({
          type: "claim",
          siteId: a.first.sites[0]!.id,
          name: "Owner",
          scenario: "last-shift",
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await b.command({
          type: "claim",
          siteId: b.first.sites[1]!.id,
          name: "Neighbor",
          scenario: "last-shift",
        })
      ).ok,
    ).toBe(true);
    const home = await a.state((view) => Boolean(view.colony));
    const bed = home.colony!.buildings.find(
      (building) => building.type === "bed",
    )!;
    expect(
      (await b.command({ type: "deconstruct", buildingId: bed.id })).ok,
    ).toBe(false);
    expect(
      s.world.colonies[home.colony!.id].buildings.some(
        (building) => building.id === bed.id,
      ),
    ).toBe(true);
    const removal = await a.command(
      { type: "deconstruct", buildingId: bed.id },
      "remove-bunk",
    );
    expect(removal.ok).toBe(true);
    expect(
      s.world.colonies[home.colony!.id].buildings.some(
        (building) => building.id === bed.id,
      ),
    ).toBe(false);
    const inventory = structuredClone(
      s.world.colonies[home.colony!.id].resources,
    );
    expect(
      await a.command(
        { type: "deconstruct", buildingId: bed.id },
        "remove-bunk",
      ),
    ).toEqual(removal);
    expect(
      (
        await a.command(
          { type: "deconstruct", buildingId: bed.id },
          "remove-again",
        )
      ).ok,
    ).toBe(false);
    expect(s.world.colonies[home.colony!.id].resources).toEqual(inventory);
  });

  test("resumes the same identity, returns idempotent receipt, and rejects conflicting reuse", async () => {
    const s = await server();
    const a = await connect(s);
    const claim: Command = {
      type: "claim",
      siteId: a.first.sites[0]!.id,
      name: "Home",
      scenario: "The Last Shift",
    };
    const accepted = await a.command(claim, "unique-claim");
    expect(accepted.ok).toBe(true);
    expect(await a.command(claim, "unique-claim")).toEqual(accepted);
    expect(
      (await a.command({ ...claim, name: "Changed" }, "unique-claim")).ok,
    ).toBe(false);
    a.ws.close();
    const b = await connect(s, a.welcome.token);
    expect(b.welcome.playerId).toBe(a.welcome.playerId);
    expect(b.first.colony?.name).toBe("Home");
    expect(Object.keys(s.world.colonies)).toHaveLength(1);
  });

  test("world, hashed sessions, and command receipts survive host restart", async () => {
    const directory = mkdtempSync(join(tmpdir(), "frontier-server-"));
    directories.push(directory);
    const savePath = join(directory, "world.json");
    const s = await server(savePath);
    const a = await connect(s);
    const claim: Command = {
      type: "claim",
      siteId: a.first.sites[1]!.id,
      name: "Still Here",
      scenario: "The Last Shift",
    };
    const result = await a.command(claim, "durable-claim");
    expect(result.ok).toBe(true);
    const file = readFileSync(savePath, "utf8");
    expect(file).not.toContain(a.welcome.token);
    await s.close();
    servers.splice(servers.indexOf(s), 1);
    const frozenTick = s.world.tick;
    const resumed = await server(savePath);
    expect(resumed.world.tick).toBe(frozenTick);
    const b = await connect(resumed, a.welcome.token);
    expect(b.first.colony?.name).toBe("Still Here");
    expect(await b.command(claim, "durable-claim")).toEqual(result);
    expect(Object.keys(resumed.world.colonies)).toHaveLength(1);
  });

  test("refuses a corrupt or unsupported save without overwriting it", async () => {
    const directory = mkdtempSync(join(tmpdir(), "frontier-corrupt-"));
    directories.push(directory);
    const savePath = join(directory, "world.json");
    const original = JSON.stringify({
      format: 99,
      world: {},
      sessions: {},
      receipts: {},
    });
    writeFileSync(savePath, original);
    await expect(createGameServer({ port: 0, savePath })).rejects.toThrow();
    expect(readFileSync(savePath, "utf8")).toBe(original);
  });

  test("closes oversized packets and command floods with explicit policy codes", async () => {
    const s = await server();
    const oversized = await connect(s);
    const tooLarge = new Promise<number>((resolve) =>
      oversized.ws.once("close", (code) => resolve(code)),
    );
    oversized.ws.send("x".repeat(9000));
    expect(await tooLarge).toBe(1009);
    const flood = await connect(s);
    const rateLimited = new Promise<number>((resolve) =>
      flood.ws.once("close", (code) => resolve(code)),
    );
    for (let i = 0; i < 40; i++)
      flood.ws.send(JSON.stringify({ type: "ping" }));
    expect(await rateLimited).toBe(1008);
    expect(Object.keys(s.world.colonies)).toHaveLength(0);
  });

  test("rejects encoded filesystem traversal and does not expose server source", async () => {
    const s = await server();
    const response = await fetch(
      `http://127.0.0.1:${port(s)}/%2e%2e%2f%2e%2e%2fpackage.json`,
    );
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("@frontier");
    const source = await fetch(
      `http://127.0.0.1:${port(s)}/apps/server/src/server.ts`,
    );
    expect(source.status).toBe(404);
  });

  test("enforces a single writer across different ports and releases the lease on close", async () => {
    const directory = mkdtempSync(join(tmpdir(), "frontier-lock-"));
    directories.push(directory);
    const savePath = join(directory, "world.json");
    const a = await server(savePath);
    await expect(createGameServer({ port: 0, savePath })).rejects.toThrow(
      "already locked",
    );
    expect(existsSync(`${savePath}.lock`)).toBe(true);
    await a.close();
    servers.splice(servers.indexOf(a), 1);
    expect(existsSync(`${savePath}.lock`)).toBe(false);
    const b = await server(savePath);
    expect(b.address()).not.toBeNull();
  });

  test("recovers only a proven-dead PID lock and preserves ambiguous live locks", async () => {
    const directory = mkdtempSync(join(tmpdir(), "frontier-stale-"));
    directories.push(directory);
    const savePath = join(directory, "world.json");
    const child = spawn(process.execPath, ["-e", "process.exit(0)"]);
    await new Promise<void>((resolve, reject) => {
      child.once("exit", () => resolve());
      child.once("error", reject);
    });
    const stale = JSON.stringify({ pid: child.pid, nonce: randomUUID() });
    writeFileSync(`${savePath}.lock`, stale);
    const active = await server(savePath);
    expect(JSON.parse(readFileSync(`${savePath}.lock`, "utf8")).pid).toBe(
      process.pid,
    );
    await active.close();
    servers.splice(servers.indexOf(active), 1);
    const live = JSON.stringify({ pid: process.pid, nonce: randomUUID() });
    writeFileSync(`${savePath}.lock`, live);
    await expect(createGameServer({ port: 0, savePath })).rejects.toThrow(
      "already locked",
    );
    expect(readFileSync(`${savePath}.lock`, "utf8")).toBe(live);
    writeFileSync(`${savePath}.lock`, "ambiguous-lock");
    await expect(createGameServer({ port: 0, savePath })).rejects.toThrow();
    expect(readFileSync(`${savePath}.lock`, "utf8")).toBe("ambiguous-lock");
  });

  test("releases its lease when listening fails", async () => {
    const occupied = await server();
    const directory = mkdtempSync(join(tmpdir(), "frontier-listen-"));
    directories.push(directory);
    const savePath = join(directory, "world.json");
    await expect(
      createGameServer({ port: port(occupied), savePath }),
    ).rejects.toThrow();
    expect(existsSync(`${savePath}.lock`)).toBe(false);
    expect((await server(savePath)).address()).not.toBeNull();
  });

  test("rejects inconsistent player-colony-site graphs without overwriting the snapshot", async () => {
    const directory = mkdtempSync(join(tmpdir(), "frontier-graph-"));
    directories.push(directory);
    const savePath = join(directory, "world.json");
    const s = await server(savePath);
    const a = await connect(s);
    expect(
      (
        await a.command({
          type: "claim",
          siteId: a.first.sites[0]!.id,
          name: "Intact",
          scenario: "last-shift",
        })
      ).ok,
    ).toBe(true);
    await s.close();
    servers.splice(servers.indexOf(s), 1);
    const valid = JSON.parse(readFileSync(savePath, "utf8"));
    for (const breakGraph of [
      (data: typeof valid) => {
        data.world.players[a.welcome.playerId].colonyId = "missing-colony";
      },
      (data: typeof valid) => {
        data.world.sites[0].ownerId = null;
      },
      (data: typeof valid) => {
        Object.values(data.world.colonies).forEach((colony: any) => {
          colony.siteId = "missing-site";
        });
      },
    ]) {
      const damaged = structuredClone(valid);
      breakGraph(damaged);
      const original = JSON.stringify(damaged);
      writeFileSync(savePath, original);
      await expect(createGameServer({ port: 0, savePath })).rejects.toThrow();
      expect(readFileSync(savePath, "utf8")).toBe(original);
      expect(existsSync(`${savePath}.lock`)).toBe(false);
    }
    writeFileSync(savePath, JSON.stringify(valid));
    expect(
      (await server(savePath)).world.players[a.welcome.playerId].colonyId,
    ).toBeTruthy();
  });
});

describe("new colony mechanics across the server boundary", () => {
  test("validates manufacturing and policies while keeping bill and patient ownership isolated", async () => {
    const s = await server();
    const a = await connect(s),
      b = await connect(s);
    for (const [client, index] of [
      [a, 0],
      [b, 1],
    ] as const)
      expect(
        (
          await client.command({
            type: "claim",
            siteId: client.first.sites[index].id,
            name: `Mechanics ${index}`,
            scenario: "last-shift",
          })
        ).ok,
      ).toBe(true);
    const own = s.world.colonies[s.world.players[a.welcome.playerId].colonyId!];
    expect(
      (
        await a.command({
          type: "queueRecipe",
          recipeId: "rations",
          quantity: 2,
        })
      ).ok,
    ).toBe(true);
    const bill = own.systems!.production.at(-1)!;
    expect(
      (await b.command({ type: "cancelRecipe", billId: bill.id })).ok,
    ).toBe(false);
    expect(
      (await b.command({ type: "tend", colonistId: own.colonists[0].id })).ok,
    ).toBe(false);
    expect(
      (await a.command({ type: "policy", policy: "work", value: "intensive" }))
        .ok,
    ).toBe(true);
    expect(own.systems!.workPolicy).toBe("intensive");
    expect(
      (await a.command({ type: "research", projectId: "hydraulics" })).ok,
    ).toBe(true);
    expect(own.systems!.researchProject).toBe("hydraulics");
    expect(
      (await a.command({ type: "cancelRecipe", billId: bill.id })).ok,
    ).toBe(true);
    expect(own.systems!.production.some((item) => item.id === bill.id)).toBe(
      false,
    );
    a.ws.send(
      JSON.stringify({
        type: "command",
        id: "bad-content",
        version: 1,
        command: {
          type: "queueRecipe",
          recipeId: "infinite-goods",
          quantity: 1,
        },
      }),
    );
    expect((await a.wait((m) => m.type === "error")).type).toBe("error");
  });
  test("resumes wounds, research, a queued order and a traveling party without duplicating goods", async () => {
    const directory = mkdtempSync(join(tmpdir(), "frontier-mechanics-"));
    directories.push(directory);
    const savePath = join(directory, "world.json");
    const s = await server(savePath),
      a = await connect(s);
    expect(
      (
        await a.command({
          type: "claim",
          siteId: a.first.sites[0].id,
          name: "Long Memory",
          scenario: "last-shift",
        })
      ).ok,
    ).toBe(true);
    const c = s.world.colonies[s.world.players[a.welcome.playerId].colonyId!];
    expect(
      (
        await a.command({
          type: "queueRecipe",
          recipeId: "rations",
          quantity: 2,
        })
      ).ok,
    ).toBe(true);
    expect(
      (await a.command({ type: "research", projectId: "hydraulics" })).ok,
    ).toBe(true);
    c.systems!.researchProgress = 7;
    c.colonists[1].injuries = [
      {
        id: "persist-cut",
        kind: "cut",
        severity: 8,
        tended: false,
        infection: 0,
      },
    ];
    c.colonists[1].health = 92;
    const launch = {
      type: "expeditionLaunch",
      siteId: "salvage-reef",
      colonistIds: [c.colonists[0].id],
    } as const;
    expect(
      (
        await a.command(
          { ...launch, colonistIds: [...launch.colonistIds] },
          "one-departure",
        )
      ).ok,
    ).toBe(true);
    const expedition = s.world.expeditions!.find(
      (e) => e.ownerId === a.welcome.playerId,
    )!;
    expect(expedition.phase).toBe("outbound");
    await s.close();
    servers.splice(servers.indexOf(s), 1);
    const saved = structuredClone(s.world);
    const restored = await createGameServer({
      port: 0,
      savePath,
      autostart: false,
    });
    servers.push(restored);
    expect(restored.world).toEqual(saved);
    await restored.start();
    const resumed = await connect(restored, a.welcome.token);
    const inventory = structuredClone(restored.world.colonies[c.id].resources);
    expect(
      (
        await resumed.command(
          { ...launch, colonistIds: [...launch.colonistIds] },
          "one-departure",
        )
      ).ok,
    ).toBe(true);
    expect(
      restored.world.expeditions!.filter(
        (e) => e.ownerId === a.welcome.playerId,
      ),
    ).toHaveLength(1);
    expect(restored.world.colonies[c.id].resources.fuel).toBe(inventory.fuel);
    expect(restored.world.colonies[c.id].colonists[1].injuries?.[0].id).toBe(
      "persist-cut",
    );
    expect(restored.world.colonies[c.id].systems!.researchProject).toBe(
      "hydraulics",
    );
    expect(
      restored.world.colonies[c.id].systems!.production.length,
    ).toBeGreaterThan(0);
  });
  test("rejects foreign tactical orders and hides a traveling rival party and cargo", async () => {
    const s = await server(),
      a = await connect(s),
      b = await connect(s);
    for (const [client, index] of [
      [a, 0],
      [b, 1],
    ] as const)
      expect(
        (
          await client.command({
            type: "claim",
            siteId: client.first.sites[index].id,
            name: `Tactical ${index}`,
            scenario: "last-shift",
          })
        ).ok,
      ).toBe(true);
    const own = s.world.colonies[s.world.players[a.welcome.playerId].colonyId!];
    expect(
      (
        await a.command({
          type: "expeditionLaunch",
          siteId: "salvage-reef",
          colonistIds: [own.colonists[0].id],
        })
      ).ok,
    ).toBe(true);
    const expedition = s.world.expeditions!.find(
      (e) => e.ownerId === a.welcome.playerId,
    )!;
    const unit = expedition.units.find(
      (u) => u.colonistId === own.colonists[0].id,
    )!;
    expect(
      (
        await b.command({
          type: "expeditionOrder",
          expeditionId: expedition.id,
          unitId: unit.id,
          x: 4,
          y: 4,
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await b.command({
          type: "expeditionRetreat",
          expeditionId: expedition.id,
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await b.command({
          type: "expeditionLaunch",
          siteId: "salvage-reef",
          colonistIds: [own.colonists[0].id],
        })
      ).ok,
    ).toBe(false);
    const view = await b.state(
      (v) => v.tick > s.world.tick - 2 && v.you.id === b.welcome.playerId,
    );
    expect(view.expeditions?.some((e) => e.id === expedition.id)).not.toBe(
      true,
    );
    expect(JSON.stringify(view)).not.toContain(unit.id);
    expect(
      (
        await a.command({
          type: "expeditionRetreat",
          expeditionId: expedition.id,
        })
      ).ok,
    ).toBe(true);
  });
});

test("upgrades a legacy mechanics-free save in memory without new supplies or identity replacement", async () => {
  const directory = mkdtempSync(join(tmpdir(), "frontier-upgrade-"));
  directories.push(directory);
  const savePath = join(directory, "world.json");
  const s = await server(savePath),
    a = await connect(s);
  expect(
    (
      await a.command({
        type: "claim",
        siteId: a.first.sites[0].id,
        name: "Old Anchorage",
        scenario: "last-shift",
      })
    ).ok,
  ).toBe(true);
  await s.close();
  servers.splice(servers.indexOf(s), 1);
  const legacy = JSON.parse(readFileSync(savePath, "utf8"));
  delete legacy.world.expeditions;
  delete legacy.world.expeditionSites;
  for (const colony of Object.values(legacy.world.colonies) as any[]) {
    delete colony.systems;
    for (const member of colony.colonists) {
      delete member.mind;
      delete member.injuries;
      delete member.thirst;
      delete member.away;
    }
  }
  const original = JSON.stringify(legacy);
  writeFileSync(savePath, original);
  const restored = await createGameServer({
    port: 0,
    savePath,
    autostart: false,
  });
  servers.push(restored);
  expect(readFileSync(savePath, "utf8")).toBe(original);
  const cid = legacy.world.players[a.welcome.playerId].colonyId;
  expect(restored.world.colonies[cid].resources).toEqual(
    legacy.world.colonies[cid].resources,
  );
  expect(restored.world.colonies[cid].systems).toBeTruthy();
  expect(
    restored.world.colonies[cid].colonists.every(
      (c) => c.mind && c.injuries && c.away === null,
    ),
  ).toBe(true);
  expect(Object.keys(restored.world.players)).toEqual(
    Object.keys(legacy.world.players),
  );
  await restored.close();
  servers.splice(servers.indexOf(restored), 1);
  const knownGood = readFileSync(savePath, "utf8");
  const corrupted = JSON.parse(knownGood);
  corrupted.world.colonies[cid].systems.water = -1;
  const bad = JSON.stringify(corrupted);
  writeFileSync(savePath, bad);
  await expect(createGameServer({ port: 0, savePath })).rejects.toThrow(
    /Corrupt/,
  );
  expect(readFileSync(savePath, "utf8")).toBe(bad);
  expect(existsSync(`${savePath}.lock`)).toBe(false);
  writeFileSync(savePath, knownGood);
  const second = await createGameServer({
    port: 0,
    savePath,
    autostart: false,
  });
  servers.push(second);
  expect(second.world.colonies[cid].resources).toEqual(
    legacy.world.colonies[cid].resources,
  );
});
