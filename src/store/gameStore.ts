import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import { STAGE_ONE_WAVES } from "../campaign/campaignData";
import type {
  ArchitectureConfig,
  ArchitectureNodeId,
  AugmentType,
  BuildSystemType,
  GridPosition,
  NodeInstance,
  ShopItemType,
  WaveSimulationResult,
} from "../simulation/trafficSimulation";
import {
  DEFAULT_ARCHITECTURE_PERFORMANCE,
  FIXED_ENTRY_POSITION,
  FIXED_EXIT_POSITION,
  getBoardTier,
  getLinkTier,
  isGridPositionAvailable,
  isMaintenanceItem,
  MAINTENANCE_CATALOG,
  SYSTEM_CATALOG,
  validateArchitectureConnections,
  validateNewConnection,
} from "../simulation/trafficSimulation";

export type GamePhase =
  | "menu"
  | "prepare"
  | "running"
  | "result"
  | "cleared"
  | "defeated";

export type MaintenanceMode = "initial" | "regular" | "emergency";
export type InfrastructureUpgradeChoice = "link" | "board";

export interface LiveWaveMetrics {
  completed: number;
  failed: number;
  queueByServer: [number, number];
  databaseQueue: number;
}

export interface AugmentState {
  pendingInstanceId: string;
  equipmentName: string;
  starLevel: 2 | 3;
  options: AugmentType[];
}

interface GameState {
  phase: GamePhase;
  waveIndex: number;
  coins: number;
  serviceHp: number;
  worldReady: boolean;
  playerLevel: number;
  playerXp: number;
  shopItems: (ShopItemType | null)[];
  inventory: (NodeInstance | null)[];
  augmentState: AugmentState | null;
  pendingInfrastructureUpgrades: number;
  maintenanceMode: MaintenanceMode;
  maintenanceExtensionMs: number;
  emergencyMaintenanceCharges: number;
  architecture: ArchitectureConfig;
  liveMetrics: LiveWaveMetrics;
  lastResult: WaveSimulationResult | null;
  startMission: () => void;
  setWorldReady: (ready: boolean) => void;
  beginWave: () => void;
  updateWaveProgress: (metrics: LiveWaveMetrics) => void;
  completeWave: (result: WaveSimulationResult) => void;
  continueAfterResult: () => void;
  useEmergencyMaintenance: () => void;
  rollShop: (free?: boolean) => void;
  buyXp: () => void;
  buyShopItem: (shopIndex: number) => void;
  sellNode: (instanceId: string) => void;
  selectAugment: (augmentType: AugmentType) => void;
  chooseInfrastructureUpgrade: (
    choice: InfrastructureUpgradeChoice,
  ) => void;
  placeNode: (
    nodeId: ArchitectureNodeId,
    position: GridPosition,
    instanceId?: string,
  ) => void;
  moveNode: (nodeId: ArchitectureNodeId, position: GridPosition) => void;
  toggleConnection: (
    from: ArchitectureNodeId,
    to: ArchitectureNodeId,
  ) => void;
  clearConnections: () => void;
  resetCampaign: () => void;
}

export const INVENTORY_CAPACITY = 8;

export const SHOP_PROBABILITIES: Readonly<Record<number, readonly number[]>> = {
  1: [100, 0, 0, 0, 0],
  2: [75, 25, 0, 0, 0],
  3: [60, 30, 10, 0, 0],
  4: [45, 35, 17, 3, 0],
  5: [30, 35, 25, 10, 0],
  6: [20, 30, 35, 14, 1],
  7: [12, 25, 35, 24, 4],
  8: [8, 18, 33, 33, 8],
  9: [5, 14, 28, 35, 18],
  10: [3, 10, 22, 35, 30],
};

export const XP_REQUIREMENTS: Readonly<Record<number, number>> = {
  1: 2,
  2: 6,
  3: 10,
  4: 20,
  5: 36,
  6: 56,
  7: 80,
  8: 108,
  9: 140,
  10: 0,
};

