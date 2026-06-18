import { useEffect, useRef } from "react";
import type {
  ArchitectureConfig,
  BuildSystemType,
  WaveDefinition,
} from "../simulation/trafficSimulation";
import {
  LOAD_BALANCER_COST,
  SECOND_SERVER_COST,
} from "../store/gameStore";

interface BuildDockProps {
  architecture: ArchitectureConfig;
  coins: number;
  expansionUnlocked: boolean;
  disabled: boolean;
  worldReady: boolean;
  wave: WaveDefinition;
  onSelectSystem: (systemType: BuildSystemType) => void;
  onDropSystem: (
    systemType: BuildSystemType,
    clientX: number,
    clientY: number,
  ) => void;
  onCancelPlacement: () => void;
  onClearConnections: () => void;
  onStartWave: () => void;
}

interface BuildCardProps {
  systemType: BuildSystemType;
  name: string;
  cloudName: string;
  description: string;
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
  cloudName,
  description,
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
  const label = installed
    ? "ONLINE"
    : locked
      ? "LOCKED"
      : `◈ ${cost} · DRAG TO GRID`;

  const handlePointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
  ): void => {
    if (event.button !== 0) {
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

  return (
    <button
      type="button"
      className={`build-card build-card--${systemType} ${installed ? "installed" : ""}`}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerCancel={onCancelPlacement}
      disabled={unavailable}
      title={installed ? `${name} 설치 완료` : `${name}을 빈 격자 칸에 배치`}
    >
      <span className="build-icon">
        <CloudServiceIcon systemType={systemType} />
      </span>
      <span>
        <strong>{name}</strong>
        <small>{cloudName}</small>
        <small>{description}</small>
      </span>
      <em>{label}</em>
    </button>
  );
}

export function BuildDock({
  architecture,
  coins,
  expansionUnlocked,
  disabled,
  worldReady,
  wave,
  onSelectSystem,
  onDropSystem,
  onCancelPlacement,
  onClearConnections,
  onStartWave,
}: BuildDockProps): React.JSX.Element {
  return (
    <aside className="build-dock" aria-label="아키텍처 구성">
      <div className="wave-brief">
        <span>{disabled ? "DEFENSE ACTIVE" : "BUILD PHASE"}</span>
        <strong>{wave.name}</strong>
        <small>
          {expansionUnlocked && !disabled
            ? "장비는 격자에 놓고, 장비끼리 드래그해 길을 그리세요."
            : "장비끼리 드래그해 트래픽 길을 연결하세요."}
        </small>
        <button
          type="button"
          className="route-reset-button"
          onClick={onClearConnections}
          disabled={disabled || architecture.connections.length === 0}
        >
          그린 길 지우기
        </button>
      </div>

      <div className="build-options">
        <BuildCard
          systemType="loadBalancer"
          name="로드밸런서"
          cloudName="트래픽 나누기"
          description="요청을 여러 서버로 분산"
          cost={LOAD_BALANCER_COST}
          installed={architecture.hasLoadBalancer}
          locked={!expansionUnlocked}
          affordable={coins >= LOAD_BALANCER_COST}
          interactionDisabled={disabled}
          onSelectSystem={onSelectSystem}
          onDropSystem={onDropSystem}
          onCancelPlacement={onCancelPlacement}
        />
        <BuildCard
          systemType="logicServer"
          name="앱 서버"
          cloudName="요청 처리"
          description="처리 슬롯과 Queue 추가"
          cost={SECOND_SERVER_COST}
          installed={architecture.serverCount === 2}
          locked={!expansionUnlocked}
          affordable={coins >= SECOND_SERVER_COST}
          interactionDisabled={disabled}
          onSelectSystem={onSelectSystem}
          onDropSystem={onDropSystem}
          onCancelPlacement={onCancelPlacement}
        />
      </div>

      <button
        type="button"
        className="wave-button"
        onClick={onStartWave}
        disabled={disabled || !worldReady}
      >
        <span>{disabled ? "DEFENDING" : worldReady ? "START WAVE" : "LOADING"}</span>
        <strong>{disabled ? "처리 중..." : worldReady ? "웨이브 출격" : "보드 준비 중"}</strong>
      </button>
    </aside>
  );
}
