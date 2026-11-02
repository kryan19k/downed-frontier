import { createServer, type Server } from "node:http";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { dirname, resolve, extname, sep } from "node:path";
import {
  existsSync,
  readFileSync,
  mkdirSync,
  openSync,
  writeFileSync,
  fsyncSync,
  closeSync,
  renameSync,
  unlinkSync,
  realpathSync,
} from "node:fs";
import { WebSocketServer, WebSocket, type RawData } from "ws";
import { z } from "zod";
import { validateExtendedWorld } from "./save-validation.js";
import {
  createWorld,
  joinWorld,
  applyCommand,
  tickWorld,
  getPlayerView,
  upgradeWorld,
} from "@frontier/sim";
import {
  BUILDINGS,
  RECIPES,
  RESEARCH,
  MAP_SIZE,
  TICK_RATE,
  type World,
  type Command,
  type CommandResult,
  type ServerMessage,
} from "@frontier/shared";

const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_:.\-]+$/);
const coordinate = z
  .number()
  .int()
  .min(0)
  .max(MAP_SIZE - 1);
const resource = z.enum([
  "scrap",
  "fiber",
  "rations",
  "components",
  "medicine",
  "fuel",
]);
export const commandSchema = z
  .discriminatedUnion("type", [
    z
      .object({
        type: z.literal("claim"),
        siteId: id,
        name: z.string().trim().min(1).max(32),
        scenario: z.string().min(1).max(40),
      })
      .strict(),
    z
      .object({
        type: z.literal("move"),
        colonistId: id,
        x: coordinate,
        y: coordinate,
      })
      .strict(),
    z
      .object({
        type: z.literal("build"),
        building: z.enum(
          Object.keys(BUILDINGS) as [
            keyof typeof BUILDINGS,
            ...(keyof typeof BUILDINGS)[],
          ],
        ),
        x: coordinate,
        y: coordinate,
      })
      .strict(),
    z
      .object({
        type: z.literal("queueRecipe"),
        recipeId: z.enum(RECIPES.map((r) => r.id) as [string, ...string[]]),
        quantity: z.number().int().min(1).max(20),
      })
      .strict(),
    z.object({ type: z.literal("cancelRecipe"), billId: id }).strict(),
    z.object({ type: z.literal("tend"), colonistId: id }).strict(),
    z
      .object({
        type: z.literal("research"),
        projectId: z.enum(RESEARCH.map((r) => r.id) as [string, ...string[]]),
      })
      .strict(),
    z
      .object({
        type: z.literal("policy"),
        policy: z.enum(["work", "rationing", "shelter"]),
        value: z.enum(["balanced", "rest", "intensive", "on", "off"]),
      })
      .strict(),
    z
      .object({
        type: z.literal("expeditionLaunch"),
        siteId: id,
        colonistIds: z
          .array(id)
          .min(1)
          .max(3)
          .refine(
            (ids) => new Set(ids).size === ids.length,
            "Crew must be unique",
          ),
      })
      .strict(),
    z
      .object({
        type: z.literal("expeditionOrder"),
        expeditionId: id,
        unitId: id,
        x: z.number().int().min(0).max(31),
        y: z.number().int().min(0).max(31),
      })
      .strict(),
    z
      .object({
        type: z.literal("expeditionAttack"),
        expeditionId: id,
        unitId: id,
        targetId: id,
      })
      .strict(),
    z
      .object({ type: z.literal("expeditionRetreat"), expeditionId: id })
      .strict(),
    z.object({ type: z.literal("cancelBuild"), buildingId: id }).strict(),
    z.object({ type: z.literal("deconstruct"), buildingId: id }).strict(),
    z
      .object({
        type: z.literal("draft"),
        colonistId: id,
        drafted: z.boolean(),
      })
      .strict(),
    z
      .object({
        type: z.literal("priority"),
        colonistId: id,
        priority: z.enum(["balanced", "build", "salvage"]),
      })
      .strict(),
    z.object({ type: z.literal("craft"), enabled: z.boolean() }).strict(),
    z.object({ type: z.literal("repair"), buildingId: id }).strict(),
    z
      .object({
        type: z.literal("alliance"),
        targetId: id,
        action: z.enum(["request", "accept", "revoke"]),
      })
      .strict(),
    z
      .object({
        type: z.literal("trade"),
        targetId: id,
        give: resource,
        giveAmount: z.number().int().min(1).max(10000),
        want: resource,
        wantAmount: z.number().int().min(1).max(10000),
      })
      .strict(),
    z
      .object({
        type: z.literal("tradeRespond"),
        offerId: id,
        accept: z.boolean(),
      })
      .strict(),
  ])
  .superRefine((command, context) => {
    if (command.type === "policy") {
      const allowed =
        command.policy === "work"
          ? ["balanced", "rest", "intensive"]
          : ["on", "off"];
      if (!allowed.includes(command.value))
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["value"],
          message: "Value does not match policy",
        });
    }
  });