export function getLevelUpCost(level: number): number {
  const costs: Record<number, number> = {
    1: 4,
    2: 6,
    3: 10,
    4: 16,
    5: 24,
    6: 34,
    7: 46,
    8: 60,
    9: 76,
  };
  return costs[level] ?? 0;
}

const DEPLOYABLE_ROLES = [
  "loadBalancer",
  "serverA",
  "serverB",
  "database",
] as const;

type DeployableRole = (typeof DEPLOYABLE_ROLES)[number];

const createInitialArchitecture = (): ArchitectureConfig => ({
  serverCount: 0,
  hasLoadBalancer: false,
  hasDatabase: false,
  databaseIndexed: false,
  linkLevel: 1,
  boardLevel: 1,
  nodePositions: {
    entry: { ...FIXED_ENTRY_POSITION },
    exit: { ...FIXED_EXIT_POSITION },
  },
  connections: [],
  boardSlots: {
    loadBalancer: null,
    serverA: null,
    serverB: null,
    database: null,
  },
  performance: { ...DEFAULT_ARCHITECTURE_PERFORMANCE },
});

function createStarterInventory(): (NodeInstance | null)[] {
  return Array<NodeInstance | null>(INVENTORY_CAPACITY).fill(null);
}

function createStarterArchitecture(): ArchitectureConfig {
  return createInitialArchitecture();
}

function createStarterState(): Pick<
  GameState,
  | "coins"
  | "serviceHp"
  | "playerLevel"
  | "playerXp"
  | "shopItems"
  | "inventory"
  | "architecture"
> {
  const inventory = createStarterInventory();
  const architecture = normalizeArchitecture(
    createStarterArchitecture(),
    inventory,
  );
  return {
    coins: 24,
    serviceHp: 100,
    playerLevel: 1,
    playerXp: 0,
    shopItems: ["ec2", "rdsPrimary", "apiGateway", "apache", "sqs"],
    inventory,
    architecture,
  };
}

const initialLiveMetrics = (): LiveWaveMetrics => ({
  completed: 0,
  failed: 0,
  queueByServer: [0, 0],
  databaseQueue: 0,
});

function isPositionOccupied(
  architecture: ArchitectureConfig,
  position: GridPosition,
  exceptNodeId?: ArchitectureNodeId,
): boolean {
  return (Object.keys(architecture.nodePositions) as ArchitectureNodeId[]).some(
    (nodeId) => {
      if (nodeId === exceptNodeId) {
        return false;
      }
      const candidate = architecture.nodePositions[nodeId];
      return candidate
        ? Math.hypot(
            candidate.column - position.column,
            candidate.row - position.row,
          ) < 120
        : false;
    },
  );
}

function rollEquipment(level: number): BuildSystemType {
  const probabilities =
    SHOP_PROBABILITIES[level] ?? SHOP_PROBABILITIES[1];
  const roll = Math.random() * 100;
  let cumulative = 0;
  let tier = 1;
  for (let index = 0; index < probabilities.length; index += 1) {
    cumulative += probabilities[index];
    if (roll <= cumulative) {
      tier = index + 1;
      break;
    }
  }
  const candidates = (
    Object.keys(SYSTEM_CATALOG) as BuildSystemType[]
  ).filter((type) => SYSTEM_CATALOG[type].tier === tier);
  return candidates[Math.floor(Math.random() * candidates.length)] ?? "ec2";
}

function rollShopItems(
  level: number,
  starter = false,
): ShopItemType[] {
  if (starter) {
    return ["ec2", "rdsPrimary", "apiGateway", "sqs", "apache"];
  }
  const maintenanceItems = Object.keys(
    MAINTENANCE_CATALOG,
  ) as ShopItemType[];
  return Array.from({ length: 5 }, () => {
    if (level >= 2 && Math.random() < 0.14) {
      return maintenanceItems[
        Math.floor(Math.random() * maintenanceItems.length)
      ];
    }
    return rollEquipment(level);
  });
}

