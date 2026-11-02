import type { Inventory, Resource, Point } from "./index";
export type Injury = {
  id: string;
  kind: "cut" | "fracture" | "infection" | "exposure";
  severity: number;
  tended: boolean;
  infection: number;
};
export type Memory = { text: string; impact: number; expiresTick: number };
export type MindState = {
  traits: string[];
  memories: Memory[];
  relationships: Record<string, number>;
  stress: number;
  breakUntil: number;
  skills: Record<string, number>;
};
export type ProductionBill = {
  id: string;
  recipeId: string;
  remaining: number;
  progress: number;
  workerId: string | null;
};
export type ColonySystems = {
  water: number;
  waterCapacity: number;
  storageCapacity: number;
  battery: number;
  flood: number;
  tide: number;
  oxygen: number;
  roomCount: number;
  foodSpoilProgress: number;
  production: ProductionBill[];
  researchProject: string | null;
  researchProgress: number;
  unlocked: string[];
  sheltered: boolean;
  workPolicy: "balanced" | "rest" | "intensive";
  rationing: boolean;
  lastDirectorTick: number;
  aidReceived?: boolean;
};
export type ExpeditionSite = {
  id: string;
  name: string;
  description: string;
  risk: number;
  x: number;
  y: number;
  kind: "salvage" | "ruin" | "nest";
  loot: Partial<Inventory>;
};
export type CombatUnit = Point & {
  id: string;
  colonistId: string | null;
  ownerId: string;
  name: string;
  health: number;
  maxHealth: number;
  cooldown: number;
  targetId: string | null;
  moveTarget: Point | null;
  weapon: "carbine" | "claws";
  downed: boolean;
};
export type Expedition = {
  id: string;
  ownerId: string;
  siteId: string;
  colonistIds: string[];
  phase: "outbound" | "exploring" | "combat" | "returning" | "complete";
  departTick: number;
  arrivalTick: number;
  cargo: Partial<Inventory>;
  units: CombatUnit[];
  log: string[];
  retreating: boolean;
  losses: number;
};
export type RecipeDefinition = {
  id: string;
  name: string;
  station: string;
  inputs: Partial<Inventory>;
  outputs: Partial<Inventory>;
  work: number;
  research?: string;
};
export type ResearchDefinition = {
  id: string;
  name: string;
  description: string;
  cost: number;
  requires: string[];
};
export const RECIPES: RecipeDefinition[] = [
  {
    id: "rations",
    name: "Prepare rations",
    station: "foodStation",
    inputs: { fiber: 3 },
    outputs: { rations: 2 },
    work: 30,
  },
  {
    id: "components",
    name: "Fabricate component",
    station: "workshop",
    inputs: { scrap: 5 },
    outputs: { components: 1 },
    work: 45,
  },
  {
    id: "medicine",
    name: "Compound medicine",
    station: "infirmary",
    inputs: { fiber: 5, components: 1 },
    outputs: { medicine: 2 },
    work: 50,
    research: "medicine",
  },
  {
    id: "fuel",
    name: "Refine biofuel",
    station: "recycler",
    inputs: { fiber: 6, scrap: 2 },
    outputs: { fuel: 3 },
    work: 50,
    research: "industry",
  },
];
export const RESEARCH: ResearchDefinition[] = [
  {
    id: "hydraulics",
    name: "Tidal hydraulics",
    description: "Improve pumping and freshwater collection.",
    cost: 80,
    requires: [],
  },
  {
    id: "agriculture",
    name: "Saltroot cultivation",
    description: "Increase sustainable crop yields.",
    cost: 100,
    requires: [],
  },
  {
    id: "medicine",
    name: "Marine medicine",
    description: "Unlock medicine compounding and improve tending.",
    cost: 120,
    requires: [],
  },
  {
    id: "industry",
    name: "Closed-loop industry",
    description: "Unlock biofuel refining and efficient fabrication.",
    cost: 160,
    requires: ["hydraulics"],
  },
  {
    id: "ballistics",
    name: "Salvage ballistics",
    description: "Improve expedition weapon accuracy.",
    cost: 150,
    requires: [],
  },
  {
    id: "abyss",
    name: "Abyssal resonance",
    description: "A frontier breakthrough for deep exploration.",
    cost: 240,
    requires: ["hydraulics", "medicine"],
  },
];
export type MechanicsCommand =
  | { type: "queueRecipe"; recipeId: string; quantity: number }
  | { type: "cancelRecipe"; billId: string }
  | { type: "tend"; colonistId: string }
  | { type: "research"; projectId: string }
  | { type: "policy"; policy: "work" | "rationing" | "shelter"; value: string }
  | { type: "expeditionLaunch"; siteId: string; colonistIds: string[] }
  | {
      type: "expeditionOrder";
      expeditionId: string;
      unitId: string;
      x: number;
      y: number;
    }
  | {
      type: "expeditionAttack";
      expeditionId: string;
      unitId: string;
      targetId: string;
    }
  | { type: "expeditionRetreat"; expeditionId: string };
