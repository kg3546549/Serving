import type {
  ArchitectureNodeId,
  GridPosition,
} from "../simulation/trafficSimulation";

interface NodeGestureInput {
  dragged: boolean;
  source: ArchitectureNodeId;
  target: ArchitectureNodeId | null;
  position: GridPosition | null;
  positionOccupied: boolean;
}

export type NodeGestureResult =
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
  dragged,
  source,
  target,
  position,
  positionOccupied,
}: NodeGestureInput): NodeGestureResult {
  if (!dragged) {
    return { type: "details", nodeId: source };
  }
  if (target) {
    return { type: "connect", from: source, to: target };
  }
  if (position && !positionOccupied) {
    return { type: "move", nodeId: source, position };
  }
  return { type: "invalid" };
}

