import { createGameServer } from "./server.js";

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be an integer between 1 and 65535");
const server = await createGameServer({
  port,
  host: process.env.HOST ?? "127.0.0.1",
  savePath: process.env.FRONTIER_SAVE_PATH,
});
console.log(
  `The Drowned Frontier server: http://${process.env.HOST ?? "127.0.0.1"}:${port}`,
);
console.log(
  "Local/invited prototype. Do not expose this server publicly; identity uses device resume tokens.",
);
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    server
      .close()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(
          error instanceof Error ? error.message : "Shutdown failed",
        );
        process.exit(1);
      });
  });
