import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGameServer } from "../apps/server/src/server";
import { tickWorld } from "../packages/sim/src/index";
import { BUILDINGS, type BuildingType } from "@frontier/shared";
const directory = await mkdtemp(join(tmpdir(), "frontier-mechanics-ui-"));
const server = await createGameServer({
  port: 0,
  savePath: join(directory, "world.json"),
});
const address = server.address();
assert(address && typeof address !== "string");
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  args: ["--no-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
async function eventually(check: () => boolean, label: string) {
  for (let i = 0; i < 150; i++) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(label);
}
try {
  await page.goto(`http://127.0.0.1:${address.port}`);
  await page
    .getByLabel("WHAT SHOULD WE CALL YOU, CAPTAIN?")
    .fill("Systems Captain");
  await page.getByRole("button", { name: "Chart a new beginning" }).click();
  await page
    .getByRole("button", { name: "Establish settlement", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Build Crew bunk", exact: true })
    .waitFor();
  const colony = Object.values(server.world.colonies)[0];
  assert(colony?.systems);
  // Prepared-colony QA fixture: station construction is tested separately in the first E2E.
  colony.deposits = [];
  colony.resources.scrap = 100;
  colony.resources.fiber = 50;
  colony.resources.components = 25;
  colony.buildings.find((b) => b.type === "generator")!.health = 100;
  for (const [type, x, y] of [
    ["workshop", 36, 35],
    ["lab", 33, 33],
    ["infirmary", 27, 33],
    ["farm", 37, 31],
    ["pump", 35, 32],
    ["reservoir", 26, 34],
    ["battery", 34, 35],
  ] as [BuildingType, number, number][]) {
    colony.buildings.push({
      id: `qa-${type}`,
      type,
      x,
      y,
      built: true,
      progress: BUILDINGS[type].work,
      health: 100,
      reservedBy: null,
    });
  }
  tickWorld(server.world, 10);
  await page
    .getByRole("button", { name: "Frontier systems", exact: true })
    .click();
  await page.getByRole("button", { name: "Production", exact: true }).click();
  const food = colony.resources.rations;
  await page
    .getByRole("button", { name: "Queue Prepare rations", exact: true })
    .click();
  await eventually(
    () => colony.systems!.production.some((b) => b.recipeId === "rations"),
    "recipe queued",
  );
  tickWorld(server.world, 500);
  assert(colony.resources.rations > food, "staffed ration recipe completed");
  await page.getByRole("button", { name: "Research", exact: true }).click();
  await page
    .getByRole("button", { name: "Research Tidal hydraulics", exact: true })
    .click();
  await eventually(
    () => colony.systems!.researchProject === "hydraulics",
    "research selected",
  );
  tickWorld(server.world, 1400);
  assert(
    colony.systems!.unlocked.includes("hydraulics"),
    "staffed powered research completed",
  );
  const mara = colony.colonists.find((c) => c.name === "Mara Voss")!;
  mara.health = 55;
  mara.injuries = [
    { id: "qa-cut", kind: "cut", severity: 15, tended: false, infection: 0 },
  ];
  await page.getByRole("button", { name: "People", exact: true }).click();
  await page
    .getByRole("button", { name: "Tend Mara Voss", exact: true })
    .click();
  await eventually(
    () => colony.colonists.some((c) => c.task === "Tending"),
    "medical work assigned",
  );
  tickWorld(server.world, 450);
  assert(mara.health > 55, "medical treatment improved patient health");
  assert(
    !mara.injuries.some((i) => i.id === "qa-cut" && !i.tended),
    "wound treated",
  );
  await page.getByRole("button", { name: "Systems", exact: true }).click();
  await page.getByLabel("Work schedule").selectOption("rest");
  await eventually(
    () => colony.systems!.workPolicy === "rest",
    "work policy applied",
  );
  await page.getByRole("button", { name: /Enter safe shelter/ }).click();
  await eventually(() => colony.systems!.sheltered, "shelter activated");
  const before = JSON.stringify({
    resources: colony.resources,
    water: colony.systems!.water,
    health: colony.colonists.map((c) => c.health),
  });
  tickWorld(server.world, 300);
  assert.equal(
    JSON.stringify({
      resources: colony.resources,
      water: colony.systems!.water,
      health: colony.colonists.map((c) => c.health),
    }),
    before,
    "shelter freezes needs and production",
  );
  await page.getByRole("button", { name: /Resume colony/ }).click();
  await eventually(() => !colony.systems!.sheltered, "shelter exit");
  await page.getByRole("button", { name: "Expeditions", exact: true }).click();
  await page.getByRole("checkbox", { name: /Ivo Reed/ }).check();
  await page
    .getByRole("button", { name: "Dispatch expedition", exact: true })
    .click();
  await eventually(
    () => !!server.world.expeditions?.some((e) => e.phase === "outbound"),
    "expedition launched",
  );
  const expedition = server.world.expeditions!.find(
    (e) => e.ownerId === colony.ownerId,
  )!;
  tickWorld(server.world, 200);
  assert(
    ["combat", "exploring"].includes(expedition.phase),
    "expedition arrived",
  );
  await page
    .getByRole("button", { name: "Open tactical view", exact: true })
    .click();
  const canvas = page.getByLabel(/^Tactical encounter map\./);
  await canvas.waitFor();
  await page.waitForFunction(
    () => !!document.querySelector("canvas")?.getAttribute("data-origin-x"),
  );
  const geometry = await canvas.evaluate((el) => ({
    x: Number(el.getAttribute("data-origin-x")),
    y: Number(el.getAttribute("data-origin-y")),
    tile: Number(el.getAttribute("data-tile-size")),
  }));
  await canvas.click({
    position: {
      x: geometry.x + 6.5 * geometry.tile,
      y: geometry.y + 8.5 * geometry.tile,
    },
  });
  await eventually(
    () =>
      expedition.units.some(
        (u) =>
          u.ownerId === colony.ownerId &&
          ((u.moveTarget?.x === 6 && u.moveTarget?.y === 8) ||
            (u.x === 6 && u.y === 8)),
      ),
    "tactical move accepted",
  );
  await mkdir("artifacts", { recursive: true });
  await page.waitForFunction(
    () => document.querySelectorAll(".toast").length === 0,
  );
  await page.screenshot({ path: "artifacts/tactical-encounter.png" });
  await page
    .getByRole("button", { name: "Order retreat", exact: true })
    .first()
    .click();
  await eventually(
    () => expedition.retreating || expedition.phase === "returning",
    "retreat accepted",
  );
  tickWorld(server.world, 600);
  assert.equal(
    expedition.phase,
    "complete",
    "expedition extracted and returned",
  );
  assert(
    colony.colonists.every((c) => !c.away),
    "all crew back at home",
  );
  await page
    .getByRole("button", {
      name: "Return to colony from expedition",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Frontier systems", exact: true })
    .click();
  await page.getByRole("button", { name: "Systems", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".toast").length === 0,
  );
  await page.screenshot({ path: "artifacts/living-colony-systems.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS prepared-colony browser scenario: staffed production, powered research unlock, medical treatment, policies, shelter, deployment, tactical movement, retreat and crew return; no page errors.",
  );
} catch (error) {
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/mechanics-failure.png" });
  console.error((await page.locator("body").innerText()).slice(-2400));
  throw error;
} finally {
  await browser.close();
  await server.close();
  await rm(directory, { recursive: true, force: true });
}
