import { describe, it, expect, vi } from "vitest";
import {
  createHostedEngine,
  createRedisHostedStore,
  hostedStoreFromEnvironment,
  type HostedStore,
  type HostedState,
} from "./hosted";
import type { GameView, ServerMessage } from "@frontier/shared";

class MemoryStore implements HostedStore {
  allowRequest?: HostedStore["allowRequest"];
  raw: string | null = null;
  conflicts = 0;
  async read() {
    return this.raw;
  }
  async compareAndSwap(expected: string | null, next: string) {
    if (this.conflicts > 0) {
      this.conflicts--;
      return false;
    }
    if (this.raw !== expected) return false;
    this.raw = next;
    return true;
  }
  get state() {
    return JSON.parse(this.raw!) as HostedState;
  }
}
function view(messages: ServerMessage[]) {
  const state = messages.find((m) => m.type === "state");
  if (state?.type !== "state") throw new Error("No snapshot");
  return state.view;
}
async function captain(
  engine: ReturnType<typeof createHostedEngine>,
  name: string,
) {
  const result = await engine.handle({ action: "join", name });
  expect(result.status).toBe(200);
  const welcome = result.messages.find((m) => m.type === "welcome");
  if (welcome?.type !== "welcome") throw new Error("No welcome");
  return {
    token: welcome.token,
    id: welcome.playerId,
    view: view(result.messages),
  };
}
let sequence = 0;
function command(
  engine: ReturnType<typeof createHostedEngine>,
  token: string,
  input: unknown,
  id = `cmd-${++sequence}`,
) {
  return engine.handle(
    { action: "command", id, version: 1, command: input },
    token,
  );
}
async function claim(
  engine: ReturnType<typeof createHostedEngine>,
  token: string,
  site = "site-1",
  id?: string,
) {
  return command(
    engine,
    token,
    {
      type: "claim",
      siteId: site,
      name: "Hosted home",
      scenario: "last-shift",
    },
    id,
  );
}

