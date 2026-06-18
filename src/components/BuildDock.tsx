import { useEffect, useRef } from "react";
import type { WaveDefinition } from "../campaign/campaignData";
import type {
  ArchitectureConfig,
  ArchitectureNodeId,
  BuildSystemType,
} from "../simulation/trafficSimulation";
import {
  getLinkTier,
  getTotalConnectionCells,
  SYSTEM_CATALOG,
} from "../simulation/trafficSimulation";

interface BuildDockProps {
  architecture: ArchitectureConfig;
  ownedNodes: ArchitectureNodeId[];
  coins: number;
  disabled: boolean;
  waveIndex: number;
  wave: WaveDefinition;
  onSelectNode: (nodeId: ArchitectureNodeId) => void;
  onDropNode: (
    nodeId: ArchitectureNodeId,
    clientX: number,
    clientY: number,
  ) => void;
  onCancelPlacement: () => void;
  onPurchaseSystem: (systemType: BuildSystemType) => void;
  onUpgradeLinks: () => void;
  onClearConnections: () => void;
}

const DEVICE_INFO: Record<
  ArchitectureNodeId,
  { name: string; category: string }
> = {
  entry: { name: "Traffic Ingress", category: "FIXED ENTRY" },
  loadBalancer: { name: "Load Balancer", category: "ROUTING" },
  serverA: { name: "App Server A", category: "COMPUTE" },
  serverB: { name: "App Server B", category: "COMPUTE" },
  database: { name: "Primary DB", category: "DATABASE" },
};

const SHOP_ORDER: readonly BuildSystemType[] = [
  "serverA",
  "database",
  "loadBalancer",
  "serverB",
  "dbIndex",
];

function DeviceIcon({
  nodeId,
}: {
  nodeId: ArchitectureNodeId | "dbIndex";
}): React.JSX.Element {
  if (nodeId === "loadBalancer") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <rect x="18" y="18" width="12" height="12" rx="2" />
        <path d="M24 6v12M24 30v12M6 24h12M30 24h12" />
        <path d="m20 10 4-4 4 4M38 20l4 4-4 4M20 38l4 4 4-4M10 20l-4 4 4 4" />
      </svg>
    );
  }
  if (nodeId === "database" || nodeId === "dbIndex") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <ellipse cx="24" cy="11" rx="15" ry="6" />
        <path d="M9 11v26c0 3 7 6 15 6s15-3 15-6V11M9 24c0 3 7 6 15 6s15-3 15-6" />
        {nodeId === "dbIndex" && <path d="m18 35 4 4 9-10" />}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M8 12h32v24H8zM15 42h18M24 36v6" />
      <path d="M15 19h18M15 25h12M15 31h15" />
      <circle cx="34" cy="31" r="2" />
    </svg>
  );
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
      <span>
        <small>{info.category}</small>
        <strong>{info.name}</strong>
      </span>
      <em>{deployed ? "DEPLOYED" : "PLACE IT"}</em>
    </button>
  );
}

function isPurchased(
  systemType: BuildSystemType,
  architecture: ArchitectureConfig,
  ownedNodes: ArchitectureNodeId[],
): boolean {
  if (systemType === "dbIndex") {
    return architecture.databaseIndexed;
  }
  const nodeId = SYSTEM_CATALOG[systemType].nodeId;
  return nodeId ? ownedNodes.includes(nodeId) : false;
}

