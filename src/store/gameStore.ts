import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import { STAGE_ONE_WAVES } from "../campaign/campaignData";
import { playRequestSuccess } from "../audio/audioDirector";
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
import {
  createRuntimeSimulationState,
  stepRuntimeSimulation,
  applyRuntimeArchitectureMutation,
  isRuntimeWaveSettled,
  buildWaveResultFromRuntime,
  type RuntimeSimulationState,
} from "../simulation/runtimeEngine";

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
  deployedEquipment: Record<string, NodeInstance>;
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
  runtimeState: RuntimeSimulationState | null;
  stepSimulation: (deltaMs: number) => void;
  equipModule: (nodeId: ArchitectureNodeId, instanceId: string) => void;
  unequipModule: (nodeId: ArchitectureNodeId, moduleType: BuildSystemType) => void;
  unplaceNode: (nodeId: ArchitectureNodeId) => void;
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
  | "deployedEquipment"
  | "architecture"
> {
  const inventory = createStarterInventory();
  const deployedEquipment: Record<string, NodeInstance> = {};
  const architecture = normalizeArchitecture(
    createStarterArchitecture(),
    inventory,
    deployedEquipment,
  );
  return {
    coins: 24,
    serviceHp: 100,
    playerLevel: 1,
    playerXp: 0,
    shopItems: ["ec2", "rdsPrimary", "apiGateway", "apache", "sqs"],
    inventory,
    deployedEquipment,
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

  // 장착된 모듈 검증 헬퍼
  const hasModuleOnServer = (type: BuildSystemType) =>
    serverItems.some((item) => item.modules?.includes(type));
  
  const hasModuleOnDatabase = (type: BuildSystemType) =>
    databaseItem?.modules?.includes(type) ?? false;

  const countAugment = (augment: AugmentType) =>
    owned.filter((item) => item.augment === augment).length;

  return {
    serverConcurrency:
      Math.max(2, Math.round(2 * maxServerScale)) +
      countAugment("autoScaler"),
    serverQueueCapacity:
      6 +
      countAugment("serverRam") * 4 +
      (hasModuleOnServer("sqs") ? 3 : 0) +
      (hasModuleOnServer("kafka") ? 5 : 0),
    serverProcessingMultiplier: Math.max(
      0.32,
      (1 / maxServerScale) *
        Math.pow(0.72, countAugment("serverCpu")) *
        Math.pow(0.85, countAugment("autoScaler")),
    ),
    databaseConcurrency:
      Math.max(2, Math.round(2 * databaseScale)) +
      countAugment("dbSharding") * 2 +
      (hasModuleOnDatabase("rdsReplica") || hasModuleOnDatabase("documentDb") ? 1 : 0),
    databaseQueueCapacity:
      8 +
      countAugment("dbStorage") * 6 +
      (hasModuleOnServer("kafka") || hasModuleOnDatabase("kafka") ? 4 : 0) +
      (hasModuleOnDatabase("s3") ? 4 : 0),
    databaseProcessingMultiplier: Math.max(
      0.24,
      (1 / databaseScale) *
        Math.pow(0.68, countAugment("dbQuery")) *
        Math.pow(0.48, countAugment("dax")) *
        (hasModuleOnDatabase("redis") ? 0.72 : 1) *
        (hasModuleOnDatabase("rdsReplica") || hasModuleOnDatabase("documentDb") ? 0.86 : 1),
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
  deployedEquipment: Record<string, NodeInstance> = {},
): ArchitectureConfig {
  const allEquipment = [
    ...inventory.filter((item): item is NodeInstance => item !== null),
    ...Object.values(deployedEquipment),
  ];
  const ids = new Set(allEquipment.map((item) => item.id));
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
  const databaseItem = allEquipment.find(
    (item) => item?.id === boardSlots.database,
  );
  normalized.databaseIndexed =
    databaseItem?.augment === "dbQuery" ||
    databaseItem?.augment === "dax" ||
    allEquipment.some((item) => item?.type === "redis");
  normalized.performance = calculatePerformance(allEquipment, normalized);
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

interface MergeCandidate {
  item: NodeInstance;
  source: "inventory" | "deployed";
  index?: number;
  role?: string;
}

function mergeInventory(
  inventory: (NodeInstance | null)[],
  architecture: ArchitectureConfig,
  deployedEquipment: Record<string, NodeInstance> = {},
): {
  inventory: (NodeInstance | null)[];
  deployedEquipment: Record<string, NodeInstance>;
  architecture: ArchitectureConfig;
  merged?: NodeInstance;
} {
  let currentInventory = [...inventory];
  let currentDeployed = { ...deployedEquipment };
  let currentArchitecture = {
    ...architecture,
    boardSlots: { ...architecture.boardSlots },
    nodePositions: { ...architecture.nodePositions },
  };
  let lastMerged: NodeInstance | undefined = undefined;

  while (true) {
    const candidates: MergeCandidate[] = [];
    currentInventory.forEach((item, index) => {
      if (item && item.starLevel < 3) {
        candidates.push({ item, source: "inventory", index });
      }
    });

    for (const role of DEPLOYABLE_ROLES) {
      const instanceId = currentArchitecture.boardSlots[role];
      if (instanceId) {
        const item = currentDeployed[instanceId];
        if (item && item.starLevel < 3) {
          candidates.push({ item, source: "deployed", role });
        }
      }
    }

    const groups = new Map<string, MergeCandidate[]>();
    candidates.forEach((cand) => {
      const key = `${cand.item.type}:${cand.item.starLevel}`;
      const group = groups.get(key) ?? [];
      group.push(cand);
      groups.set(key, group);
    });

    const group = [...groups.values()].find((items) => items.length >= 3);
    if (!group) {
      break;
    }

    const consumed = group.slice(0, 3);
    
    // 모듈 수집
    const collectedModules: BuildSystemType[] = [];
    consumed.forEach((cand) => {
      if (cand.item.modules) {
        cand.item.modules.forEach((mod) => {
          if (!collectedModules.includes(mod)) {
            collectedModules.push(mod);
          }
        });
      }
    });

    const merged: NodeInstance = {
      id: uuidv4(),
      type: consumed[0].item.type,
      starLevel: (consumed[0].item.starLevel + 1) as 2 | 3,
      modules: collectedModules.slice(0, 2),
    };
    lastMerged = merged;

    // 소모되기 전의 원래 위치 및 역할 기억
    const deployedConsumed = consumed.filter((c) => c.source === "deployed");
    let primaryRole: DeployableRole | undefined = undefined;
    let originalPosition: GridPosition | undefined = undefined;
    if (deployedConsumed.length > 0) {
      primaryRole = deployedConsumed[0].role as DeployableRole;
      originalPosition = currentArchitecture.nodePositions[primaryRole as ArchitectureNodeId];
    }

    // 소모 처리
    consumed.forEach((cand) => {
      if (cand.source === "inventory") {
        currentInventory[cand.index!] = null;
      } else if (cand.source === "deployed") {
        const instanceId = cand.item.id;
        delete currentDeployed[instanceId];
        currentArchitecture.boardSlots[cand.role as DeployableRole] = null;
        delete currentArchitecture.nodePositions[cand.role as ArchitectureNodeId];
      }
    });

    // 남은 모듈은 인벤토리에 환수
    const remainingModules = collectedModules.slice(2);
    remainingModules.forEach((mod) => {
      const emptyIndex = currentInventory.findIndex((slot) => slot === null);
      if (emptyIndex >= 0) {
        currentInventory[emptyIndex] = {
          id: uuidv4(),
          type: mod,
          starLevel: 1,
        };
      }
    });

    // 합성 결과 배치
    if (primaryRole) {
      currentArchitecture.boardSlots[primaryRole] = merged.id;
      if (originalPosition) {
        currentArchitecture.nodePositions[primaryRole as ArchitectureNodeId] = originalPosition;
      }
      currentDeployed[merged.id] = merged;
    } else {
      const firstInventoryIndex = consumed[0].index!;
      currentInventory[firstInventoryIndex] = merged;
    }
  }

  return {
    inventory: currentInventory,
    deployedEquipment: currentDeployed,
    architecture: normalizeArchitecture(
      currentArchitecture,
      currentInventory,
      currentDeployed,
    ),
    merged: lastMerged,
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
  deployedEquipment: {},
  augmentState: null,
  pendingInfrastructureUpgrades: 0,
  maintenanceMode: "initial",
  maintenanceExtensionMs: 0,
  emergencyMaintenanceCharges: 0,
  architecture: createInitialArchitecture(),
  liveMetrics: initialLiveMetrics(),
  lastResult: null,
  runtimeState: null,

  startMission: () =>
    set({
      phase: "prepare",
      maintenanceMode: "initial",
      ...createStarterState(),
    }),

  setWorldReady: (worldReady) => set({ worldReady }),

  beginWave: () =>
    set((state) => {
      const wave = STAGE_ONE_WAVES[state.waveIndex];
      const runtimeState = createRuntimeSimulationState(state.architecture, wave);
      return {
        phase: "running",
        liveMetrics: initialLiveMetrics(),
        lastResult: null,
        runtimeState,
      };
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
      const merge = mergeInventory(nextInventory, state.architecture, state.deployedEquipment);
      return {
        coins: state.coins - price,
        shopItems: nextShop,
        inventory: merge.inventory,
        deployedEquipment: merge.deployedEquipment,
        architecture: normalizeArchitecture(
          merge.architecture,
          merge.inventory,
          merge.deployedEquipment,
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
      let itemIndex = state.inventory.findIndex((candidate) => candidate?.id === instanceId);
      let item: NodeInstance | null = null;
      const nextInventory = [...state.inventory];
      const nextDeployedEquipment = { ...state.deployedEquipment };

      if (itemIndex >= 0) {
        item = state.inventory[itemIndex];
        nextInventory[itemIndex] = null;
      } else if (state.deployedEquipment[instanceId]) {
        item = state.deployedEquipment[instanceId];
        delete nextDeployedEquipment[instanceId];
      }

      if (!item) {
        return state;
      }

      const isPassive = isMaintenanceItem(item.type);
      const spec = isPassive ? (MAINTENANCE_CATALOG as any)[item.type] : (SYSTEM_CATALOG as any)[item.type];
      const baseCost = spec ? spec.cost : 0;

      const refundMultiplier =
        item.starLevel === 3 ? 4.5 : item.starLevel === 2 ? 1.5 : 0.5;

      const nextArchitecture = {
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

      const normalized = normalizeArchitecture(
        nextArchitecture,
        nextInventory,
        nextDeployedEquipment,
      );

      return {
        coins: state.coins + Math.floor(baseCost * refundMultiplier),
        inventory: nextInventory,
        deployedEquipment: nextDeployedEquipment,
        architecture: normalized,
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
      const nextDeployedEquipment = { ...state.deployedEquipment };
      if (nextDeployedEquipment[targetId]) {
        nextDeployedEquipment[targetId] = {
          ...nextDeployedEquipment[targetId],
          augment: augmentType,
        };
      }
      return {
        inventory: nextInventory,
        deployedEquipment: nextDeployedEquipment,
        architecture: normalizeArchitecture(
          state.architecture,
          nextInventory,
          nextDeployedEquipment,
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
      ) || state.deployedEquipment[instanceId];
      if (
        !item ||
        !roleAcceptsEquipment(nodeId as DeployableRole, item)
      ) {
        return state;
      }
      const nextInventory = [...state.inventory];
      const nextDeployedEquipment = { ...state.deployedEquipment };
      const itemIndex = state.inventory.findIndex((candidate) => candidate?.id === instanceId);
      if (itemIndex >= 0) {
        nextInventory[itemIndex] = null;
      }
      nextDeployedEquipment[instanceId] = item;

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
      
      const normalized = normalizeArchitecture(
        nextArchitecture,
        nextInventory,
        nextDeployedEquipment,
      );
      
      let nextRuntime = state.runtimeState;
      if (nextRuntime && state.phase === "running") {
        nextRuntime = applyRuntimeArchitectureMutation(nextRuntime, normalized);
      }

      return {
        inventory: nextInventory,
        deployedEquipment: nextDeployedEquipment,
        architecture: normalized,
        runtimeState: nextRuntime,
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
      
      let nextRuntime = state.runtimeState;
      if (nextRuntime && state.phase === "running") {
        nextRuntime = applyRuntimeArchitectureMutation(nextRuntime, architecture);
      }

      return {
        architecture,
        runtimeState: nextRuntime,
      };
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
      const nextArchitecture = {
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
      };

      let nextRuntime = state.runtimeState;
      if (nextRuntime && state.phase === "running") {
        nextRuntime = applyRuntimeArchitectureMutation(nextRuntime, nextArchitecture);
      }

      return {
        architecture: nextArchitecture,
        runtimeState: nextRuntime,
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
      runtimeState: null,
    }),

  stepSimulation: (deltaMs) =>
    set((state) => {
      if (!state.runtimeState || state.phase !== "running") {
        return state;
      }
      const prevCompleted = state.runtimeState.metrics.completed;
      const prevFailed =
        state.runtimeState.metrics.dropped +
        state.runtimeState.metrics.timedOut;
      const nextRuntime = stepRuntimeSimulation(state.runtimeState, deltaMs);
      
      const liveMetrics: LiveWaveMetrics = {
        completed: nextRuntime.metrics.completed,
        failed: nextRuntime.metrics.dropped + nextRuntime.metrics.timedOut,
        queueByServer: [
          nextRuntime.nodes.serverA.queue.length,
          nextRuntime.nodes.serverB.queue.length,
        ],
        databaseQueue: nextRuntime.nodes.database.queue.length,
      };

      const nextCompleted = nextRuntime.metrics.completed;
      const diffCompleted = nextCompleted - prevCompleted;
      const nextFailed = nextRuntime.metrics.dropped + nextRuntime.metrics.timedOut;
      const diffFailed = nextFailed - prevFailed;

      if (diffCompleted > 0) {
        playRequestSuccess();
      }

      const hpDamage = diffFailed * 2;
      const coinsGained = diffCompleted * 1;

      const serviceHp = Math.max(0, state.serviceHp - hpDamage);
      const coins = state.coins + coinsGained;

      let phase: GamePhase = state.phase;
      let lastResult = state.lastResult;
      
      if (serviceHp <= 0) {
        phase = "defeated";
        lastResult = buildWaveResultFromRuntime(nextRuntime);
      } else if (isRuntimeWaveSettled(nextRuntime)) {
        const result = buildWaveResultFromRuntime(nextRuntime);
        const isFinalWave = state.waveIndex === STAGE_ONE_WAVES.length - 1;
        
        const interest = Math.min(5, Math.floor(coins / 10));
        phase = isFinalWave ? "cleared" : "result";
        lastResult = result;
        return {
          runtimeState: null,
          phase,
          coins: coins + (result.metrics.passed ? 35 : 15) + interest,
          serviceHp,
          lastResult,
          liveMetrics,
        };
      }

      return {
        runtimeState: nextRuntime,
        liveMetrics,
        serviceHp,
        coins,
        phase,
        lastResult,
      };
    }),

  equipModule: (nodeId, instanceId) =>
    set((state) => {
      const itemIndex = state.inventory.findIndex((item) => item?.id === instanceId);
      if (itemIndex < 0) return state;
      const moduleItem = state.inventory[itemIndex]!;
      const moduleType = moduleItem.type;

      const isModule = ["sqs", "kafka", "redis", "s3", "waf", "cognito", "rdsReplica", "documentDb"].includes(moduleType);
      if (!isModule) return state;

      const targetInstanceId = state.architecture.boardSlots[nodeId as DeployableRole];
      if (!targetInstanceId) return state;

      const nextInventory = [...state.inventory];
      nextInventory[itemIndex] = null;

      const nextDeployedEquipment = { ...state.deployedEquipment };
      const targetNode = nextDeployedEquipment[targetInstanceId];
      if (targetNode) {
        const currentModules = targetNode.modules ?? [];
        if (currentModules.length >= 2) {
          return state;
        }
        nextDeployedEquipment[targetInstanceId] = {
          ...targetNode,
          modules: [...currentModules, moduleType],
        };
      }

      const nextArchitecture = normalizeArchitecture(state.architecture, nextInventory, nextDeployedEquipment);
      
      let nextRuntime = state.runtimeState;
      if (nextRuntime && state.phase === "running") {
        nextRuntime = applyRuntimeArchitectureMutation(nextRuntime, nextArchitecture);
      }

      return {
        inventory: nextInventory,
        deployedEquipment: nextDeployedEquipment,
        architecture: nextArchitecture,
        runtimeState: nextRuntime,
      };
    }),

  unequipModule: (nodeId, moduleType) =>
    set((state) => {
      const targetInstanceId = state.architecture.boardSlots[nodeId as DeployableRole];
      if (!targetInstanceId) return state;

      const emptyIndex = state.inventory.findIndex((item) => item === null);
      if (emptyIndex < 0) return state;

      const nextInventory = [...state.inventory];
      const nextDeployedEquipment = { ...state.deployedEquipment };
      const targetNode = nextDeployedEquipment[targetInstanceId];
      if (!targetNode) return state;

      const currentModules = targetNode.modules ?? [];
      if (!currentModules.includes(moduleType)) return state;

      nextDeployedEquipment[targetInstanceId] = {
        ...targetNode,
        modules: currentModules.filter((m) => m !== moduleType),
      };

      nextInventory[emptyIndex] = {
        id: uuidv4(),
        type: moduleType,
        starLevel: 1,
      };

      const nextArchitecture = normalizeArchitecture(state.architecture, nextInventory, nextDeployedEquipment);
      
      let nextRuntime = state.runtimeState;
      if (nextRuntime && state.phase === "running") {
        nextRuntime = applyRuntimeArchitectureMutation(nextRuntime, nextArchitecture);
      }

      return {
        inventory: nextInventory,
        deployedEquipment: nextDeployedEquipment,
        architecture: nextArchitecture,
        runtimeState: nextRuntime,
      };
    }),

  unplaceNode: (nodeId) =>
    set((state) => {
      const hasEmptySlot = state.inventory.some((slot) => slot === null);
      if (!hasEmptySlot) {
        return state;
      }

      const instanceId = state.architecture.boardSlots[nodeId as DeployableRole];
      if (!instanceId) {
        return state;
      }

      const item = state.deployedEquipment[instanceId];
      if (!item) {
        return state;
      }

      const nextInventory = [...state.inventory];
      const nextDeployedEquipment = { ...state.deployedEquipment };

      const emptyIndex = nextInventory.findIndex((slot) => slot === null);
      if (emptyIndex >= 0) {
        nextInventory[emptyIndex] = item;
      }

      delete nextDeployedEquipment[instanceId];

      const nextArchitecture = {
        ...state.architecture,
        boardSlots: { ...state.architecture.boardSlots },
        nodePositions: { ...state.architecture.nodePositions },
      };
      nextArchitecture.boardSlots[nodeId as DeployableRole] = null;
      delete nextArchitecture.nodePositions[nodeId];

      const normalized = normalizeArchitecture(
        nextArchitecture,
        nextInventory,
        nextDeployedEquipment,
      );

      let nextRuntime = state.runtimeState;
      if (nextRuntime && state.phase === "running") {
        nextRuntime = applyRuntimeArchitectureMutation(nextRuntime, normalized);
      }

      return {
        inventory: nextInventory,
        deployedEquipment: nextDeployedEquipment,
        architecture: normalized,
        runtimeState: nextRuntime,
      };
    }),
}));
