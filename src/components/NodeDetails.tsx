import type {
  ArchitectureConfig,
  ArchitectureNodeId,
  BuildSystemType,
} from "../simulation/trafficSimulation";
import {
  getNodePortUsage,
  NODE_PORT_LIMITS,
} from "../simulation/trafficSimulation";
import { useGameStore } from "../store/gameStore";
import { DeviceIcon } from "./DeviceIcon";

interface NodeDetailsProps {
  nodeId: ArchitectureNodeId;
  architecture: ArchitectureConfig;
  onClose: () => void;
}

const NODE_COPY: Record<
  ArchitectureNodeId,
  { name: string; role: string; color: string; stats: string[] }
> = {
  entry: {
    name: "Traffic Ingress",
    role: "외부 HTTPS 요청이 보드로 들어오는 상단 고정 입구",
    color: "mint",
    stats: ["위치 고정", "요청 생성", "파란 요청 링크"],
  },
  exit: {
    name: "Response Egress",
    role: "처리가 끝난 응답이 최종적으로 도착하는 고정 출구",
    color: "purple",
    stats: ["위치 고정", "응답 수신", "200 OK 피드백"],
  },
  loadBalancer: {
    name: "Load Balancer",
    role: "요청을 서버 A/B에 분산하고 응답을 출구로 전달",
    color: "purple",
    stats: ["Round Robin", "백엔드 2대", "분산 계층"],
  },
  serverA: {
    name: "App Server A",
    role: "HTTPS 로직과 DB 작업을 처리한 뒤 응답을 출구로 전달",
    color: "blue",
    stats: ["동시 처리 2", "Queue 6", "처리 시간 1.2초"],
  },
  serverB: {
    name: "App Server B",
    role: "폭주 웨이브에서 서버 A의 처리 부하를 분담",
    color: "blue",
    stats: ["동시 처리 2", "Queue 6", "처리 시간 1.2초"],
  },
  database: {
    name: "Primary DB",
    role: "GET 데이터를 읽고 POST 데이터를 저장한 뒤 응답 데이터를 생성",
    color: "yellow",
    stats: ["동시 처리 2", "독립 Queue", "읽기·쓰기 시간 분리"],
  },
};

