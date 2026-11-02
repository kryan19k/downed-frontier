import { useEffect, useRef, useState } from "react";
import type { GameView, Command, CombatUnit } from "@frontier/shared";
import { getEncounterObstacles } from "@frontier/sim";
import "./tactical.css";
type Props = {
  view: GameView;
  expeditionId: string;
  onCommand: (command: Command) => void;
};
export default function TacticalCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null),
    hostRef = useRef<HTMLDivElement>(null),
    latest = useRef(props);
  latest.current = props;
  const [selected, setSelected] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selected;
  const expedition = props.view.expeditions?.find(
    (e) => e.id === props.expeditionId,
  );
  const own =
    expedition?.units.filter(
      (u) => u.ownerId === props.view.you.id && !u.downed,
    ) ?? [];
  useEffect(() => {
    if (!own.some((u) => u.id === selected)) setSelected(own[0]?.id ?? null);
  }, [own.map((u) => u.id).join(","), selected]);
  useEffect(() => {
    const canvas = canvasRef.current!,
      host = hostRef.current!,
      ctx = canvas.getContext("2d")!;
    let width = 1,
      height = 1,
      raf = 0,
      tile = 20,
      origin = { x: 0, y: 0 };
    const resize = () => {
      const r = host.getBoundingClientRect();
      width = r.width;
      height = r.height;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    const order = (x: number, y: number) => {
      const p = latest.current,
        exp = p.view.expeditions?.find((e) => e.id === p.expeditionId);
      if (!exp || !["combat", "exploring"].includes(exp.phase)) return;
      const all = (p.view.expeditions ?? [])
        .filter((e) => e.siteId === exp.siteId)
        .flatMap((e) =>
          e.units.filter(
            (u) =>
              u.ownerId === "wildlife" ||
              ["combat", "exploring"].includes(e.phase),
          ),
        );
      const clicked = all.find((u) => u.x === x && u.y === y);
      if (clicked?.ownerId === p.view.you.id && !clicked.downed) {
        setSelected(clicked.id);
        return;
      }
      const unitId = selectedRef.current;
      if (!unitId) return;
      if (clicked && !clicked.downed)
        p.onCommand({
          type: "expeditionAttack",
          expeditionId: exp.id,
          unitId,
          targetId: clicked.id,
        });
      else if (x >= 0 && y >= 0 && x < 32 && y < 32)
        p.onCommand({
          type: "expeditionOrder",
          expeditionId: exp.id,
          unitId,
          x,
          y,
        });
    };
    const click = (e: PointerEvent) => {
      canvas.focus();
      const r = canvas.getBoundingClientRect();
      order(
        Math.floor((e.clientX - r.left - origin.x) / tile),
        Math.floor((e.clientY - r.top - origin.y) / tile),
      );
    };
    const key = (e: KeyboardEvent) => {
      const p = latest.current,
        exp = p.view.expeditions?.find((e) => e.id === p.expeditionId),
        unit = exp?.units.find((u) => u.id === selectedRef.current);
      if (!exp || !unit) return;
      const delta: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
      };
      const d = delta[e.key];
      if (d) {
        e.preventDefault();
        const x = Math.max(0, Math.min(31, unit.x + d[0])),
          y = Math.max(0, Math.min(31, unit.y + d[1]));
        p.onCommand({
          type: "expeditionOrder",
          expeditionId: exp.id,
          unitId: unit.id,
          x,
          y,
        });
      }
    };
    canvas.addEventListener("pointerdown", click);
    canvas.addEventListener("keydown", key);
    function draw(now: number) {
      const p = latest.current,
        exp = p.view.expeditions?.find((e) => e.id === p.expeditionId);
      const ratio = Math.min(devicePixelRatio || 1, 2);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const grad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        30,
        width * 0.5,
        height * 0.5,
        width * 0.7,
      );
      grad.addColorStop(0, "#225053");
      grad.addColorStop(1, "#091e28");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      tile = Math.max(
        8,
        Math.min((width - (width > 1000 ? 540 : 80)) / 32, (height - 260) / 32),
      );
      origin = { x: width / 2 - tile * 16, y: height / 2 - tile * 16 + 10 };
      canvas.dataset.tileSize = String(tile);
      canvas.dataset.originX = String(origin.x);
      canvas.dataset.originY = String(origin.y);
      const obstacles = new Set(
        getEncounterObstacles(exp?.siteId ?? "salvage-reef").map(
          (o) => `${o.x},${o.y}`,
        ),
      );
      for (let y = 0; y < 32; y++)
        for (let x = 0; x < 32; x++) {
          const px = origin.x + x * tile,
            py = origin.y + y * tile,
            n = ((x * 37 + y * 19) % 17) / 17;
          ctx.fillStyle = obstacles.has(`${x},${y}`)
            ? "#576b61"
            : (x + y) % 5 === 0
              ? "#48534a"
              : "#344a44";
          ctx.fillRect(px, py, tile, tile);
          ctx.strokeStyle = "#152f2d55";
          ctx.strokeRect(px + 0.5, py + 0.5, tile - 1, tile - 1);
          if (obstacles.has(`${x},${y}`)) {
            ctx.fillStyle = "#829083";
            ctx.fillRect(px + 2, py + 2, tile - 4, tile * 0.22);
            ctx.fillStyle = "#182b29";
            ctx.fillRect(
              px + tile * 0.65,
              py + tile * 0.4,
              tile * 0.25,
              tile * 0.45,
            );
          } else if (n > 0.82) {
            ctx.fillStyle = "#a3986b30";
            ctx.fillRect(
              px + tile * 0.2,
              py + tile * 0.25,
              tile * 0.1,
              tile * 0.4,
            );
          }
        }
      ctx.strokeStyle = "#b5a06e88";
      ctx.lineWidth = 2;
      ctx.strokeRect(origin.x - 3, origin.y - 3, tile * 32 + 6, tile * 32 + 6);
      // The safe entrance is visible; retreat still follows the server's travel/escape rules.
      ctx.fillStyle = "#81c8b122";
      ctx.fillRect(origin.x, origin.y + tile * 13, tile * 4, tile * 6);
      ctx.fillStyle = "#b4d2bb";
      ctx.font = "9px system-ui";
      ctx.fillText("LANDING", origin.x + 4, origin.y + tile * 13 - 5);
      const visible = exp
        ? (p.view.expeditions ?? [])
            .filter((e) => e.siteId === exp.siteId)
            .flatMap((e) =>
              e.units.filter(
                (u) =>
                  u.ownerId === "wildlife" ||
                  ["combat", "exploring"].includes(e.phase),
              ),
            )
        : [];
      const units = new Map<string, CombatUnit>();
      for (const u of visible) units.set(u.id, u);
      for (const u of units.values()) {
        const x = origin.x + (u.x + 0.5) * tile,
          y = origin.y + (u.y + 0.5) * tile,
          ours = u.ownerId === p.view.you.id,
          hostile = u.ownerId === "wildlife",
          active = u.id === selectedRef.current;
        if (active) {
          ctx.strokeStyle = "#ffe5a5";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, tile * 0.53, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = u.downed
          ? "#7c8174"
          : ours
            ? "#83c8bb"
            : hostile
              ? "#ce8d67"
              : "#c7a3ce";
        ctx.shadowColor = "#0008";
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.ellipse(x, y, tile * 0.25, tile * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#f3d4a3";
        ctx.beginPath();
        ctx.arc(x, y - tile * 0.2, tile * 0.13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#101c20";
        ctx.fillRect(x - tile * 0.35, y + tile * 0.4, tile * 0.7, 3);
        ctx.fillStyle = ours ? "#b6cc89" : "#d68e72";
        ctx.fillRect(
          x - tile * 0.35,
          y + tile * 0.4,
          tile * 0.7 * Math.max(0, u.health / u.maxHealth),
          3,
        );
        if (active || tile > 20) {
          ctx.fillStyle = "#e2dbc3";
          ctx.font = "9px system-ui";
          ctx.textAlign = "center";
          ctx.fillText(u.name.split(" ")[0], x, y - tile * 0.55);
          ctx.textAlign = "left";
        }
        const target = units.get(u.targetId ?? "");
        if (target && !u.downed) {
          ctx.setLineDash([3, 5]);
          ctx.strokeStyle = "#e9b07166";
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(
            origin.x + (target.x + 0.5) * tile,
            origin.y + (target.y + 0.5) * tile,
          );
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      if (exp && ["outbound", "returning", "complete"].includes(exp.phase)) {
        ctx.fillStyle = "#06191bc9";
        ctx.fillRect(origin.x, origin.y, tile * 32, tile * 32);
        ctx.fillStyle = "#ead6a8";
        ctx.font = "25px Georgia";
        ctx.textAlign = "center";
        ctx.fillText(
          exp.phase === "complete"
            ? "Expedition concluded"
            : exp.phase === "returning"
              ? "Returning to the colony"
              : "Crossing frontier waters",
          width / 2,
          height / 2,
        );
        ctx.font = "12px system-ui";
        ctx.fillText(
          exp.phase === "complete"
            ? "Your crew and recovered supplies are home."
            : `${Math.max(0, Math.ceil((exp.arrivalTick - p.view.tick) / 10))} seconds to arrival`,
          width / 2,
          height / 2 + 28,
        );
        ctx.textAlign = "left";
      }
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", click);
      canvas.removeEventListener("keydown", key);
    };
  }, []);
  return (
    <div className="tactical-stage" ref={hostRef}>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        aria-label="Tactical encounter map. Select your crew, click a hostile to attack, or click a tile to move. Arrow keys move the selected crew."
      />
      <div className="tactical-title">
        <span>EXPEDITION COMMAND</span>
        <h2>
          {props.view.expeditionSites?.find((s) => s.id === expedition?.siteId)
            ?.name ?? "Frontier encounter"}
        </h2>
        <p>
          {expedition?.phase.toUpperCase()} · Click crew to select · Click
          target to attack
        </p>
      </div>
      <div className="tactical-squad">
        {own.map((u) => (
          <button
            key={u.id}
            className={u.id === selected ? "selected" : ""}
            onClick={() => setSelected(u.id)}
          >
            {u.name.split(" ")[0]} <b>{Math.ceil(u.health)} HP</b>
          </button>
        ))}
        {expedition && expedition.phase !== "complete" && (
          <button
            className="retreat"
            onClick={() =>
              props.onCommand({
                type: "expeditionRetreat",
                expeditionId: expedition.id,
              })
            }
          >
            Order retreat
          </button>
        )}
      </div>
      <div className="tactical-log" aria-live="polite">
        {expedition?.log
          .slice(0, 3)
          .map((line, i) => <p key={`${i}-${line}`}>{line}</p>)}
      </div>
    </div>
  );
}