export function BuildDock({
  architecture,
  ownedNodes,
  coins,
  disabled,
  waveIndex,
  wave,
  onSelectNode,
  onDropNode,
  onCancelPlacement,
  onPurchaseSystem,
  onUpgradeLinks,
  onClearConnections,
}: BuildDockProps): React.JSX.Element {
  const currentWave = waveIndex + 1;
  const linkTier = getLinkTier(architecture.linkLevel);
  const usedLinkCells = getTotalConnectionCells(architecture);

  return (
    <aside className="build-dock" aria-label="보유 장비와 인프라 상점">
      <header className="shop-header">
        <div>
          <span>STAGE 01 · HTTPS API</span>
          <strong>인프라 상점</strong>
        </div>
        <div className="shop-wallet" aria-label={`보유 재화 ${coins}`}>
          <small>CREDITS</small>
          <strong>◈ {coins}</strong>
        </div>
      </header>

      <section className="wave-brief">
        <span>
          WAVE {String(wave.id).padStart(2, "0")} · {wave.protocol}
        </span>
        <strong>{wave.name}</strong>
        <p>{wave.description}</p>
      </section>

      <section className="inventory-section">
        <div className="panel-heading">
          <div>
            <span>OWNED RESOURCES</span>
            <strong>보유 장비</strong>
          </div>
          <small>구매 후 드래그 배치</small>
        </div>
        {ownedNodes.length === 0 ? (
          <div className="empty-inventory">
            <strong>보유 장비 없음</strong>
            <span>App Server와 Primary DB를 먼저 구매하세요.</span>
          </div>
        ) : (
          <div className="inventory-list">
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

      <div className="request-lifecycle" aria-label="요청 처리 순서">
        <span>REQUEST</span>
        <i>→</i>
        <span>APP</span>
        <i>→</i>
        <span>DB</span>
        <i>→</i>
        <span>RESPONSE</span>
      </div>

      <section className="link-budget" aria-label="간선 용량">
        <div>
          <span>LINK CAPACITY</span>
          <strong>
            LV.{linkTier.level} · {usedLinkCells}/{linkTier.totalCells}칸
          </strong>
          <small>간선 1개 최대 {linkTier.maxEdgeCells}칸</small>
        </div>
        <button
          type="button"
          onClick={onUpgradeLinks}
          disabled={
            disabled ||
            linkTier.upgradeCost === null ||
            coins < linkTier.upgradeCost
          }
        >
          {linkTier.upgradeCost === null
            ? "MAX"
            : `확장 ◈ ${linkTier.upgradeCost}`}
        </button>
      </section>

      <div className="shop-offers">
        {SHOP_ORDER.map((systemType) => {
          const item = SYSTEM_CATALOG[systemType];
          const purchased = isPurchased(
            systemType,
            architecture,
            ownedNodes,
          );
          const locked = item.unlockWave > currentWave;
          const requiresDatabase =
            systemType === "dbIndex" && !architecture.hasDatabase;
          return (
            <button
              key={systemType}
              type="button"
              className="shop-offer"
              disabled={
                disabled ||
                locked ||
                purchased ||
                requiresDatabase ||
                coins < item.cost
              }
              onClick={() => onPurchaseSystem(systemType)}
            >
              <span className="build-icon">
                <DeviceIcon nodeId={item.nodeId ?? "dbIndex"} />
              </span>
              <span className="build-copy">
                <small>
                  {locked
                    ? `WAVE ${item.unlockWave} 해금`
                    : systemType === "dbIndex"
                      ? "DATABASE UPGRADE"
                      : DEVICE_INFO[item.nodeId!].category}
                </small>
                <strong>{item.name}</strong>
                <span>{item.description}</span>
              </span>
              <span className="build-price">
                <strong>
                  {purchased
                    ? "OWNED"
                    : locked
                      ? "LOCKED"
                      : requiresDatabase
                        ? "DB 필요"
                        : `◈ ${item.cost}`}
                </strong>
              </span>
            </button>
          );
        })}
      </div>

      <footer className="shop-footer">
        <p>
          좌클릭 드래그: 이동 · 우클릭/Shift+드래그: 연결 · 입구는 고정
        </p>
        <button
          type="button"
          className="route-reset-button"
          onClick={onClearConnections}
          disabled={disabled || architecture.connections.length === 0}
        >
          모든 간선 지우기
        </button>
      </footer>
    </aside>
  );
}