describe("durable hosted world across independent instances", () => {
  it("stores a session and filters snapshots from a second stateless engine instance", async () => {
    const store = new MemoryStore(),
      a = createHostedEngine(store, { now: () => 1000 }),
      b = createHostedEngine(store, { now: () => 1000 });
    const alice = await captain(a, "Alice");
    const bob = await captain(b, "Bob");
    await claim(a, alice.token);
    await claim(b, bob.token, "site-2");
    const result = await b.handle({ action: "state" }, alice.token);
    const filtered = view(result.messages);
    expect(filtered.you.id).toBe(alice.id);
    expect(filtered.colony?.ownerId).toBe(alice.id);
    expect(filtered.colonies).toHaveLength(2);
    expect(
      filtered.colonies.find((c) => c.ownerId === bob.id),
    ).not.toHaveProperty("resources");
    expect(store.state.sessions).not.toHaveProperty(alice.token);
    expect(JSON.stringify(store.state.sessions)).not.toContain(alice.token);
  });
  it("retries a committed command with its original receipt without awarding starting goods twice", async () => {
    const store = new MemoryStore(),
      engine = createHostedEngine(store, { now: () => 1000 });
    const alice = await captain(engine, "Alice");
    const first = await claim(engine, alice.token, "site-1", "claim-once");
    const before = store.state.world;
    const again = await claim(
      createHostedEngine(store, { now: () => 1000 }),
      alice.token,
      "site-1",
      "claim-once",
    );
    expect(again.messages.find((m) => m.type === "ack")).toEqual(
      first.messages.find((m) => m.type === "ack"),
    );
    expect(store.state.world).toEqual(before);
    const bad = await command(
      engine,
      alice.token,
      {
        type: "claim",
        siteId: "site-2",
        name: "Other",
        scenario: "last-shift",
      },
      "claim-once",
    );
    expect(bad.messages.find((m) => m.type === "ack")).toMatchObject({
      result: { ok: false },
    });
    expect(Object.keys(store.state.world.colonies)).toHaveLength(1);
  });
  it("serializes two racing claims across instances with exactly one winner", async () => {
    const store = new MemoryStore(),
      one = createHostedEngine(store, { now: () => 1000 }),
      two = createHostedEngine(store, { now: () => 1000 });
    const alice = await captain(one, "Alice"),
      bob = await captain(two, "Bob");
    const result = await Promise.all([
      claim(one, alice.token),
      claim(two, bob.token),
    ]);
    const acks = result
      .flatMap((r) => r.messages)
      .filter((m) => m.type === "ack");
    expect(acks.filter((m) => m.type === "ack" && m.result.ok)).toHaveLength(1);
    expect(Object.keys(store.state.world.colonies)).toHaveLength(1);
  });
  it("keeps join identity stable through CAS conflicts and does not strand extra captains", async () => {
    const store = new MemoryStore();
    store.conflicts = 3;
    const alice = await captain(
      createHostedEngine(store, { now: () => 1000 }),
      "Alice",
    );
    expect(Object.keys(store.state.world.players)).toEqual([alice.id]);
    expect(Object.keys(store.state.sessions)).toHaveLength(1);
  });
  it("advances by server elapsed time, caps inactive catch-up, and ignores client clocks", async () => {
    const store = new MemoryStore();
    let now = 1000;
    const engine = createHostedEngine(store, { now: () => now });
    const alice = await captain(engine, "Alice");
    now += 1000;
    let state = await engine.handle({ action: "state" }, alice.token);
    expect(view(state.messages).tick).toBe(10);
    now += 3600000;
    state = await engine.handle({ action: "state" }, alice.token);
    expect(view(state.messages).tick).toBe(60);
    state = await engine.handle({ action: "state" }, alice.token);
    expect(view(state.messages).tick).toBe(60);
    const before = store.raw;
    expect(
      (await engine.handle({ action: "state", clock: 9999999 }, alice.token))
        .status,
    ).toBe(400);
    expect(store.raw).toBe(before);
  });
  it("rejects bad actors, commands and ownership without mutating state", async () => {
    const store = new MemoryStore(),
      engine = createHostedEngine(store, { now: () => 1000 });
    const alice = await captain(engine, "Alice"),
      bob = await captain(engine, "Bob");
    const claimed = await claim(engine, alice.token);
    await claim(engine, bob.token, "site-2");
    const crew = view(claimed.messages).colony!.colonists[0];
    const attack = await command(engine, bob.token, {
      type: "move",
      colonistId: crew.id,
      x: 33,
      y: 32,
    });
    expect(attack.messages.find((m) => m.type === "ack")).toMatchObject({
      result: { ok: false },
    });
    const before = store.raw;
    expect(
      (await engine.handle({ action: "state" }, "invalid-token-0000000000"))
        .status,
    ).toBe(401);
    expect(
      (
        await engine.handle(
          {
            action: "command",
            id: "bad",
            version: 1,
            command: { type: "move", colonistId: crew.id, x: 999, y: 32 },
          },
          alice.token,
        )
      ).status,
    ).toBe(400);
    expect(store.raw).toBe(before);
  });
  it("refuses a corrupt stored world and never overwrites it with a new game", async () => {
    const store = new MemoryStore();
    store.raw = '{"format":999,"world":{}}';
    await expect(
      createHostedEngine(store).handle({ action: "join", name: "Alice" }),
    ).rejects.toThrow(/incompatible or corrupt/);
    expect(store.raw).toBe('{"format":999,"world":{}}');
  });
  it("stops after bounded CAS retries without acknowledging an uncommitted command", async () => {
    const store = new MemoryStore(),
      engine = createHostedEngine(store, { now: () => 1000 });
    const alice = await captain(engine, "Alice");
    const before = store.raw;
    store.conflicts = 10;
    const result = await claim(engine, alice.token);
    expect(result.status).toBe(503);
    expect(result.messages.some((m) => m.type === "ack")).toBe(false);
    expect(store.raw).toBe(before);
  });
  it("preserves the same identity after server recreation and rejects an invalid resume token", async () => {
    const store = new MemoryStore();
    const alice = await captain(
      createHostedEngine(store, { now: () => 1000 }),
      "Alice",
    );
    const engine = createHostedEngine(store, { now: () => 1000 });
    const resumed = await engine.handle({
      action: "join",
      name: "Other name",
      token: alice.token,
    });
    expect(view(resumed.messages).you).toMatchObject({
      id: alice.id,
      name: "Alice",
    });
    expect(
      (
        await engine.handle({
          action: "join",
          name: "Other",
          token: "wrong-token-00000000",
        })
      ).status,
    ).toBe(401);
    expect(Object.keys(store.state.world.players)).toHaveLength(1);
  });
  it("enforces the eight-captain private pilot budget", async () => {
    const store = new MemoryStore(),
      engine = createHostedEngine(store, { now: () => 1000 });
    for (let i = 0; i < 8; i++) await captain(engine, `Crew ${i}`);
    expect(
      (await engine.handle({ action: "join", name: "Ninth" })).status,
    ).toBe(409);
    expect(Object.keys(store.state.world.players)).toHaveLength(8);
  });
  it("does not discard durable receipts when the pilot history is full", async () => {
    const store = new MemoryStore(),
      engine = createHostedEngine(store, { now: () => 1000 });
    const alice = await captain(engine, "Alice");
    const state = store.state;
    for (let i = 0; i < 2000; i++)
      state.receipts[`old-${i}`] = {
        fingerprint: "old",
        result: { ok: true, message: "stored" },
      };
    store.raw = JSON.stringify(state);
    const before = store.raw;
    expect((await claim(engine, alice.token)).status).toBe(409);
    expect(store.raw).toBe(before);
  });
  it("returns rate limiting before state mutation", async () => {
    const store = new MemoryStore();
    store.allowRequest = async () => false;
    expect(
      (
        await createHostedEngine(store).handle({
          action: "join",
          name: "Alice",
        })
      ).status,
    ).toBe(429);
    expect(store.raw).toBeNull();
  });
});
describe("hosted store configuration", () => {
  it("fails closed without Redis configuration instead of keeping memory state", async () => {
    await expect(hostedStoreFromEnvironment({})).rejects.toThrow(
      /storage is not configured/,
    );
  });
  it("uses a single Redis Lua CAS for snapshot commits and a separate bounded rate key", async () => {
    const evalMock = vi
      .fn()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(13);
    const redis = { get: vi.fn().mockResolvedValue("old"), eval: evalMock };
    const store = createRedisHostedStore(redis, "world-key");
    expect(await store.read()).toBe("old");
    expect(await store.compareAndSwap(null, "new")).toBe(true);
    expect(evalMock.mock.calls[0][1]).toEqual(["world-key"]);
    expect(evalMock.mock.calls[0][2]).toEqual(["0", "", "new"]);
    expect(await store.compareAndSwap("old", "new")).toBe(false);
    expect(await store.allowRequest!("hash", 1, 12)).toBe(false);
  });
});

describe("anonymous join replay", () => {
  it("reuses one identity after a lost first response when a high-entropy join nonce is retried", async () => {
    const store = new MemoryStore();
    const first = createHostedEngine(store, { now: () => 1000 });
    const request = { action: "join", name: "Alice", joinId: "a".repeat(43) };
    const joined = await first.handle(request);
    const retried = await createHostedEngine(store, { now: () => 1000 }).handle(
      request,
    );
    expect(joined.messages.find((m) => m.type === "welcome")).toEqual(
      retried.messages.find((m) => m.type === "welcome"),
    );
    expect(Object.keys(store.state.world.players)).toHaveLength(1);
    expect(Object.keys(store.state.sessions)).toHaveLength(1);
    expect(store.raw).not.toContain("a".repeat(43));
  });
});
