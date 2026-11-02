import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  createWorld,
  joinWorld,
  applyCommand,
  tickWorld,
  getPlayerView,
  upgradeWorld,
} from "@frontier/sim";
import type { World, ServerMessage, CommandResult } from "@frontier/shared";
import { clientSchema } from "./server.js";
import { validateExtendedWorld } from "./save-validation.js";

export interface HostedStore {
  read(): Promise<string | null>;
  compareAndSwap(expectedRaw: string | null, nextRaw: string): Promise<boolean>;
  allowRequest?(key: string, seconds: number, limit: number): Promise<boolean>;
}
export type HostedReply = { status: number; messages: ServerMessage[] };
export type HostedState = {
  format: 1;
  revision: number;
  world: World;
  sessions: Record<string, { playerId: string; createdAt: number }>;
  receipts: Record<string, { fingerprint: string; result: CommandResult }>;
  lastTickAt: number;
};
const identityLimit = 8;
const receiptLimit = 2000;
const token = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const safeName = z
  .string()
  .trim()
  .min(1)
  .max(24)
  .refine((v) => !/[\u0000-\u001f\u007f]/.test(v));
const requestSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("join"),
      name: safeName,
      token: token.optional(),
      joinId: z
        .string()
        .length(43)
        .regex(/^[A-Za-z0-9_-]+$/)
        .optional(),
    })
    .strict(),
  z.object({ action: z.literal("state") }).strict(),
  z
    .object({
      action: z.literal("command"),
      id: z.string().min(1).max(100),
      version: z.literal(1),
      command: z.unknown(),
    })
    .strict(),
]);
const stateShape = z
  .object({
    format: z.literal(1),
    revision: z.number().int().nonnegative().safe(),
    world: z
      .object({
        version: z.literal(1),
        seed: z.number().int(),
        tick: z.number().int().nonnegative(),
        nextId: z.number().int().positive(),
        players: z.record(z.unknown()),
        colonies: z.record(z.unknown()),
        sites: z.array(z.unknown()).length(8),
        offers: z.array(z.unknown()),
        alliances: z.array(z.unknown()),
        allianceRequests: z.array(z.unknown()),
        events: z.array(z.unknown()),
      })
      .passthrough(),
    sessions: z.record(
      z.object({
        playerId: z.string(),
        createdAt: z.number().int().nonnegative(),
      }),
    ),
    receipts: z.record(
      z.object({
        fingerprint: z.string(),
        result: z.object({ ok: z.boolean(), message: z.string() }),
      }),
    ),
    lastTickAt: z.number().int().nonnegative().safe(),
  })
  .strict();
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
function failure(status: number, message: string): HostedReply {
  return { status, messages: [{ type: "error", message }] };
}
function decode(raw: string | null, now: number): HostedState {
  if (!raw)
    return {
      format: 1,
      revision: 0,
      world: createWorld(70823),
      sessions: {},
      receipts: {},
      lastTickAt: now,
    };
  let state: HostedState;
  try {
    stateShape.parse(JSON.parse(raw));
    state = JSON.parse(raw) as HostedState;
    if (
      Object.keys(state.sessions).length > identityLimit ||
      Object.keys(state.receipts).length > receiptLimit
    )
      throw new Error("Limit exceeded");
    for (const [id, player] of Object.entries(state.world.players)) {
      if (
        !player ||
        player.id !== id ||
        typeof player.name !== "string" ||
        typeof player.color !== "string"
      )
        throw new Error("Invalid player");
      if (
        player.colonyId &&
        state.world.colonies[player.colonyId]?.ownerId !== id
      )
        throw new Error("Invalid claim");
    }
    for (const site of state.world.sites) {
      if (!site || typeof site.id !== "string" || !Number.isInteger(site.seed))
        throw new Error("Invalid site");
      if (site.ownerId) {
        const player = state.world.players[site.ownerId];
        if (
          !player?.colonyId ||
          state.world.colonies[player.colonyId]?.siteId !== site.id
        )
          throw new Error("Invalid site owner");
      }
    }
    for (const [id, colony] of Object.entries(state.world.colonies)) {
      if (
        !colony ||
        colony.id !== id ||
        state.world.players[colony.ownerId]?.colonyId !== id ||
        !state.world.sites.some(
          (site) =>
            site.id === colony.siteId && site.ownerId === colony.ownerId,
        )
      )
        throw new Error("Invalid colony");
    }
    for (const session of Object.values(state.sessions))
      if (!state.world.players[session.playerId])
        throw new Error("Invalid session");
    validateExtendedWorld(state.world);
  } catch {
    throw new Error(
      "Hosted world data is incompatible or corrupt. The stored world has been preserved; restore a known-good backup before retrying.",
    );
  }
  upgradeWorld(state.world);
  return state;
}
function advance(state: HostedState, now: number) {
  const elapsed = Math.max(0, now - state.lastTickAt);
  const steps = Math.min(50, Math.floor(elapsed / 100));
  if (steps) tickWorld(state.world, steps);
  // Inactive worlds do not accumulate an unbounded offline debt. This private pilot
  // advances only when requested, with no more than five seconds of catch-up.
  if (elapsed > 5000) state.lastTickAt = now;
  else state.lastTickAt += steps * 100;
}

