import { chromium, type Page } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { createGameServer } from "../apps/server/src/server";

const temporary = await mkdtemp(join(tmpdir(), "frontier-browser-"));
const server = await createGameServer({
  port: 0,
  savePath: join(temporary, "world.json"),
});
const address = server.address();
assert(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;
const executablePath =
  process.env.CHROMIUM_PATH ||
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ["--no-sandbox"],
});
const errors: string[] = [];
async function eventually(
  check: () => boolean,
  description: string,
  timeout = 25000,
) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timed out: ${description}`);
}
async function captain(page: Page, name: string, colony: string) {
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin);
  await page.getByLabel("WHAT SHOULD WE CALL YOU, CAPTAIN?").fill(name);
  await page.getByRole("button", { name: "Chart a new beginning" }).click();
  await page.getByLabel("NAME YOUR SETTLEMENT").fill(colony);
  await page
    .getByRole("button", { name: "Establish settlement", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Build Crew bunk", exact: true })
    .waitFor();
  await eventually(
    () => Object.values(server.world.colonies).some((c) => c.name === colony),
    "settlement created",
  );
}
async function clickTile(page: Page, x: number, y: number) {
  const map = page.getByLabel(/^Colony map\./);
  await map.waitFor();
  const bounds = await map.boundingBox();
  assert(bounds);
  await page.waitForFunction(
    () => !!document.querySelector("canvas")?.getAttribute("data-camera-zoom"),
  );
  const camera = await map.evaluate((el) => ({
    x: Number(el.getAttribute("data-camera-x")),
    y: Number(el.getAttribute("data-camera-y")),
    zoom: Number(el.getAttribute("data-camera-zoom")),
    tile: Number(el.getAttribute("data-tile-size")),
  }));
  await map.click({
    position: {
      x: bounds.width / 2 + ((x + 0.5) * camera.tile - camera.x) * camera.zoom,
      y: bounds.height / 2 + ((y + 0.5) * camera.tile - camera.y) * camera.zoom,
    },
  });
}
try {
  const aContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const bContext = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    reducedMotion: "reduce",
  });
  const a = await aContext.newPage(),
    b = await bContext.newPage();
  await captain(a, "Captain A", "Saltwake Haven");
  await captain(b, "Captain B", "Lantern Anchorage");
  await a.getByRole("button", { name: "Your colony", exact: true }).click();
  await b.getByRole("button", { name: "Your colony", exact: true }).click();
  assert.equal(Object.keys(server.world.colonies).length, 2);
  const colonyA = Object.values(server.world.colonies).find(
    (c) => c.name === "Saltwake Haven",
  )!;
  const colonyB = Object.values(server.world.colonies).find(
    (c) => c.name === "Lantern Anchorage",
  )!;
  assert.notEqual(colonyA.siteId, colonyB.siteId);

  // Build through the actual canvas projection, then let authoritative crew finish it.
  await a.getByRole("button", { name: "Build Crew bunk", exact: true }).click();
  await clickTile(a, 27, 30);
  await eventually(
    () =>
      colonyA.buildings.some(
        (s) => s.type === "bed" && s.x === 27 && s.y === 30,
      ),
    "canvas placed a real blueprint",
  );
  await a.keyboard.press("Escape");
  await a.getByRole("button", { name: /Repair Tidal generator/ }).click();

  // Both alliance consent and the exchange run through independent browser sessions.
  await a.getByRole("button", { name: "Diplomacy", exact: true }).click();
  await b.getByRole("button", { name: "Diplomacy", exact: true }).click();
  await a
    .getByRole("button", { name: "Propose alliance to Captain B", exact: true })
    .click();
  await b
    .getByRole("button", {
      name: "Accept alliance with Captain A",
      exact: true,
    })
    .click();
  await eventually(
    () => server.world.alliances.length === 1,
    "bilateral alliance",
  );
  await a
    .getByRole("button", { name: "Propose exchange", exact: true })
    .click();
  await b.getByRole("button", { name: "Accept", exact: true }).click();
  await eventually(
    () => server.world.offers.some((o) => o.status === "accepted"),
    "escrow exchange accepted",
  );
  assert.equal(
    server.world.offers.filter((o) => o.status === "accepted").length,
    1,
  );

  // Reload is a reconnect, not a new captain or another starting package.
  const token = await b.evaluate(() => localStorage.getItem("frontier-token"));
  await b.reload();
  await b
    .getByRole("button", { name: "Build Crew bunk", exact: true })
    .waitFor();
  assert.equal(
    await b.evaluate(() => localStorage.getItem("frontier-token")),
    token,
  );
  assert.equal(Object.keys(server.world.players).length, 2);
  await eventually(
    () => colonyA.buildings.find((s) => s.type === "generator")?.health === 100,
    "crew repairs the generator",
  );
  await eventually(
    () =>
      !!colonyA.buildings.find(
        (s) => s.type === "bed" && s.x === 27 && s.y === 30,
      )?.built,
    "crew completes a bunk",
    45000,
  );

  // Direct control, priority changes, and movement use actual crew ownership.
  await a.getByRole("button", { name: "Your colony", exact: true }).click();
  await a
    .getByRole("button", { name: /Mara Voss/ })
    .first()
    .click();
  await a.getByRole("button", { name: /Take direct control/ }).click();
  const mara = colonyA.colonists.find((c) => c.name === "Mara Voss")!;
  await eventually(() => mara.drafted, "draft crew");
  await clickTile(a, 34, 28);
  await eventually(
    () => mara.x === 34 && mara.y === 28,
    "direct move reaches tile",
  );
  await a.getByLabel("WORK PRIORITY").selectOption("build");
  await eventually(() => mara.priority === "build", "work priority changed");
  await a.getByRole("button", { name: /Return to autonomous work/ }).click();
  await eventually(() => !mara.drafted, "release crew to work");
  await a.keyboard.press("Escape");

  await a.getByRole("button", { name: "Your colony", exact: true }).click();
  const cameraCanvas = a.getByLabel(/^Colony map\./);
  await cameraCanvas.focus();
  const beforePan = await cameraCanvas.getAttribute("data-camera-x");
  await a.keyboard.press("ArrowRight");
  await a.waitForFunction(
    (old) =>
      document.querySelector("canvas")?.getAttribute("data-camera-x") !== old,
    beforePan,
  );
  const beforeZoom = await cameraCanvas.getAttribute("data-camera-zoom");
  await a.keyboard.press("+");
  await a.waitForFunction(
    (old) =>
      document.querySelector("canvas")?.getAttribute("data-camera-zoom") !==
      old,
    beforeZoom,
  );
  const grid = a.getByRole("button", { name: "Toggle grid", exact: true });
  await grid.click();
  assert.equal(await grid.getAttribute("aria-pressed"), "true");
  await grid.click();
  // Reset the camera and let transient order feedback expire before capturing evidence.
  await a.getByRole("button", { name: "Regional map", exact: true }).click();
  await a.getByRole("button", { name: "Your colony", exact: true }).click();
  await a.waitForFunction(
    () => document.querySelectorAll(".toast").length === 0,
  );
  await mkdir("artifacts", { recursive: true });
  await a.screenshot({ path: "artifacts/colony.png" });
  await a
    .getByRole("button", { name: "Hide command panel", exact: true })
    .click();
  const stage = await a.locator(".world-stage").boundingBox();
  assert(
    stage && stage.width === 1440 && stage.height === 1000,
    "world fills the viewport",
  );
  assert.equal(
    await a.locator(".inspector").getAttribute("aria-hidden"),
    "true",
  );
  await a.screenshot({ path: "artifacts/fullscreen-colony.png" });
  await a
    .getByRole("button", { name: "Show command panel", exact: true })
    .click();
  await a.getByRole("button", { name: "Regional map", exact: true }).click();
  await a.screenshot({ path: "artifacts/region.png" });
  await a
    .getByRole("button", { name: "Open field guide", exact: true })
    .first()
    .click();
  await a.getByRole("dialog").waitFor();
  await a.getByRole("button", { name: "Close dialog", exact: true }).click();
  assert.deepEqual(errors, [], "no browser runtime errors");
  // Removing a misplaced built structure is recoverable and refunds only once.
  await a.getByRole("button", { name: "Your colony", exact: true }).click();
  await a.locator("summary").filter({ hasText: "Structures" }).click();
  await a
    .getByRole("button", { name: "Dismantle Crew bunk at 27,30", exact: true })
    .click();
  await eventually(
    () =>
      !colonyA.buildings.some(
        (s) => s.type === "bed" && s.x === 27 && s.y === 30,
      ),
    "dismantle finished structure",
  );
  assert.deepEqual(errors, [], "no browser runtime errors after demolition");
  console.log(
    "PASS: two browser captains, distinct claims, canvas construction, crew repair, bilateral alliance, escrow trade, reload identity, completed work, draft/move/priorities, demolition, map/guide controls, no page errors.",
  );
} finally {
  await browser.close();
  await server.close();
  await rm(temporary, { recursive: true, force: true });
}
