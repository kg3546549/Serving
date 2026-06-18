import type {
  ArchitectureConfig,
  ArchitectureNodeId,
  BuildSystemType,
  GridPosition,
  WaveSimulationResult,
} from "../../simulation/trafficSimulation";
import type { LiveWaveMetrics } from "../../store/gameStore";

export const GAME_EVENTS = {
  SCENE_READY: "scene:ready",
  CONFIGURE_ARCHITECTURE: "architecture:configure",
  WAVE_REQUEST: "wave:request",
  WAVE_PROGRESS: "wave:progress",
  WAVE_COMPLETE: "wave:complete",
  BUILD_SELECT: "build:select",
  BUILD_CANCEL: "build:cancel",
  BUILD_DROP: "build:drop",
  SYSTEM_PLACEMENT_REQUEST: "system:placement-request",
  CONNECTION_REQUEST: "connection:request",
  RESET_WORLD: "world:reset",
} as const;

export interface WaveCompletePayload {
  result: WaveSimulationResult;
}

export interface WaveProgressPayload {
  metrics: LiveWaveMetrics;
}

export interface ArchitecturePayload {
  architecture: ArchitectureConfig;
}

export interface BuildSelectPayload {
  systemType: BuildSystemType;
}

export interface BuildDropPayload extends BuildSelectPayload {
  x: number;
  y: number;
}

export interface SystemPlacementPayload extends BuildSelectPayload {
  position: GridPosition;
}

export interface ConnectionRequestPayload {
  from: ArchitectureNodeId;
  to: ArchitectureNodeId;
}

type EventListener = (payload: unknown) => void;

class GameEventBus {
  private listeners = new Map<string, Set<EventListener>>();

  on<T>(eventName: string, listener: (payload: T) => void): () => void {
    const listenersForEvent =
      this.listeners.get(eventName) ?? new Set<EventListener>();
    const normalizedListener = listener as EventListener;

    listenersForEvent.add(normalizedListener);
    this.listeners.set(eventName, listenersForEvent);

    return () => {
      listenersForEvent.delete(normalizedListener);
      if (listenersForEvent.size === 0) {
        this.listeners.delete(eventName);
      }
    };
  }

  emit<T>(eventName: string, payload: T): void {
    const listenersForEvent = this.listeners.get(eventName);
    if (!listenersForEvent) {
      return;
    }

    for (const listener of listenersForEvent) {
      listener(payload);
    }
  }
}

export const gameEvents = new GameEventBus();