export const clientSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("command"),
      id,
      version: z.literal(1),
      command: commandSchema,
    })
    .strict(),
  z.object({ type: z.literal("ping") }).strict(),
]);
const receiptSchema = z.object({
  fingerprint: z.string(),
  result: z.object({ ok: z.boolean(), message: z.string() }),
});
const sessionSchema = z.object({
  playerId: id,
  createdAt: z.number().finite(),
});
const saveSchema = z
  .object({
    format: z.literal(1),
    world: z.unknown(),
    sessions: z.record(sessionSchema),
    receipts: z.record(receiptSchema),
  })
  .strict();
type Receipt = z.infer<typeof receiptSchema>;
type Session = z.infer<typeof sessionSchema>;
type Saved = {
  format: 1;
  world: World;
  sessions: Record<string, Session>;
  receipts: Record<string, Receipt>;
};
type Connection = {
  ws: WebSocket;
  playerId: string;
  windowStart: number;
  messages: number;
  alive: boolean;
};
type Pending = {
  connection: Connection;
  id: string;
  command: Command;
  fingerprint: string;
};
export type ServerOptions = {
  port?: number;
  host?: string;
  savePath?: string | null;
  autostart?: boolean;
  seed?: number;
  webRoot?: string;
};
export type GameServer = {
  httpServer: Server;
  world: World;
  start: () => Promise<void>;
  close: () => Promise<void>;
  address: () => ReturnType<Server["address"]>;
  save: () => void;
};
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

