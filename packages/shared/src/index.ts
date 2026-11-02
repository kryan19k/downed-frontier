import type {
  ColonySystems,
  MindState,
  Injury,
  Expedition,
  ExpeditionSite,
  MechanicsCommand,
} from "./mechanics";
export * from "./mechanics";
export const MAP_SIZE = 64;
export const TICK_RATE = 10;
export const PROTOCOL_VERSION = 1;
export type Resource =
  | "scrap"
  | "fiber"
  | "rations"
  | "components"
  | "medicine"
  | "fuel";
export type Inventory = Record<Resource, number>;
export type BuildingType =
  | "floor"
  | "wall"
  | "door"
  | "bed"
  | "stockpile"
  | "foodStation"
  | "generator"
  | "workshop"
  | "pump"
  | "farm"
  | "infirmary"
  | "lab"
  | "battery"
  | "recycler"
  | "reservoir";
export type Terrain = "water" | "sand" | "grass" | "rock" | "deck";
export type Point = { x: number; y: number };
export type Site = {
  id: string;
  name: string;
  subtitle: string;
  biome: "Shallows" | "Canopy" | "Deep";
  x: number;
  y: number;
  seed: number;
  richness: number;
  hazard: string;
  ownerId: string | null;
};
export type Player = {
  id: string;
  name: string;
  color: string;
  colonyId: string | null;
};
export type Colonist = Point & {
  id: string;
  name: string;
  role: string;
  color: string;
  health: number;
  hunger: number;
  energy: number;
  morale: number;
  skill: number;
  task: string;
  target: Point | null;
  jobId: string | null;
  progress: number;
  drafted: boolean;
  priority: "balanced" | "build" | "salvage";
  blockedReason: string | null;
  carrying?: { resource: Resource; amount: number } | null;
  injuries?: Injury[];
  mind?: MindState;
  thirst?: number;
  away?: string | null;
};
export type Building = Point & {
  id: string;
  type: BuildingType;
  built: boolean;
  progress: number;
  health: number;
  reservedBy: string | null;
  repairSupplies?: boolean;
};
export type Deposit = Point & {
  id: string;
  resource: Resource;
  amount: number;
  reservedBy: string | null;
};
export type GameEvent = {
  id: string;
  tick: number;
  kind: "info" | "success" | "warning" | "danger";
  text: string;
};
export type Colony = {
  id: string;
  ownerId: string;
  siteId: string;
  name: string;
  resources: Inventory;
  colonists: Colonist[];
  buildings: Building[];
  deposits: Deposit[];
  events: GameEvent[];
  power: number;
  research: number;
  autoCraft: boolean;
  scenario: string;
  storm: boolean;
  foundedTick?: number;
  systems?: ColonySystems;
};
export type TradeOffer = {
  id: string;
  from: string;
  to: string;
  give: Resource;
  giveAmount: number;
  want: Resource;
  wantAmount: number;
  status: "open" | "accepted" | "cancelled";
  createdTick: number;
};
export type World = {
  version: 1;
  seed: number;
  tick: number;
  nextId: number;
  players: Record<string, Player>;
  sites: Site[];
  colonies: Record<string, Colony>;
  alliances: [string, string][];
  allianceRequests: [string, string][];
  offers: TradeOffer[];
  expeditions?: Expedition[];
  expeditionSites?: ExpeditionSite[];
  events: GameEvent[];
};
export type PublicColony = {
  id: string;
  ownerId: string;
  siteId: string;
  name: string;
  population: number;
};
export type GameView = {
  version: 1;
  tick: number;
  seed: number;
  you: Player;
  players: Player[];
  sites: Site[];
  colony: Colony | null;
  colonies: PublicColony[];
  alliances: [string, string][];
  allianceRequests: [string, string][];
  offers: TradeOffer[];
  expeditions?: Expedition[];
  expeditionSites?: ExpeditionSite[];
  events: GameEvent[];
  onlinePlayers?: string[];
};
export type Command =
  | MechanicsCommand
  | { type: "claim"; siteId: string; name: string; scenario: string }
  | { type: "move"; colonistId: string; x: number; y: number }
  | { type: "build"; building: BuildingType; x: number; y: number }
  | { type: "cancelBuild"; buildingId: string }
  | { type: "deconstruct"; buildingId: string }
  | { type: "draft"; colonistId: string; drafted: boolean }
  | { type: "priority"; colonistId: string; priority: Colonist["priority"] }
  | { type: "craft"; enabled: boolean }
  | { type: "repair"; buildingId: string }
  | {
      type: "alliance";
      targetId: string;
      action: "request" | "accept" | "revoke";
    }
  | {
      type: "trade";
      targetId: string;
      give: Resource;
      giveAmount: number;
      want: Resource;
      wantAmount: number;
    }
  | { type: "tradeRespond"; offerId: string; accept: boolean };
