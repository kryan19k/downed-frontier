import { performance } from "node:perf_hooks";
import { cpus, platform, arch } from "node:os";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import {
  createWorld,
  joinWorld,
  applyCommand,
  tickWorld,
} from "../packages/sim/src/index";
const world = createWorld(70823);
for (let i = 0; i < 4; i++) {
  const actor = `load-${i}`;
  joinWorld(world, actor, `Load captain ${i}`);
  assert(
    applyCommand(world, actor, {
      type: "claim",
      siteId: world.sites[i].id,
      name: `Load colony ${i}`,
      scenario: "last-shift",
    }).ok,
  );
  const c = world.colonies[world.players[actor].colonyId!];
  for (const [x, y] of [
    [27, 30],
    [27, 31],
  ])
    assert(
      applyCommand(world, actor, { type: "build", building: "bed", x, y }).ok,
    );
  assert(
    applyCommand(world, actor, {
      type: "build",
      building: "workshop",
      x: 36,
      y: 35,
    }).ok,
  );
  assert(
    applyCommand(world, actor, {
      type: "repair",
      buildingId: c.buildings.find((b) => b.type === "generator")!.id,
    }).ok,
  );
}
const times: number[] = [];
const started = performance.now();
for (let i = 0; i < 36000; i++) {
  const before = performance.now();
  tickWorld(world);
  times.push(performance.now() - before);
}
const duration = performance.now() - started;
for (const colony of Object.values(world.colonies)) {
  for (const amount of Object.values(colony.resources))
    assert(Number.isInteger(amount) && amount >= 0);
  for (const item of [...colony.buildings, ...colony.deposits])
    if (item.reservedBy)
      assert(
        colony.colonists.some(
          (c) => c.id === item.reservedBy && c.jobId === item.id,
        ),
      );
  assert(
    colony.colonists.every((c) => c.x >= 0 && c.x < 64 && c.y >= 0 && c.y < 64),
  );
}
times.sort((a, b) => a - b);
const percentile = (p: number) =>
  Number(
    times[Math.min(times.length - 1, Math.floor(times.length * p))].toFixed(4),
  );
const result = {
  kind: "accelerated headless simulation; not a live network or browser load test",
  node: process.version,
  platform: platform(),
  arch: arch(),
  cpu: cpus()[0]?.model,
  seed: world.seed,
  colonies: 4,
  colonists: 12,
  ticks: 36000,
  simulatedSeconds: 3600,
  wallMilliseconds: Math.round(duration),
  tickMilliseconds: {
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
    max: Number(times.at(-1)!.toFixed(4)),
  },
  invariants:
    "nonnegative integer inventory, valid positions, no orphan reservations",
};
await mkdir("artifacts", { recursive: true });
await writeFile(
  "artifacts/performance.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