function advanceLevel(
  level: number,
  xp: number,
  amount: number,
): { level: number; xp: number; levelsGained: number } {
  let nextLevel = level;
  let nextXp = xp + amount;
  let levelsGained = 0;
  while (
    nextLevel < 10 &&
    nextXp >= XP_REQUIREMENTS[nextLevel]
  ) {
    nextXp -= XP_REQUIREMENTS[nextLevel];
    nextLevel += 1;
    levelsGained += 1;
  }
  return { level: nextLevel, xp: nextXp, levelsGained };
}

function addInfrastructureUpgradeRewards(
  architecture: ArchitectureConfig,
  currentPending: number,
  levelsGained: number,
): number {
  const remainingChoices =
    (3 - architecture.boardLevel) + (3 - architecture.linkLevel);
  return Math.min(
    remainingChoices,
    currentPending + levelsGained,
  );
}

function roleAcceptsEquipment(
  role: DeployableRole,
  item: NodeInstance,
): boolean {
  const category = SYSTEM_CATALOG[item.type].category;
  if (role === "database") {
    return category === "database";
  }
  if (role === "loadBalancer") {
    return category === "loadBalancer";
  }
  return category === "server";
}

function getItemScale(item: NodeInstance): number {
  const tierScale = 1 + (SYSTEM_CATALOG[item.type].tier - 1) * 0.14;
  const starScale = item.starLevel === 3 ? 2.2 : item.starLevel === 2 ? 1.5 : 1;
  return tierScale * starScale;
}

function calculatePerformance(
  inventory: (NodeInstance | null)[],
  architecture: ArchitectureConfig,
) {
  const owned = inventory.filter(
    (item): item is NodeInstance => item !== null,
  );
  const byId = new Map(owned.map((item) => [item.id, item]));
  const serverItems = (["serverA", "serverB"] as const)
    .map((role) => byId.get(architecture.boardSlots[role] ?? ""))
    .filter((item): item is NodeInstance => Boolean(item));
  const databaseItem = architecture.boardSlots.database
    ? byId.get(architecture.boardSlots.database)
    : undefined;
  const loadBalancerItem = architecture.boardSlots.loadBalancer
    ? byId.get(architecture.boardSlots.loadBalancer)
    : undefined;

  const maxServerScale = Math.max(
    1,
    ...serverItems.map(getItemScale),
  );
  const databaseScale = databaseItem ? getItemScale(databaseItem) : 1;
  const loadBalancerScale = loadBalancerItem
    ? getItemScale(loadBalancerItem)
    : 1;
  const has = (type: BuildSystemType) =>
    owned.some((item) => item.type === type);
  const countAugment = (augment: AugmentType) =>
    owned.filter((item) => item.augment === augment).length;

  return {
    serverConcurrency:
      Math.max(2, Math.round(2 * maxServerScale)) +
      countAugment("autoScaler"),
    serverQueueCapacity:
      6 +
      countAugment("serverRam") * 4 +
      (has("sqs") ? 3 : 0) +
      (has("kafka") ? 5 : 0),
    serverProcessingMultiplier: Math.max(
      0.32,
      (1 / maxServerScale) *
        Math.pow(0.72, countAugment("serverCpu")) *
        Math.pow(0.85, countAugment("autoScaler")),
    ),
    databaseConcurrency:
      Math.max(2, Math.round(2 * databaseScale)) +
      countAugment("dbSharding") * 2 +
      (has("rdsReplica") ? 1 : 0),
    databaseQueueCapacity:
      8 +
      countAugment("dbStorage") * 6 +
      (has("kafka") ? 4 : 0) +
      (has("s3") ? 4 : 0),
    databaseProcessingMultiplier: Math.max(
      0.24,
      (1 / databaseScale) *
        Math.pow(0.68, countAugment("dbQuery")) *
        Math.pow(0.48, countAugment("dax")) *
        (has("redis") ? 0.72 : 1) *
        (has("rdsReplica") ? 0.86 : 1),
    ),
    responseMultiplier: Math.max(
      0.45,
      (1 / loadBalancerScale) *
        Math.pow(0.88, countAugment("lbHealth")),
    ),
    loadBalancerBackendLimit:
      2 + countAugment("lbBackends") * 2,
  };
}