export function NodeDetails({
  nodeId,
  architecture,
  onClose,
}: NodeDetailsProps): React.JSX.Element {
  const copy = NODE_COPY[nodeId];
  const position = architecture.nodePositions[nodeId];
  const links = architecture.connections.filter(
    (connection) => connection.from === nodeId || connection.to === nodeId,
  ).length;
  const portUsage = getNodePortUsage(architecture, nodeId);
  const portLimits = NODE_PORT_LIMITS[nodeId];

  // Zustand 스토어 상태 연동
  const inventory = useGameStore((state) => state.inventory);
  const liveMetrics = useGameStore((state) => state.liveMetrics);
  const unequipModule = useGameStore((state) => state.unequipModule);

  const instanceId = architecture.boardSlots[nodeId as "serverA" | "serverB" | "database" | "loadBalancer"];
  const item = inventory.find((i) => i?.id === instanceId);
  const modules = item?.modules ?? [];

  // 성능 계수 및 원형 프로그레스 계산
  const performance = architecture.performance ?? {
    serverQueueCapacity: 6,
    databaseQueueCapacity: 8,
  };
  const isServer = nodeId === "serverA" || nodeId === "serverB";
  const isDb = nodeId === "database";

  const maxQueue = isDb
    ? performance.databaseQueueCapacity
    : isServer
      ? performance.serverQueueCapacity
      : 0;

  const currentQueue = isDb
    ? liveMetrics.databaseQueue
    : nodeId === "serverA"
      ? liveMetrics.queueByServer[0]
      : nodeId === "serverB"
        ? liveMetrics.queueByServer[1]
        : 0;

  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const fillPercentage = maxQueue > 0 ? (currentQueue / maxQueue) * 100 : 0;
  const strokeDashoffset = circumference - (fillPercentage / 100) * circumference;

  const getAccentColor = () => {
    if (copy.color === "mint") return "#7dd9be";
    if (copy.color === "purple") return "#b4a1e5";
    if (copy.color === "blue") return "#88b8ef";
    return "#f6d477";
  };

  const getAccentGradient = () => {
    if (copy.color === "mint") return "linear-gradient(135deg, #4ad2b6, #189e90)";
    if (copy.color === "purple") return "linear-gradient(135deg, #a78bfa, #6d28d9)";
    if (copy.color === "blue") return "linear-gradient(135deg, #60a5fa, #1d4ed8)";
    return "linear-gradient(135deg, #fbbf24, #b45309)";
  };

  const getAccentShadowColor = () => {
    if (copy.color === "mint") return "rgba(24, 158, 144, 0.25)";
    if (copy.color === "purple") return "rgba(109, 40, 217, 0.25)";
    if (copy.color === "blue") return "rgba(29, 78, 216, 0.25)";
    return "rgba(180, 83, 9, 0.25)";
  };

  return (
    <aside
      className={`node-details node-details--${copy.color}`}
      aria-label={`${copy.name} 상세정보`}
      style={{
        position: "absolute",
        right: "16px",
        bottom: "56px",
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        width: "310px",
        padding: "16px",
        background: "var(--ui-panel-solid)",
        border: "1px solid var(--ui-line)",
        borderRadius: "14px",
        boxShadow: "var(--ui-shadow)",
        color: "var(--ui-text)",
        textAlign: "left",
        boxSizing: "border-box"
      }}
    >
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", position: "relative", borderBottom: "1px solid var(--ui-line)", paddingBottom: "10px" }}>
        {/* 장비 컬러 글로우와 그라데이션이 적용된 대표 아이콘 */}
        <div style={{
          display: "grid",
          width: "44px",
          height: "44px",
          placeItems: "center",
          borderRadius: "10px",
          background: getAccentGradient(),
          boxShadow: `0 6px 16px ${getAccentShadowColor()}`,
          color: "#fff",
          flexShrink: 0
        }}>
          <div style={{ width: "24px", height: "24px", display: "grid", placeItems: "center" }}>
            <DeviceIcon nodeId={nodeId} />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, paddingRight: "26px" }}>
          <span className="node-details-kicker" style={{ fontSize: "9px", letterSpacing: "0.1em", color: "var(--ui-blue)", fontWeight: 800 }}>DEVICE INFO</span>
          <h2 style={{ fontSize: "15px", fontWeight: 800, margin: 0, color: "var(--ui-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{copy.name}</h2>
          <p style={{ fontSize: "9.5px", color: "var(--ui-muted)", lineHeight: "1.4", margin: 0 }}>{copy.role}</p>
        </div>

        <button
          type="button"
          className="node-details-close"
          onClick={onClose}
          aria-label="장비 상세정보 닫기"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            background: "var(--ui-bg)",
            border: "1px solid var(--ui-line)",
            borderRadius: "50%",
            width: "22px",
            height: "22px",
            display: "grid",
            placeItems: "center",
            color: "var(--ui-muted)",
            fontSize: "14px",
            cursor: "pointer"
          }}
        >
          ×
        </button>
      </div>

      {/* 실시간 큐 점유율 원형 차트 (Circular Progress Bar) */}
      {(isServer || isDb) && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "var(--ui-bg)", padding: "10px", borderRadius: "10px", border: "1px solid var(--ui-line)" }}>
          <svg width="52" height="52" viewBox="0 0 60 60">
            <circle cx="30" cy="30" r="20" fill="none" stroke="var(--ui-line-strong)" strokeWidth="4" />
            <circle cx="30" cy="30" r="20" fill="none" stroke={getAccentColor()} strokeWidth="4"
                    strokeDasharray={2 * Math.PI * 20}
                    strokeDashoffset={2 * Math.PI * 20 - (fillPercentage / 100) * (2 * Math.PI * 20)}
                    strokeLinecap="round"
                    transform="rotate(-90 30 30)"
                    style={{ transition: "stroke-dashoffset 0.35s ease" }} />
          </svg>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <span style={{ fontSize: "8.5px", color: "var(--ui-muted)", fontWeight: 800 }}>QUEUE STATUS</span>
            <div style={{ fontSize: "15px", fontWeight: 800, color: "var(--ui-text)" }}>
              {currentQueue} <span style={{ fontSize: "11px", color: "var(--ui-muted)", fontWeight: 500 }}>/ {maxQueue}</span>
            </div>
          </div>
        </div>
      )}

      {/* 장착된 모듈 슬롯 리스트 */}
      {(isServer || isDb) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "8.5px", color: "var(--ui-blue)", fontWeight: 800, letterSpacing: "0.05em" }}>EQUIPPED MODULE SLOTS</span>
          <div style={{ display: "flex", gap: "8px" }}>
            {[0, 1].map((slotIdx) => {
              const moduleType = modules[slotIdx];
              return (
                <div key={slotIdx} style={{
                  flex: 1,
                  height: "44px",
                  border: "1px dashed var(--ui-line-strong)",
                  borderRadius: "8px",
                  background: moduleType ? "color-mix(in oklab, var(--ui-blue-soft) 30%, transparent)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  fontSize: "10px"
                }}>
                  {moduleType ? (
                    <>
                      <div style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
                        <span style={{ fontWeight: 800, color: "var(--ui-text)" }}>{moduleType.toUpperCase()}</span>
                        <span style={{ fontSize: "7.5px", color: "var(--ui-muted)" }}>Slot {slotIdx + 1}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => unequipModule(nodeId as "serverA" | "serverB" | "database", moduleType)}
                        style={{
                          background: "color-mix(in oklab, var(--ui-red) 12%, transparent)",
                          border: "1px solid color-mix(in oklab, var(--ui-red) 25%, transparent)",
                          color: "var(--ui-red)",
                          borderRadius: "4px",
                          padding: "2px 5px",
                          fontSize: "9px",
                          fontWeight: 800,
                          cursor: "pointer"
                        }}
                      >
                        탈착
                      </button>
                    </>
                  ) : (
                    <span style={{ color: "var(--ui-muted)", fontSize: "9px" }}>Empty Slot</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="node-details-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11px" }}>
        <span style={{ display: "grid", gap: "2px", padding: "6px 10px", borderRadius: "8px", background: "var(--ui-bg)", border: "1px solid var(--ui-line)" }}>
          <small style={{ display: "block", fontSize: "8px", color: "var(--ui-muted)", fontWeight: 800 }}>POSITION</small>
          <strong style={{ color: "var(--ui-text)" }}>
            {position
              ? `${Math.round(position.column)}, ${Math.round(position.row)}`
              : "INVENTORY"}
          </strong>
        </span>
        <span style={{ display: "grid", gap: "2px", padding: "6px 10px", borderRadius: "8px", background: "var(--ui-bg)", border: "1px solid var(--ui-line)" }}>
          <small style={{ display: "block", fontSize: "8px", color: "var(--ui-muted)", fontWeight: 800 }}>LINKS</small>
          <strong style={{ color: "var(--ui-text)" }}>
            {links} / {portLimits.traffic + portLimits.data}
          </strong>
        </span>
      </div>

      <ul style={{ listStyle: "none", fontSize: "10.5px", display: "flex", flexDirection: "column", gap: "4px", borderTop: "1px solid var(--ui-line)", paddingTop: "10px", paddingLeft: 0, margin: 0 }}>
        {portLimits.traffic > 0 && (
          <li style={{ color: "var(--ui-text)", padding: "3px 6px", background: "var(--ui-bg)", borderRadius: "4px" }}>
            트래픽 포트 <b>{portUsage.traffic}</b>/<b>{portLimits.traffic}</b> 사용중
          </li>
        )}
        {portLimits.data > 0 && (
          <li style={{ color: "var(--ui-text)", padding: "3px 6px", background: "var(--ui-bg)", borderRadius: "4px" }}>
            데이터 포트 <b>{portUsage.data}</b>/<b>{portLimits.data}</b> 사용중
          </li>
        )}
        {copy.stats.map((stat) => (
          <li key={stat} style={{ color: "var(--ui-muted)", paddingLeft: "4px" }}>• {stat}</li>
        ))}
      </ul>
      <small className="node-details-hint" style={{ fontSize: "9px", color: "var(--ui-muted)" }}>
        {nodeId === "entry" || nodeId === "exit"
          ? "고정 I/O • 드래그로 선 연결"
          : "드래그로 이동 • 드래그로 선 연결"}
      </small>
    </aside>
  );
}
