import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameView, ServerMessage, Command } from "@frontier/shared";
import {
  createHostedTransport,
  createJoinId,
  type ConnectionStatus,
} from "./hostedTransport";
const state = (tick = 0): ServerMessage => ({
  type: "state",
  view: { tick } as GameView,
});
const welcome: ServerMessage = {
  type: "welcome",
  token: "confirmed-resume-token",
  playerId: "captain-a",
  version: 1,
};
function response(messages: ServerMessage[], status = 200) {
  return new Response(JSON.stringify({ messages }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
const envelope = (id = "order-1") => ({
  type: "command" as const,
  id,
  version: 1 as const,
  command: { type: "craft", enabled: false } as Command,
});
const clients: ReturnType<typeof createHostedTransport>[] = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  for (const c of clients.splice(0)) c.stop();
  vi.useRealTimers();
});
function setup(fetcher: typeof fetch, token: string | null = null) {
  const messages: ServerMessage[][] = [],
    statuses: ConnectionStatus[] = [],
    notices: string[] = [];
  const client = createHostedTransport({
    name: "Captain",
    token,
    fetch: fetcher,
    onMessages: (m) => messages.push(m),
    onStatus: (s) => statuses.push(s),
    onNotice: (n) => notices.push(n),
  });
  clients.push(client);
  return { client, messages, statuses, notices };
}
describe("hosted browser transport", () => {
  it("joins with a high-entropy nonce, polls with the confirmed token, and preserves a resume token", async () => {
    const requests: { body: Record<string, unknown>; headers: Headers }[] = [];
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(init!.body as string);
        requests.push({ body, headers: new Headers(init?.headers) });
        return response(
          body.action === "join" ? [welcome, state()] : [state(5)],
        );
      },
    );
    const { client, statuses } = setup(fetcher as typeof fetch);
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(requests[0].body.joinId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(requests[0].body.token).toBeUndefined();
    await vi.advanceTimersByTimeAsync(500);
    expect(requests[1].body.action).toBe("state");
    expect(requests[1].headers.get("Authorization")).toBe(
      "Bearer confirmed-resume-token",
    );
    expect(statuses.at(-1)).toBe("connected");
    const resumed = setup(fetcher as typeof fetch, "saved-token");
    resumed.client.start();
    await vi.advanceTimersByTimeAsync(0);
    const join = requests.at(-1)!;
    expect(join.body.token).toBe("saved-token");
    expect(join.body.joinId).toBeUndefined();
  });
  it("reuses the same join nonce after a lost initial response instead of creating another identity", async () => {
    const joins: string[] = [];
    let calls = 0;
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(init!.body as string);
        joins.push(body.joinId);
        if (calls++ === 0) throw new TypeError("response lost");
        return response([welcome, state()]);
      },
    );
    const { client, statuses } = setup(fetcher as typeof fetch);
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(joins).toHaveLength(2);
    expect(joins[0]).toBe(joins[1]);
    expect(statuses.at(-1)).toBe("connected");
  });
  it("retries a lost command response with its original ID and delivers exactly one acknowledgment", async () => {
    const ids: string[] = [];
    let commandCalls = 0;
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(init!.body as string);
        if (body.action === "join") return response([welcome, state()]);
        if (body.action === "command") {
          ids.push(body.id);
          if (commandCalls++ === 0) throw new TypeError("lost after commit");
          return response([
            { type: "ack", id: body.id, result: { ok: true, message: "Done" } },
            state(12),
          ]);
        }
        return response([state(12)]);
      },
    );
    const { client, messages } = setup(fetcher as typeof fetch);
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    const sent = client.send(envelope("stable-order"));
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(400);
    await sent;
    expect(ids).toEqual(["stable-order", "stable-order"]);
    expect(messages.flat().filter((m) => m.type === "ack")).toHaveLength(1);
  });
  it("serializes an in-flight snapshot before a command so an old snapshot cannot overwrite the acknowledgment", async () => {
    let release: ((r: Response) => void) | undefined;
    const actions: string[] = [];
    let concurrent = 0,
      maxConcurrent = 0;
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(init!.body as string);
        actions.push(body.action);
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        try {
          if (body.action === "join") return response([welcome, state()]);
          if (body.action === "state")
            return await new Promise<Response>((r) => {
              release = r;
            });
          return response([
            {
              type: "ack",
              id: body.id,
              result: { ok: true, message: "Built" },
            },
            state(20),
          ]);
        } finally {
          concurrent--;
        }
      },
    );
    const { client, messages } = setup(fetcher as typeof fetch);
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(500);
    const sent = client.send(envelope());
    await vi.advanceTimersByTimeAsync(0);
    expect(actions).toEqual(["join", "state"]);
    release!(response([state(10)]));
    await vi.advanceTimersByTimeAsync(0);
    await sent;
    expect(actions).toEqual(["join", "state", "command"]);
    expect(maxConcurrent).toBe(1);
    expect(
      messages
        .flat()
        .filter((m) => m.type === "state")
        .map((m) => m.type === "state" && m.view.tick),
    ).toEqual([0, 10, 20]);
  });
  it("stops on invalid identity rather than repeatedly retrying or discarding its token", async () => {
    const fetcher = vi.fn(async () =>
      response([{ type: "error", message: "Resume token is unknown." }], 401),
    );
    const { client, notices, statuses } = setup(
      fetcher as typeof fetch,
      "bad-token",
    );
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(notices).toEqual(["Resume token is unknown."]);
    expect(statuses.at(-1)).toBe("reconnecting");
    await expect(client.send(envelope())).rejects.toThrow(
      "Waiting for the world connection",
    );
  });
  it("backs off on unavailable storage and reports the repeated configuration error only once", async () => {
    const fetcher = vi.fn(async () =>
      response(
        [{ type: "error", message: "Configure persistent game storage." }],
        503,
      ),
    );
    const { client, notices } = setup(fetcher as typeof fetch);
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(notices).toEqual(["Configure persistent game storage."]);
    client.stop();
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("aborts pending requests and does not publish state after the transport is stopped", async () => {
    let requestSignal: AbortSignal | undefined;
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        requestSignal = init?.signal as AbortSignal;
        return await new Promise<Response>((_resolve, reject) =>
          requestSignal!.addEventListener(
            "abort",
            () => reject(new DOMException("Stopped", "AbortError")),
            { once: true },
          ),
        );
      },
    );
    const { client, messages, notices } = setup(fetcher as typeof fetch);
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    client.stop();
    await vi.advanceTimersByTimeAsync(0);
    expect(requestSignal?.aborted).toBe(true);
    expect(messages).toEqual([]);
    expect(notices).toEqual([]);
    await vi.advanceTimersByTimeAsync(20000);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("creates distinct 256-bit join credentials in the required URL-safe form", () => {
    const a = createJoinId(),
      b = createJoinId();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(b).not.toBe(a);
  });
});