function normalizeArchitecture(
  architecture: ArchitectureConfig,
  inventory: (NodeInstance | null)[],
): ArchitectureConfig {
  const ids = new Set(
    inventory
      .filter((item): item is NodeInstance => item !== null)
      .map((item) => item.id),
  );
  const boardSlots = { ...architecture.boardSlots };
  const nodePositions = { ...architecture.nodePositions };

  for (const role of DEPLOYABLE_ROLES) {
    if (boardSlots[role] && !ids.has(boardSlots[role]!)) {
      boardSlots[role] = null;
      delete nodePositions[role];
    }
  }

  const serverCount = (
    Number(Boolean(boardSlots.serverA)) +
    Number(Boolean(boardSlots.serverB))
  ) as 0 | 1 | 2;
  const placedNodes = new Set<ArchitectureNodeId>([
    "entry",
    "exit",
    ...DEPLOYABLE_ROLES.filter((role) => Boolean(boardSlots[role])),
  ]);
  const normalized: ArchitectureConfig = {
    ...architecture,
    serverCount,
    hasLoadBalancer: Boolean(boardSlots.loadBalancer),
    hasDatabase: Boolean(boardSlots.database),
    boardSlots,
    nodePositions,
    connections: architecture.connections.filter(
      (connection) =>
        placedNodes.has(connection.from) &&
        placedNodes.has(connection.to),
    ),
  };
  const databaseItem = inventory.find(
    (item) => item?.id === boardSlots.database,
  );
  normalized.databaseIndexed =
    databaseItem?.augment === "dbQuery" ||
    databaseItem?.augment === "dax" ||
    inventory.some((item) => item?.type === "redis");
  normalized.performance = calculatePerformance(inventory, normalized);
  return normalized;
}

function getAugmentOptions(item: NodeInstance): AugmentType[] {
  const category = SYSTEM_CATALOG[item.type].category;
  const commonByCategory: Record<string, AugmentType[]> = {
    server: ["serverRam", "serverCpu", "autoScaler"],
    database: ["dbQuery", "dbStorage", "dbSharding"],
    loadBalancer: ["lbBackends", "lbAlgorithm", "lbHealth"],
    queue: ["queuePartitions", "queueConsumers", "serverRam"],
    cache: ["cacheHitRate", "dbQuery", "serverRam"],
    security: ["securityRules", "scrubbing", "serverRam"],
    storage: ["storageThroughput", "dbStorage", "cacheHitRate"],
  };
  const options = [...(commonByCategory[category] ?? commonByCategory.server)];
  const rareChance = item.starLevel === 3 ? 0.15 : 0.05;
  if (Math.random() < rareChance) {
    const rareByCategory: Record<string, AugmentType> = {
      server: "autoScaler",
      database: "dax",
      loadBalancer: "lbAlgorithm",
      queue: "queuePartitions",
      cache: "dax",
      security: "scrubbing",
      storage: "storageThroughput",
    };
    options[2] = rareByCategory[category] ?? "autoScaler";
  }
  return [...new Set(options)].slice(0, 3);
}