export type CommandResult = { ok: boolean; message: string };
export type ClientMessage =
  | { type: "command"; id: string; version: 1; command: Command }
  | { type: "ping" };
export type ServerMessage =
  | { type: "welcome"; token: string; playerId: string; version: 1 }
  | { type: "state"; view: GameView }
  | { type: "ack"; id: string; result: CommandResult }
  | { type: "error"; message: string }
  | { type: "pong" };
export type BuildingDefinition = {
  name: string;
  description: string;
  cost: Partial<Inventory>;
  work: number;
  symbol: string;
};
export const BUILDINGS: Record<BuildingType, BuildingDefinition> = {
  floor: {
    name: "Deck plating",
    description: "A sturdy foundation above the tide.",
    cost: { scrap: 1 },
    work: 14,
    symbol: "▧",
  },
  wall: {
    name: "Bulkhead",
    description: "A reinforced wall. Blocks movement.",
    cost: { scrap: 4 },
    work: 35,
    symbol: "▥",
  },
  door: {
    name: "Hatch",
    description: "A passage through your bulkheads.",
    cost: { scrap: 3, components: 1 },
    work: 30,
    symbol: "▣",
  },
  bed: {
    name: "Crew bunk",
    description: "A place to rest and recover energy.",
    cost: { scrap: 3, fiber: 4 },
    work: 40,
    symbol: "▰",
  },
  stockpile: {
    name: "Stockpile",
    description: "A marked landing for gathered supplies.",
    cost: { scrap: 2 },
    work: 20,
    symbol: "▦",
  },
  foodStation: {
    name: "Galley",
    description: "Turns shore fiber into edible rations.",
    cost: { scrap: 8, components: 2 },
    work: 65,
    symbol: "◒",
  },
  generator: {
    name: "Tidal generator",
    description: "Consumes fuel to power the outpost.",
    cost: { scrap: 12, components: 4 },
    work: 90,
    symbol: "ϟ",
  },
  workshop: {
    name: "Fabricator",
    description: "Powered workshop converts scrap into components.",
    cost: { scrap: 10, components: 3 },
    work: 80,
    symbol: "⚒",
  },
  pump: {
    name: "Bilge pump",
    description: "Powered pump reduces tide-driven flooding.",
    cost: { scrap: 10, components: 3 },
    work: 70,
    symbol: "♒",
  },
  farm: {
    name: "Saltroot garden",
    description: "Crew tend renewable fiber crops using freshwater.",
    cost: { scrap: 4, fiber: 8 },
    work: 45,
    symbol: "♧",
  },
  infirmary: {
    name: "Infirmary",
    description: "Treat wounds and compound medicine.",
    cost: { scrap: 10, components: 3, medicine: 2 },
    work: 80,
    symbol: "✚",
  },
  lab: {
    name: "Research station",
    description: "Crew investigate frontier technologies.",
    cost: { scrap: 12, components: 4 },
    work: 90,
    symbol: "⚗",
  },
  battery: {
    name: "Accumulator",
    description: "Stores surplus electricity for outages.",
    cost: { scrap: 8, components: 4 },
    work: 65,
    symbol: "▰",
  },
  recycler: {
    name: "Biorefinery",
    description: "Refines renewable fiber into expedition fuel.",
    cost: { scrap: 12, components: 4 },
    work: 80,
    symbol: "♲",
  },
  reservoir: {
    name: "Rain cistern",
    description: "Collects water and increases freshwater reserves.",
    cost: { scrap: 6, components: 1 },
    work: 45,
    symbol: "◉",
  },
};
export const RESOURCE_LABELS: Record<Resource, string> = {
  scrap: "Scrap",
  fiber: "Fiber",
  rations: "Rations",
  components: "Components",
  medicine: "Medicine",
  fuel: "Fuel",
};
