import { useEffect, useRef } from "react";
import {
  BUILDINGS,
  MAP_SIZE,
  type Building,
  type BuildingType,
  type GameView,
  type Site,
  type Terrain,
} from "@frontier/shared";
import { createTerrain } from "@frontier/sim";

export type WorldCanvasProps = {
  view: GameView;
  mode: "colony" | "region";
  selectedColonistId: string | null;
  buildType: BuildingType | null;
  onSelectColonist: (id: string | null) => void;
  onTileClick: (x: number, y: number) => void;
  onSelectSite: (id: string) => void;
  selectedSiteId: string | null;
  showGrid: boolean;
};

const TILE = 32;
const SIDE = MAP_SIZE * TILE;
const hash = (x: number, y: number, seed = 0) => {
  let n =
    Math.imul(x + seed * 17, 374761393) + Math.imul(y + seed * 31, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
const mix = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function rounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r = 3,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
function ellipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}
function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size = 10,
  color = "#c6d3bd",
  align: CanvasTextAlign = "left",
) {
  ctx.font = `500 ${size}px "Inter", system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}

function tree(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  n: number,
) {
  ellipse(ctx, x + 7 * s, y + 10 * s, 17 * s, 10 * s, "#071d2190");
  ctx.strokeStyle = "#64543b";
  ctx.lineWidth = 4 * s;
  ctx.beginPath();
  ctx.moveTo(x, y + 8 * s);
  ctx.lineTo(x - 1 * s, y - 15 * s);
  ctx.stroke();
  const colors = ["#254f41", "#366246", "#456f49", "#54794d"];
  for (let i = 0; i < 5; i++) {
    const a = i * 2.1 + n * 2;
    const r = (i === 4 ? 0 : 10) * s;
    ellipse(
      ctx,
      x + Math.cos(a) * r,
      y - 10 * s + Math.sin(a) * r * 0.7,
      (13 - i * 0.6) * s,
      (11 - i * 0.4) * s,
      colors[i % 4],
    );
  }
  ellipse(ctx, x - 4 * s, y - 16 * s, 6 * s, 3 * s, "#88a56655");
}

function coastPath(ctx: CanvasRenderingContext2D, terrain: Terrain[]) {
  ctx.beginPath();
  for (let y = 0; y < MAP_SIZE; y++)
    for (let x = 0; x < MAP_SIZE; x++) {
      if (terrain[y * MAP_SIZE + x] === "water") continue;
      const north = y === 0 || terrain[(y - 1) * MAP_SIZE + x] === "water";
      const south =
        y === MAP_SIZE - 1 || terrain[(y + 1) * MAP_SIZE + x] === "water";
      const west = x === 0 || terrain[y * MAP_SIZE + x - 1] === "water";
      const east =
        x === MAP_SIZE - 1 || terrain[y * MAP_SIZE + x + 1] === "water";
      ctx.roundRect(x * TILE, y * TILE, TILE, TILE, [
        north && west ? 12 : 0,
        north && east ? 12 : 0,
        south && east ? 12 : 0,
        south && west ? 12 : 0,
      ]);
    }
}

function makeTerrain(seed: number) {
  const terrain = createTerrain(seed);
  const canvas = document.createElement("canvas");
  canvas.width = SIDE;
  canvas.height = SIDE;
  const ctx = canvas.getContext("2d")!;
  coastPath(ctx, terrain);
  ctx.shadowColor = "#70af9960";
  ctx.shadowBlur = 90;
  ctx.fillStyle = "#315b54";
  ctx.fill();
  ctx.shadowBlur = 35;
  ctx.shadowColor = "#9bbd9255";
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#0c272c";
  ctx.lineWidth = 11;
  ctx.stroke();
  ctx.strokeStyle = "#8caba15c";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = "#a3996c";
  ctx.fillRect(0, 0, SIDE, SIDE);
  for (let y = 0; y < MAP_SIZE; y++)
    for (let x = 0; x < MAP_SIZE; x++) {
      const kind = terrain[y * MAP_SIZE + x];
      if (kind === "water") continue;
      const n = hash(x, y, seed);
      const px = x * TILE,
        py = y * TILE;
      if (kind === "sand")
        ctx.fillStyle = `hsl(${42 + n * 6} 20% ${48 + n * 7}%)`;
      if (kind === "grass")
        ctx.fillStyle = `hsl(${79 + n * 12} 19% ${30 + n * 9}%)`;
      if (kind === "rock")
        ctx.fillStyle = `hsl(${140 + n * 15} 7% ${32 + n * 7}%)`;
      if (kind === "deck") ctx.fillStyle = `hsl(164 9% ${27 + n * 5}%)`;
      ctx.fillRect(px, py, TILE, TILE);
      if (kind === "deck") {
        ctx.strokeStyle = "#162b2a50";
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        ctx.fillStyle = "#a9b29c38";
        ctx.fillRect(px + 4, py + 4, 2, 2);
        ctx.fillRect(px + 26, py + 26, 2, 2);
        if (n > 0.86) {
          ctx.fillStyle = "#9e754446";
          ctx.fillRect(px + 12, py + 4, 10, 25);
        }
      } else {
        for (let i = 0; i < 4; i++) {
          const xx = px + hash(x * 4 + i, y, seed) * TILE,
            yy = py + hash(x, y * 5 + i, seed) * TILE;
          ctx.fillStyle = i % 2 ? "#ece6b416" : "#172a211e";
          ctx.fillRect(xx, yy, 1 + hash(x + i, y, seed) * 4, 1.5);
        }
        if (kind === "grass" && n > 0.62) {
          ctx.strokeStyle = "#c9c59122";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px + 10, py + 20);
          ctx.lineTo(px + 8, py + 13);
          ctx.moveTo(px + 10, py + 20);
          ctx.lineTo(px + 14, py + 12);
          ctx.stroke();
        }
        if (kind === "rock" && n > 0.25) {
          ellipse(ctx, px + 19, py + 20, 13, 7, "#10292b30");
          ctx.fillStyle = "#5c6c60";
          ctx.beginPath();
          ctx.moveTo(px + 6, py + 19);
          ctx.lineTo(px + 12, py + 8);
          ctx.lineTo(px + 24, py + 10);
          ctx.lineTo(px + 29, py + 20);
          ctx.lineTo(px + 18, py + 25);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "#87918470";
          ctx.beginPath();
          ctx.moveTo(px + 12, py + 8);
          ctx.lineTo(px + 24, py + 10);
          ctx.lineTo(px + 29, py + 20);
          ctx.stroke();
        }
      }
    }
  ctx.restore();
  // Shoreline detail is decorative; the simulation's tile types remain authoritative.
  for (let y = 1; y < MAP_SIZE - 1; y++)
    for (let x = 1; x < MAP_SIZE - 1; x++) {
      const kind = terrain[y * MAP_SIZE + x];
      const n = hash(x, y, seed + 9);
      if (kind === "grass" && n > 0.84)
        tree(ctx, x * TILE + 16, y * TILE + 18, 0.85 + n * 0.3, n);
      if (kind === "water" && n > 0.94) {
        const near =
          terrain[y * MAP_SIZE + x - 1] !== "water" ||
          terrain[y * MAP_SIZE + x + 1] !== "water" ||
          terrain[(y - 1) * MAP_SIZE + x] !== "water" ||
          terrain[(y + 1) * MAP_SIZE + x] !== "water";
        if (near) {
          ellipse(ctx, x * TILE + 12, y * TILE + 19, 6, 3, "#326763");
          ellipse(ctx, x * TILE + 23, y * TILE + 10, 4, 2, "#477e71");
        }
      }
    }
  return { canvas, terrain };
}

let buildingArt: HTMLImageElement | null = null;
function loadedBuildingArt() {
  if (!buildingArt) {
    buildingArt = new Image();
    buildingArt.src = "/art/buildings-atlas.png";
  }
  return buildingArt.complete && buildingArt.naturalWidth > 0
    ? buildingArt
    : null;
}
function drawBuilding(
  ctx: CanvasRenderingContext2D,
  b: Building,
  time: number,
  power: number,
) {
  const x = b.x * TILE,
    y = b.y * TILE;
  ctx.save();
  ctx.translate(x, y);
  if (!b.built) {
    ctx.fillStyle = "#bfdcc820";
    ctx.fillRect(1, 1, 30, 30);
    ctx.strokeStyle = "#b7d1b9aa";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(2, 2, 28, 28);
    ctx.setLineDash([]);
    text(ctx, BUILDINGS[b.type].symbol, 16, 23, 21, "#c7dac6", "center");
    ctx.fillStyle = "#142c2b";
    ctx.fillRect(3, 28, 26, 3);
    ctx.fillStyle = "#c3bd83";
    ctx.fillRect(3, 28, 26 * mix(b.progress / BUILDINGS[b.type].work, 0, 1), 3);
    ctx.restore();
    return;
  }
  const art = loadedBuildingArt();
  const sprite = (
    { generator: 0, workshop: 1, foodStation: 2, bed: 3 } as Partial<
      Record<BuildingType, number>
    >
  )[b.type];
  if (art && sprite !== undefined) {
    const sw = art.naturalWidth / 2,
      sh = art.naturalHeight / 2;
    ctx.shadowColor = "#0009";
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 3;
    ctx.drawImage(
      art,
      (sprite % 2) * sw,
      Math.floor(sprite / 2) * sh,
      sw,
      sh,
      -6,
      -6,
      44,
      44,
    );
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    if (b.type === "generator" && power > 0) {
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = "#ffca5b44";
      ctx.beginPath();
      ctx.arc(16, 14, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }
    if (b.health < 90) {
      ctx.fillStyle = "#c37b47";
      ctx.fillRect(3, 31, 26, 2);
      ctx.fillStyle = "#f1d38e";
      ctx.fillRect(3, 31, (26 * b.health) / 100, 2);
    }
    ctx.restore();
    return;
  }
  ctx.shadowColor = "#06171966";
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 4;
  if (b.type === "floor") {
    ctx.fillStyle = "#66756a";
    ctx.fillRect(0, 0, 32, 32);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = "#344a43";
    ctx.lineWidth = 1;
    ctx.strokeRect(1, 1, 30, 30);
    ctx.strokeStyle = "#9aaa8444";
    ctx.beginPath();
    ctx.moveTo(3, 4);
    ctx.lineTo(28, 4);
    ctx.stroke();
  } else if (b.type === "wall") {
    ctx.fillStyle = "#263d3c";
    rounded(ctx, 0, -3, 32, 35, 2);
    ctx.fill();
    ctx.fillStyle = "#728175";
    ctx.fillRect(1, -3, 30, 11);
    ctx.fillStyle = "#8e9a85";
    ctx.fillRect(2, -3, 28, 3);
    ctx.fillStyle = "#465b51";
    ctx.fillRect(3, 10, 26, 17);
    ctx.strokeStyle = "#223e36";
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 13, 20, 11);
  } else if (b.type === "door") {
    ctx.fillStyle = "#889184";
    ctx.fillRect(1, 0, 30, 32);
    ctx.fillStyle = "#253e3d";
    ctx.fillRect(5, 2, 22, 28);
    ctx.fillStyle = "#516c5d";
    ctx.fillRect(6, 3, 20, 24);
    ctx.strokeStyle = "#b1ae74";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16, 6);
    ctx.lineTo(16, 23);
    ctx.stroke();
    ctx.fillStyle = "#c2caa5";
    ctx.fillRect(22, 13, 2, 5);
  } else if (b.type === "bed") {
    ctx.fillStyle = "#263d37";
    rounded(ctx, 5, 1, 22, 30, 2);
    ctx.fill();
    ctx.fillStyle = "#afaa7a";
    rounded(ctx, 7, 2, 18, 27, 2);
    ctx.fill();
    ctx.fillStyle = "#d5d5b3";
    rounded(ctx, 8, 3, 16, 7, 2);
    ctx.fill();
    ctx.fillStyle = "#657e71";
    ctx.fillRect(7, 12, 18, 16);
    ctx.fillStyle = "#809b83";
    ctx.fillRect(7, 12, 18, 3);
    ctx.fillStyle = "#365a4a";
    ctx.fillRect(7, 26, 18, 3);
  } else if (b.type === "stockpile") {
    ctx.fillStyle = "#786e4f";
    ctx.fillRect(1, 2, 30, 28);
    ctx.fillStyle = "#a69a6d";
    ctx.fillRect(2, 4, 28, 3);
    ctx.fillRect(2, 24, 28, 3);
    ctx.strokeStyle = "#c7b88766";
    ctx.strokeRect(2, 2, 28, 28);
    ctx.fillStyle = "#46594e";
    ctx.fillRect(5, 9, 10, 12);
    ctx.fillStyle = "#bc9b65";
    ctx.fillRect(18, 10, 10, 10);
    ctx.strokeStyle = "#776144";
    ctx.beginPath();
    ctx.moveTo(18, 10);
    ctx.lineTo(28, 20);
    ctx.moveTo(28, 10);
    ctx.lineTo(18, 20);
    ctx.stroke();
  } else if (b.type === "generator") {
    ctx.fillStyle = "#344a46";
    rounded(ctx, 1, 0, 30, 31, 3);
    ctx.fill();
    ctx.fillStyle = "#829080";
    ctx.fillRect(2, 0, 28, 7);
    ctx.fillStyle = "#475b4c";
    ctx.fillRect(4, 10, 24, 17);
    ctx.fillStyle = "#162e2c";
    ctx.beginPath();
    ctx.arc(16, 18, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(16, 18);
    ctx.rotate(power > 0 ? time * 0.003 : 0);
    ctx.fillStyle = "#a0aa8d";
    for (let j = 0; j < 3; j++) {
      ctx.rotate((Math.PI * 2) / 3);
      ctx.fillRect(-2, -7, 4, 7);
    }
    ctx.restore();
    ctx.fillStyle =
      b.health < 70 ? "#dd8f5f" : power > 0 ? "#bbe096" : "#695e48";
    ctx.fillRect(24, 4, 3, 3);
    if (power > 0) {
      ctx.shadowColor = "#cfcd81";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#c7cf8b";
      ctx.fillRect(5, 4, 8, 2);
    }
  } else if (b.type === "foodStation") {
    ctx.fillStyle = "#32483f";
    rounded(ctx, 1, 3, 30, 27, 2);
    ctx.fill();
    ctx.fillStyle = "#9da58e";
    ctx.fillRect(1, 3, 30, 9);
    ctx.fillStyle = "#566c5d";
    ctx.fillRect(3, 14, 26, 14);
    ctx.fillStyle = "#192d2c";
    ctx.beginPath();
    ctx.arc(11, 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#a7b19b";
    ctx.beginPath();
    ctx.arc(11, 8, 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#b9bd99";
    ctx.fillRect(20, 5, 7, 5);
    ctx.fillStyle = "#ddac6b";
    ctx.fillRect(7, 19, 10, 4);
    ctx.fillStyle = "#243a32";
    ctx.fillRect(22, 17, 4, 10);
  } else if (b.type === "workshop") {
    ctx.fillStyle = "#384c42";
    ctx.fillRect(0, 4, 32, 27);
    ctx.fillStyle = "#a39b76";
    ctx.fillRect(0, 1, 32, 11);
    ctx.fillStyle = "#c1b68b";
    ctx.fillRect(0, 1, 32, 2);
    ctx.fillStyle = "#5b6e56";
    ctx.fillRect(4, 15, 24, 13);
    ctx.fillStyle = "#243d36";
    ctx.fillRect(6, 18, 20, 6);
    ctx.fillStyle = "#879b79";
    ctx.fillRect(4, 4, 9, 6);
    ctx.fillStyle = "#d8ae66";
    ctx.fillRect(20, 5, 8, 3);
    ctx.strokeStyle = "#233d38";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16, 3);
    ctx.lineTo(18, 9);
    ctx.moveTo(16, 7);
    ctx.lineTo(23, 5);
    ctx.stroke();
  }
  if (
    [
      "pump",
      "farm",
      "infirmary",
      "lab",
      "battery",
      "recycler",
      "reservoir",
    ].includes(b.type)
  ) {
    ctx.fillStyle = "#1b3634";
    rounded(ctx, 0, 2, 32, 29, 3);
    ctx.fill();
    ctx.fillStyle = "#8f9579";
    ctx.fillRect(1, 1, 30, 7);
    ctx.fillStyle = "#af9a66";
    ctx.fillRect(1, 1, 30, 2);
    if (b.type === "farm") {
      ctx.fillStyle = "#4b4730";
      ctx.fillRect(3, 10, 26, 19);
      for (let i = 0; i < 6; i++) {
        const xx = 7 + (i % 3) * 8,
          yy = 15 + Math.floor(i / 3) * 9;
        ctx.fillStyle = "#8aa967";
        ctx.beginPath();
        ctx.ellipse(xx, yy, 4, 2, -0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (b.type === "reservoir") {
      ctx.fillStyle = "#529e9c";
      ctx.beginPath();
      ctx.ellipse(16, 17, 11, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#bdbe8d";
      ctx.stroke();
    } else {
      ctx.fillStyle = b.type === "infirmary" ? "#dbd7b7" : "#9dba9e";
      ctx.font = "19px Georgia";
      ctx.textAlign = "center";
      ctx.fillText(BUILDINGS[b.type].symbol, 16, 26);
      ctx.textAlign = "left";
    }
    ctx.fillStyle = power > 0 ? "#e8c875" : "#776747";
    ctx.fillRect(3, 27, 3, 2);
  }
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  if (b.health < 90) {
    ctx.strokeStyle = "#d49763";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, 4);
    ctx.lineTo(13, 13);
    ctx.lineTo(9, 20);
    ctx.stroke();
  }
  ctx.restore();
}

function blob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  seed: number,
  color: string,
) {
  ctx.beginPath();
  for (let j = 0; j <= 44; j++) {
    const a = (j / 44) * Math.PI * 2;
    const rr =
      r *
      (0.85 + 0.11 * Math.sin(a * 3 + seed) + 0.1 * Math.sin(a * 7 + seed * 2));
    const px = x + Math.cos(a) * rr,
      py = y + Math.sin(a) * rr * 0.64;
    if (j === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function regionPosition(site: Site, sites: Site[]) {
  const maxX = Math.max(...sites.map((s) => s.x), 100),
    maxY = Math.max(...sites.map((s) => s.y), 100);
  return { x: 100 + (site.x / maxX) * 1050, y: 85 + (site.y / maxY) * 650 };
}

export default function WorldCanvas(props: WorldCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    const canvas = canvasRef.current!;
    const host = hostRef.current!;
    const ctx = canvas.getContext("2d")!;
    let width = 1,
      height = 1,
      raf = 0,
      key = "",
      cameraData = "";
    let camera = { x: SIDE / 2, y: SIDE / 2, zoom: 0.65 };
    let hover: { x: number; y: number } | null = null;
    let dragging = false,
      space = false,
      moved = false;
    let pointer = { x: 0, y: 0 };
    const cached = new Map<number, ReturnType<typeof makeTerrain>>();
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const resize = () => {
      const r = host.getBoundingClientRect();
      width = Math.max(1, r.width);
      height = Math.max(1, r.height);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    const screenWorld = (x: number, y: number) => ({
      x: (x - width / 2) / camera.zoom + camera.x,
      y: (y - height / 2) / camera.zoom + camera.y,
    });
    const localPoint = (e: PointerEvent | WheelEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const pointerDown = (e: PointerEvent) => {
      canvas.focus({ preventScroll: true });
      pointer = localPoint(e);
      moved = false;
      dragging = e.button === 1 || e.button === 2 || space;
      canvas.setPointerCapture(e.pointerId);
      if (dragging) canvas.style.cursor = "grabbing";
    };
    const pointerMove = (e: PointerEvent) => {
      const p = localPoint(e);
      hover = p;
      if (canvas.hasPointerCapture(e.pointerId)) {
        const dx = p.x - pointer.x,
          dy = p.y - pointer.y;
        if (dragging) {
          camera.x -= dx / camera.zoom;
          camera.y -= dy / camera.zoom;
          camera.x = mix(camera.x, -300, SIDE + 300);
          camera.y = mix(camera.y, -300, SIDE + 300);
          moved = true;
        } else if (Math.abs(dx) + Math.abs(dy) > 5) moved = true;
      }
      pointer = p;
    };
    const pointerUp = (e: PointerEvent) => {
      if (canvas.hasPointerCapture(e.pointerId))
        canvas.releasePointerCapture(e.pointerId);
      if (!dragging && !moved && e.button === 0) {
        const p = localPoint(e),
          w = screenWorld(p.x, p.y),
          v = latest.current;
        if (v.mode === "region") {
          let closest: Site | null = null,
            best = 65;
          for (const site of v.view.sites) {
            const pos = regionPosition(site, v.view.sites),
              d = Math.hypot(w.x - pos.x, w.y - pos.y);
            if (d < best) {
              best = d;
              closest = site;
            }
          }
          if (closest) v.onSelectSite(closest.id);
        } else if (v.view.colony) {
          const colonist = !v.buildType
            ? v.view.colony.colonists
                .filter((c) => !c.away)
                .find(
                  (c) =>
                    Math.hypot(
                      w.x - (c.x + 0.5) * TILE,
                      w.y - (c.y + 0.5) * TILE,
                    ) <
                    TILE * 0.65,
                )
            : null;
          if (colonist) v.onSelectColonist(colonist.id);
          else {
            const x = Math.floor(w.x / TILE),
              y = Math.floor(w.y / TILE);
            if (x >= 0 && x < MAP_SIZE && y >= 0 && y < MAP_SIZE)
              v.onTileClick(x, y);
          }
        }
      }
      dragging = false;
      canvas.style.cursor = latest.current.buildType ? "crosshair" : "default";
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = localPoint(e),
        before = screenWorld(p.x, p.y);
      camera.zoom = mix(
        camera.zoom * Math.exp(-e.deltaY * 0.001),
        latest.current.mode === "region" ? 0.35 : 0.25,
        latest.current.mode === "region" ? 2 : 2.5,
      );
      const after = screenWorld(p.x, p.y);
      camera.x += before.x - after.x;
      camera.y += before.y - after.y;
    };
    const keyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        space = true;
        e.preventDefault();
        canvas.style.cursor = "grab";
      }
      const speed = 45 / camera.zoom;
      if (e.key === "ArrowLeft") camera.x -= speed;
      if (e.key === "ArrowRight") camera.x += speed;
      if (e.key === "ArrowUp") camera.y -= speed;
      if (e.key === "ArrowDown") camera.y += speed;
      if (e.key === "+" || e.key === "=")
        camera.zoom = mix(camera.zoom * 1.15, 0.25, 2.5);
      if (e.key === "-") camera.zoom = mix(camera.zoom / 1.15, 0.25, 2.5);
      if (e.key.startsWith("Arrow")) e.preventDefault();
    };
    const keyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        space = false;
        canvas.style.cursor = "default";
      }
    };
    const leave = () => {
      hover = null;
    };
    const context = (e: MouseEvent) => e.preventDefault();
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointerleave", leave);
    canvas.addEventListener("wheel", wheel, { passive: false });
    canvas.addEventListener("keydown", keyDown);
    canvas.addEventListener("keyup", keyUp);
    canvas.addEventListener("contextmenu", context);

    function draw(now: number) {
      const p = latest.current;
      const time = reduced ? 0 : now;
      const colony = p.view.colony;
      const site = p.view.sites.find((s) => s.id === colony?.siteId);
      const modeKey = p.mode + (site?.id || "");
      if (key !== modeKey) {
        key = modeKey;
        if (p.mode === "region")
          camera = {
            x: 625,
            y: 410,
            zoom: Math.min(width / 1320, height / 880),
          };
        else
          camera = {
            x: SIDE / 2,
            y: SIDE / 2,
            zoom: Math.max(0.55, Math.min(1.05, width / 1000, height / 760)),
          };
      }
      const nextCameraData = `${camera.x},${camera.y},${camera.zoom}`;
      if (nextCameraData !== cameraData) {
        cameraData = nextCameraData;
        canvas.dataset.cameraX = String(camera.x);
        canvas.dataset.cameraY = String(camera.y);
        canvas.dataset.cameraZoom = String(camera.zoom);
        canvas.dataset.tileSize = String(TILE);
      }
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const ocean = ctx.createLinearGradient(0, 0, width, height);
      ocean.addColorStop(0, "#163e43");
      ocean.addColorStop(0.55, "#16444a");
      ocean.addColorStop(1, "#0f3039");
      ctx.fillStyle = ocean;
      ctx.fillRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(camera.zoom, camera.zoom);
      ctx.translate(-camera.x, -camera.y);
      const start = screenWorld(0, 0),
        end = screenWorld(width, height);
      // Ocean currents and sparse sea foam; animation never changes simulation state.
      for (let y = Math.floor(start.y / 85) * 85; y < end.y + 85; y += 85)
        for (
          let x = Math.floor(start.x / 100) * 100;
          x < end.x + 100;
          x += 100
        ) {
          const n = hash(x, y, p.view.seed);
          const xx = x + n * 60,
            yy = y + Math.sin(time * 0.0003 + x * 0.002) * 5;
          ctx.strokeStyle = `rgba(142,193,178,${0.04 + n * 0.06})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(xx, yy);
          ctx.bezierCurveTo(xx + 18, yy - 4, xx + 31, yy + 5, xx + 50, yy);
          ctx.stroke();
          if (n > 0.88) {
            ctx.fillStyle = "#b6d4b439";
            ctx.fillRect(xx + 29, yy + 7, 2, 1);
            ctx.fillRect(xx + 35, yy + 6, 4, 1);
          }
        }
      if (p.mode === "region") drawRegion(ctx, p, time, camera.zoom);
      else if (colony && site) {
        if (!cached.has(site.seed))
          cached.set(site.seed, makeTerrain(site.seed));
        const map = cached.get(site.seed)!;
        ctx.drawImage(map.canvas, 0, 0);
        if (colony.systems && colony.systems.flood > 0) {
          const flood = colony.systems.flood;
          ctx.fillStyle = `rgba(43,140,155,${Math.min(0.4, flood / 200)})`;
          for (let y = 25; y < 40; y++)
            for (let x = 24; x < 40; x++)
              if ((x * 11 + y * 7) % 100 < flood)
                ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
          ctx.strokeStyle = "#b8e4db44";
          ctx.lineWidth = 1;
          for (let i = 0; i < 8; i++) {
            const yy = (27 + i * 1.4) * TILE + Math.sin(time * 0.001 + i) * 4;
            ctx.beginPath();
            ctx.moveTo(24 * TILE, yy);
            ctx.lineTo(40 * TILE, yy);
            ctx.stroke();
          }
        }

        // Submerged foundations at the edge of the mapped shelf.
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.translate(410, 1560);
        ctx.rotate(-0.35);
        ctx.fillStyle = "#0b2428";
        rounded(ctx, 0, 0, 180, 52, 16);
        ctx.fill();
        ctx.strokeStyle = "#89a193";
        ctx.lineWidth = 3;
        for (let i = 1; i < 6; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 28, 4);
          ctx.lineTo(i * 28, 48);
          ctx.stroke();
        }
        ctx.restore();
        if (p.showGrid || p.buildType) {
          ctx.strokeStyle = "#d6dec115";
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let i = 0; i <= MAP_SIZE; i++) {
            ctx.moveTo(i * TILE, 0);
            ctx.lineTo(i * TILE, SIDE);
            ctx.moveTo(0, i * TILE);
            ctx.lineTo(SIDE, i * TILE);
          }
          ctx.stroke();
        }
        for (const d of colony.deposits) {
          if (d.amount <= 0) continue;
          const x = (d.x + 0.5) * TILE,
            y = (d.y + 0.5) * TILE,
            n = hash(d.x, d.y, site.seed);
          if (d.resource === "fiber") {
            ctx.strokeStyle = "#3b644c";
            ctx.lineWidth = 3;
            for (let j = 0; j < 5; j++) {
              ctx.beginPath();
              ctx.moveTo(x + (j - 2) * 3, y + 7);
              ctx.quadraticCurveTo(
                x + (j - 2) * 6,
                y - 7,
                x + (j - 2) * 5,
                y - 12 - (j % 2) * 6,
              );
              ctx.stroke();
            }
            ellipse(ctx, x, y + 4, 10, 4, "#273f3222");
          } else {
            ellipse(ctx, x + 3, y + 7, 13, 6, "#122f2b60");
            ctx.fillStyle =
              d.resource === "components"
                ? "#a4b2a4"
                : d.resource === "fuel"
                  ? "#936e4b"
                  : "#6c8176";
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(n * 0.7 - 0.35);
            ctx.fillRect(-10, -6, 14, 10);
            ctx.fillStyle = "#9a9c78";
            ctx.fillRect(2, -3, 8, 12);
            ctx.fillStyle = "#344e48";
            ctx.fillRect(-7, -3, 8, 3);
            ctx.strokeStyle = "#a4ac8b70";
            ctx.strokeRect(-10, -6, 14, 10);
            ctx.restore();
          }
        }
        const buildings = [...colony.buildings].sort((a, b) => a.y - b.y);
        for (const b of buildings) drawBuilding(ctx, b, time, colony.power);
        const selected = colony.colonists.find(
          (c) => c.id === p.selectedColonistId,
        );
        if (selected?.target) {
          ctx.setLineDash([6, 7]);
          ctx.strokeStyle = "#dbd9ae88";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo((selected.x + 0.5) * TILE, (selected.y + 0.5) * TILE);
          ctx.lineTo(
            (selected.target.x + 0.5) * TILE,
            (selected.target.y + 0.5) * TILE,
          );
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.strokeRect(
            selected.target.x * TILE + 4,
            selected.target.y * TILE + 4,
            24,
            24,
          );
        }
        for (const c of colony.colonists
          .filter((c) => !c.away)
          .sort((a, b) => a.y - b.y)) {
          const x = (c.x + 0.5) * TILE,
            y = (c.y + 0.5) * TILE;
          const active = c.id === p.selectedColonistId;
          ellipse(ctx, x + 3, y + 8, 10, 5, "#102b2a70");
          if (active) {
            ctx.strokeStyle = "#efe2a7";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(x, y + 4, 14, 10, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = "#dfcc85";
            ctx.beginPath();
            ctx.moveTo(x, y - 30);
            ctx.lineTo(x - 4, y - 36);
            ctx.lineTo(x + 4, y - 36);
            ctx.closePath();
            ctx.fill();
          }
          ctx.fillStyle = "#203e39";
          rounded(ctx, x - 7, y - 9, 14, 18, 5);
          ctx.fill();
          ctx.fillStyle = c.color || "#a1b6a0";
          rounded(ctx, x - 6, y - 9, 12, 15, 4);
          ctx.fill();
          ctx.fillStyle = "#d1b98a";
          ctx.beginPath();
          ctx.arc(x, y - 13, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#4a5640";
          ctx.beginPath();
          ctx.ellipse(x, y - 15, 5.5, 3.5, 0, Math.PI, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#e4dbad";
          ctx.fillRect(x - 2, y - 4, 4, 5);
          if (c.drafted) {
            ctx.fillStyle = "#3c3c2b";
            ctx.fillRect(x + 5, y - 9, 3, 15);
            ctx.fillStyle = "#c6ae75";
            ctx.fillRect(x + 5, y - 9, 3, 4);
          }
          if (c.carrying) {
            ctx.fillStyle = "#ad9865";
            ctx.fillRect(x - 5, y + 1, 11, 8);
            ctx.strokeStyle = "#655b3c";
            ctx.lineWidth = 1;
            ctx.strokeRect(x - 5, y + 1, 11, 8);
            ctx.beginPath();
            ctx.moveTo(x - 4, y + 2);
            ctx.lineTo(x + 5, y + 8);
            ctx.stroke();
          }
          if (c.jobId && c.progress > 0) {
            ctx.strokeStyle = "#dfc58d";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(
              x,
              y,
              17,
              -Math.PI / 2,
              -Math.PI / 2 + Math.PI * 2 * (c.progress % 1 || 0.2),
            );
            ctx.stroke();
          }
          if (active || camera.zoom > 0.58) {
            const fontSize = 11 / camera.zoom;
            ctx.font = `600 ${fontSize}px system-ui`;
            const tw = ctx.measureText(c.name.split(" ")[0]).width;
            ctx.fillStyle = "#102b29cc";
            rounded(ctx, x - tw / 2 - 5, y + 17, tw + 10, 16 / camera.zoom, 3);
            ctx.fill();
            text(
              ctx,
              c.name.split(" ")[0],
              x,
              y + 17 + 11 / camera.zoom,
              fontSize,
              active ? "#ede5b9" : "#d3dccb",
              "center",
            );
          }
          if (c.health < 75) {
            ctx.fillStyle = "#132d2b";
            ctx.fillRect(x - 12, y - 25, 24, 3);
            ctx.fillStyle = "#da9c71";
            ctx.fillRect(x - 12, y - 25, (24 * c.health) / 100, 3);
          }
        }
        if (hover) {
          const w = screenWorld(hover.x, hover.y),
            x = Math.floor(w.x / TILE),
            y = Math.floor(w.y / TILE);
          if (x >= 0 && x < 64 && y >= 0 && y < 64) {
            const blocked =
              map.terrain[y * 64 + x] === "water" ||
              colony.buildings.some(
                (b) => b.x === x && b.y === y && b.type !== "floor",
              );
            ctx.strokeStyle = p.buildType
              ? blocked
                ? "#d99472"
                : "#e5d69f"
              : "#d1d6b34a";
            ctx.fillStyle = p.buildType
              ? blocked
                ? "#d9947225"
                : "#e5d69f20"
              : "#d1d6b30a";
            ctx.lineWidth = 2;
            ctx.fillRect(x * TILE + 1, y * TILE + 1, 30, 30);
            ctx.strokeRect(x * TILE + 1, y * TILE + 1, 30, 30);
            if (p.buildType)
              text(
                ctx,
                BUILDINGS[p.buildType].symbol,
                x * TILE + 16,
                y * TILE + 24,
                23,
                blocked ? "#d99472" : "#efe0ac",
                "center",
              );
          }
        }
      }
      ctx.restore();
      const vignette = ctx.createRadialGradient(
        width / 2,
        height / 2,
        height * 0.2,
        width / 2,
        height / 2,
        width * 0.72,
      );
      vignette.addColorStop(0, "#04191d00");
      vignette.addColorStop(1, "#061a234a");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);
      // Cartographic scale, legible regardless of zoom level.
      ctx.strokeStyle = "#b0c3ac80";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(24, height - 31);
      ctx.lineTo(24, height - 26);
      ctx.lineTo(84, height - 26);
      ctx.lineTo(84, height - 31);
      ctx.stroke();
      text(
        ctx,
        p.mode === "region" ? "REGIONAL CHART · 07" : "SHALLOWS · LOCAL SURVEY",
        24,
        height - 40,
        9,
        "#b7c9b385",
      );
      text(
        ctx,
        p.mode === "region"
          ? "20 nautical miles"
          : `${Math.round(60 / (TILE * camera.zoom))} meters`,
        94,
        height - 23,
        9,
        "#b7c9b380",
      );
      text(ctx, "N", width - 33, 37, 10, "#d0d2ac");
      ctx.strokeStyle = "#bbc5a8";
      ctx.beginPath();
      ctx.moveTo(width - 30, 46);
      ctx.lineTo(width - 30, 67);
      ctx.moveTo(width - 35, 52);
      ctx.lineTo(width - 30, 46);
      ctx.lineTo(width - 25, 52);
      ctx.stroke();
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("keydown", keyDown);
      canvas.removeEventListener("keyup", keyUp);
      canvas.removeEventListener("contextmenu", context);
      cached.clear();
    };
  }, []);
  return (
    <div
      ref={hostRef}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "#123b40",
      }}
    >
      <canvas
        ref={canvasRef}
        tabIndex={0}
        aria-label={
          props.mode === "region"
            ? "Regional world map. Click a settlement site to inspect it. Arrow keys pan; plus and minus zoom."
            : "Colony map. Click a crew member to select, then click a tile to move. Choose a building and click to place. Arrow keys pan; plus and minus zoom."
        }
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          outlineOffset: -3,
          cursor: props.buildType ? "crosshair" : "default",
          touchAction: "none",
        }}
      />
    </div>
  );
}

