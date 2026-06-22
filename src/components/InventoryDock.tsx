import { useRef } from "react";
import type {
  ArchitectureConfig,
  ArchitectureNodeId,
  NodeInstance,
} from "../simulation/trafficSimulation";
import {
  getBoardTier,
  getLinkTier,
  getTotalConnectionCells,
  isMaintenanceItem,
  MAINTENANCE_CATALOG,
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
  onInspectItem: (item: NodeInstance) => void;
  onSellItem: (instanceId: string) => void;
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
  onInspectItem: (item: NodeInstance) => void;
  onSellItem: (instanceId: string) => void;
}

function InventoryCard({
  item,
  deployedRole,
  preferredRole,
  disabled,
  onSelectNode,
  onDropNode,
  onCancelPlacement,
  onInspectItem,
  onSellItem,
}: InventoryCardProps): React.JSX.Element {
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const isPassive = isMaintenanceItem(item.type);
  const spec = isPassive
    ? (MAINTENANCE_CATALOG as any)[item.type]
    : (SYSTEM_CATALOG as any)[item.type];
  const deployable = preferredRole !== null;
  const roleLabel = deployedRole
    ? deployedRole === "database"
      ? "QUEUE 2"
      : deployedRole === "loadBalancer"
        ? "Round Robin"
        : "QUEUE 0"
    : deployable
      ? "드래그하여 배치"
      : "패시브 적용";

  const baseCost = spec ? spec.cost : 0;
  const refundMultiplier = item.starLevel === 3 ? 4.5 : item.starLevel === 2 ? 1.5 : 0.5;
  const sellValue = Math.floor(baseCost * refundMultiplier);

  return (
    <div className="inventory-card-wrapper" style={{ position: "relative" }}>
      <button
        type="button"
        className={`inventory-card ${deployedRole ? "deployed" : ""} ${
          deployable ? "" : "passive"
        }`}
        aria-disabled={disabled && deployable}
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          if (preferredRole && !disabled) {
            onSelectNode(preferredRole, item.id);
          }
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          onInspectItem(item);
        }}
        onPointerDown={(event) => {
          if (event.button !== 0 || disabled || !preferredRole) {
            return;
          }
          event.currentTarget.setPointerCapture(event.pointerId);
          pointerStartRef.current = {
            x: event.clientX,
            y: event.clientY,
          };
          draggedRef.current = false;
          onSelectNode(preferredRole, item.id);
        }}
        onPointerMove={(event) => {
          const start = pointerStartRef.current;
          if (!start) {
            return;
          }
          draggedRef.current =
            draggedRef.current ||
            Math.hypot(event.clientX - start.x, event.clientY - start.y) > 7;
        }}
        onPointerUp={(event) => {
          if (!pointerStartRef.current) {
            return;
          }
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          if (draggedRef.current && preferredRole) {
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
        }}
        onPointerCancel={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          pointerStartRef.current = null;
          draggedRef.current = false;
          onCancelPlacement();
        }}
        title={
          deployable
            ? `${spec.name} 배치 · 우클릭 상세`
            : `${spec.name} 패시브 적용 · 우클릭 상세`
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
          <em>{roleLabel}</em>
          <b>
            {"★".repeat(item.starLevel)}
            {item.augment ? ` · ${item.augment}` : ""}
          </b>
        </span>
      </button>
      
      <button
        type="button"
        className="inventory-sell-button"
        onClick={(e) => {
          e.stopPropagation();
          onSellItem(item.id);
        }}
      >
        판매 +${sellValue}
      </button>
    </div>
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

  // 모듈의 경우 대상 장비가 보드에 배치되어 있을 때에만 드래그앤드롭이 활성화되도록 선호 역할 반환
  if (["sqs", "kafka", "waf", "cognito"].includes(item.type)) {
    if (architecture.boardSlots.serverA) return "serverA";
    if (architecture.boardSlots.serverB) return "serverB";
  }
  if (["redis", "rdsReplica", "documentDb", "s3"].includes(item.type)) {
    if (architecture.boardSlots.database) return "database";
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
  onInspectItem,
  onSellItem,
}: InventoryDockProps): React.JSX.Element {
  const ownedCount = inventory.filter((item) => item !== null && getDeployedRole(architecture, item.id) === null).length;
  const deployedCount = Object.values(architecture.boardSlots).filter(Boolean)
    .length;
  const boardTier = getBoardTier(architecture.boardLevel);
  const linkTier = getLinkTier(architecture.linkLevel);
  const usedLinkCells = architecture.connections.length;

  return (
    <section className="inventory-dock" aria-label="보유 자원">
      <header className="inventory-heading">
        <strong>보유 자원</strong>
        <span>OWNED RESOURCES</span>
        <small>{ownedCount} / 8 보유 · {deployedCount} 배치</small>
      </header>

      <div className="inventory-capacity">
        <article>
          <span>BOARD AREA</span>
          <strong>LV. {boardTier.level} · {boardTier.columns} × {boardTier.rows}</strong>
          <small>자유 배치 가능한 보드 영역</small>
        </article>
        <article>
          <span>LINK BUDGET</span>
          <strong>LV. {linkTier.level} · {usedLinkCells} / {linkTier.totalCells}개</strong>
          <small>연결 가능한 최대 링크 개수</small>
        </article>
      </div>

      <div className="inventory-slots">
        {inventory.map((item, index) => {
          const isDeployed = item ? getDeployedRole(architecture, item.id) !== null : false;
          return item && !isDeployed ? (
            <InventoryCard
              key={item.id}
              item={item}
              deployedRole={null}
              preferredRole={getPreferredRole(architecture, item)}
              disabled={disabled}
              onSelectNode={onSelectNode}
              onDropNode={onDropNode}
              onCancelPlacement={onCancelPlacement}
              onInspectItem={onInspectItem}
              onSellItem={onSellItem}
            />
          ) : (
            <div className="inventory-empty-slot" key={`empty-${index}`}>
              <span>＋</span>
              <small>장비 슬롯</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}
