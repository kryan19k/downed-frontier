import { useEffect, useState } from "react";
import {
  Activity,
  Beaker,
  ChevronRight,
  Compass,
  Droplets,
  FlaskConical,
  Heart,
  Package,
  Shield,
  Users,
  Waves,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import {
  BUILDINGS,
  RECIPES,
  RESEARCH,
  RESOURCE_LABELS,
  type Command,
  type GameView,
  type Inventory,
  type Resource,
} from "@frontier/shared";
import "./mechanics.css";

type Props = {
  view: GameView;
  send: (command: Command) => void;
  onTactical?: (id: string) => void;
  connected?: boolean;
};
type Tab = "systems" | "production" | "research" | "expeditions" | "people";
const tabs: { id: Tab; name: string; icon: typeof Activity }[] = [
  { id: "systems", name: "Systems", icon: Activity },
  { id: "production", name: "Production", icon: Wrench },
  { id: "research", name: "Research", icon: FlaskConical },
  { id: "expeditions", name: "Expeditions", icon: Compass },
  { id: "people", name: "People", icon: Users },
];
function Goods({ items }: { items: Partial<Inventory> }) {
  return (
    <span className="mechanics-goods">
      {Object.entries(items)
        .filter(([, n]) => n)
        .map(([key, amount]) => (
          <span key={key}>
            {amount} {RESOURCE_LABELS[key as Resource] || key}
          </span>
        ))}
    </span>
  );
}
function Gauge({
  label,
  value,
  max = 100,
  unit = "",
  warning = false,
}: {
  label: string;
  value: number;
  max?: number;
  unit?: string;
  warning?: boolean;
}) {
  return (
    <div className={`mechanics-gauge ${warning ? "warning" : ""}`}>
      <div>
        <span>{label}</span>
        <strong>
          {Math.round(value)}
          {unit}
          {max !== 100 ? ` / ${max}` : ""}
        </strong>
      </div>
      <span className="mechanics-bar">
        <i
          style={{
            width: `${Math.min(100, Math.max(0, (value / max) * 100))}%`,
          }}
        />
      </span>
    </div>
  );
}
export default function MechanicsPanel({
  view,
  send,
  onTactical,
  connected = true,
}: Props) {
  const [tab, setTab] = useState<Tab>("systems");
  const [quantity, setQuantity] = useState(1);
  const [selectedSite, setSelectedSite] = useState("");
  const [crew, setCrew] = useState<string[]>([]);
  const colony = view.colony,
    systems = colony?.systems;
  const sites = view.expeditionSites || [];
  useEffect(() => {
    if (!selectedSite && sites.length) setSelectedSite(sites[0].id);
  }, [sites, selectedSite]);
  if (!colony)
    return (
      <p className="mechanics-note">
        Establish your home before managing its frontier systems.
      </p>
    );
  const available = colony.colonists.filter((c) => !c.away && c.health >= 25);
  const active = (view.expeditions || []).filter(
    (e) => e.ownerId === view.you.id && e.phase !== "complete",
  );
  const unlocked = systems?.unlocked || [];
  const inventory = Object.values(colony.resources).reduce(
    (sum, n) => sum + n,
    0,
  );
  const hasStation = (name: string) =>
    colony.buildings.some((b) => b.type === name && b.built && b.health > 0);
  return (
    <section
      className="mechanics-panel"
      aria-label="Frontier systems management"
    >
      <header className="mechanics-heading">
        <span className="eyebrow">THE LIVING FRONTIER</span>
        <h2>
          Every system.
          <br />
          One fragile home.
        </h2>
        <p>
          Care for your people, close the resource loop, and decide what lies
          beyond your shore.
        </p>
      </header>
      <nav className="mechanics-tabs" aria-label="Frontier management sections">
        {tabs.map(({ id, name, icon: Icon }) => (
          <button
            key={id}
            aria-pressed={tab === id}
            className={tab === id ? "selected" : ""}
            onClick={(event) => {
              setTab(id);
              event.currentTarget
                .closest(".inspector-scroll")
                ?.scrollTo({ top: 0 });
            }}
          >
            <Icon size={13} />
            {name}
          </button>
        ))}
      </nav>
      <div className="mechanics-content">
        {tab === "systems" && (
          <>
            {!systems ? (
              <p className="mechanics-note">
                Waiting for the colony's system report.
              </p>
            ) : (
              <>
                {systems.sheltered && (
                  <div className="mechanics-alert safe">
                    <Shield size={16} />
                    <span>
                      Shelter active. Colony production and survival are
                      suspended.
                    </span>
                  </div>
                )}
                <div className="mechanics-section-heading">
                  <Waves size={14} />
                  <h3>Tides & habitat</h3>
                </div>
                <Gauge
                  label="Freshwater"
                  value={systems.water}
                  max={systems.waterCapacity}
                  warning={systems.water < 15}
                />
                <Gauge
                  label="Flood level"
                  value={systems.flood}
                  unit="%"
                  warning={systems.flood > 35}
                />
                <Gauge label="Tidal pressure" value={systems.tide} unit="%" />
                <Gauge
                  label="Breathable atmosphere"
                  value={systems.oxygen}
                  unit="%"
                  warning={systems.oxygen < 50}
                />
                <div className="mechanics-stat-grid">
                  <div>
                    <strong>{systems.roomCount}</strong>
                    <span>Enclosed rooms</span>
                  </div>
                  <div>
                    <strong>{colony.power > 0 ? "Online" : "Offline"}</strong>
                    <span>Power network</span>
                  </div>
                </div>
                <Gauge
                  label="Battery reserve"
                  value={systems.battery}
                  unit="%"
                />
                <Gauge
                  label="Storage used"
                  value={inventory}
                  max={systems.storageCapacity}
                  warning={inventory >= systems.storageCapacity}
                />
                <p className="mechanics-note">
                  Cisterns replenish water. Gardens turn water into renewable
                  fiber. Powered pumps counter flooding; accumulators bridge
                  outages.
                </p>
                <div className="mechanics-section-heading">
                  <Shield size={14} />
                  <h3>Standing policies</h3>
                </div>
                <label
                  className="mechanics-label"
                  htmlFor="frontier-work-policy"
                >
                  Work schedule
                </label>
                <select
                  id="frontier-work-policy"
                  value={systems.workPolicy}
                  disabled={!connected}
                  onChange={(e) =>
                    send({
                      type: "policy",
                      policy: "work",
                      value: e.target.value,
                    })
                  }
                >
                  <option value="balanced">Balanced work and recovery</option>
                  <option value="rest">Recovery focus</option>
                  <option value="intensive">
                    Intensive work · higher strain
                  </option>
                </select>
                <button
                  className="mechanics-policy"
                  aria-pressed={systems.rationing}
                  disabled={!connected}
                  onClick={() =>
                    send({
                      type: "policy",
                      policy: "rationing",
                      value: systems.rationing ? "off" : "on",
                    })
                  }
                >
                  <span>
                    <Package size={15} />
                    Ration conservation
                  </span>
                  <strong>{systems.rationing ? "ON" : "OFF"}</strong>
                </button>
                <button
                  className="mechanics-policy"
                  aria-pressed={systems.sheltered}
                  disabled={!connected}
                  onClick={() =>
                    send({
                      type: "policy",
                      policy: "shelter",
                      value: systems.sheltered ? "off" : "on",
                    })
                  }
                >
                  <span>
                    <Shield size={15} />
                    {systems.sheltered ? "Resume colony" : "Enter safe shelter"}
                  </span>
                  <ChevronRight size={15} />
                </button>
                <p className="mechanics-note">
                  Shelter is a safe-home policy, not an escape from a deployed
                  expedition or unsettled trade. It provides no production or
                  research.
                </p>
              </>
            )}
          </>
        )}
        {tab === "production" && (
          <>
            <div className="mechanics-section-heading">
              <Wrench size={14} />
              <h3>Staffed production</h3>
            </div>
            <p className="mechanics-note">
              Bills need materials, the correct station, and an available
              worker. Workshop recipes also need power.
            </p>
            <label className="mechanics-label" htmlFor="recipe-quantity">
              Batches to queue
            </label>
            <input
              id="recipe-quantity"
              type="number"
              min={1}
              max={20}
              value={quantity}
              onChange={(e) =>
                setQuantity(
                  Math.max(
                    1,
                    Math.min(20, Math.floor(Number(e.target.value) || 1)),
                  ),
                )
              }
            />
            {RECIPES.map((recipe) => {
              const station =
                BUILDINGS[recipe.station as keyof typeof BUILDINGS];
              const locked =
                !!recipe.research && !unlocked.includes(recipe.research);
              const stationBuilt = hasStation(recipe.station);
              return (
                <article className="mechanics-card" key={recipe.id}>
                  <div className="mechanics-card-title">
                    <h3>{recipe.name}</h3>
                    <span>{station?.name || recipe.station}</span>
                  </div>
                  <div className="mechanics-recipe">
                    <Goods items={recipe.inputs} />
                    <ChevronRight size={13} />
                    <Goods items={recipe.outputs} />
                  </div>
                  <button
                    className="mechanics-action"
                    aria-label={`Queue ${recipe.name}`}
                    disabled={
                      !connected ||
                      locked ||
                      !stationBuilt ||
                      systems?.sheltered
                    }
                    onClick={() =>
                      send({
                        type: "queueRecipe",
                        recipeId: recipe.id,
                        quantity,
                      })
                    }
                  >
                    {locked
                      ? `Requires ${RESEARCH.find((r) => r.id === recipe.research)?.name || recipe.research}`
                      : !stationBuilt
                        ? `Build ${station?.name || recipe.station}`
                        : `Queue ${quantity} ${quantity === 1 ? "batch" : "batches"}`}
                  </button>
                </article>
              );
            })}
            <div className="mechanics-section-heading">
              <Package size={14} />
              <h3>Work queue</h3>
              <span>{systems?.production.length || 0}</span>
            </div>
            {systems?.production.length ? (
              systems.production.map((bill) => {
                const recipe = RECIPES.find((r) => r.id === bill.recipeId);
                const worker = colony.colonists.find(
                  (c) => c.id === bill.workerId,
                );
                return (
                  <article className="mechanics-card" key={bill.id}>
                    <div className="mechanics-card-title">
                      <h3>{recipe?.name || bill.recipeId}</h3>
                      <button
                        aria-label={`Cancel production bill ${bill.id}`}
                        disabled={!connected}
                        onClick={() =>
                          send({ type: "cancelRecipe", billId: bill.id })
                        }
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <p>
                      {bill.remaining} batches left ·{" "}
                      {worker ? worker.name : "Waiting for crew"}
                    </p>
                    <Gauge
                      label="Current batch"
                      value={bill.progress}
                      max={recipe?.work || 100}
                    />
                  </article>
                );
              })
            ) : (
              <p className="mechanics-empty">
                No production bills. Queue a recipe above.
              </p>
            )}
          </>
        )}
        {tab === "research" && (
          <>
            <div className="mechanics-section-heading">
              <Beaker size={14} />
              <h3>Frontier research</h3>
            </div>
            <p className="mechanics-note">
              Build and power a research station. A crew member must work at the
              station to make progress.
            </p>
            {RESEARCH.map((project) => {
              const done = unlocked.includes(project.id);
              const current = systems?.researchProject === project.id;
              const missing = project.requires.filter(
                (r) => !unlocked.includes(r),
              );
              return (
                <article
                  className={`mechanics-card ${done ? "complete" : ""}`}
                  key={project.id}
                >
                  <div className="mechanics-card-title">
                    <h3>{project.name}</h3>
                    <span>{done ? "DISCOVERED" : `${project.cost} study`}</span>
                  </div>
                  <p>{project.description}</p>
                  {current && (
                    <Gauge
                      label="Study progress"
                      value={systems?.researchProgress || 0}
                      max={project.cost}
                    />
                  )}
                  <button
                    className="mechanics-action"
                    aria-label={`Research ${project.name}`}
                    disabled={
                      !connected ||
                      done ||
                      current ||
                      missing.length > 0 ||
                      !hasStation("lab") ||
                      systems?.sheltered
                    }
                    onClick={() =>
                      send({ type: "research", projectId: project.id })
                    }
                  >
                    {done
                      ? "Knowledge secured"
                      : current
                        ? "Research in progress"
                        : missing.length
                          ? `Requires ${missing.map((id) => RESEARCH.find((r) => r.id === id)?.name || id).join(", ")}`
                          : !hasStation("lab")
                            ? "Build Research station"
                            : "Begin research"}
                  </button>
                </article>
              );
            })}
          </>
        )}
        {tab === "expeditions" && (
          <>
            <div className="mechanics-section-heading">
              <Compass size={14} />
              <h3>Beyond home waters</h3>
            </div>
            <p className="mechanics-note">
              Parties leave their home jobs and carry limited provisions.
              Contested sites may contain hostiles and other players. Your
              protected home is never a combat target.
            </p>
            <label className="mechanics-label" htmlFor="expedition-site">
              Destination
            </label>
            <select
              id="expedition-site"
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.kind}
                </option>
              ))}
            </select>
            {sites.find((s) => s.id === selectedSite) && (
              <div className="mechanics-site-detail">
                <p>{sites.find((s) => s.id === selectedSite)!.description}</p>
                <span>
                  Risk{" "}
                  {Math.round(sites.find((s) => s.id === selectedSite)!.risk)} ·
                  Shared exploration site
                </span>
              </div>
            )}
            <p className="mechanics-note">
              1–3 able crew · 2 fuel and 2 rations per survivor · 20 seconds
              outward travel. Downed crew can be recovered; retreat takes time.
            </p>
            <fieldset className="mechanics-crew-picker">
              <legend>Choose your party</legend>
              {available.map((c) => (
                <label key={c.id}>
                  <input
                    type="checkbox"
                    checked={crew.includes(c.id)}
                    disabled={!crew.includes(c.id) && crew.length >= 3}
                    onChange={(e) =>
                      setCrew((ids) =>
                        e.target.checked
                          ? [...ids, c.id]
                          : ids.filter((id) => id !== c.id),
                      )
                    }
                  />
                  <span>
                    {c.name}
                    <small>
                      {c.role} · {Math.round(c.health)}% health
                    </small>
                  </span>
                </label>
              ))}
            </fieldset>
            <button
              className="mechanics-action primary"
              disabled={
                !connected ||
                !selectedSite ||
                !crew.some((id) => available.some((c) => c.id === id)) ||
                systems?.sheltered
              }
              onClick={() => {
                send({
                  type: "expeditionLaunch",
                  siteId: selectedSite,
                  colonistIds: crew.filter((id) =>
                    available.some((c) => c.id === id),
                  ),
                });
                setCrew([]);
              }}
            >
              Dispatch expedition
            </button>
            <div className="mechanics-section-heading">
              <Activity size={14} />
              <h3>Active expeditions</h3>
              <span>{active.length}</span>
            </div>
            {active.length ? (
              active.map((expedition) => (
                <article className="mechanics-card" key={expedition.id}>
                  <div className="mechanics-card-title">
                    <h3>
                      {sites.find((s) => s.id === expedition.siteId)?.name ||
                        "Expedition"}
                    </h3>
                    <span>{expedition.phase.toUpperCase()}</span>
                  </div>
                  <p>
                    {expedition.colonistIds.length} crew ·{" "}
                    {Math.max(
                      0,
                      Math.ceil((expedition.arrivalTick - view.tick) / 10),
                    )}
                    s to arrival
                  </p>
                  <Goods items={expedition.cargo} />
                  <div className="mechanics-inline-actions">
                    {["combat", "exploring"].includes(expedition.phase) &&
                      onTactical && (
                        <button
                          className="mechanics-action"
                          onClick={() => onTactical(expedition.id)}
                        >
                          Open tactical view
                        </button>
                      )}
                    <button
                      className="mechanics-action"
                      disabled={
                        !connected ||
                        expedition.phase === "returning" ||
                        expedition.retreating
                      }
                      onClick={() =>
                        send({
                          type: "expeditionRetreat",
                          expeditionId: expedition.id,
                        })
                      }
                    >
                      {expedition.phase === "returning"
                        ? "Returning home"
                        : "Order retreat"}
                    </button>
                  </div>
                  <details>
                    <summary>Expedition log</summary>
                    <ol className="mechanics-party-log">
                      {expedition.log.slice(0, 8).map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ol>
                  </details>
                </article>
              ))
            ) : (
              <p className="mechanics-empty">
                No deployed parties. The frontier can wait until you are ready.
              </p>
            )}
          </>
        )}
        {tab === "people" && (
          <>
            <div className="mechanics-section-heading">
              <Users size={14} />
              <h3>The people behind the outpost</h3>
            </div>
            {colony.colonists.map((person) => (
              <article className="mechanics-card person-card" key={person.id}>
                <div className="mechanics-card-title">
                  <h3>{person.name}</h3>
                  <span>
                    {person.away ? "DEPLOYED" : person.role.toUpperCase()}
                  </span>
                </div>
                <div className="mechanics-traits">
                  {person.mind?.traits.map((trait) => (
                    <span key={trait}>{trait}</span>
                  ))}
                </div>
                <Gauge
                  label="Health"
                  value={person.health}
                  unit="%"
                  warning={person.health < 40}
                />
                <Gauge
                  label="Hydration"
                  value={person.thirst ?? 100}
                  unit="%"
                  warning={(person.thirst ?? 100) < 25}
                />
                <Gauge
                  label="Stress"
                  value={person.mind?.stress || 0}
                  unit="%"
                  warning={(person.mind?.stress || 0) > 65}
                />
                {!!person.injuries?.length && (
                  <>
                    <h4>Injuries & care</h4>
                    {person.injuries.map((injury) => (
                      <p className="mechanics-injury" key={injury.id}>
                        <Heart size={12} />
                        {injury.kind} · severity {Math.round(injury.severity)} ·{" "}
                        {injury.tended ? "Tended" : "Untended"}
                        {injury.infection > 0
                          ? ` · infection ${Math.round(injury.infection)}`
                          : ""}
                      </p>
                    ))}
                    <button
                      className="mechanics-action"
                      aria-label={`Tend ${person.name}`}
                      disabled={
                        !connected ||
                        !!person.away ||
                        !colony.resources.medicine
                      }
                      onClick={() =>
                        send({ type: "tend", colonistId: person.id })
                      }
                    >
                      Assign medical care to {person.name.split(" ")[0]}
                    </button>
                  </>
                )}
                {!!person.mind?.memories.length && (
                  <details>
                    <summary>Recent memories</summary>
                    <ul>
                      {person.mind.memories.map((memory, i) => (
                        <li key={i}>
                          {memory.text}
                          <b
                            className={
                              memory.impact < 0 ? "negative" : "positive"
                            }
                          >
                            {" "}
                            {memory.impact > 0 ? "+" : ""}
                            {memory.impact}
                          </b>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {!!person.mind && (
                  <details>
                    <summary>Skills & relationships</summary>
                    <div className="mechanics-skill-list">
                      {Object.entries(person.mind.skills).map(([skill, xp]) => (
                        <span key={skill}>
                          {skill}
                          <b>{Math.round(xp)}</b>
                        </span>
                      ))}
                    </div>
                    {Object.entries(person.mind.relationships).map(
                      ([id, value]) => (
                        <p key={id}>
                          {colony.colonists.find((c) => c.id === id)?.name ||
                            "Former crewmate"}{" "}
                          <b>
                            {value > 0 ? "+" : ""}
                            {Math.round(value)}
                          </b>
                        </p>
                      ),
                    )}
                  </details>
                )}
              </article>
            ))}
          </>
        )}
      </div>
    </section>
  );
}
