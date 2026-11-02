import { useEffect, useState, type FormEvent } from "react";
import {
  Anchor,
  Waves,
  Droplets,
  Compass,
  Hammer,
  Users,
  Globe2,
  Settings,
  BookOpen,
  Heart,
  Utensils,
  Moon,
  Zap,
  Shield,
  Radio,
  ArrowUpRight,
  ArrowLeft,
  Plus,
  X,
  Check,
  ChevronRight,
  Package,
  Leaf,
  Wrench,
  Flame,
  Activity,
  Flag,
  Send,
  Grid3X3,
  HelpCircle,
  Home,
  ChevronDown,
  MousePointer2,
  Maximize2,
  Layers,
  Sun,
  Clock,
  Handshake,
  Info,
} from "lucide-react";
import {
  BUILDINGS,
  RESOURCE_LABELS,
  type BuildingType,
  type Colonist,
  type Colony,
  type Resource,
  type GameView,
  type Command,
} from "@frontier/shared";
import WorldCanvas from "./WorldCanvas";
import MechanicsPanel from "./MechanicsPanel";
import TacticalCanvas from "./TacticalCanvas";
import { useFrontier } from "./useFrontier";
const resourceIcons = {
  scrap: Package,
  fiber: Leaf,
  rations: Utensils,
  components: Wrench,
  medicine: Heart,
  fuel: Flame,
};
const resources = Object.keys(RESOURCE_LABELS) as Resource[];
const buildOrder = Object.keys(BUILDINGS) as BuildingType[];
const scenarios = [
  {
    id: "last-shift",
    name: "The Last Shift",
    text: "Three engineers. A broken outpost. One more chance.",
    tag: "ENGINEERING",
  },
  {
    id: "lifeboat",
    name: "The Lifeboat",
    text: "A close-knit crew with enough supplies to begin again.",
    tag: "SURVIVAL",
  },
  {
    id: "seedkeepers",
    name: "The Seedkeepers",
    text: "Keepers of the old world, carrying the seeds of the next.",
    tag: "CULTIVATION",
  },
];
function Meter({
  value,
  label,
  icon: Icon,
}: {
  value: number;
  label: string;
  icon: typeof Heart;
}) {
  return (
    <div className="need">
      <span>
        <Icon size={12} />
        {label}
      </span>
      <div className="meter">
        <i
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
          className={value < 30 ? "low" : ""}
        />
      </div>
      <b>{Math.round(value)}%</b>
    </div>
  );
}
function Cost({ type }: { type: BuildingType }) {
  return (
    <span className="cost">
      {Object.entries(BUILDINGS[type].cost).map(([r, n]) => (
        <span key={r}>
          {n} {RESOURCE_LABELS[r as Resource]}
        </span>
      ))}
    </span>
  );
}
function WorldClock({ tick }: { tick: number }) {
  const s = Math.floor(tick / 10);
  return (
    <span>
      {String(Math.floor(s / 3600)).padStart(2, "0")}:
      {String(Math.floor(s / 60) % 60).padStart(2, "0")}:
      {String(s % 60).padStart(2, "0")}
    </span>
  );
}
export default function App() {
  const [name, setName] = useState<string | null>(() =>
    localStorage.getItem("frontier-name"),
  );
  const [nameInput, setNameInput] = useState("");
  const { view, status, pending, send, notices, notify } = useFrontier(name);
  const [mode, setMode] = useState<"colony" | "region">("region");
  const [panel, setPanel] = useState<
    "overview" | "crew" | "relations" | "frontier"
  >("overview");
  const [selectedColonistId, setSelectedColonistId] = useState<string | null>(
    null,
  );
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [buildType, setBuildType] = useState<BuildingType | null>(null);
  const [tacticalId, setTacticalId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [modal, setModal] = useState<"help" | "settings" | null>(null);
  const [colonyName, setColonyName] = useState("New Anchorage");
  const [scenario, setScenario] = useState("last-shift");
  const [showLog, setShowLog] = useState(false);
  const [claimPending, setClaimPending] = useState(false);
  const [previousColony, setPreviousColony] = useState<string | null>(null);
  const colony = view?.colony;
  const selected = colony?.colonists.find((c) => c.id === selectedColonistId);
  const site = view?.sites.find((s) => s.id === selectedSiteId);
  const ownSite = view?.sites.find((s) => s.id === colony?.siteId);
  const connected = status === "connected";
  useEffect(() => {
    if (colony && colony.id !== previousColony) {
      setPreviousColony(colony.id);
      setPanelOpen(true);
      setMode("colony");
      setClaimPending(false);
    }
  }, [colony, previousColony]);
  useEffect(() => {
    if (view && !selectedSiteId)
      setSelectedSiteId(
        view.sites.find((s) => !s.ownerId)?.id || view.sites[0]?.id || null,
      );
  }, [view, selectedSiteId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.matches("input,select,textarea")) return;
      if (e.key.toLowerCase() === "i" && !modal) {
        e.preventDefault();
        setPanelOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setBuildType(null);
        setSelectedColonistId(null);
        setModal(null);
      }
      if (e.key.toLowerCase() === "g") setShowGrid((g) => !g);
      if (e.key.toLowerCase() === "m") {
        setMode((m) => (m === "region" && colony ? "colony" : "region"));
        setBuildType(null);
      }
      if (e.key === "?") setModal("help");
      const n = Number(e.key);
      if (n >= 1 && n <= 8 && colony) {
        setMode("colony");
        setBuildType(buildOrder[n - 1]);
        setSelectedColonistId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [colony]);
  useEffect(() => {
    if (
      tacticalId &&
      !(view?.expeditions || []).some(
        (e) => e.id === tacticalId && e.phase !== "complete",
      )
    )
      setTacticalId(null);
  }, [view, tacticalId]);
  useEffect(() => {
    if (mode === "region") setTacticalId(null);
  }, [mode]);
  function begin(e: FormEvent) {
    e.preventDefault();
    const clean = nameInput.trim().slice(0, 24);
    if (!clean) return;
    localStorage.setItem("frontier-name", clean);
    setName(clean);
  }
  function selectCrew(id: string | null) {
    setSelectedColonistId(id);
    if (id) {
      setBuildType(null);
      setPanel("crew");
      setPanelOpen(true);
    }
  }
  function tileClick(x: number, y: number) {
    if (!colony || tacticalId) return;
    if (buildType) send({ type: "build", building: buildType, x, y });
    else if (selectedColonistId)
      send({ type: "move", colonistId: selectedColonistId, x, y });
    else
      notify("Select a crew member to move, or choose a structure to build.");
  }
  function claim() {
    if (!site || !colonyName.trim()) return;
    send({
      type: "claim",
      siteId: site.id,
      name: colonyName.trim().slice(0, 32),
      scenario,
    });
    setClaimPending(true);
    setTimeout(() => setClaimPending(false), 3000);
  }
  return (
    <div
      className={`frontier-app immersive ${panelOpen ? "panel-open" : "panel-closed"}`}
    >
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setMode("region");
          }}
          aria-label="Drowned Frontier regional map"
        >
          <span className="brand-mark">
            <Anchor size={23} />
          </span>
          <span>
            <strong>
              The Drowned Frontier<span className="brand-dot">.</span>
            </strong>
            <small>A WORLD WORTH REBUILDING</small>
          </span>
        </a>
        <div className="world-badge">
          <span className="world-orbit">
            <Globe2 size={16} />
          </span>
          <span>
            THE SHALLOWS<small>Frontier world · Prototype 0.1</small>
          </span>
          <ChevronDown size={12} />
        </div>
        <div className="top-actions">
          <button
            className="icon-button"
            aria-label="Toggle fullscreen"
            title="Toggle fullscreen"
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
              else
                void document.documentElement
                  .requestFullscreen()
                  .catch(() =>
                    notify("Fullscreen is unavailable in this browser."),
                  );
            }}
          >
            <Maximize2 size={18} />
          </button>
          <span className={`connection ${connected ? "live" : ""}`}>
            <i />
            {connected
              ? "WORLD CONNECTED"
              : status === "waiting"
                ? "AWAITING CAPTAIN"
                : status === "connecting"
                  ? "CONNECTING"
                  : "RECONNECTING"}
          </span>
          <button
            className="icon-button"
            title="Field guide (?)"
            aria-label="Open field guide"
            onClick={() => setModal("help")}
          >
            <HelpCircle size={19} />
          </button>
          <button
            className="icon-button"
            title="Settings"
            aria-label="Open settings"
            onClick={() => setModal("settings")}
          >
            <Settings size={19} />
          </button>
          <span className="captain-avatar" title={name || "Your captain"}>
            {(name || "?").slice(0, 1).toUpperCase()}
          </span>
        </div>
      </header>
      <div className="resourcebar">
        <div className="outpost-label">
          <Flag size={15} />
          <span>
            {colony?.name || "UNCHARTED OPPORTUNITY"}
            <small>
              {colony ? "YOUR SETTLEMENT" : "CHOOSE YOUR BEGINNING"}
            </small>
          </span>
        </div>
        <div className="resource-items">
          {resources.map((r) => {
            const Icon = resourceIcons[r];
            return (
              <div
                className={`resource resource-${r}`}
                key={r}
                title={`${RESOURCE_LABELS[r]} in colony storage`}
              >
                <Icon size={17} />
                <span>
                  <b>{colony ? colony.resources[r] : "—"}</b>
                  <small>{RESOURCE_LABELS[r]}</small>
                </span>
              </div>
            );
          })}
          <div className="resource resource-water">
            <Droplets size={17} />
            <span>
              <b>{colony?.systems ? Math.floor(colony.systems.water) : "—"}</b>
              <small>Water</small>
            </span>
          </div>
          <div className="resource">
            <Zap size={17} />
            <span>
              <b>{colony ? (colony.power > 0 ? "Online" : "Offline") : "—"}</b>
              <small>Power</small>
            </span>
          </div>
          <div className="resource">
            <Users size={17} />
            <span>
              <b>{colony?.colonists.length ?? "—"}</b>
              <small>Survivors</small>
            </span>
          </div>
        </div>
        <div className="world-clock">
          <Sun size={18} />
          <span>
            <b>{view ? <WorldClock tick={view.tick} /> : "—"}</b>
            <small>SHARED WORLD TIME</small>
          </span>
        </div>
      </div>
      <div className="workspace">
        <nav
          className="rail"
          aria-label="Game views"
          onClickCapture={(e) => {
            const b = (e.target as HTMLElement).closest("button");
            if (
              b &&
              [
                "Your colony",
                "Regional map",
                "Crew inspector",
                "Diplomacy",
              ].includes(b.getAttribute("aria-label") || "")
            )
              setPanelOpen(true);
          }}
        >
          <div>
            <button
              title="Your colony"
              aria-label="Your colony"
              className={mode === "colony" ? "active" : ""}
              disabled={!colony}
              onClick={() => {
                setTacticalId(null);
                setMode("colony");
                setPanel("overview");
              }}
            >
              <Home size={21} />
              <span>Architect</span>
            </button>
            <button
              title="Regional map (M)"
              aria-label="Regional map"
              className={mode === "region" ? "active" : ""}
              onClick={() => {
                setMode("region");
                setBuildType(null);
              }}
            >
              <Compass size={22} />
              <span>World</span>
            </button>
            <button
              title="Crew"
              aria-label="Crew inspector"
              className={mode === "colony" && panel === "crew" ? "active" : ""}
              disabled={!colony}
              onClick={() => {
                setTacticalId(null);
                setMode("colony");
                setPanel("crew");
                setPanelOpen(true);
              }}
            >
              <Users size={21} />
              <span>Orders</span>
            </button>
            <button
              title="Diplomacy"
              aria-label="Diplomacy"
              className={panel === "relations" ? "active" : ""}
              disabled={!colony}
              onClick={() => {
                setPanel("relations");
                setMode("colony");
              }}
            >
              <Handshake size={22} />
              <span>Diplomacy</span>
            </button>
            <button
              className="frontier-nav-button"
              aria-label="Frontier systems"
              title="Systems, production, research and expeditions"
              disabled={!colony}
              onClick={() => {
                setPanel("frontier");
                setPanelOpen(true);
                setMode("colony");
              }}
            >
              <Activity size={21} />
              <span>Frontier</span>
            </button>
          </div>
          <div>
            <button
              title="Event journal"
              aria-label="Toggle event journal"
              className={showLog ? "active" : ""}
              onClick={() => setShowLog((v) => !v)}
            >
              <BookOpen size={20} />
              <span>Journal</span>
            </button>
            <button
              title="Field guide"
              aria-label="Open field guide"
              onClick={() => setModal("help")}
            >
              <HelpCircle size={21} />
              <span>Guide</span>
            </button>
            <span className="rail-coordinate">34° N</span>
          </div>
        </nav>
        <main className="game-main">
          <div className="map-heading">
            <div>
              <span className="eyebrow">
                {mode === "region"
                  ? "REGIONAL CHART · 01"
                  : "PROTECTED HOME TERRITORY"}
              </span>
              <h1>
                {mode === "region"
                  ? "A new world awaits."
                  : colony?.name || "Your outpost"}
              </h1>
              <p>
                {mode === "region"
                  ? "Eight places to begin. An ocean of possibilities."
                  : `${ownSite?.subtitle || "An outpost on the edge of the world"} · ${colony?.colonists.length || 0} survivors`}
              </p>
            </div>
            <div className="map-heading-actions">
              {mode === "region" && colony && (
                <button
                  className="light-button"
                  onClick={() => setMode("colony")}
                >
                  <ArrowLeft size={14} />
                  Return home
                </button>
              )}
              <button
                className={`map-toggle ${showGrid ? "selected" : ""}`}
                title="Toggle grid (G)"
                aria-label="Toggle grid"
                aria-pressed={showGrid}
                onClick={() => setShowGrid((v) => !v)}
              >
                <Grid3X3 size={17} />
              </button>
            </div>
          </div>
          <div className="world-stage">
            {view && tacticalId ? (
              <>
                <TacticalCanvas
                  view={view}
                  expeditionId={tacticalId}
                  onCommand={send}
                />
                <button
                  className="tactical-return"
                  aria-label="Return to colony from expedition"
                  onClick={() => setTacticalId(null)}
                >
                  <ArrowLeft size={14} />
                  Return to home waters
                </button>
              </>
            ) : view ? (
              <WorldCanvas
                view={view}
                mode={mode}
                selectedColonistId={selectedColonistId}
                buildType={buildType}
                onSelectColonist={selectCrew}
                onTileClick={tileClick}
                onSelectSite={(id) => {
                  setSelectedSiteId(id);
                  setPanelOpen(true);
                }}
                selectedSiteId={selectedSiteId}
                showGrid={showGrid}
              />
            ) : (
              <div className="empty-ocean">
                <div className="ocean-rings" />
                <Anchor size={38} />
                <span>
                  {name
                    ? "Finding your place in the frontier…"
                    : "Beyond the horizon, a beginning."}
                </span>
              </div>
            )}
            <div className="map-top-left">
              <span className="map-status">
                <i />
                {mode === "region"
                  ? "THE FRONTIER"
                  : colony?.storm
                    ? "STORM FRONT"
                    : "TEMPERATE WATERS"}
              </span>
              {mode === "colony" && (
                <span className="safe-tag">
                  <Shield size={12} />
                  Protected settlement
                </span>
              )}
            </div>
            <div className="map-top-right">
              <Waves size={15} />
              <span>{mode === "region" ? "SHARED WORLD" : "THE SHALLOWS"}</span>
            </div>
            <div className="map-bottom-left">
              <MousePointer2 size={13} />
              <span>
                {buildType
                  ? `Place ${BUILDINGS[buildType].name} · Esc to cancel`
                  : selected
                    ? `${selected.name} selected · Click land to move`
                    : mode === "region"
                      ? "Select a charted site to inspect"
                      : "Click a survivor to inspect"}
              </span>
            </div>
            <div className="map-bottom-right">
              <span>Scroll to zoom</span>
              <i />
              Drag to pan
            </div>
            {showLog && view && (
              <div className="journal">
                <div className="journal-heading">
                  <BookOpen size={15} />
                  <strong>Outpost journal</strong>
                  <button
                    aria-label="Close journal"
                    onClick={() => setShowLog(false)}
                  >
                    <X size={15} />
                  </button>
                </div>
                <EventList events={colony?.events || view.events} />
              </div>
            )}
            {!connected && name && (
              <div className="reconnect-banner">
                <Radio size={14} />
                {status === "connecting"
                  ? "Connecting to world server…"
                  : "Connection lost. Retrying automatically; the world continues."}
              </div>
            )}
          </div>
          <div
            className="construction-bar"
            style={tacticalId ? { display: "none" } : undefined}
          >
            {mode === "colony" && colony && !tacticalId ? (
              <>
                <div className="toolbar-label">
                  <Hammer size={18} />
                  <span>
                    BUILD<small>Choose & place</small>
                  </span>
                </div>
                <div className="build-options">
                  {buildOrder.map((b, i) => {
                    const def = BUILDINGS[b];
                    const affordable = Object.entries(def.cost).every(
                      ([r, n]) => colony.resources[r as Resource] >= (n || 0),
                    );
                    return (
                      <button
                        key={b}
                        data-building={b}
                        className={`build-option ${buildType === b ? "selected" : ""} ${!affordable ? "unaffordable" : ""}`}
                        title={`${def.name} — ${def.description} Costs ${Object.entries(
                          def.cost,
                        )
                          .map(
                            ([r, n]) =>
                              `${n} ${RESOURCE_LABELS[r as Resource]}`,
                          )
                          .join(", ")}.${i < 8 ? ` Shortcut ${i + 1}` : ""}`}
                        aria-label={`Build ${def.name}`}
                        aria-pressed={buildType === b}
                        disabled={!connected}
                        onClick={() => {
                          setBuildType(buildType === b ? null : b);
                          setSelectedColonistId(null);
                        }}
                      >
                        <span className="build-key">{i < 8 ? i + 1 : "+"}</span>
                        <span className="build-symbol">{def.symbol}</span>
                        <span className="build-name">{def.name}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  className="cancel-tool"
                  title="Cancel placement (Esc)"
                  aria-label="Cancel placement"
                  disabled={!buildType}
                  onClick={() => setBuildType(null)}
                >
                  <X size={17} />
                </button>
              </>
            ) : (
              <>
                <div className="toolbar-label">
                  <Compass size={20} />
                  <span>
                    YOUR NEXT CHAPTER
                    <small>Starts with a place to call home</small>
                  </span>
                </div>
                <div className="region-legend">
                  <span>
                    <i className="legend-available" />
                    Available site
                  </span>
                  <span>
                    <i className="legend-claimed" />
                    Established colony
                  </span>
                  <span>
                    <Shield size={14} />
                    Protected home territory
                  </span>
                </div>
                <span className="chart-stamp">FRONTIER SURVEY / 01</span>
              </>
            )}
          </div>
          <footer className="statusbar">
            <span>
              <span className="status-dot" />
              {view
                ? `${view.onlinePlayers?.length ?? view.players.length} captain${(view.onlinePlayers?.length ?? view.players.length) === 1 ? "" : "s"} in the world`
                : "Shared-world colony survival"}
            </span>
            <span>
              {pending
                ? `${pending} order${pending === 1 ? "" : "s"} awaiting confirmation`
                : "Server-authoritative simulation"}
              <span className="footer-separator">·</span>10 ticks / second
            </span>
            <button onClick={() => setModal("help")}>
              Controls <kbd>?</kbd>
            </button>
          </footer>
        </main>
        <button
          className="inspector-toggle"
          aria-label={panelOpen ? "Hide command panel" : "Show command panel"}
          onClick={() => setPanelOpen((v) => !v)}
        >
          <Layers size={16} />
          {panelOpen ? "Hide panel" : "Command panel"}
          <kbd>I</kbd>
        </button>
        {colony && (
          <div className="crew-dock" aria-label="Crew quick selection">
            <h3 className="roster-heading">
              <Users size={15} /> Survivors ({colony.colonists.length})
            </h3>
            {colony.colonists.map((c, i) => (
              <button
                key={c.id}
                onClick={() => selectCrew(c.id)}
                aria-label={`Inspect ${c.name}`}
                className={`${selectedColonistId === c.id ? "chosen" : ""} ${c.away ? "away" : ""}`}
              >
                <span className="portrait" data-portrait={i} />
                <strong>{c.name}</strong>
                <span className="roster-role">{c.role}</span>
                <span className="roster-task">
                  {c.away ? "On expedition" : c.task}
                </span>
                <span className="roster-health">
                  ♥ {Math.round(c.health)}% · {Math.round(c.morale)} morale
                </span>
                <span className="crew-health">
                  <i style={{ width: `${c.health}%` }} />
                </span>
              </button>
            ))}
            <section className="roster-overview">
              <h3>Colony Overview</h3>
              <Meter
                value={
                  colony.colonists.reduce((n, c) => n + c.morale, 0) /
                  colony.colonists.length
                }
                label="Morale"
                icon={Sun}
              />
              <Meter
                value={
                  colony.colonists.reduce((n, c) => n + c.hunger, 0) /
                  colony.colonists.length
                }
                label="Nutrition"
                icon={Utensils}
              />
              <Meter
                value={
                  colony.colonists.reduce((n, c) => n + c.energy, 0) /
                  colony.colonists.length
                }
                label="Rest"
                icon={Moon}
              />
              <p>
                <Shield size={12} /> Protected home waters
              </p>
            </section>
          </div>
        )}
        <aside
          className={`inspector ${panel === "frontier" ? "frontier-inspector" : ""}`}
          aria-hidden={!panelOpen}
          inert={!panelOpen}
        >
          {panel === "frontier" && colony && view && mode === "colony" ? (
            <div className="inspector-scroll">
              <MechanicsPanel
                view={view}
                send={send}
                connected={connected}
                onTactical={(id) => {
                  setTacticalId(id);
                  setBuildType(null);
                  setSelectedColonistId(null);
                }}
              />
            </div>
          ) : mode === "region" ? (
            <>
              <div className="inspector-title">
                <span className="eyebrow">
                  {colony ? "FRONTIER ATLAS" : "A PLACE TO BEGIN"}
                </span>
                <h2>
                  {colony ? "Beyond your shores" : "Choose your foothold"}
                </h2>
                <p>
                  {colony
                    ? "Discover your neighbors and the waters between."
                    : "Every outpost has a different story. Where will yours begin?"}
                </p>
              </div>
              <div className="inspector-scroll">
                {site ? (
                  <>
                    <div className={`site-art art-${site.biome.toLowerCase()}`}>
                      <span className="site-number">
                        SITE{" "}
                        {String(
                          (view?.sites.findIndex((s) => s.id === site.id) ||
                            0) + 1,
                        ).padStart(2, "0")}
                      </span>
                      <div className="art-sun" />
                      <div className="art-island" />
                      <span className="site-biome">
                        <Waves size={12} />
                        {site.biome}
                      </span>
                    </div>
                    <div className="site-detail">
                      <span className="eyebrow">
                        {site.ownerId
                          ? "ESTABLISHED SETTLEMENT"
                          : "UNCLAIMED TERRITORY"}
                      </span>
                      <h3>{site.name}</h3>
                      <p>{site.subtitle}</p>
                      <div className="site-stats">
                        <div>
                          <Package size={14} />
                          <span>Resource potential</span>
                          <b>
                            {site.richness >= 4
                              ? "Abundant"
                              : site.richness >= 2
                                ? "Promising"
                                : "Modest"}
                          </b>
                        </div>
                        <div>
                          <Activity size={14} />
                          <span>Local pressure</span>
                          <b>{site.hazard}</b>
                        </div>
                        <div>
                          <Shield size={14} />
                          <span>Home protection</span>
                          <b>Always active</b>
                        </div>
                      </div>
                    </div>
                    {!colony && !site.ownerId ? (
                      <div className="claim-form">
                        <label htmlFor="colony-name">
                          NAME YOUR SETTLEMENT
                        </label>
                        <input
                          id="colony-name"
                          maxLength={32}
                          value={colonyName}
                          onChange={(e) => setColonyName(e.target.value)}
                          placeholder="New Anchorage"
                        />
                        <label htmlFor="scenario">YOUR ORIGIN</label>
                        <select
                          id="scenario"
                          value={scenario}
                          onChange={(e) => setScenario(e.target.value)}
                        >
                          {scenarios.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <p className="scenario-copy">
                          {scenarios.find((s) => s.id === scenario)?.text}
                        </p>
                        <button
                          className="primary-button claim-button"
                          disabled={
                            !connected || claimPending || !colonyName.trim()
                          }
                          onClick={claim}
                        >
                          <Flag size={15} />
                          {claimPending
                            ? "Establishing…"
                            : "Establish settlement"}
                          <ArrowUpRight size={16} />
                        </button>
                        <span className="claim-note">
                          One home. Three survivors. Your story.
                        </span>
                      </div>
                    ) : (
                      <div className="site-owner">
                        <Flag size={14} />
                        {site.ownerId
                          ? `Claimed by ${view?.players.find((p) => p.id === site.ownerId)?.name || "another captain"}`
                          : "Available for a new captain"}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="empty-panel">
                    <Compass size={30} />
                    <p>Select a site on the chart.</p>
                  </div>
                )}
                <div className="site-list-heading">
                  CHARTED LOCATIONS <span>{view?.sites.length || 0}</span>
                </div>
                <div className="site-list">
                  {view?.sites.map((s, i) => (
                    <button
                      key={s.id}
                      className={s.id === selectedSiteId ? "selected" : ""}
                      onClick={() => setSelectedSiteId(s.id)}
                    >
                      <span className="site-index">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>
                        <strong>{s.name}</strong>
                        <small>
                          {s.biome} · {s.ownerId ? "Claimed" : "Available"}
                        </small>
                      </span>
                      {s.ownerId ? (
                        <Flag size={13} />
                      ) : (
                        <ChevronRight size={14} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : colony && view ? (
            <>
              <div className="inspector-tabs">
                <button
                  className={panel === "overview" ? "selected" : ""}
                  onClick={() => setPanel("overview")}
                >
                  Outpost
                </button>
                <button
                  className={panel === "crew" ? "selected" : ""}
                  onClick={() => setPanel("crew")}
                >
                  Crew <span>{colony.colonists.length}</span>
                </button>
                <button
                  className={panel === "relations" ? "selected" : ""}
                  onClick={() => setPanel("relations")}
                >
                  Relations
                </button>
              </div>
              <div className="inspector-scroll">
                {panel === "overview" ? (
                  <>
                    <div className="colony-heading">
                      <span className="eyebrow">SETTLEMENT OVERVIEW</span>
                      <h2>
                        A home, against
                        <br />
                        the tide.
                      </h2>
                      <p>
                        Your people keep working while you plan their next
                        chapter.
                      </p>
                    </div>
                    <div className="overview-stats">
                      <div>
                        <Users size={17} />
                        <b>{colony.colonists.length}</b>
                        <small>Survivors</small>
                      </div>
                      <div>
                        <Zap size={17} />
                        <b>{colony.power > 0 ? "Online" : "Offline"}</b>
                        <small>Power grid</small>
                      </div>
                      <div>
                        <Home size={17} />
                        <b>{colony.buildings.filter((b) => b.built).length}</b>
                        <small>Structures</small>
                      </div>
                    </div>
                    <FirstSteps
                      colony={colony}
                      send={send}
                      connected={connected}
                      onBuild={(b) => {
                        setBuildType(b);
                        setSelectedColonistId(null);
                      }}
                    />
                    <SectionTitle
                      icon={Users}
                      title="Your people"
                      meta="LIVE"
                    />
                    <div className="crew-list">
                      {colony.colonists.map((c) => (
                        <CrewRow
                          key={c.id}
                          colonist={c}
                          selected={false}
                          onClick={() => selectCrew(c.id)}
                        />
                      ))}
                    </div>
                    <SectionTitle icon={Hammer} title="Work & production" />
                    <div className="production-card">
                      <div>
                        <span className="production-icon">
                          <Wrench size={18} />
                        </span>
                        <span>
                          <strong>Automatic production</strong>
                          <small>Use available galley & fabricator</small>
                        </span>
                        <button
                          className={`switch ${colony.autoCraft ? "on" : ""}`}
                          aria-label="Toggle automatic production"
                          aria-pressed={colony.autoCraft}
                          disabled={!connected}
                          onClick={() =>
                            send({ type: "craft", enabled: !colony.autoCraft })
                          }
                        >
                          <i />
                        </button>
                      </div>
                      <p>
                        Survivors gather supplies, build plans, eat and rest
                        according to their needs.
                      </p>
                    </div>
                    <div className="construction-queue">
                      {colony.buildings
                        .filter((b) => !b.built)
                        .map((b) => (
                          <div key={b.id}>
                            <span>
                              {BUILDINGS[b.type].name}
                              <small>
                                {Math.round(
                                  (100 * b.progress) / BUILDINGS[b.type].work,
                                )}
                                % complete
                              </small>
                            </span>
                            <button
                              title="Cancel and recover unused supplies"
                              aria-label={`Cancel ${BUILDINGS[b.type].name}`}
                              onClick={() =>
                                send({ type: "cancelBuild", buildingId: b.id })
                              }
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                    </div>
                    {colony.buildings
                      .filter((b) => b.built && b.health < 100)
                      .map((b) => (
                        <button
                          key={b.id}
                          className="repair-button"
                          onClick={() =>
                            send({ type: "repair", buildingId: b.id })
                          }
                        >
                          <Wrench size={14} />
                          Repair {BUILDINGS[b.type].name}
                          <span>{Math.round(b.health)}%</span>
                        </button>
                      ))}
                    <details className="structures-list">
                      <summary>
                        <Layers size={14} />
                        <span>Structures</span>
                        <small>
                          {colony.buildings.filter((b) => b.built).length}
                        </small>
                        <ChevronDown size={13} />
                      </summary>
                      <div>
                        {colony.buildings
                          .filter((b) => b.built)
                          .map((b) => (
                            <div className="structure-row" key={b.id}>
                              <span className="structure-symbol">
                                {BUILDINGS[b.type].symbol}
                              </span>
                              <span>
                                <strong>{BUILDINGS[b.type].name}</strong>
                                <small>
                                  Tile {b.x}, {b.y} · {Math.round(b.health)}%
                                  health
                                </small>
                              </span>
                              {b.health < 100 && (
                                <button
                                  disabled={!connected}
                                  aria-label={`Order repairs for ${BUILDINGS[b.type].name} at ${b.x},${b.y}`}
                                  title="Assign a survivor to repairs"
                                  onClick={() =>
                                    send({ type: "repair", buildingId: b.id })
                                  }
                                >
                                  <Wrench size={12} />
                                </button>
                              )}
                              <button
                                disabled={!connected}
                                aria-label={`Dismantle ${BUILDINGS[b.type].name} at ${b.x},${b.y}`}
                                title={`Dismantle: returns half the original construction materials, rounded down. Reserved repair supplies are returned. Removes the structure and can reopen blocked routes.`}
                                onClick={() =>
                                  send({
                                    type: "deconstruct",
                                    buildingId: b.id,
                                  })
                                }
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ))}
                      </div>
                      <p>
                        Remove a structure to reopen a blocked route.
                        Dismantling returns half its original materials, rounded
                        down.
                      </p>
                    </details>
                    <SectionTitle icon={BookOpen} title="Recent happenings" />
                    <EventList events={colony.events} limit={4} />
                  </>
                ) : panel === "crew" ? (
                  <>
                    <div className="panel-intro">
                      <span className="eyebrow">THE HEART OF YOUR COLONY</span>
                      <h2>Every survivor matters.</h2>
                      <p>
                        Select a crew member to inspect their needs and give
                        orders.
                      </p>
                    </div>
                    <div className="crew-list">
                      {colony.colonists.map((c) => (
                        <CrewRow
                          key={c.id}
                          colonist={c}
                          selected={c.id === selectedColonistId}
                          onClick={() => selectCrew(c.id)}
                        />
                      ))}
                    </div>
                    {selected ? (
                      <div className="crew-detail">
                        <div className="detail-title">
                          <span
                            data-portrait={
                              selected.name.startsWith("Mara")
                                ? 0
                                : selected.name.startsWith("Ivo")
                                  ? 1
                                  : 2
                            }
                            className="large-avatar"
                            style={{ background: selected.color }}
                          >
                            {selected.name.slice(0, 1)}
                          </span>
                          <div>
                            <h3>{selected.name}</h3>
                            <p>
                              {selected.role} · Skill {selected.skill}
                            </p>
                          </div>
                        </div>
                        <div className="needs">
                          <Meter
                            value={selected.health}
                            label="Health"
                            icon={Heart}
                          />
                          <Meter
                            value={selected.hunger}
                            label="Nutrition"
                            icon={Utensils}
                          />
                          <Meter
                            value={selected.energy}
                            label="Energy"
                            icon={Moon}
                          />
                          <Meter
                            value={selected.morale}
                            label="Morale"
                            icon={Sun}
                          />
                        </div>
                        <div className="current-task">
                          <span className="eyebrow">CURRENT ACTIVITY</span>
                          <strong>{selected.task}</strong>
                          {selected.blockedReason && (
                            <p className="blocked-reason">
                              <Info size={13} />
                              {selected.blockedReason}
                            </p>
                          )}
                          <small>
                            Position {Math.round(selected.x)},{" "}
                            {Math.round(selected.y)}
                          </small>
                          {selected.carrying && (
                            <small className="cargo-label">
                              <Package size={11} />
                              Carrying {selected.carrying.amount}{" "}
                              {RESOURCE_LABELS[selected.carrying.resource]}
                            </small>
                          )}
                        </div>
                        <label className="field-label" htmlFor="priority">
                          WORK PRIORITY
                        </label>
                        <select
                          id="priority"
                          value={selected.priority}
                          disabled={!connected}
                          onChange={(e) =>
                            send({
                              type: "priority",
                              colonistId: selected.id,
                              priority: e.target.value as Colonist["priority"],
                            })
                          }
                        >
                          <option value="balanced">Balanced duties</option>
                          <option value="build">Construction first</option>
                          <option value="salvage">Salvage first</option>
                        </select>
                        <button
                          className={`draft-button ${selected.drafted ? "drafted" : ""}`}
                          disabled={!connected}
                          onClick={() =>
                            send({
                              type: "draft",
                              colonistId: selected.id,
                              drafted: !selected.drafted,
                            })
                          }
                        >
                          <Flag size={15} />
                          {selected.drafted
                            ? "Return to autonomous work"
                            : "Take direct control"}
                          <span>{selected.drafted ? "RELEASE" : "DRAFT"}</span>
                        </button>
                        <p className="muted-note">
                          Click accessible land to issue a move order. Escape
                          clears your selection.
                        </p>
                      </div>
                    ) : (
                      <div className="empty-panel">
                        <MousePointer2 size={23} />
                        <p>
                          Choose someone above
                          <br />
                          or click a survivor on the map.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <Relations view={view} send={send} connected={connected} />
                )}
              </div>
            </>
          ) : null}
          <div className="inspector-footer">
            <Waves size={14} />
            <span>From what remains, we begin again.</span>
          </div>
        </aside>
      </div>
      <div className="toast-stack" aria-live="polite">
        {notices.map((n) => (
          <div key={n.id} className={`toast ${n.kind}`}>
            {n.kind === "success" ? (
              <Check size={15} />
            ) : n.kind === "error" ? (
              <Info size={15} />
            ) : (
              <Radio size={15} />
            )}
            <span>{n.text}</span>
          </div>
        ))}
      </div>
      {!name && (
        <div className="welcome-backdrop">
          <div className="welcome-card">
            <span className="eyebrow">THE DROWNED FRONTIER</span>
            <span className="welcome-anchor">
              <Anchor size={36} />
            </span>
            <h2>
              The world changed.
              <br />
              We begin again.
            </h2>
            <p>
              Beyond the ruins, a place to call home. Lead a small crew, build
              your outpost, and find your people in a shared ocean world.
            </p>
            <form onSubmit={begin}>
              <label htmlFor="captain-name">
                WHAT SHOULD WE CALL YOU, CAPTAIN?
              </label>
              <input
                id="captain-name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={24}
                placeholder="Your name"
                autoComplete="nickname"
                required
                autoFocus
              />
              <button
                className="primary-button"
                type="submit"
                disabled={!nameInput.trim()}
              >
                Chart a new beginning
                <ArrowUpRight size={18} />
              </button>
            </form>
            <span className="welcome-note">
              <Users size={13} />
              Multiplayer prototype · Your progress stays with this browser
            </span>
          </div>
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
            <span className="eyebrow">CAPTAIN'S FIELD NOTES</span>
            <h2 id="modal-title">
              {modal === "help"
                ? "Find your feet. Then your frontier."
                : "Make yourself at home."}
            </h2>
            {modal === "help" ? (
              <>
                <p>
                  Choose an unclaimed site on the regional map and establish
                  your settlement. Your crew gathers, eats, rests and builds
                  automatically.
                </p>
                <div className="help-steps">
                  <div>
                    <span>01</span>
                    <p>
                      <strong>A place for everything</strong>Build a stockpile,
                      bunks and a galley. Place structures on accessible dry
                      land.
                    </p>
                  </div>
                  <div>
                    <span>02</span>
                    <p>
                      <strong>Keep the lights on</strong>Repair your generator
                      and enable automatic production. Watch food, fuel and crew
                      needs.
                    </p>
                  </div>
                  <div>
                    <span>03</span>
                    <p>
                      <strong>You are not alone</strong>Open Relations to
                      propose alliances and supply exchanges. Use an incognito
                      window or another browser for an independent captain.
                    </p>
                  </div>
                </div>
                <div className="controls">
                  <span>
                    <kbd>Scroll</kbd>Zoom
                  </span>
                  <span>
                    <kbd>Space + drag</kbd>Pan
                  </span>
                  <span>
                    <kbd>1–8</kbd>Build
                  </span>
                  <span>
                    <kbd>M</kbd>Regional map
                  </span>
                  <span>
                    <kbd>G</kbd>Grid
                  </span>
                  <span>
                    <kbd>Esc</kbd>Cancel
                  </span>
                </div>
                <p className="prototype-note">
                  <Info size={15} />
                  This is a local-development prototype. Home settlements are
                  protected. Frontier management includes production, research,
                  medical care and dangerous shared expeditions. Public hosting
                  is still being developed. The shared world continues while the
                  server runs.
                </p>
              </>
            ) : (
              <>
                <p>
                  Settings apply to this browser. The shared world cannot be
                  paused or fast-forwarded.
                </p>
                <button
                  className="settings-row"
                  onClick={() => setShowGrid((v) => !v)}
                >
                  <span>
                    <Grid3X3 size={18} />
                    Construction grid
                  </span>
                  <span className={`switch ${showGrid ? "on" : ""}`}>
                    <i />
                  </span>
                </button>
                <div className="settings-info">
                  <Radio size={18} />
                  <div>
                    <strong>Server-authoritative world</strong>
                    <p>
                      Your browser submits orders. The server decides outcomes
                      and saves progress.
                    </p>
                  </div>
                </div>
                <div className="settings-info">
                  <Shield size={18} />
                  <div>
                    <strong>Your captain identity</strong>
                    <p>
                      Stored on this browser. Keep browser data to retain
                      access; use a private window for another player.
                    </p>
                  </div>
                </div>
                <p className="muted-note">
                  No music or audio playback is included in this build.
                </p>
                <div className="identity-reset">
                  <strong>Lost access to this captain?</strong>
                  <p>
                    After a server reset, an old identity may no longer connect.
                    Starting again clears only this browser's identity; it does
                    not delete any existing colony.
                  </p>
                  <button
                    className="light-button"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Clear this browser’s captain identity and start again? Your existing colony remains on the server. You cannot return to it without the original identity token.",
                        )
                      ) {
                        localStorage.removeItem("frontier-token");
                        localStorage.removeItem("frontier-pending-join");
                        localStorage.removeItem("frontier-name");
                        location.reload();
                      }
                    }}
                  >
                    Start a new captain
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function SectionTitle({
  icon: Icon,
  title,
  meta,
}: {
  icon: typeof Users;
  title: string;
  meta?: string;
}) {
  return (
    <div className="section-title">
      <Icon size={14} />
      <h3>{title}</h3>
      {meta && <span>{meta}</span>}
    </div>
  );
}
function CrewRow({
  colonist: c,
  selected,
  onClick,
}: {
  colonist: Colonist;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`crew-row ${selected ? "selected" : ""}`}
      onClick={onClick}
    >
      <span
        className="crew-avatar"
        data-portrait={
          c.name.startsWith("Mara") ? 0 : c.name.startsWith("Ivo") ? 1 : 2
        }
        style={{ background: c.color }}
      >
        {c.name.slice(0, 1)}
        <i className={c.health < 30 ? "danger" : ""} />
      </span>
      <span className="crew-row-info">
        <strong>
          {c.name}
          <small>{c.role}</small>
        </strong>
        <span>{c.task || "Considering next task"}</span>
      </span>
      <ChevronRight size={14} />
    </button>
  );
}
function EventList({
  events,
  limit = 20,
}: {
  events: { id: string; tick: number; kind: string; text: string }[];
  limit?: number;
}) {
  return (
    <div className="event-list">
      {events.length ? (
        events.slice(0, limit).map((e) => (
          <div className={`event event-${e.kind}`} key={e.id}>
            <i />
            <div>
              <p>{e.text}</p>
              <small>
                {Math.floor(e.tick / 10)}s ·{" "}
                {e.kind === "warning"
                  ? "Attention"
                  : e.kind === "success"
                    ? "Progress"
                    : "Outpost log"}
              </small>
            </div>
          </div>
        ))
      ) : (
        <p className="muted-note">
          Quiet waters. Your story is just beginning.
        </p>
      )}
    </div>
  );
}
function Relations({
  view,
  send,
  connected,
}: {
  view: GameView;
  send: (c: Command) => void;
  connected: boolean;
}) {
  const [target, setTarget] = useState("");
  const [give, setGive] = useState<Resource>("scrap");
  const [want, setWant] = useState<Resource>("fiber");
  const [amount, setAmount] = useState(5);
  const others = view.players.filter((p) => p.id !== view.you.id && p.colonyId);
  return (
    <>
      <div className="panel-intro">
        <span className="eyebrow">A SHARED FRONTIER</span>
        <h2>
          Stronger
          <br />
          together.
        </h2>
        <p>
          Make allies, exchange supplies, and shape the world beyond your
          shores.
        </p>
      </div>
      <SectionTitle
        icon={Users}
        title="Neighboring captains"
        meta={`${others.length}`}
      />
      {others.length ? (
        <div className="neighbors">
          {others.map((p) => {
            const ally = view.alliances.some(
              (a) => a.includes(p.id) && a.includes(view.you.id),
            );
            const incoming = view.allianceRequests.some(
              (a) => a[0] === p.id && a[1] === view.you.id,
            );
            const outgoing = view.allianceRequests.some(
              (a) => a[0] === view.you.id && a[1] === p.id,
            );
            return (
              <div className="neighbor" key={p.id}>
                <span className="crew-avatar" style={{ background: p.color }}>
                  {p.name.slice(0, 1)}
                </span>
                <div>
                  <strong>{p.name}</strong>
                  <small>
                    {view.colonies.find((c) => c.ownerId === p.id)?.name ||
                      "Independent outpost"}
                  </small>
                  <span className={`relation-tag ${ally ? "allied" : ""}`}>
                    {ally
                      ? "ALLIED"
                      : incoming
                        ? "INVITATION RECEIVED"
                        : outgoing
                          ? "INVITATION SENT"
                          : "NEUTRAL"}
                  </span>
                </div>
                <button
                  className="icon-button"
                  disabled={!connected || outgoing}
                  title={
                    ally
                      ? "Leave alliance"
                      : incoming
                        ? "Accept alliance"
                        : "Propose alliance"
                  }
                  aria-label={`${ally ? "Leave alliance with" : incoming ? "Accept alliance with" : "Propose alliance to"} ${p.name}`}
                  onClick={() =>
                    send({
                      type: "alliance",
                      targetId: p.id,
                      action: ally ? "revoke" : incoming ? "accept" : "request",
                    })
                  }
                >
                  {ally ? (
                    <X size={15} />
                  ) : incoming ? (
                    <Check size={16} />
                  ) : (
                    <Plus size={16} />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-panel">
          <Waves size={28} />
          <p>
            No other settlements yet.
            <br />
            Invite another captain to this server.
          </p>
          <small>Use another browser or an incognito window.</small>
        </div>
      )}
      {others.length > 0 && (
        <>
          <SectionTitle icon={Package} title="Supply exchange" />
          <form
            className="trade-form"
            onSubmit={(e) => {
              e.preventDefault();
              send({
                type: "trade",
                targetId: target || others[0].id,
                give,
                want,
                giveAmount: amount,
                wantAmount: amount,
              });
            }}
          >
            <label htmlFor="trade-partner">CAPTAIN</label>
            <select
              id="trade-partner"
              value={target || others[0].id}
              onChange={(e) => setTarget(e.target.value)}
            >
              {others.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <div className="trade-columns">
              <div>
                <label htmlFor="trade-give">YOU OFFER</label>
                <select
                  id="trade-give"
                  value={give}
                  onChange={(e) => setGive(e.target.value as Resource)}
                >
                  {resources.map((r) => (
                    <option key={r} value={r}>
                      {RESOURCE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="trade-want">YOU REQUEST</label>
                <select
                  id="trade-want"
                  value={want}
                  onChange={(e) => setWant(e.target.value as Resource)}
                >
                  {resources.map((r) => (
                    <option key={r} value={r}>
                      {RESOURCE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label htmlFor="trade-amount">UNITS ON EACH SIDE</label>
            <input
              type="number"
              id="trade-amount"
              min={1}
              max={100}
              value={amount}
              onChange={(e) =>
                setAmount(
                  Math.max(1, Math.min(100, Number(e.target.value) || 1)),
                )
              }
            />
            <button
              className="primary-button"
              disabled={!connected || give === want}
              type="submit"
            >
              <Send size={14} />
              Propose exchange
            </button>
            <p className="muted-note">
              Prototype exchanges use direct escrow. Physical dock delivery
              comes later.
            </p>
          </form>
        </>
      )}
      <SectionTitle icon={BookOpen} title="Exchange offers" />
      {view.offers
        .filter((o) => o.status === "open")
        .map((o) => (
          <div className="offer" key={o.id}>
            <strong>
              {view.players.find((p) => p.id === o.from)?.name || "Captain"}{" "}
              offers
            </strong>
            <p>
              {o.giveAmount} {RESOURCE_LABELS[o.give]} for {o.wantAmount}{" "}
              {RESOURCE_LABELS[o.want]}
            </p>
            {o.to === view.you.id ? (
              <div>
                <button
                  className="light-button"
                  onClick={() =>
                    send({ type: "tradeRespond", offerId: o.id, accept: true })
                  }
                >
                  <Check size={13} />
                  Accept
                </button>
                <button
                  className="light-button"
                  onClick={() =>
                    send({ type: "tradeRespond", offerId: o.id, accept: false })
                  }
                >
                  Decline
                </button>
              </div>
            ) : (
              <button
                className="light-button"
                onClick={() =>
                  send({ type: "tradeRespond", offerId: o.id, accept: false })
                }
              >
                Cancel offer
              </button>
            )}
          </div>
        ))}
      {!view.offers.some((o) => o.status === "open") && (
        <p className="muted-note padded">No outstanding offers.</p>
      )}
    </>
  );
}

function FirstSteps({
  colony,
  send,
  connected,
  onBuild,
}: {
  colony: Colony;
  send: (c: Command) => void;
  connected: boolean;
  onBuild: (b: BuildingType) => void;
}) {
  const beds = colony.buildings.filter(
    (b) => b.type === "bed" && b.built,
  ).length;
  const generator = colony.buildings.find(
    (b) => b.type === "generator" && b.built,
  );
  const objectives = [
    {
      title: "A bunk for every survivor",
      detail: `${beds} of ${colony.colonists.length} bunks ready`,
      done: beds >= colony.colonists.length,
      action: () => onBuild("bed"),
      label: "Place a crew bunk",
    },
    {
      title: "Restore the tide station",
      detail: generator
        ? `Generator at ${Math.round(generator.health)}% condition`
        : "A generator is needed",
      done: !!generator && generator.health >= 100,
      action: () =>
        generator
          ? send({ type: "repair", buildingId: generator.id })
          : onBuild("generator"),
      label: generator ? "Restore generator" : "Place a generator",
    },
    {
      title: "Hold back high tide",
      detail: "A powered bilge pump prevents flooding",
      done: colony.buildings.some((b) => b.type === "pump" && b.built),
      action: () => onBuild("pump"),
      label: "Place a bilge pump",
    },
    {
      title: "Collect freshwater",
      detail: "A cistern replenishes your drinking supply",
      done: colony.buildings.some((b) => b.type === "reservoir" && b.built),
      action: () => onBuild("reservoir"),
      label: "Place a rain cistern",
    },
    {
      title: "Make something new",
      detail: "Build a powered fabricator",
      done: colony.buildings.some((b) => b.type === "workshop" && b.built),
      action: () => onBuild("workshop"),
      label: "Place a fabricator",
    },
  ];
  const complete = objectives.filter((o) => o.done).length;
  return (
    <div className="first-steps">
      <div className="first-steps-heading">
        <Flag size={13} />
        <strong>Your first foothold</strong>
        <span>
          {complete} / {objectives.length}
        </span>
      </div>
      {objectives.map((o, i) => (
        <div className={`objective ${o.done ? "complete" : ""}`} key={o.title}>
          <span className="objective-check">
            {o.done ? <Check size={10} /> : i + 1}
          </span>
          <div>
            <strong>{o.title}</strong>
            <small>{o.detail}</small>
          </div>
          {!o.done && (
            <button
              aria-label={o.label}
              title={o.label}
              disabled={!connected}
              onClick={o.action}
            >
              <ArrowUpRight size={14} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