/** A local filesystem lease prevents two hosts from overwriting one world. */
function acquireWorldLock(savePath: string): () => void {
  const path = `${savePath}.lock`;
  const contents = JSON.stringify({ pid: process.pid, nonce: randomUUID() });
  const lockError = () =>
    new Error(
      `World is already locked: ${path}. Stop its owning host. Ambiguous locks require manual inspection.`,
    );
  function create() {
    const fd = openSync(path, "wx", 0o600);
    try {
      writeFileSync(fd, contents);
      fsyncSync(fd);
    } catch (error) {
      closeSync(fd);
      unlinkSync(path);
      throw error;
    }
    closeSync(fd);
  }
  try {
    create();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    // Serialize stale-lock recovery so a second recovering host cannot unlink
    // the first host's newly acquired live lock between a read and unlink.
    const recovery = `${path}.recovery`;
    let guard: number;
    try {
      guard = openSync(recovery, "wx", 0o600);
    } catch {
      throw lockError();
    }
    try {
      const original = readFileSync(path, "utf8");
      const parsed = z
        .object({ pid: z.number().int().positive(), nonce: z.string().uuid() })
        .strict()
        .safeParse(JSON.parse(original));
      if (!parsed.success) throw lockError();
      try {
        process.kill(parsed.data.pid, 0);
        throw lockError();
      } catch (check) {
        if ((check as NodeJS.ErrnoException).code !== "ESRCH")
          throw lockError();
      }
      if (readFileSync(path, "utf8") !== original) throw lockError();
      unlinkSync(path);
      // A fresh contender may have won the atomic wx race. Never remove it.
      try {
        create();
      } catch {
        throw lockError();
      }
    } finally {
      closeSync(guard);
      unlinkSync(recovery);
    }
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    try {
      if (readFileSync(path, "utf8") === contents) unlinkSync(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  };
}

/** Refuse incompatible/corrupt snapshots instead of silently replacing a player's world. */
function readSave(path: string): Saved {
  const parsed = saveSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  const w = parsed.world as World;
  if (
    !w ||
    w.version !== 1 ||
    !Number.isInteger(w.tick) ||
    w.tick < 0 ||
    !Number.isInteger(w.seed) ||
    !Number.isInteger(w.nextId) ||
    !Array.isArray(w.sites) ||
    w.sites.length !== 8 ||
    typeof w.players !== "object" ||
    !w.players ||
    !w.colonies ||
    !Array.isArray(w.offers) ||
    !Array.isArray(w.alliances) ||
    !Array.isArray(w.allianceRequests) ||
    !Array.isArray(w.events)
  )
    throw new Error(
      "Unsupported or corrupt world snapshot. Preserve the file and restore a known-good backup.",
    );
  for (const [key, p] of Object.entries(w.players)) {
    if (
      !p ||
      p.id !== key ||
      typeof p.name !== "string" ||
      typeof p.color !== "string" ||
      !(p.colonyId === null || typeof p.colonyId === "string")
    )
      throw new Error("Corrupt player state");
    if (
      p.colonyId !== null &&
      (!Object.hasOwn(w.colonies, p.colonyId) ||
        w.colonies[p.colonyId].ownerId !== key)
    )
      throw new Error("Corrupt player-colony ownership");
  }
  const siteIds = new Set<string>();
  for (const site of w.sites) {
    if (
      !site ||
      typeof site.id !== "string" ||
      siteIds.has(site.id) ||
      !(site.ownerId === null || typeof site.ownerId === "string")
    )
      throw new Error("Corrupt site state");
    siteIds.add(site.id);
    if (site.ownerId !== null) {
      const owner = Object.hasOwn(w.players, site.ownerId)
        ? w.players[site.ownerId]
        : null;
      if (!owner?.colonyId || w.colonies[owner.colonyId]?.siteId !== site.id)
        throw new Error("Corrupt site claim ownership");
    }
  }
  for (const [key, colony] of Object.entries(w.colonies)) {
    if (
      !colony ||
      !w.players[colony.ownerId] ||
      !Array.isArray(colony.colonists) ||
      !Array.isArray(colony.buildings) ||
      !Array.isArray(colony.deposits) ||
      !Array.isArray(colony.events)
    )
      throw new Error("Corrupt colony state");
    const site = w.sites.find((site) => site.id === colony.siteId);
    if (
      colony.id !== key ||
      w.players[colony.ownerId].colonyId !== key ||
      site?.ownerId !== colony.ownerId
    )
      throw new Error("Corrupt colony claim mapping");
    for (const name of [
      "scrap",
      "fiber",
      "rations",
      "components",
      "medicine",
      "fuel",
    ] as const)
      if (
        !Number.isInteger(colony.resources?.[name]) ||
        colony.resources[name] < 0
      )
        throw new Error("Corrupt resource quantity");
    for (const entity of [
      ...colony.colonists,
      ...colony.buildings,
      ...colony.deposits,
    ])
      if (
        !Number.isFinite(entity.x) ||
        !Number.isFinite(entity.y) ||
        typeof entity.id !== "string"
      )
        throw new Error("Corrupt entity state");
  }
  validateExtendedWorld(w);
  for (const session of Object.values(parsed.sessions))
    if (!w.players[session.playerId])
      throw new Error("Session references missing player");
  return { ...parsed, world: w };
}

export async function createGameServer(
  options: ServerOptions = {},
): Promise<GameServer> {
  if (process.env.NODE_ENV === "production")
    throw new Error(
      "This unauthenticated invited-session prototype is not enabled for public production hosting.",
    );
  let savePath =
    options.savePath === undefined
      ? resolve(process.cwd(), "data/world.json")
      : options.savePath;
  let releaseLock = () => {};
  if (savePath) {
    savePath = resolve(savePath);
    mkdirSync(dirname(savePath), { recursive: true });
    savePath = resolve(
      realpathSync(dirname(savePath)),
      savePath.slice(dirname(savePath).length + 1),
    );
    releaseLock = acquireWorldLock(savePath);
  }
  let state: Saved;
  try {
    state =
      savePath && existsSync(savePath)
        ? readSave(savePath)
        : {
            format: 1,
            world: createWorld(options.seed ?? 70823),
            sessions: {},
            receipts: {},
          };
    upgradeWorld(state.world);
    validateExtendedWorld(state.world);
  } catch (error) {
    releaseLock();
    throw error;
  }
  const world = state.world;
  const clients = new Set<Connection>();
  const queue: Pending[] = [];
  let tickTimer: ReturnType<typeof setInterval> | undefined;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let started = false;
  let closing = false;
  let persistenceError = false;
  const webRoot = resolve(
    options.webRoot ?? resolve(process.cwd(), "apps/web/dist"),
  );

  function persist() {
    if (!savePath) return;
    mkdirSync(dirname(savePath), { recursive: true });
    const temporary = `${savePath}.tmp`;
    const fd = openSync(temporary, "w", 0o600);
    try {
      writeFileSync(fd, JSON.stringify(state));
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(temporary, savePath);
    // Directory fsync makes the rename durable on supported local filesystems.
    const directory = openSync(dirname(savePath), "r");
    try {
      fsyncSync(directory);
    } finally {
      closeSync(directory);
    }
  }
  function send(ws: WebSocket, message: ServerMessage) {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 1024 * 1024) {
      ws.close(1013, "Connection too slow; reconnect to resync");
      return;
    }
    ws.send(JSON.stringify(message));
  }
  function sendState(connection: Connection) {
    try {
      const view = getPlayerView(world, connection.playerId);
      view.onlinePlayers = [...new Set([...clients].map((c) => c.playerId))];
      send(connection.ws, { type: "state", view });
    } catch {
      send(connection.ws, {
        type: "error",
        message: "Unable to synchronize. Please reconnect.",
      });
    }
  }
  function broadcast() {
    for (const connection of clients) sendState(connection);
  }
  function failPersistence() {
    persistenceError = true;
    console.error(
      "World persistence failed; simulation paused to protect committed state. Check storage before restarting.",
    );
    for (const connection of clients)
      send(connection.ws, {
        type: "error",
        message:
          "World paused: storage unavailable. Your last acknowledged command is preserved. Reconnect after the host repairs storage.",
      });
  }
  function processTick() {
    if (closing || persistenceError) return;
    const batch = queue.splice(0, 100);
    for (const pending of batch) {
      const key = `${pending.connection.playerId}:${pending.id}`;
      const prior = state.receipts[key];
      if (prior) {
        send(pending.connection.ws, {
          type: "ack",
          id: pending.id,
          result:
            prior.fingerprint === pending.fingerprint
              ? prior.result
              : {
                  ok: false,
                  message:
                    "This command ID was already used for different input.",
                },
        });
        continue;
      }
      const count = Object.keys(state.receipts).filter((k) =>
        k.startsWith(`${pending.connection.playerId}:`),
      ).length;
      if (count >= 10000) {
        send(pending.connection.ws, {
          type: "ack",
          id: pending.id,
          result: {
            ok: false,
            message:
              "Prototype command history is full. Ask the host to archive this world.",
          },
        });
        continue;
      }
      const before = structuredClone(world);
      let result: CommandResult;
      try {
        result = applyCommand(
          world,
          pending.connection.playerId,
          pending.command,
        );
      } catch {
        Object.assign(world, before);
        result = { ok: false, message: "Command could not be applied safely." };
      }
      state.receipts[key] = { fingerprint: pending.fingerprint, result };
      try {
        persist();
      } catch {
        // A write/rename may already have committed. Stop processing immediately;
        // restart reconciles from the durable file and its receipt before retry.
        Object.assign(world, before);
        delete state.receipts[key];
        failPersistence();
        break;
      }
      send(pending.connection.ws, { type: "ack", id: pending.id, result });
      sendState(pending.connection);
    }
    if (persistenceError) return;
    tickWorld(world, 1);
    if (world.tick % 50 === 0) {
      try {
        persist();
      } catch {
        failPersistence();
      }
    }
    if (world.tick % 2 === 0) broadcast();
  }

  const httpServer = createServer((req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    if (req.url === "/api/health") {
      res.writeHead(persistenceError ? 503 : 200, {
        "Content-Type": "application/json",
      });
      res.end(
        JSON.stringify({
          ok: !persistenceError,
          protocol: 1,
          tick: world.tick,
          mode: "local-invited-prototype",
        }),
      );
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      res.end("Method not allowed");
      return;
    }
    let pathname: string;
    try {
      pathname = decodeURIComponent(
        new URL(req.url ?? "/", "http://localhost").pathname,
      );
    } catch {
      res.writeHead(400);
      res.end("Invalid path");
      return;
    }
    if (pathname.startsWith("/api/") || pathname === "/socket") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    let path = resolve(
      webRoot,
      `.${pathname === "/" ? "/index.html" : pathname}`,
    );
    if (path !== webRoot && !path.startsWith(webRoot + sep)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    if (!existsSync(path) && !extname(pathname))
      path = resolve(webRoot, "index.html");
    const types: Record<string, string> = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".ico": "image/x-icon",
      ".woff2": "font/woff2",
      ".json": "application/json",
    };
    try {
      const file = readFileSync(path);
      res.writeHead(200, {
        "Content-Type": types[extname(path)] ?? "application/octet-stream",
      });
      res.end(req.method === "HEAD" ? undefined : file);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Client build not found. Run npm run build, or use npm run dev.");
    }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
  httpServer.on("upgrade", (req, socket, head) => {
    if (closing || persistenceError) {
      socket.write("HTTP/1.1 503 Service Unavailable\r\n\r\n");
      socket.destroy();
      return;
    }
    let url: URL;
    try {
      url = new URL(req.url ?? "/", "http://localhost");
    } catch {
      socket.destroy();
      return;
    }
    if (url.pathname !== "/socket") {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }
    if (clients.size >= 32) {
      socket.write("HTTP/1.1 503 Service Unavailable\r\n\r\n");
      socket.destroy();
      return;
    }
    const origin = req.headers.origin;
    if (origin) {
      try {
        const originHost = new URL(origin).hostname;
        const host = new URL(`http://${req.headers.host ?? "localhost"}`)
          .hostname;
        const local = (v: string) =>
          ["localhost", "127.0.0.1", "[::1]"].includes(v);
        if (originHost !== host && !(local(originHost) && local(host))) {
          socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
          socket.destroy();
          return;
        }
      } catch {
        socket.destroy();
        return;
      }
    }
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, req),
    );
  });
  wss.on("connection", (ws, req) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    let token = url.searchParams.get("token");
    let session = token ? state.sessions[hash(token)] : undefined;
    if (token && !session) {
      send(ws, {
        type: "error",
        message:
          "Session not found. Start a new local identity or restore the matching world save.",
      });
      ws.close(1008, "Invalid resume token");
      return;
    }
    if (!session) {
      if (Object.keys(world.players).length >= 32) {
        send(ws, {
          type: "error",
          message: "This prototype world has reached its identity limit.",
        });
        ws.close(1008, "World full");
        return;
      }
      const before = structuredClone(world);
      token = randomBytes(32).toString("base64url");
      const playerId = `p-${randomUUID()}`;
      const name =
        (url.searchParams.get("name") ?? "Wayfarer")
          .replace(/[\u0000-\u001f\u007f]/g, "")
          .trim()
          .slice(0, 24) || "Wayfarer";
      joinWorld(world, playerId, name);
      session = { playerId, createdAt: Date.now() };
      state.sessions[hash(token)] = session;
      try {
        persist();
      } catch {
        Object.assign(world, before);
        delete state.sessions[hash(token)];
        failPersistence();
        ws.close(1011, "Storage unavailable");
        return;
      }
    }
    const connection: Connection = {
      ws,
      playerId: session.playerId,
      windowStart: Date.now(),
      messages: 0,
      alive: true,
    };
    clients.add(connection);
    send(ws, {
      type: "welcome",
      token: token!,
      playerId: session.playerId,
      version: 1,
    });
    sendState(connection);
    ws.on("pong", () => {
      connection.alive = true;
    });
    ws.on("message", (raw: RawData, isBinary: boolean) => {
      if (isBinary) {
        ws.close(1003, "JSON text required");
        return;
      }
      const now = Date.now();
      if (now - connection.windowStart >= 1000) {
        connection.windowStart = now;
        connection.messages = 0;
      }
      if (++connection.messages > 30) {
        ws.close(1008, "Command rate exceeded");
        return;
      }
      let payload: unknown;
      try {
        payload = JSON.parse(raw.toString());
      } catch {
        send(ws, { type: "error", message: "Invalid JSON message." });
        return;
      }
      const parsed = clientSchema.safeParse(payload);
      if (!parsed.success) {
        send(ws, {
          type: "error",
          message: "Invalid command, protocol version, or payload bounds.",
        });
        return;
      }
      if (parsed.data.type === "ping") {
        send(ws, { type: "pong" });
        return;
      }
      if (persistenceError) {
        send(ws, {
          type: "error",
          message: "World paused: storage unavailable.",
        });
        return;
      }
      if (queue.length >= 256) {
        send(ws, {
          type: "ack",
          id: parsed.data.id,
          result: {
            ok: false,
            message: "World command queue is busy; retry shortly.",
          },
        });
        return;
      }
      const { id: commandId, command } = parsed.data;
      queue.push({
        connection,
        id: commandId,
        command,
        fingerprint: JSON.stringify(command),
      });
    });
    ws.on("close", () => {
      clients.delete(connection);
    });
    ws.on("error", () => {
      clients.delete(connection);
    });
  });

  async function start() {
    if (started) return;
    if (closing) throw new Error("This host has already closed.");
    try {
      await new Promise<void>((ok, fail) => {
        httpServer.once("error", fail);
        httpServer.listen(
          options.port ?? 3001,
          options.host ?? "127.0.0.1",
          () => {
            httpServer.off("error", fail);
            ok();
          },
        );
      });
    } catch (error) {
      closing = true;
      releaseLock();
      throw error;
    }
    started = true;
    tickTimer = setInterval(processTick, 1000 / TICK_RATE);
    heartbeatTimer = setInterval(() => {
      for (const c of clients) {
        if (!c.alive) {
          c.ws.terminate();
          continue;
        }
        c.alive = false;
        c.ws.ping();
      }
    }, 15000);
  }
  async function close() {
    if (closing) return;
    closing = true;
    if (tickTimer) clearInterval(tickTimer);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    for (const c of clients) c.ws.terminate();
    try {
      if (!persistenceError) persist();
    } finally {
      try {
        await new Promise<void>((ok) => wss.close(() => ok()));
        if (started)
          await new Promise<void>((ok, fail) =>
            httpServer.close((error) => (error ? fail(error) : ok())),
          );
      } finally {
        releaseLock();
      }
    }
  }
  const result: GameServer = {
    httpServer,
    world,
    start,
    close,
    address: () => httpServer.address(),
    save: persist,
  };
  if (options.autostart !== false) await start();
  return result;
}
