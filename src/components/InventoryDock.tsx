import { useEffect, useRef } from "react";
import type {
  ArchitectureConfig,
  ArchitectureNodeId,
} from "../simulation/trafficSimulation";
import { DeviceIcon } from "./DeviceIcon";
import { DEVICE_INFO } from "./devicePresentation";

interface InventoryDockProps {
  architecture: ArchitectureConfig;
  ownedNodes: ArchitectureNodeId[];
  disabled: boolean;
  onSelectNode: (nodeId: ArchitectureNodeId) => void;
  onDropNode: (
    nodeId: ArchitectureNodeId,
    clientX: number,
    clientY: number,
  ) => void;
  onCancelPlacement: () => void;
}

interface InventoryCardProps {
  nodeId: ArchitectureNodeId;
  deployed: boolean;
  disabled: boolean;
  onSelectNode: (nodeId: ArchitectureNodeId) => void;
  onDropNode: (
    nodeId: ArchitectureNodeId,
    clientX: number,
    clientY: number,
  ) => void;
  onCancelPlacement: () => void;
}

function InventoryCard({
  nodeId,
  deployed,
  disabled,
  onSelectNode,
  onDropNode,
  onCancelPlacement,
}: InventoryCardProps): React.JSX.Element {
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const info = DEVICE_INFO[nodeId];

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent): void => {
      const start = pointerStartRef.current;
      if (!start) {
        return;
      }
      draggedRef.current =
        draggedRef.current ||
        Math.hypot(event.clientX - start.x, event.clientY - start.y) > 7;
    };
    const handlePointerUp = (event: PointerEvent): void => {
      if (!pointerStartRef.current) {
        return;
      }
      if (draggedRef.current) {
        suppressClickRef.current = true;
        onDropNode(nodeId, event.clientX, event.clientY);
      }
      pointerStartRef.current = null;
      draggedRef.current = false;
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [nodeId, onDropNode]);

  return (
    <button
      type="button"
      className={`inventory-card ${deployed ? "deployed" : ""}`}
      disabled={disabled}
      onClick={() => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        onSelectNode(nodeId);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0 || disabled) {
          return;
        }
        pointerStartRef.current = { x: event.clientX, y: event.clientY };
        draggedRef.current = false;
        onSelectNode(nodeId);
      }}
      onPointerCancel={onCancelPlacement}
      title={`${info.name}을 보드로 드래그`}
    >
      <span className="inventory-icon">
        <DeviceIcon nodeId={nodeId} />
      </span>
      <span className="inventory-card-copy">
        <small>{info.category}</small>
        <strong>{info.name}</strong>
        <em>{deployed ? "보드에 배치됨" : "드래그해서 배치"}</em>
      </span>
      <span className={`inventory-state ${deployed ? "online" : ""}`}>
        {deployed ? "ONLINE" : "READY"}
      </span>
    </button>
  );
}

export function InventoryDock({
  architecture,
  ownedNodes,
  disabled,
  onSelectNode,
  onDropNode,
  onCancelPlacement,
}: InventoryDockProps): React.JSX.Element {
  const deployedCount = ownedNodes.filter(
    (nodeId) => architecture.nodePositions[nodeId] !== undefined,
  ).length;

  return (
    <section className="inventory-dock" aria-label="보유 장비">
      <header className="inventory-dock-heading">
        <div>
          <span>OWNED RESOURCES</span>
          <strong>보유 장비</strong>
        </div>
        <small>
          {deployedCount}/{ownedNodes.length} 배치 · 카드 드래그
        </small>
      </header>

      {ownedNodes.length === 0 ? (
        <div className="inventory-dock-empty">
          <strong>아직 보유한 장비가 없습니다.</strong>
          <span>우측 상점에서 App Server와 Primary DB를 구매하세요.</span>
        </div>
      ) : (
        <div className="inventory-dock-list">
          {ownedNodes.map((nodeId) => (
            <InventoryCard
              key={nodeId}
              nodeId={nodeId}
              deployed={architecture.nodePositions[nodeId] !== undefined}
              disabled={disabled}
              onSelectNode={onSelectNode}
              onDropNode={onDropNode}
              onCancelPlacement={onCancelPlacement}
            />
          ))}
        </div>
      )}
    </section>
  );
}