function mergeInventory(
  inventory: (NodeInstance | null)[],
  architecture: ArchitectureConfig,
): {
  inventory: (NodeInstance | null)[];
  architecture: ArchitectureConfig;
  merged?: NodeInstance;
} {
  const groups = new Map<string, Array<{ item: NodeInstance; index: number }>>();
  inventory.forEach((item, index) => {
    if (!item || item.starLevel >= 3) {
      return;
    }
    const key = `${item.type}:${item.starLevel}`;
    const group = groups.get(key) ?? [];
    group.push({ item, index });
    groups.set(key, group);
  });
  const group = [...groups.values()].find((items) => items.length >= 3);
  if (!group) {
    return { inventory, architecture };
  }

  const consumed = group.slice(0, 3);
  const consumedIds = new Set(consumed.map(({ item }) => item.id));
  const merged: NodeInstance = {
    id: uuidv4(),
    type: consumed[0].item.type,
    starLevel: (consumed[0].item.starLevel + 1) as 2 | 3,
  };
  const nextInventory = [...inventory];
  consumed.forEach(({ index }) => {
    nextInventory[index] = null;
  });
  nextInventory[consumed[0].index] = merged;

  const nextArchitecture: ArchitectureConfig = {
    ...architecture,
    boardSlots: { ...architecture.boardSlots },
    nodePositions: { ...architecture.nodePositions },
  };
  const occupiedRoles = DEPLOYABLE_ROLES.filter((role) =>
    consumedIds.has(nextArchitecture.boardSlots[role] ?? ""),
  );
  occupiedRoles.forEach((role, index) => {
    if (index === 0) {
      nextArchitecture.boardSlots[role] = merged.id;
    } else {
      nextArchitecture.boardSlots[role] = null;
      delete nextArchitecture.nodePositions[role];
    }
  });

  return {
    inventory: nextInventory,
    architecture: normalizeArchitecture(nextArchitecture, nextInventory),
    merged,
  };
}