function drawRegion(
  ctx: CanvasRenderingContext2D,
  p: WorldCanvasProps,
  time: number,
  zoom: number,
) {
  const sites = p.view.sites;
  // Fine survey grid and routes establish a single connected regional world.
  ctx.strokeStyle = "#b5d1be0b";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < 1400; x += 100) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 900);
  }
  for (let y = 0; y < 900; y += 100) {
    ctx.moveTo(0, y);
    ctx.lineTo(1400, y);
  }
  ctx.stroke();
  ctx.setLineDash([3, 8]);
  ctx.strokeStyle = "#c3caa33a";
  ctx.lineWidth = 1;
  sites.forEach((s, i) => {
    if (i === sites.length - 1) return;
    const a = regionPosition(s, sites),
      b = regionPosition(sites[i + 1], sites);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo((a.x + b.x) / 2 + 28, (a.y + b.y) / 2 - 22, b.x, b.y);
    ctx.stroke();
  });
  ctx.setLineDash([]);
  for (const site of sites) {
    const pos = regionPosition(site, sites),
      n = hash(site.seed, 7),
      selected = site.id === p.selectedSiteId;
    const owner = p.view.players.find((pl) => pl.id === site.ownerId);
    const own = site.ownerId === p.view.you.id;
    const color = owner?.color || "#c4b784";
    blob(ctx, pos.x + 5, pos.y + 11, 65 + n * 12, site.seed, "#071f2638");
    blob(ctx, pos.x, pos.y, 69 + n * 12, site.seed, "#3a74706b");
    blob(ctx, pos.x, pos.y, 57 + n * 12, site.seed, "#8d9673");
    blob(
      ctx,
      pos.x - 2,
      pos.y - 3,
      49 + n * 9,
      site.seed,
      site.biome === "Canopy"
        ? "#4a694c"
        : site.biome === "Deep"
          ? "#4b6865"
          : "#667e5c",
    );
    for (let j = 0; j < 8; j++) {
      const a = j * 2.4,
        rad = 12 + hash(j, site.seed) * 28;
      const x = pos.x + Math.cos(a) * rad,
        y = pos.y + Math.sin(a) * rad * 0.5;
      if (j % 2 === 0 && site.biome !== "Deep") tree(ctx, x, y, 0.45, n);
      else {
        ctx.fillStyle = "#7e8777";
        ctx.fillRect(x - 4, y - 3, 8, 6);
        ctx.fillStyle = "#a2a68b";
        ctx.fillRect(x - 4, y - 3, 8, 2);
      }
    }
    if (selected) {
      ctx.strokeStyle = "#e6d4a1";
      ctx.lineWidth = 1.5 / zoom;
      ctx.setLineDash([4 / zoom, 6 / zoom]);
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y, 78 + n * 12, 54 + n * 7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = "#102e2e";
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 / zoom;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y - 8, 10 / zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (owner) {
      ctx.fillStyle = color;
      ctx.fillRect(pos.x - 3 / zoom, pos.y - 11 / zoom, 6 / zoom, 6 / zoom);
    } else {
      ctx.strokeStyle = "#d6c995";
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      ctx.moveTo(pos.x - 4 / zoom, pos.y - 8);
      ctx.lineTo(pos.x + 4 / zoom, pos.y - 8);
      ctx.moveTo(pos.x, pos.y - 8 - 4 / zoom);
      ctx.lineTo(pos.x, pos.y - 8 + 4 / zoom);
      ctx.stroke();
    }
    const font = 11 / zoom;
    ctx.font = `600 ${font}px system-ui`;
    const labelWidth = ctx.measureText(site.name.toUpperCase()).width;
    ctx.fillStyle = selected ? "#1a3532ed" : "#122f30db";
    rounded(
      ctx,
      pos.x - labelWidth / 2 - 10 / zoom,
      pos.y + 42,
      labelWidth + 20 / zoom,
      35 / zoom,
      4 / zoom,
    );
    ctx.fill();
    if (selected) {
      ctx.strokeStyle = "#a9a47766";
      ctx.lineWidth = 1 / zoom;
      ctx.stroke();
    }
    text(
      ctx,
      site.name.toUpperCase(),
      pos.x,
      pos.y + 42 + 14 / zoom,
      font,
      selected ? "#e7dba8" : "#d0d9c7",
      "center",
    );
    text(
      ctx,
      own
        ? "YOUR SETTLEMENT"
        : owner
          ? owner.name.toUpperCase()
          : `${site.biome.toUpperCase()} · UNCLAIMED`,
      pos.x,
      pos.y + 42 + 27 / zoom,
      8 / zoom,
      owner ? color : "#94b0a0",
      "center",
    );
  }
  text(
    ctx,
    "T H E   D R O W N E D   F R O N T I E R",
    630,
    36,
    13,
    "#bfceb445",
    "center",
  );
  text(
    ctx,
    "SURVEY OFFICE  /  SECTOR 07  /  EBB TIDE",
    630,
    61,
    8,
    "#b1c7ad38",
    "center",
  );
  // Small bioluminescent eddies in unmapped water.
  for (let j = 0; j < 12; j++) {
    const x = 80 + hash(j, 42) * 1100,
      y = 130 + hash(j, 98) * 600;
    const a = 0.12 + 0.08 * Math.sin(time * 0.0007 + j);
    ellipse(ctx, x, y, 1.7, 1.7, `rgba(164,211,169,${a})`);
  }
}
