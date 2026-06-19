import type {
  ArchitectureNodeId,
  GridPosition,
} from "../simulation/trafficSimulation";

interface NodeGestureInput {
  mode: "move" | "connect";
  dragged: boolean;
  movementDistance?: number;
  source: ArchitectureNodeId;
  target: ArchitectureNodeId | null;
  position: GridPosition | null;
  positionOccupied: boolean;
}

export type NodeGestureResult =
  | { type: "select"; nodeId: ArchitectureNodeId }
  | { type: "details"; nodeId: ArchitectureNodeId }
  | {
      type: "connect";
      from: ArchitectureNodeId;
      to: ArchitectureNodeId;
    }
  | {
      type: "move";
      nodeId: ArchitectureNodeId;
      position: GridPosition;
    }
  | { type: "invalid" };

export function resolveNodeGesture({
  mode,
  dragged,
  movementDistance = 0,
  source,
  target,
  position,
  positionOccupied,
}: NodeGestureInput): NodeGestureResult {
  const moved = dragged || movementDistance >= 9;

  if (!moved && mode === "connect") {
    return { type: "details", nodeId: source };
  }
  if (!moved && mode === "move") {
    return { type: "select", nodeId: source };
  }
  if (mode === "connect" && moved && target) {
    return { type: "connect", from: source, to: target };
  }
  if (mode === "move" && moved && position && !positionOccupied) {
    return { type: "move", nodeId: source, position };
  }
  return { type: "invalid" };
}
