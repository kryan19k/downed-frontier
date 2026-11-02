import type { ClientMessage, ServerMessage } from "@frontier/shared";

export type ConnectionStatus =
  | "waiting"
  | "connecting"
  | "connected"
  | "reconnecting";
type Envelope = Extract<ClientMessage, { type: "command" }>;
type Queued = {
  envelope: Envelope;
  createdAt: number;
  resolve: () => void;
  reject: (error: Error) => void;
};
type Options = {
  name: string;
  token: string | null;
  joinId?: string;
  onMessages: (messages: ServerMessage[]) => void;
  onStatus: (status: ConnectionStatus) => void;
  onNotice: (message: string) => void;
  fetch?: typeof fetch;
  endpoint?: string;
};
class HostedError extends Error {
  constructor(
    message: string,
    public readonly status: number = 0,
  ) {
    super(message);
  }
}
const terminalIdentity = (error: unknown) =>
  error instanceof HostedError && [401, 403].includes(error.status);
const retryable = (error: unknown) =>
  !(error instanceof HostedError) || error.status === 0 || error.status >= 500;
const reason = (error: unknown) =>
  error instanceof Error ? error.message : "Unable to contact the game server.";

/** A pending join nonce is a credential: retain until welcome, never log or share it. */
export function createJoinId() {
  return btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
  )
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

