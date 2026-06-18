import { create } from "zustand";
import type {
  ArchitectureConfig,
  ArchitectureNodeId,
  BuildSystemType,
  GridPosition,
  WaveSimulationResult,
} from "../simulation/trafficSimulation";
import { DEFAULT_NODE_POSITIONS } from "../simulation/trafficSimulation";

export type GamePhase =
  | "menu"
  | "prepare"
  | "running"
  | "result"
  | "cleared";

export interface LiveWaveMetrics {
  completed: number;
  failed: number;
  queueByServer: [number, number];
}

interface GameState {
  phase: GamePhase;
  waveIndex: number;
  coins: number;
  worldReady: boolean;
  expansionUnlocked: boolean;
  shopLevel: number;
  shopRotation: number;
  architecture: ArchitectureConfig;
  liveMetrics: LiveWaveMetrics;
  lastResult: WaveSimulationResult | null;
  startMission: () => void;
  setWorldReady: (ready: boolean) => void;
  beginWave: (result: WaveSimulationResult) => void;
  updateWaveProgress: (metrics: LiveWaveMetrics) => void;
  completeWave: (result: WaveSimulationResult) => void;
  continueAfterResult: () => void;
  placeSystem: (
    systemType: BuildSystemType,
    position: GridPosition,
  ) => void;
  moveNode: (
    nodeId: ArchitectureNodeId,
    position: GridPosition,
  ) => void;
  toggleConnection: (
    from: ArchitectureNodeId,
    to: ArchitectureNodeId,
  ) => void;
  upgradeShop: () => void;
  rerollShop: () => void;
  clearConnections: () => void;
  resetCampaign: () => void;
}

const createInitialArchitecture = (): ArchitectureConfig => ({
  serverCount: 1,
  hasLoadBalancer: false,
  nodePositions: {
    entry: { ...DEFAULT_NODE_POSITIONS.entry },
    loadBalancer: { ...DEFAULT_NODE_POSITIONS.loadBalancer },
    serverA: { ...DEFAULT_NODE_POSITIONS.serverA },
    serverB: { ...DEFAULT_NODE_POSITIONS.serverB },
    database: { ...DEFAULT_NODE_POSITIONS.database },
  },
  connections: [],
});

const initialLiveMetrics = (): LiveWaveMetrics => ({
  completed: 0,
  failed: 0,
  queueByServer: [0, 0],
});

export const LOAD_BALANCER_COST = 80;
export const SECOND_SERVER_COST = 100;
export const SHOP_REROLL_COST = 15;
export const MAX_SHOP_LEVEL = 3;

const SHOP_LEVEL_UPGRADE_COSTS = [0, 60, 100] as const;
const REROLL_DISCOUNTS = [
  { loadBalancer: 0, logicServer: 10 },
  { loadBalancer: 15, logicServer: 0 },
  { loadBalancer: 5, logicServer: 15 },
  { loadBalancer: 10, logicServer: 5 },
] as const;

export function getShopUpgradeCost(shopLevel: number): number | null {
  if (shopLevel >= MAX_SHOP_LEVEL) {
    return null;
  }
  return SHOP_LEVEL_UPGRADE_COSTS[shopLevel] ?? null;
}

export function getShopPrice(
  baseCost: number,
  shopLevel: number,
  shopRotation: number,
  systemType: BuildSystemType,
): number {
  const rotation =
    REROLL_DISCOUNTS[shopRotation % REROLL_DISCOUNTS.length] ??
    REROLL_DISCOUNTS[0];
  const levelDiscount = Math.max(0, shopLevel - 1) * 5;
  const offerDiscount = rotation[systemType];
  const totalDiscount = Math.min(30, levelDiscount + offerDiscount);
  return Math.ceil((baseCost * (100 - totalDiscount)) / 100);
}

function isNodeActive(
  architecture: ArchitectureConfig,
  nodeId: ArchitectureNodeId,
): boolean {
  if (nodeId === "loadBalancer") {
    return architecture.hasLoadBalancer;
  }
  if (nodeId === "serverB") {
    return architecture.serverCount === 2;
  }
  return true;
}

function isPositionOccupied(
  architecture: ArchitectureConfig,
  position: GridPosition,
  exceptNodeId?: ArchitectureNodeId,
): boolean {
  return (Object.keys(architecture.nodePositions) as ArchitectureNodeId[]).some(
    (nodeId) => {
      if (nodeId === exceptNodeId || !isNodeActive(architecture, nodeId)) {
        return false;
      }
      const nodePosition = architecture.nodePositions[nodeId];
      return (
        nodePosition.column === position.column &&
        nodePosition.row === position.row
      );
    },
  );
}

