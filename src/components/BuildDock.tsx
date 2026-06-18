import { useEffect, useRef } from "react";
import type {
  ArchitectureConfig,
  BuildSystemType,
  WaveDefinition,
} from "../simulation/trafficSimulation";
import {
  getShopPrice,
  getShopUpgradeCost,
  LOAD_BALANCER_COST,
  MAX_SHOP_LEVEL,
  SECOND_SERVER_COST,
  SHOP_REROLL_COST,
} from "../store/gameStore";

interface BuildDockProps {
  architecture: ArchitectureConfig;
  coins: number;
  expansionUnlocked: boolean;
  shopLevel: number;
  shopRotation: number;
  disabled: boolean;
  wave: WaveDefinition;
  onSelectSystem: (systemType: BuildSystemType) => void;
  onDropSystem: (
    systemType: BuildSystemType,
    clientX: number,
    clientY: number,
  ) => void;
  onCancelPlacement: () => void;
  onClearConnections: () => void;
  onUpgradeShop: () => void;
  onRerollShop: () => void;
}

interface BuildCardProps {
  systemType: BuildSystemType;
  name: string;
  category: string;
  description: string;
  baseCost: number;
  cost: number;
  installed: boolean;
  locked: boolean;
  affordable: boolean;
  interactionDisabled: boolean;
  onSelectSystem: (systemType: BuildSystemType) => void;
  onDropSystem: (
    systemType: BuildSystemType,
    clientX: number,
    clientY: number,
  ) => void;
  onCancelPlacement: () => void;
}

function CloudServiceIcon({
  systemType,
}: {
  systemType: BuildSystemType;
}): React.JSX.Element {
  if (systemType === "loadBalancer") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 8v9M10 31h10M28 31h10" />
        <path d="m20 14 4 4 4-4M16 26l4 5-4 5M32 26l-4 5 4 5" />
        <rect x="18" y="18" width="12" height="9" rx="2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="10" y="9" width="28" height="30" rx="4" />
      <path d="M15 17h18M15 24h18M15 31h18" />
      <circle cx="18" cy="17" r="1.5" />
      <circle cx="18" cy="24" r="1.5" />
      <circle cx="18" cy="31" r="1.5" />
    </svg>
  );
}
function BuildCard({
  systemType,
  name,
  category,
  description,
  baseCost,
  cost,
  installed,
  locked,
  affordable,
  interactionDisabled,
  onSelectSystem,
  onDropSystem,
  onCancelPlacement,
}: BuildCardProps): React.JSX.Element {
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const unavailable =
    interactionDisabled || installed || locked || !affordable;

  const handlePointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
  ): void => {
    if (event.button !== 0 || unavailable) {
      return;
    }
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    draggedRef.current = false;
    onSelectSystem(systemType);
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent): void => {
      const start = dragStartRef.current;
      if (!start) {
        return;
      }
      draggedRef.current =
        draggedRef.current ||
        Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8;
    };

    const handlePointerUp = (event: PointerEvent): void => {
      if (!dragStartRef.current) {
        return;
      }
      if (draggedRef.current) {
        suppressClickRef.current = true;
        onDropSystem(systemType, event.clientX, event.clientY);
      }
      dragStartRef.current = null;
      draggedRef.current = false;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [onDropSystem, systemType]);

  const handleClick = (): void => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onSelectSystem(systemType);
  };

  const hasDiscount = cost < baseCost;

  return (
    <button
      type="button"
      className={`build-card build-card--${systemType} ${installed ? "installed" : ""}`}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerCancel={onCancelPlacement}
      disabled={unavailable}
      title={installed ? `${name} 설치 완료` : `${name} 구매 후 배치`}
    >
      <span className="build-icon">
        <CloudServiceIcon systemType={systemType} />
      </span>
      <span className="build-copy">
        <small>{category}</small>
        <strong>{name}</strong>
        <span>{description}</span>
      </span>
      <span className="build-price">
        {installed ? (
          <strong>ONLINE</strong>
        ) : locked ? (
          <strong>LOCKED</strong>
        ) : (
          <>
            {hasDiscount && <del>◈ {baseCost}</del>}
            <strong>◈ {cost}</strong>
          </>
        )}
      </span>
    </button>
  );
}

export function BuildDock({
  architecture,
  coins,
  expansionUnlocked,
  shopLevel,
  shopRotation,
  disabled,
  wave,
  onSelectSystem,
  onDropSystem,
  onCancelPlacement,
  onClearConnections,
  onUpgradeShop,
  onRerollShop,
}: BuildDockProps): React.JSX.Element {
  const loadBalancerPrice = getShopPrice(
    LOAD_BALANCER_COST,
    shopLevel,
    shopRotation,
    "loadBalancer",
  );
  const serverPrice = getShopPrice(
    SECOND_SERVER_COST,
    shopLevel,
    shopRotation,
    "logicServer",
  );
  const upgradeCost = getShopUpgradeCost(shopLevel);

  return (
    <aside className="build-dock" aria-label="장비 상점">
      <header className="shop-header">
        <div>
          <span>ARCHITECT SHOP</span>
          <strong>장비 상점</strong>
        </div>
        <div className="shop-wallet" aria-label={`보유 재화 ${coins}`}>
          <small>CREDITS</small>
          <strong>◈ {coins}</strong>
        </div>
      </header>

      <section className="shop-level">
        <div>
          <span>SHOP LEVEL</span>
          <strong>
            LV.{shopLevel} <small>/ {MAX_SHOP_LEVEL}</small>
          </strong>
        </div>
        <button
          type="button"
          onClick={onUpgradeShop}
          disabled={
            disabled || upgradeCost === null || coins < upgradeCost
          }
        >
          {upgradeCost === null ? "MAX LEVEL" : `레벨 업 ◈ ${upgradeCost}`}
        </button>
      </section>

      <div className="shop-toolbar">
        <div>
          <span>{disabled ? "WAVE ACTIVE" : "CURRENT WAVE"}</span>
          <strong>{wave.name}</strong>
        </div>
        <button
          type="button"
          onClick={onRerollShop}
          disabled={
            disabled ||
            !expansionUnlocked ||
            coins < SHOP_REROLL_COST
          }
        >
          ↻ 리롤 {SHOP_REROLL_COST}
        </button>
      </div>

      <div className="build-options">
        <BuildCard
          systemType="loadBalancer"
          name="로드밸런서"
          category="TRAFFIC ROUTING"
          description="요청을 두 서버로 나누는 분산 장비"
          baseCost={LOAD_BALANCER_COST}
          cost={loadBalancerPrice}
          installed={architecture.hasLoadBalancer}
          locked={!expansionUnlocked}
          affordable={coins >= loadBalancerPrice}
          interactionDisabled={disabled}
          onSelectSystem={onSelectSystem}
          onDropSystem={onDropSystem}
          onCancelPlacement={onCancelPlacement}
        />
        <BuildCard
          systemType="logicServer"
          name="앱 서버 B"
          category="COMPUTE"
          description="동시 처리 슬롯과 Queue를 추가"
          baseCost={SECOND_SERVER_COST}
          cost={serverPrice}
          installed={architecture.serverCount === 2}
          locked={!expansionUnlocked}
          affordable={coins >= serverPrice}
          interactionDisabled={disabled}
          onSelectSystem={onSelectSystem}
          onDropSystem={onDropSystem}
          onCancelPlacement={onCancelPlacement}
        />
      </div>

      <footer className="shop-footer">
        <p>
          장비는 카드 클릭 후 격자 선택 또는 보드로 드래그해 구매·배치합니다.
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
