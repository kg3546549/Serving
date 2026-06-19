import { create } from "zustand";
import { STAGE_ONE_WAVES } from "../campaign/campaignData";
import type {
  ArchitectureConfig,
  ArchitectureNodeId,
  BuildSystemType,
  GridPosition,
  WaveSimulationResult,
} from "../simulation/trafficSimulation";
import {
  FIXED_ENTRY_POSITION,
  FIXED_EXIT_POSITION,
  getBoardTier,
  getLinkTier,
  isGridPositionAvailable,
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

export interface LiveWaveMetrics {
  completed: number;
  failed: number;
  queueByServer: [number, number];
  databaseQueue: number;
}

interface GameState {
  phase: GamePhase;
  waveIndex: number;
  coins: number;
  serviceHp: number;
  worldReady: boolean;
  ownedNodes: ArchitectureNodeId[];
  architecture: ArchitectureConfig;
  liveMetrics: LiveWaveMetrics;
  lastResult: WaveSimulationResult | null;
  startMission: () => void;
  setWorldReady: (ready: boolean) => void;
  beginWave: (result: WaveSimulationResult) => void;
  updateWaveProgress: (metrics: LiveWaveMetrics) => void;
  completeWave: (result: WaveSimulationResult) => void;
  continueAfterResult: () => void;
  purchaseSystem: (systemType: BuildSystemType) => void;
  placeNode: (nodeId: ArchitectureNodeId, position: GridPosition) => void;
  moveNode: (nodeId: ArchitectureNodeId, position: GridPosition) => void;
  toggleConnection: (
    from: ArchitectureNodeId,
    to: ArchitectureNodeId,
  ) => void;
  upgradeLinks: () => void;
  upgradeBoard: () => void;
  clearConnections: () => void;
  resetCampaign: () => void;
}

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
});

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
      const nodePosition = architecture.nodePositions[nodeId];
      return (
        nodePosition?.column === position.column &&
        nodePosition.row === position.row
      );
    },
  );
}

function hasSystem(state: GameState, systemType: BuildSystemType): boolean {
  if (systemType === "dbIndex") {
    return state.architecture.databaseIndexed;
  }
  const nodeId = SYSTEM_CATALOG[systemType].nodeId;
  return nodeId ? state.ownedNodes.includes(nodeId) : false;
}

export const useGameStore = create<GameState>((set) => ({
  phase: "menu",
  waveIndex: 0,
  coins: 240,
  serviceHp: 100,
  worldReady: false,
  ownedNodes: [],
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
      const isFinalWave = state.waveIndex === STAGE_ONE_WAVES.length - 1;
      const hpDamage = Math.min(30, Math.ceil(result.metrics.failed * 1.5));
      const serviceHp = Math.max(0, state.serviceHp - hpDamage);
      return {
        phase:
          serviceHp <= 0
            ? "defeated"
            : isFinalWave
              ? "cleared"
              : "result",
        coins: state.coins + result.metrics.earnedCoins,
        serviceHp,
        lastResult: result,
      };
    }),

  continueAfterResult: () =>
    set((state) => ({
      phase: "prepare",
      waveIndex: Math.min(
        state.waveIndex + 1,
        STAGE_ONE_WAVES.length - 1,
      ),
    })),

  purchaseSystem: (systemType) =>
    set((state) => {
      if (state.phase !== "prepare") {
        return state;
      }
      const item = SYSTEM_CATALOG[systemType];
      if (
        item.unlockWave > state.waveIndex + 1 ||
        state.coins < item.cost ||
        hasSystem(state, systemType)
      ) {
        return state;
      }
      if (systemType === "dbIndex") {
        if (!state.architecture.hasDatabase) {
          return state;
        }
        return {
          coins: state.coins - item.cost,
          architecture: {
            ...state.architecture,
            databaseIndexed: true,
          },
        };
      }

      const nodeId = item.nodeId;
      if (!nodeId) {
        return state;
      }
      const nextArchitecture = { ...state.architecture };
      if (systemType === "serverA") {
        nextArchitecture.serverCount = 1;
      } else if (systemType === "serverB") {
        if (state.architecture.serverCount < 1) {
          return state;
        }
        nextArchitecture.serverCount = 2;
      } else if (systemType === "loadBalancer") {
        nextArchitecture.hasLoadBalancer = true;
      } else if (systemType === "database") {
        nextArchitecture.hasDatabase = true;
      }
      return {
        coins: state.coins - item.cost,
        ownedNodes: [...state.ownedNodes, nodeId],
        architecture: nextArchitecture,
      };
    }),

  placeNode: (nodeId, position) =>
    set((state) => {
      if (
        state.phase !== "prepare" ||
        nodeId === "entry" ||
        nodeId === "exit" ||
        !state.ownedNodes.includes(nodeId) ||
        !isGridPositionAvailable(state.architecture, position) ||
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

  moveNode: (nodeId, position) =>
    set((state) => {
      if (
        state.phase !== "prepare" ||
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
        state.phase !== "prepare" ||
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
      if (!exists) {
        const validation = validateNewConnection(
          state.architecture,
          from,
          to,
        );
        if (!validation.valid) {
          return state;
        }
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

  upgradeLinks: () =>
    set((state) => {
      if (state.phase !== "prepare") {
        return state;
      }
      const tier = getLinkTier(state.architecture.linkLevel);
      if (
        tier.upgradeCost === null ||
        state.coins < tier.upgradeCost ||
        state.architecture.linkLevel >= 3
      ) {
        return state;
      }
      return {
        coins: state.coins - tier.upgradeCost,
        architecture: {
          ...state.architecture,
          linkLevel: (state.architecture.linkLevel + 1) as 2 | 3,
        },
      };
    }),

  upgradeBoard: () =>
    set((state) => {
      if (state.phase !== "prepare") {
        return state;
      }
      const tier = getBoardTier(state.architecture.boardLevel);
      if (
        tier.upgradeCost === null ||
        state.coins < tier.upgradeCost ||
        state.architecture.boardLevel >= 3
      ) {
        return state;
      }
      return {
        coins: state.coins - tier.upgradeCost,
        architecture: {
          ...state.architecture,
          boardLevel: (state.architecture.boardLevel + 1) as 2 | 3,
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
      coins: 240,
      serviceHp: 100,
      ownedNodes: [],
      architecture: createInitialArchitecture(),
      liveMetrics: initialLiveMetrics(),
      lastResult: null,
    }),
}));