export const useGameStore = create<GameState>((set) => ({
  phase: "menu",
  waveIndex: 0,
  coins: 240,
  serviceHp: 100,
  worldReady: false,
  playerLevel: 1,
  playerXp: 0,
  shopItems: [null, null, null, null, null],
  inventory: Array<NodeInstance | null>(INVENTORY_CAPACITY).fill(null),
  augmentState: null,
  pendingInfrastructureUpgrades: 0,
  maintenanceMode: "initial",
  maintenanceExtensionMs: 0,
  emergencyMaintenanceCharges: 0,
  architecture: createInitialArchitecture(),
  liveMetrics: initialLiveMetrics(),
  lastResult: null,

  startMission: () =>
    set({
      phase: "prepare",
      maintenanceMode: "initial",
      ...createStarterState(),
    }),

  setWorldReady: (worldReady) => set({ worldReady }),

  beginWave: () =>
    set({
      phase: "running",
      liveMetrics: initialLiveMetrics(),
      lastResult: null,
    }),

  updateWaveProgress: (liveMetrics) => set({ liveMetrics }),

  completeWave: (result) =>
    set((state) => {
      const isFinalWave = state.waveIndex === STAGE_ONE_WAVES.length - 1;
      const hpDamage = Math.min(30, Math.ceil(result.metrics.failed * 1.5));
      const serviceHp = Math.max(0, state.serviceHp - hpDamage);
      const interest = Math.min(5, Math.floor(state.coins / 10));
      return {
        phase:
          serviceHp <= 0
            ? "defeated"
            : isFinalWave
              ? "cleared"
              : "result",
        coins: state.coins + result.metrics.earnedCoins + interest,
        serviceHp,
        lastResult: result,
      };
    }),

  continueAfterResult: () =>
    set((state) => {
      return {
        phase: "prepare",
        maintenanceMode: "regular",
        waveIndex: Math.min(
          state.waveIndex + 1,
          STAGE_ONE_WAVES.length - 1,
        ),
        shopItems: rollShopItems(state.playerLevel),
      };
    }),

  useEmergencyMaintenance: () =>
    set((state) => {
      if (
        state.phase !== "running" ||
        state.emergencyMaintenanceCharges <= 0
      ) {
        return state;
      }
      return {
        phase: "prepare",
        maintenanceMode: "emergency",
        emergencyMaintenanceCharges:
          state.emergencyMaintenanceCharges - 1,
        liveMetrics: initialLiveMetrics(),
      };
    }),

  rollShop: (free = false) =>
    set((state) => {
      if (
        (state.phase !== "prepare" && state.phase !== "running") ||
        (!free && state.coins < 2)
      ) {
        return state;
      }
      return {
        coins: free ? state.coins : state.coins - 2,
        shopItems: rollShopItems(state.playerLevel),
      };
    }),

  buyXp: () =>
    set((state) => {
      const levelUpCost = getLevelUpCost(state.playerLevel);
      if (
        (state.phase !== "prepare" && state.phase !== "running") ||
        state.coins < levelUpCost ||
        state.playerLevel >= 10
      ) {
        return state;
      }
      const progress = advanceLevel(
        state.playerLevel,
        state.playerXp,
        4,
      );
      return {
        coins: state.coins - levelUpCost,
        playerXp: progress.xp,
        playerLevel: progress.level,
        pendingInfrastructureUpgrades: addInfrastructureUpgradeRewards(
          state.architecture,
          state.pendingInfrastructureUpgrades,
          progress.levelsGained,
        ),
      };
    }),

  buyShopItem: (shopIndex) =>
    set((state) => {
      if (state.phase !== "prepare" && state.phase !== "running") {
        return state;
      }
      const shopItem = state.shopItems[shopIndex];
      if (!shopItem) {
        return state;
      }
      const price = isMaintenanceItem(shopItem)
        ? MAINTENANCE_CATALOG[shopItem].cost
        : SYSTEM_CATALOG[shopItem].cost;
      if (state.coins < price) {
        return state;
      }
      const nextShop = [...state.shopItems];
      nextShop[shopIndex] = null;

      if (isMaintenanceItem(shopItem)) {
        return {
          coins: state.coins - price,
          shopItems: nextShop,
          emergencyMaintenanceCharges:
            state.emergencyMaintenanceCharges +
            (shopItem === "extendedMaintenance" ? 0 : 1),
          maintenanceExtensionMs:
            state.maintenanceExtensionMs +
            (shopItem === "emergencyMaintenance" ? 0 : 10_000),
        };
      }

      const emptyIndex = state.inventory.findIndex((item) => item === null);
      if (emptyIndex < 0) {
        return state;
      }
      const nextInventory = [...state.inventory];
      nextInventory[emptyIndex] = {
        id: uuidv4(),
        type: shopItem,
        starLevel: 1,
      };
      const merge = mergeInventory(nextInventory, state.architecture);
      return {
        coins: state.coins - price,
        shopItems: nextShop,
        inventory: merge.inventory,
        architecture: normalizeArchitecture(
          merge.architecture,
          merge.inventory,
        ),
        augmentState: merge.merged
          ? {
              pendingInstanceId: merge.merged.id,
              equipmentName: SYSTEM_CATALOG[merge.merged.type].name,
              starLevel: merge.merged.starLevel as 2 | 3,
              options: getAugmentOptions(merge.merged),
            }
          : state.augmentState,
      };
    }),

  sellNode: (instanceId) =>
    set((state) => {
      const index = state.inventory.findIndex(
        (item) => item?.id === instanceId,
      );
      if (index < 0) {
        return state;
      }
      const item = state.inventory[index]!;
      const refundMultiplier =
        item.starLevel === 3 ? 6 : item.starLevel === 2 ? 2.5 : 1;
      const nextInventory = [...state.inventory];
      nextInventory[index] = null;
      return {
        coins:
          state.coins +
          Math.floor(SYSTEM_CATALOG[item.type].cost * refundMultiplier),
        inventory: nextInventory,
        architecture: normalizeArchitecture(
          state.architecture,
          nextInventory,
        ),
      };
    }),

  selectAugment: (augmentType) =>
    set((state) => {
      if (!state.augmentState) {
        return state;
      }
      const targetId = state.augmentState.pendingInstanceId;
      const nextInventory: (NodeInstance | null)[] = state.inventory.map(
        (item) =>
          item && item.id === targetId
            ? { ...item, augment: augmentType }
            : item,
      );
      return {
        inventory: nextInventory,
        architecture: normalizeArchitecture(
          state.architecture,
          nextInventory,
        ),
        augmentState: null,
      };
    }),

  chooseInfrastructureUpgrade: (choice) =>
    set((state) => {
      if (state.pendingInfrastructureUpgrades <= 0) {
        return state;
      }
      const nextArchitecture = { ...state.architecture };
      if (choice === "link" && nextArchitecture.linkLevel < 3) {
        nextArchitecture.linkLevel = (nextArchitecture.linkLevel + 1) as 2 | 3;
      }
      if (choice === "board" && nextArchitecture.boardLevel < 3) {
        nextArchitecture.boardLevel = (nextArchitecture.boardLevel + 1) as 2 | 3;
      }
      return {
        architecture: nextArchitecture,
        pendingInfrastructureUpgrades:
          state.pendingInfrastructureUpgrades - 1,
      };
    }),

  placeNode: (nodeId, position, instanceId) =>
    set((state) => {
      if (
        (state.phase !== "prepare" && state.phase !== "running") ||
        nodeId === "entry" ||
        nodeId === "exit" ||
        !instanceId ||
        !isGridPositionAvailable(state.architecture, position) ||
        isPositionOccupied(state.architecture, position, nodeId)
      ) {
        return state;
      }
      const item = state.inventory.find(
        (candidate) => candidate?.id === instanceId,
      );
      if (
        !item ||
        !roleAcceptsEquipment(nodeId as DeployableRole, item)
      ) {
        return state;
      }
      const nextArchitecture: ArchitectureConfig = {
        ...state.architecture,
        boardSlots: { ...state.architecture.boardSlots },
        nodePositions: { ...state.architecture.nodePositions },
      };
      for (const role of DEPLOYABLE_ROLES) {
        if (nextArchitecture.boardSlots[role] === instanceId) {
          nextArchitecture.boardSlots[role] = null;
          delete nextArchitecture.nodePositions[role];
        }
      }
      nextArchitecture.boardSlots[nodeId as DeployableRole] = instanceId;
      nextArchitecture.nodePositions[nodeId] = position;
      return {
        architecture: normalizeArchitecture(
          nextArchitecture,
          state.inventory,
        ),
      };
    }),

  moveNode: (nodeId, position) =>
    set((state) => {
      if (
        (state.phase !== "prepare" && state.phase !== "running") ||
        nodeId === "entry" ||
        nodeId === "exit" ||
        state.architecture.nodePositions[nodeId] === undefined ||
        !isGridPositionAvailable(state.architecture, position) ||
        isPositionOccupied(state.architecture, position, nodeId)
      ) {
        return state;
      }
      const architecture: ArchitectureConfig = {
        ...state.architecture,
        nodePositions: {
          ...state.architecture.nodePositions,
          [nodeId]: position,
        },
      };
      if (!validateArchitectureConnections(architecture).valid) {
        return state;
      }
      return { architecture };
    }),

  toggleConnection: (from, to) =>
    set((state) => {
      if (
        (state.phase !== "prepare" && state.phase !== "running") ||
        from === to ||
        !state.architecture.nodePositions[from] ||
        !state.architecture.nodePositions[to]
      ) {
        return state;
      }
      const exists = state.architecture.connections.some(
        (connection) =>
          (connection.from === from && connection.to === to) ||
          (connection.from === to && connection.to === from),
      );
      if (
        !exists &&
        !validateNewConnection(state.architecture, from, to).valid
      ) {
        return state;
      }
      return {
        architecture: {
          ...state.architecture,
          connections: exists
            ? state.architecture.connections.filter(
                (connection) =>
                  !(
                    (connection.from === from && connection.to === to) ||
                    (connection.from === to && connection.to === from)
                  ),
              )
            : [...state.architecture.connections, { from, to }],
        },
      };
    }),

  clearConnections: () =>
    set((state) => ({
      architecture: {
        ...state.architecture,
        connections: [],
      },
    })),

  resetCampaign: () =>
    set({
      phase: "prepare",
      waveIndex: 0,
      ...createStarterState(),
      augmentState: null,
      pendingInfrastructureUpgrades: 0,
      maintenanceMode: "initial",
      maintenanceExtensionMs: 0,
      emergencyMaintenanceCharges: 0,
      liveMetrics: initialLiveMetrics(),
      lastResult: null,
    }),
}));
