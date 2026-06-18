import { create } from "zustand";
import type {
  ArchitectureConfig,
  ArchitectureNodeId,
  BuildSystemType,
  GridPosition,
  WaveSimulationResult,
} from "../simulation/trafficSimulation";

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
  toggleConnection: (
    from: ArchitectureNodeId,
    to: ArchitectureNodeId,
  ) => void;
  clearConnections: () => void;
  resetCampaign: () => void;
}

const initialArchitecture: ArchitectureConfig = {
  serverCount: 1,
  hasLoadBalancer: false,
  connections: [],
};

const initialLiveMetrics = (): LiveWaveMetrics => ({
  completed: 0,
  failed: 0,
  queueByServer: [0, 0],
});

export const LOAD_BALANCER_COST = 80;
export const SECOND_SERVER_COST = 100;

export const useGameStore = create<GameState>((set) => ({
  phase: "menu",
  waveIndex: 0,
  coins: 40,
  worldReady: false,
  expansionUnlocked: false,
  architecture: initialArchitecture,
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

      if (systemType === "loadBalancer") {
        if (
          state.architecture.hasLoadBalancer ||
          state.coins < LOAD_BALANCER_COST
        ) {
          return state;
        }

        return {
          coins: state.coins - LOAD_BALANCER_COST,
          architecture: {
            ...state.architecture,
            hasLoadBalancer: true,
            loadBalancerPosition: position,
          },
        };
      }

      if (
        state.architecture.serverCount === 2 ||
        state.coins < SECOND_SERVER_COST
      ) {
        return state;
      }

      return {
        coins: state.coins - SECOND_SERVER_COST,
        architecture: {
          ...state.architecture,
          serverCount: 2,
          secondServerPosition: position,
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
      architecture: initialArchitecture,
      liveMetrics: initialLiveMetrics(),
      lastResult: null,
    }),
}));
