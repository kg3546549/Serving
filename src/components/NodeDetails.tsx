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

  return (
    <aside
      className={`node-details node-details--${copy.color}`}
      aria-label={`${copy.name} 상세정보`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        padding: "20px",
        background: "var(--bg-card-raw, rgba(15, 23, 42, 0.72))",
        border: "1px solid var(--border-color)",
        borderRadius: "16px",
        backdropFilter: "blur(12px)",
        boxShadow: "0 12px 32px rgba(0,0,0,0.4)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="node-details-kicker" style={{ fontSize: "11px", letterSpacing: "0.1em", color: "var(--brand-cyan)" }}>DEVICE INFO</span>
        <button
          type="button"
          className="node-details-close"
          onClick={onClose}
          aria-label="장비 상세정보 닫기"
          style={{ background: "transparent", border: "none", color: "#9ca3af", fontSize: "20px", cursor: "pointer" }}
        >
          ×
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 700, margin: 0 }}>{copy.name}</h2>
        <p style={{ fontSize: "13px", color: "#9ca3af", lineHeight: "1.5" }}>{copy.role}</p>
      </div>

      {/* 실시간 큐 점유율 원형 차트 (Circular Progress Bar) */}
      {(isServer || isDb) && (
        <div style={{ display: "flex", alignItems: "center", gap: "16px", background: "rgba(255,255,255,0.02)", padding: "14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.04)" }}>
          <svg width="70" height="70" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
            <circle cx="40" cy="40" r="28" fill="none" stroke={getAccentColor()} strokeWidth="6"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    transform="rotate(-90 40 40)"
                    style={{ transition: "stroke-dashoffset 0.35s ease" }} />
          </svg>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <span style={{ fontSize: "11px", color: "#9ca3af" }}>QUEUE STATUS</span>
            <div style={{ fontSize: "18px", fontWeight: 700 }}>
              {currentQueue} <span style={{ fontSize: "13px", color: "#6b7280", fontWeight: 400 }}>/ {maxQueue}</span>
            </div>
          </div>
        </div>
      )}

      {/* 장착된 모듈 슬롯 리스트 */}
      {(isServer || isDb) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <span style={{ fontSize: "11px", color: "var(--brand-cyan)", fontWeight: 600 }}>EQUIPPED MODULE SLOTS</span>
          <div style={{ display: "flex", gap: "10px" }}>
            {[0, 1].map((slotIdx) => {
              const moduleType = modules[slotIdx];
              return (
                <div key={slotIdx} style={{
                  flex: 1,
                  height: "54px",
                  border: "1px dashed var(--border-color)",
                  borderRadius: "8px",
                  background: moduleType ? "rgba(255,255,255,0.03)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  fontSize: "12px"
                }}>
                  {moduleType ? (
                    <>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 600, color: "#fff" }}>{moduleType.toUpperCase()}</span>
                        <span style={{ fontSize: "9px", color: "#9ca3af" }}>Slot {slotIdx + 1}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => unequipModule(nodeId as "serverA" | "serverB" | "database", moduleType)}
                        style={{
                          background: "rgba(244,63,94,0.1)",
                          border: "1px solid rgba(244,63,94,0.2)",
                          color: "#f43f5e",
                          borderRadius: "4px",
                          padding: "2px 6px",
                          fontSize: "10px",
                          cursor: "pointer"
                        }}
                      >
                        탈착
                      </button>
                    </>
                  ) : (
                    <span style={{ color: "#4b5563", fontSize: "11px" }}>Empty Slot</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="node-details-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px" }}>
        <span>
          <small style={{ display: "block", fontSize: "10px", color: "#6b7280", marginBottom: "2px" }}>POSITION</small>
          <strong>
            {position
              ? `${Math.round(position.column)}, ${Math.round(position.row)}`
              : "INVENTORY"}
          </strong>
        </span>
        <span>
          <small style={{ display: "block", fontSize: "10px", color: "#6b7280", marginBottom: "2px" }}>LINKS</small>
          <strong>
            {links} / {portLimits.traffic + portLimits.data}
          </strong>
        </span>
      </div>

      <ul style={{ listStyle: "none", fontSize: "13px", display: "flex", flexDirection: "column", gap: "6px", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "12px" }}>
        {portLimits.traffic > 0 && (
          <li>트래픽 포트 {portUsage.traffic}/{portLimits.traffic}</li>
        )}
        {portLimits.data > 0 && (
          <li>데이터 포트 {portUsage.data}/{portLimits.data}</li>
        )}
        {copy.stats.map((stat) => (
          <li key={stat} style={{ color: "#9ca3af" }}>- {stat}</li>
        ))}
      </ul>
      <small className="node-details-hint" style={{ fontSize: "11px", color: "#6b7280" }}>
        {nodeId === "entry" || nodeId === "exit"
          ? "고정 I/O • 우클릭/Shift+드래그로 링크 연결"
          : "드래그로 이동 • 우클릭/Shift+드래그로 링크 연결"}
      </small>
    </aside>
  );
}