/** Every instance loads and atomically commits the same external state. No memory fallback. */
export function createHostedEngine(
  store: HostedStore,
  options: { now?: () => number; seed?: number } = {},
) {
  const clock = options.now ?? Date.now;
  return {
    async handle(payload: unknown, bearer?: string): Promise<HostedReply> {
      const parsed = requestSchema.safeParse(payload);
      if (!parsed.success)
        return failure(400, "Invalid hosted request or payload bounds.");
      const input = parsed.data;
      const command =
        input.action === "command"
          ? clientSchema.safeParse({
              type: "command",
              id: input.id,
              version: input.version,
              command: input.command,
            })
          : null;
      if (command && !command.success)
        return failure(
          400,
          "Invalid command, protocol version, or payload bounds.",
        );
      const provided = input.action === "join" ? input.token : bearer;
      if (provided && !token.safeParse(provided).success)
        return failure(
          401,
          "Session not found. Start a new captain or restore the matching world.",
        );
      if (input.action !== "join" && !provided)
        return failure(401, "A captain session is required.");
      // Generate once per request, outside CAS retries: a conflict cannot create ghosts.
      const freshToken =
        input.action === "join" && !provided
          ? input.joinId
            ? createHash("sha256")
                .update("frontier-hosted-join-v1:" + input.joinId)
                .digest("base64url")
            : randomBytes(32).toString("base64url")
          : null;
      const freshId = freshToken ? `p-${randomUUID()}` : null;
      const now = clock();
      if (
        store.allowRequest &&
        !(await store.allowRequest(
          digest(provided ?? freshToken ?? "anonymous"),
          1,
          12,
        ))
      )
        return failure(
          429,
          "Hosted request rate exceeded. Wait a moment before retrying.",
        );
      for (let attempt = 0; attempt < 6; attempt++) {
        const raw = await store.read();
        const state = decode(raw, now);
        if (!raw && options.seed !== undefined)
          state.world = createWorld(options.seed);
        let playerId =
          provided || freshToken
            ? state.sessions[digest(provided ?? freshToken!)]?.playerId
            : undefined;
        if (provided && !playerId)
          return failure(
            401,
            "Session not found. Start a new captain or restore the matching world.",
          );
        if (input.action === "join" && !provided && !playerId) {
          if (Object.keys(state.world.players).length >= identityLimit)
            return failure(
              409,
              "This private pilot has reached its eight-captain limit. Ask the host to archive or reset the world.",
            );
          playerId = freshId!;
          joinWorld(state.world, playerId, input.name);
          state.sessions[digest(freshToken!)] = { playerId, createdAt: now };
        }
        if (!playerId)
          return failure(401, "A valid captain session is required.");
        advance(state, now);
        const messages: ServerMessage[] = [];
        if (input.action === "join")
          messages.push({
            type: "welcome",
            token: provided ?? freshToken!,
            playerId,
            version: 1,
          });
        if (
          input.action === "command" &&
          command?.success &&
          command.data.type === "command"
        ) {
          const key = `${playerId}:${command.data.id}`;
          const fingerprint = JSON.stringify(command.data.command);
          const prior = state.receipts[key];
          let result: CommandResult;
          if (prior)
            result =
              prior.fingerprint === fingerprint
                ? prior.result
                : {
                    ok: false,
                    message:
                      "This command ID was already used for different input.",
                  };
          else {
            if (Object.keys(state.receipts).length >= receiptLimit)
              return failure(
                409,
                "Pilot command history is full. Ask the host to archive this world; old receipts are preserved.",
              );
            result = applyCommand(state.world, playerId, command.data.command);
            state.receipts[key] = { fingerprint, result };
          }
          messages.push({ type: "ack", id: command.data.id, result });
        }
        state.revision++;
        // Acknowledge only the CAS that persisted world, session and receipt together.
        if (await store.compareAndSwap(raw, JSON.stringify(state))) {
          messages.push({
            type: "state",
            view: getPlayerView(state.world, playerId),
          });
          return { status: 200, messages };
        }
      }
      return failure(
        503,
        "The shared world is busy. Retry this same command ID shortly.",
      );
    },
  };
}

/** Redis Lua compares raw JSON and commits the new snapshot as a single operation. */
export function createRedisHostedStore(
  redis: {
    get<T>(key: string): Promise<T | null>;
    eval<T>(script: string, keys: string[], args: unknown[]): Promise<T>;
  },
  key: string,
): HostedStore {
  return {
    read: () => redis.get<string>(key),
    compareAndSwap: async (expected, next) =>
      Number(
        await redis.eval<number>(
          "local old=redis.call('GET',KEYS[1]); if (not old and ARGV[1]=='0') or (old and ARGV[1]=='1' and old==ARGV[2]) then redis.call('SET',KEYS[1],ARGV[3]); return 1 end; return 0",
          [key],
          [expected === null ? "0" : "1", expected ?? "", next],
        ),
      ) === 1,
    allowRequest: async (identity, seconds, limit) =>
      Number(
        await redis.eval<number>(
          "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
          [`${key}:rate:${identity}`],
          [seconds],
        ),
      ) <= limit,
  };
}
export async function hostedStoreFromEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): Promise<HostedStore> {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const credential = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  if (!url || !credential)
    throw new Error(
      "Hosted world storage is not configured. Connect an Upstash Redis store to this Vercel project before playing.",
    );
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({
    url,
    token: credential,
    automaticDeserialization: false,
  });
  const environment =
    env.VERCEL_ENV === "production"
      ? "production"
      : `preview:${env.VERCEL_GIT_COMMIT_SHA ?? env.VERCEL_URL ?? "local"}`;
  const key = env.FRONTIER_REDIS_KEY ?? `frontier:${environment}:v1`;
  return createRedisHostedStore(redis, key);
}
