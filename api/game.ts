import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash } from "node:crypto";
import {
  createHostedEngine,
  hostedStoreFromEnvironment,
} from "../apps/server/src/hosted.js";
export const config = { maxDuration: 30 };
type Request = IncomingMessage & { body?: unknown };
function reply(res: ServerResponse, status: number, messages: unknown[]) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  res.end(JSON.stringify({ messages }));
}
export default async function game(req: Request, res: ServerResponse) {
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      reply(res, 405, [{ type: "error", message: "GET or POST required." }]);
      return;
    }
    const origin = req.headers.origin;
    if (origin) {
      try {
        if (new URL(origin).host !== req.headers.host) {
          reply(res, 403, [
            {
              type: "error",
              message: "Cross-origin world requests are not allowed.",
            },
          ]);
          return;
        }
      } catch {
        reply(res, 403, [
          { type: "error", message: "Invalid request origin." },
        ]);
        return;
      }
    }
    if (Number(req.headers["content-length"] ?? 0) > 16384) {
      reply(res, 413, [
        { type: "error", message: "Request body is too large." },
      ]);
      return;
    }
    let payload: unknown;
    if (req.method === "GET") payload = { action: "state" };
    else if (req.body !== undefined) {
      if (
        Buffer.byteLength(
          typeof req.body === "string" ? req.body : JSON.stringify(req.body),
        ) > 16384
      ) {
        reply(res, 413, [
          { type: "error", message: "Request body is too large." },
        ]);
        return;
      }
      try {
        payload =
          typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      } catch {
        reply(res, 400, [{ type: "error", message: "Invalid JSON request." }]);
        return;
      }
    } else {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += bytes.length;
        if (size > 16384) {
          reply(res, 413, [
            { type: "error", message: "Request body is too large." },
          ]);
          return;
        }
        chunks.push(bytes);
      }
      try {
        payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        reply(res, 400, [{ type: "error", message: "Invalid JSON request." }]);
        return;
      }
    }
    const store = await hostedStoreFromEnvironment();
    const forwarded = req.headers["x-forwarded-for"];
    const address =
      typeof forwarded === "string"
        ? forwarded.split(",")[0].trim()
        : (req.socket.remoteAddress ?? "anonymous");
    const requester = createHash("sha256").update(address).digest("hex");
    if (
      store.allowRequest &&
      !(await store.allowRequest("requester:" + requester, 1, 20))
    ) {
      reply(res, 429, [
        {
          type: "error",
          message: "Hosted request rate exceeded. Retry shortly.",
        },
      ]);
      return;
    }

    const header = req.headers.authorization;
    const bearer =
      typeof header === "string" && header.startsWith("Bearer ")
        ? header.slice(7)
        : undefined;
    const result = await createHostedEngine(store).handle(payload, bearer);
    reply(res, result.status, result.messages);
  } catch (error) {
    const missing =
      error instanceof Error &&
      error.message.startsWith("Hosted world storage is not configured");
    reply(res, 503, [
      {
        type: "error",
        message: missing
          ? error.message
          : "Hosted world storage is unavailable. Your saved state was preserved; retry shortly.",
      },
    ]);
  }
}