export const useGameStore = create<GameState>((set) => ({
  phase: "menu",
  waveIndex: 0,
  coins: 40,
  worldReady: false,
  expansionUnlocked: false,
  shopLevel: 1,
  shopRotation: 0,
  architecture: createInitialArchitecture(),
  liveMetrics: initialLiveMetrics(),
  lastResult: null,

  startMission: () => set({ phase: "prepare" }),
  setWorldReady: (worldReady) => set({ worldReady }),

  beginWave: (lastResult) =>
    set({
      phase: "running",
      liveMetrics: initialLiveMetrics(),
      lastResult,
    }),

  updateWaveProgress: (liveMetrics) => set({ liveMetrics }),

  completeWave: (result) =>
    set((state) => {
      const isFinalWave = state.waveIndex === 1;
      const passed = result.metrics.passed;

      return {
        phase: passed && isFinalWave ? "cleared" : "result",
        waveIndex: passed && !isFinalWave ? 1 : state.waveIndex,
        coins: state.coins + result.metrics.earnedCoins,
        expansionUnlocked:
          state.expansionUnlocked || (isFinalWave && !passed),
        lastResult: result,
      };
    }),

  continueAfterResult: () => set({ phase: "prepare" }),

  placeSystem: (systemType, position) =>
    set((state) => {
      if (!state.expansionUnlocked || state.phase !== "prepare") {
        return state;
      }
      if (isPositionOccupied(state.architecture, position)) {
        return state;
      }

      if (systemType === "loadBalancer") {
        const price = getShopPrice(
          LOAD_BALANCER_COST,
          state.shopLevel,
          state.shopRotation,
          systemType,
        );
        if (
          state.architecture.hasLoadBalancer ||
          state.coins < price
        ) {
          return state;
        }

        return {
          coins: state.coins - price,
          architecture: {
            ...state.architecture,
            hasLoadBalancer: true,
            nodePositions: {
              ...state.architecture.nodePositions,
              loadBalancer: position,
            },
          },
        };
      }

      const price = getShopPrice(
        SECOND_SERVER_COST,
        state.shopLevel,
        state.shopRotation,
        systemType,
      );
      if (
        state.architecture.serverCount === 2 ||
        state.coins < price
      ) {
        return state;
      }

      return {
        coins: state.coins - price,
        architecture: {
          ...state.architecture,
          serverCount: 2,
          nodePositions: {
            ...state.architecture.nodePositions,
            serverB: position,
          },
        },
      };
    }),

  moveNode: (nodeId, position) =>
    set((state) => {
      if (
        state.phase !== "prepare" ||
        !isNodeActive(state.architecture, nodeId) ||
        isPositionOccupied(state.architecture, position, nodeId)
      ) {
        return state;
      }
      return {
        architecture: {
          ...state.architecture,
          nodePositions: {
            ...state.architecture.nodePositions,
            [nodeId]: position,
          },
        },
      };
    }),

  toggleConnection: (from, to) =>
    set((state) => {
      if (state.phase !== "prepare" || from === to) {
        return state;
      }
      const exists = state.architecture.connections.some(
        (connection) =>
          (connection.from === from && connection.to === to) ||
          (connection.from === to && connection.to === from),
      );
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

  upgradeShop: () =>
    set((state) => {
      if (state.phase !== "prepare") {
        return state;
      }
      const cost = getShopUpgradeCost(state.shopLevel);
      if (cost === null || state.coins < cost) {
        return state;
      }
      return {
        coins: state.coins - cost,
        shopLevel: state.shopLevel + 1,
      };
    }),

  rerollShop: () =>
    set((state) => {
      if (
        state.phase !== "prepare" ||
        !state.expansionUnlocked ||
        state.coins < SHOP_REROLL_COST
      ) {
        return state;
      }
      return {
        coins: state.coins - SHOP_REROLL_COST,
        shopRotation: state.shopRotation + 1,
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
      coins: 40,
      expansionUnlocked: false,
      shopLevel: 1,
      shopRotation: 0,
      architecture: createInitialArchitecture(),
      liveMetrics: initialLiveMetrics(),
      lastResult: null,
    }),
}));
