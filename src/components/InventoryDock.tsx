import { useEffect, useRef } from "react";
import type {
  ArchitectureConfig,
  ArchitectureNodeId,
  NodeInstance,
} from "../simulation/trafficSimulation";
import {
  getBoardTier,
  getLinkTier,
  getTotalConnectionCells,
  SYSTEM_CATALOG,
} from "../simulation/trafficSimulation";
import { ResourceIcon } from "./DeviceIcon";

interface InventoryDockProps {
  inventory: (NodeInstance | null)[];
  architecture: ArchitectureConfig;
  disabled: boolean;
  onSelectNode: (nodeId: ArchitectureNodeId, instanceId?: string) => void;
  onDropNode: (
    nodeId: ArchitectureNodeId,
    clientX: number,
    clientY: number,
    instanceId?: string,
  ) => void;
  onCancelPlacement: () => void;
  onSellNode: (instanceId: string) => void;
}

interface InventoryCardProps {
  item: NodeInstance;
  deployedRole: ArchitectureNodeId | null;
  preferredRole: ArchitectureNodeId | null;
  disabled: boolean;
  onSelectNode: (nodeId: ArchitectureNodeId, instanceId: string) => void;
  onDropNode: (
    nodeId: ArchitectureNodeId,
    clientX: number,
    clientY: number,
    instanceId: string,
  ) => void;
  onCancelPlacement: () => void;
  onSellNode: (instanceId: string) => void;
}

function InventoryCard({
  item,
  deployedRole,
  preferredRole,
  disabled,
  onSelectNode,
  onDropNode,
  onCancelPlacement,
  onSellNode,
}: InventoryCardProps): React.JSX.Element {
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const spec = SYSTEM_CATALOG[item.type];
  const deployable = preferredRole !== null;

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
      if (!pointerStartRef.current || !preferredRole) {
        return;
      }
      if (draggedRef.current) {
        suppressClickRef.current = true;
        onDropNode(
          preferredRole,
          event.clientX,
          event.clientY,
          item.id,
        );
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
  }, [item.id, onDropNode, preferredRole]);

  return (
    <button
      type="button"
      className={`inventory-card ${deployedRole ? "deployed" : ""} ${
        deployable ? "" : "passive"
      }`}
      disabled={disabled && deployable}
      onClick={() => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        if (preferredRole) {
          onSelectNode(preferredRole, item.id);
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        if (!disabled) {
          onSellNode(item.id);
        }
      }}
      onPointerDown={(event) => {
        if (event.button !== 0 || disabled || !preferredRole) {
          return;
        }
        pointerStartRef.current = {
          x: event.clientX,
          y: event.clientY,
        };
        draggedRef.current = false;
        onSelectNode(preferredRole, item.id);
      }}
      onPointerCancel={onCancelPlacement}
      title={
        deployable
          ? `${spec.name} 배치 · 우클릭 판매`
          : `${spec.name} 패시브 적용 · 우클릭 판매`
      }
    >
      <span className="inventory-card-state">
        <i />
        {deployedRole ? "ACTIVE" : deployable ? "READY" : "PASSIVE"}
      </span>
      <span className="inventory-card-icon">
        <ResourceIcon type={item.type} />
      </span>
      <span className="inventory-card-copy">
        <small>{spec.category.toUpperCase()}</small>
        <strong>{spec.name}</strong>
        <em>
          {"★".repeat(item.starLevel)}
          {item.augment ? ` · ${item.augment}` : ""}
        </em>
      </span>
    </button>
  );
}

function getDeployedRole(
  architecture: ArchitectureConfig,
  instanceId: string,
): ArchitectureNodeId | null {
  const entry = Object.entries(architecture.boardSlots).find(
    ([, id]) => id === instanceId,
  );
  return (entry?.[0] as ArchitectureNodeId | undefined) ?? null;
}

function getPreferredRole(
  architecture: ArchitectureConfig,
  item: NodeInstance,
): ArchitectureNodeId | null {
  const spec = SYSTEM_CATALOG[item.type];
  const deployedRole = getDeployedRole(architecture, item.id);
  if (deployedRole) {
    return deployedRole;
  }
  if (spec.category === "server") {
    return architecture.boardSlots.serverA ? "serverB" : "serverA";
  }
  if (spec.category === "database" && spec.nodeId) {
    return "database";
  }
  if (spec.category === "loadBalancer" && spec.nodeId) {
    return "loadBalancer";
  }
  return null;
}

export function InventoryDock({
  inventory,
  architecture,
  disabled,
  onSelectNode,
  onDropNode,
  onCancelPlacement,
  onSellNode,
}: InventoryDockProps): React.JSX.Element {
  const ownedCount = inventory.filter(Boolean).length;
  const deployedCount = Object.values(architecture.boardSlots).filter(Boolean)
    .length;
  const boardTier = getBoardTier(architecture.boardLevel);
  const linkTier = getLinkTier(architecture.linkLevel);
  const usedLinkCells = getTotalConnectionCells(architecture);

  return (
    <section className="inventory-dock" aria-label="보유 자원">
      <header className="inventory-heading">
        <strong>보유 자원</strong>
        <span>OWNED RESOURCES</span>
        <small>{ownedCount} / 8 보유 · {deployedCount} 배치</small>
      </header>

      <div className="inventory-capacity">
        <article>
          <span>BOARD SIZE</span>
          <strong>LV. {boardTier.level} · {boardTier.columns} × {boardTier.rows}</strong>
          <small>레벨업 선택으로 확장</small>
        </article>
        <article>
          <span>LINK CAPACITY</span>
          <strong>LV. {linkTier.level} · {usedLinkCells} / {linkTier.totalCells}</strong>
          <small>링크당 최대 {linkTier.maxEdgeCells}칸</small>
        </article>
      </div>

      <div className="inventory-slots">
        {inventory.map((item, index) =>
          item ? (
            <InventoryCard
              key={item.id}
              item={item}
              deployedRole={getDeployedRole(architecture, item.id)}
              preferredRole={getPreferredRole(architecture, item)}
              disabled={disabled}
              onSelectNode={onSelectNode}
              onDropNode={onDropNode}
              onCancelPlacement={onCancelPlacement}
              onSellNode={onSellNode}
            />
          ) : (
            <div className="inventory-empty-slot" key={`empty-${index}`}>
              <span>＋</span>
              <small>장비 슬롯</small>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
