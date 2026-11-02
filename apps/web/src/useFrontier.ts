import { useCallback, useEffect, useRef, useState } from "react";
import { createHostedTransport, createJoinId } from "./hostedTransport";
import type { Command, GameView, ServerMessage } from "@frontier/shared";

export type Notice = {
  id: string;
  text: string;
  kind: "success" | "error" | "info";
};
export function useFrontier(name: string | null) {
  const [view, setView] = useState<GameView | null>(null);
  const [status, setStatus] = useState<
    "waiting" | "connecting" | "connected" | "reconnecting"
  >("waiting");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [pending, setPending] = useState(0);
  const socket = useRef<WebSocket | null>(null);
  const hostedSend = useRef<((id: string, command: Command) => void) | null>(
    null,
  );
  const inflight = useRef(new Map<string, number>());
  const notify = useCallback((text: string, kind: Notice["kind"] = "info") => {
    const id = crypto.randomUUID();
    setNotices((n) => [...n.slice(-1), { id, text, kind }]);
    setTimeout(() => setNotices((n) => n.filter((x) => x.id !== id)), 6000);
  }, []);
  useEffect(() => {
    if (!name) return;
    let alive = true,
      attempt = 0,
      retry: ReturnType<typeof setTimeout> | undefined;
    const hosted =
      (import.meta as ImportMeta & { env: Record<string, string> }).env
        .VITE_GAME_TRANSPORT === "http";
    if (hosted) {
      const resumeToken = localStorage.getItem("frontier-token");
      const joinId = resumeToken
        ? undefined
        : (localStorage.getItem("frontier-pending-join") ?? createJoinId());
      if (joinId) localStorage.setItem("frontier-pending-join", joinId);
      const transport = createHostedTransport({
        name,
        token: resumeToken,
        joinId,
        onStatus: (next) => {
          if (alive) setStatus(next);
        },
        onNotice: (message) => {
          if (alive) notify(message, "error");
        },
        onMessages: (messages) => {
          if (!alive) return;
          for (const message of messages) {
            if (message.type === "welcome") {
              localStorage.setItem("frontier-token", message.token);
              localStorage.removeItem("frontier-pending-join");
            } else if (message.type === "state") setView(message.view);
            else if (message.type === "ack") {
              inflight.current.delete(message.id);
              setPending(inflight.current.size);
              notify(
                message.result.message,
                message.result.ok ? "success" : "error",
              );
            } else if (message.type === "error")
              notify(message.message, "error");
          }
        },
      });
      hostedSend.current = (id, command) => {
        void transport
          .send({ type: "command", id, version: 1, command })
          .catch((error) => {
            if (!alive) return;
            inflight.current.delete(id);
            setPending(inflight.current.size);
            notify(
              error instanceof Error
                ? error.message
                : "Order was not confirmed. Inspect the colony before repeating it.",
              "error",
            );
          });
      };
      transport.start();
      const expire = setInterval(() => {
        if (!alive) return;
        const now = Date.now();
        let changed = false;
        for (const [id, sent] of inflight.current)
          if (now - sent > 12000) {
            inflight.current.delete(id);
            changed = true;
          }
        if (changed) {
          setPending(inflight.current.size);
          notify(
            "An order was not confirmed. Inspect the world before trying again.",
            "info",
          );
        }
      }, 3000);
      return () => {
        alive = false;
        hostedSend.current = null;
        clearInterval(expire);
        transport.stop();
        inflight.current.clear();
      };
    }
    const connect = () => {
      if (!alive) return;
      setStatus(attempt ? "reconnecting" : "connecting");
      const configured = (
        import.meta as ImportMeta & { env: Record<string, string> }
      ).env.VITE_SERVER_URL;
      const url = new URL(
        configured ||
          `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/socket`,
      );
      const token = localStorage.getItem("frontier-token");
      if (token) url.searchParams.set("token", token);
      url.searchParams.set("name", name);
      const ws = new WebSocket(url);
      socket.current = ws;
      ws.onmessage = (event) => {
        if (!alive) return;
        let message: ServerMessage;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (message.type === "welcome") {
          localStorage.setItem("frontier-token", message.token);
          attempt = 0;
          setStatus("connected");
        } else if (message.type === "state") {
          setView(message.view);
          setStatus("connected");
        } else if (message.type === "ack") {
          inflight.current.delete(message.id);
          setPending(inflight.current.size);
          notify(
            message.result.message,
            message.result.ok ? "success" : "error",
          );
        } else if (message.type === "error") {
          notify(message.message, "error");
        }
      };
      ws.onclose = () => {
        if (!alive) return;
        setStatus("reconnecting");
        if (inflight.current.size) {
          notify(
            "Connection interrupted. Check your colony before repeating an order.",
            "info",
          );
          inflight.current.clear();
          setPending(0);
        }
        retry = setTimeout(connect, Math.min(1000 * 2 ** attempt++, 10000));
      };
      ws.onerror = () => ws.close();
    };
    connect();
    const expire = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, sent] of inflight.current) {
        if (now - sent > 12000) {
          inflight.current.delete(id);
          changed = true;
        }
      }
      if (changed) {
        setPending(inflight.current.size);
        notify(
          "An order was not confirmed. Inspect the world before trying again.",
          "info",
        );
      }
    }, 3000);
    return () => {
      alive = false;
      clearTimeout(retry);
      clearInterval(expire);
      socket.current?.close();
    };
  }, [name, notify]);
  const send = useCallback(
    (command: Command) => {
      if (
        status !== "connected" ||
        (!hostedSend.current && socket.current?.readyState !== WebSocket.OPEN)
      ) {
        notify("Waiting for the world connection.", "error");
        return;
      }
      const id = crypto.randomUUID();
      inflight.current.set(id, Date.now());
      setPending(inflight.current.size);
      if (hostedSend.current) {
        hostedSend.current(id, command);
        return;
      }
      socket.current!.send(
        JSON.stringify({ type: "command", id, version: 1, command }),
      );
    },
    [status, notify],
  );
  return { view, status, pending, send, notices, notify };
}