/** One sequential request stream per browser: snapshots cannot overtake acknowledged commands. */
export function createHostedTransport(options: Options) {
  const fetcher = options.fetch ?? fetch;
  const joinId = options.token ? undefined : (options.joinId ?? createJoinId());
  const lifecycle = new AbortController();
  const queue: Queued[] = [];
  let token = options.token,
    joined = false,
    processing = false,
    terminal = false,
    started = false,
    attempt = 0,
    lastNotice = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stopped = () => lifecycle.signal.aborted;
  const notice = (message: string) => {
    if (!stopped() && message !== lastNotice) {
      lastNotice = message;
      options.onNotice(message);
    }
  };
  const schedule = (ms: number) => {
    if (stopped() || terminal) return;
    clearTimeout(timer);
    timer = setTimeout(() => void run(), ms);
  };
  const pause = (ms: number) =>
    new Promise<void>((resolve, reject) => {
      if (stopped()) {
        reject(new Error("Connection closed."));
        return;
      }
      const finish = () => {
        lifecycle.signal.removeEventListener("abort", cancel);
        resolve();
      };
      const wait = setTimeout(finish, ms);
      const cancel = () => {
        clearTimeout(wait);
        lifecycle.signal.removeEventListener("abort", cancel);
        reject(new Error("Connection closed."));
      };
      lifecycle.signal.addEventListener("abort", cancel, { once: true });
    });
  async function request(
    payload: Record<string, unknown>,
  ): Promise<ServerMessage[]> {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    lifecycle.signal.addEventListener("abort", cancel, { once: true });
    const timeout = setTimeout(cancel, 4000);
    try {
      const response = await fetcher(options.endpoint ?? "/api/game", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new HostedError(
          response.status === 401 || response.status === 403
            ? "Sign in to this Vercel deployment before connecting."
            : "The game endpoint did not return a valid response.",
          response.ok ? 502 : response.status,
        );
      }
      const messages =
        body && typeof body === "object" && "messages" in body
          ? (body as { messages: unknown }).messages
          : null;
      if (
        !Array.isArray(messages) ||
        messages.length > 20 ||
        !messages.every(
          (message) =>
            message &&
            typeof message === "object" &&
            ["welcome", "state", "ack", "error", "pong"].includes(message.type),
        )
      ) {
        throw new HostedError(
          "The game server returned an invalid message.",
          response.ok ? 502 : response.status,
        );
      }
      if (!response.ok) {
        const message = messages.find((m) => m.type === "error");
        throw new HostedError(
          typeof message?.message === "string"
            ? message.message
            : `Game request failed (${response.status}).`,
          response.status,
        );
      }
      return messages as ServerMessage[];
    } catch (error) {
      if (stopped()) throw new Error("Connection closed.");
      if (error instanceof HostedError) throw error;
      throw new HostedError("Connection interrupted. Waiting to reconnect.");
    } finally {
      clearTimeout(timeout);
      lifecycle.signal.removeEventListener("abort", cancel);
    }
  }
  function consume(messages: ServerMessage[]) {
    if (stopped()) return;
    for (const message of messages)
      if (message.type === "welcome") token = message.token;
    options.onMessages(messages);
  }
  async function run() {
    if (processing || stopped() || terminal) return;
    processing = true;
    let delay = 500;
    try {
      if (!joined) {
        options.onStatus(attempt ? "reconnecting" : "connecting");
        const messages = await request({
          action: "join",
          name: options.name,
          ...(token ? { token } : { joinId }),
        });
        if (
          !messages.some(
            (m) => m.type === "welcome" && typeof m.token === "string",
          ) ||
          !messages.some((m) => m.type === "state")
        )
          throw new HostedError(
            "The game did not confirm your captain identity.",
            502,
          );
        consume(messages);
        joined = true;
      } else if (queue.length) {
        const item = queue.shift()!;
        try {
          if (Date.now() - item.createdAt > 10000)
            throw new HostedError(
              "This order waited too long. Inspect the colony before repeating it.",
              408,
            );
          let delivered = false;
          for (let retry = 0; retry < 3; retry++) {
            try {
              // Each retry uses the original command ID. A lost response cannot duplicate a committed order.
              const messages = await request({
                action: "command",
                id: item.envelope.id,
                version: item.envelope.version,
                command: item.envelope.command,
              });
              if (
                !messages.some(
                  (m) => m.type === "ack" && m.id === item.envelope.id,
                )
              )
                throw new HostedError(
                  "The server did not acknowledge this order. Inspect the colony before repeating it.",
                  502,
                );
              consume(messages);
              delivered = true;
              break;
            } catch (error) {
              if (stopped() || !retryable(error) || retry === 2) throw error;
              await pause(400 * 2 ** retry);
            }
          }
          if (delivered) item.resolve();
        } catch (error) {
          item.reject(
            error instanceof Error ? error : new Error(reason(error)),
          );
          if (terminalIdentity(error) || retryable(error)) throw error;
        }
      } else {
        const messages = await request({ action: "state" });
        if (!messages.some((m) => m.type === "state"))
          throw new HostedError(
            "World synchronization was not confirmed.",
            502,
          );
        consume(messages);
      }
      if (!stopped()) {
        attempt = 0;
        lastNotice = "";
        options.onStatus("connected");
      }
    } catch (error) {
      if (stopped()) return;
      options.onStatus("reconnecting");
      notice(reason(error));
      if (
        terminalIdentity(error) ||
        (error instanceof HostedError &&
          error.status >= 400 &&
          error.status < 500)
      ) {
        terminal = true;
        while (queue.length) queue.shift()!.reject(new Error(reason(error)));
      } else {
        delay = Math.min(1000 * 2 ** attempt++, 10000);
      }
    } finally {
      processing = false;
      if (!stopped() && !terminal) schedule(queue.length ? 0 : delay);
    }
  }
  return {
    start() {
      if (started) return;
      started = true;
      options.onStatus("connecting");
      schedule(0);
    },
    send(envelope: Envelope): Promise<void> {
      if (stopped() || terminal || !joined)
        return Promise.reject(new Error("Waiting for the world connection."));
      if (queue.length >= 20)
        return Promise.reject(
          new Error("Too many pending orders. Wait for the world to respond."),
        );
      return new Promise((resolve, reject) => {
        queue.push({ envelope, createdAt: Date.now(), resolve, reject });
        if (!processing) schedule(0);
      });
    },
    stop() {
      clearTimeout(timer);
      lifecycle.abort();
      while (queue.length)
        queue.shift()!.reject(new Error("Connection closed."));
    },
  };
}
