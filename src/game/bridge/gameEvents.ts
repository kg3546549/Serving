import type {
  ArchitectureConfig,
  ArchitectureNodeId,
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
  BUILD_CANCEL: "build:cancel",
  INVENTORY_SELECT: "inventory:select",
  INVENTORY_DROP: "inventory:drop",
  NODE_PLACEMENT_REQUEST: "node:placement-request",
  CONNECTION_REQUEST: "connection:request",
  NODE_MOVE_REQUEST: "node:move-request",
  NODE_DETAILS_REQUEST: "node:details-request",
  CAMERA_COMMAND: "camera:command",
  CAMERA_CHANGED: "camera:changed",
  RESET_WORLD: "world:reset",
} as const;

export type CameraCommand = "zoomIn" | "zoomOut" | "reset";

export interface CameraChangedPayload {
  zoom: number;
}

export interface WaveCompletePayload {
  result: WaveSimulationResult;
}

export interface WaveProgressPayload {
  metrics: LiveWaveMetrics;
}

export interface ArchitecturePayload {
  architecture: ArchitectureConfig;
}

export interface InventorySelectPayload {
  nodeId: ArchitectureNodeId;
  instanceId?: string;
}

export interface InventoryDropPayload extends InventorySelectPayload {
  x: number;
  y: number;
}

export interface NodePlacementPayload {
  nodeId: ArchitectureNodeId;
  position: GridPosition;
  instanceId?: string;
}

export interface ConnectionRequestPayload {
  from: ArchitectureNodeId;
  to: ArchitectureNodeId;
}

export interface NodeMoveRequestPayload {
  nodeId: ArchitectureNodeId;
  position: GridPosition;
}

export interface NodeDetailsRequestPayload {
  nodeId: ArchitectureNodeId;
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
