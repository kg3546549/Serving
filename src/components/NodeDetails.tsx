import type {
  ArchitectureConfig,
  ArchitectureNodeId,
} from "../simulation/trafficSimulation";
import {
  getNodePortUsage,
  NODE_PORT_LIMITS,
} from "../simulation/trafficSimulation";

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

  return (
    <aside
      className={`node-details node-details--${copy.color}`}
      aria-label={`${copy.name} 상세정보`}
    >
      <button
        type="button"
        className="node-details-close"
        onClick={onClose}
        aria-label="장비 상세정보 닫기"
      >
        ×
      </button>
      <span className="node-details-kicker">DEVICE INFO</span>
      <h2>{copy.name}</h2>
      <p>{copy.role}</p>
      <div className="node-details-grid">
        <span>
          <small>POSITION</small>
          <strong>
            {position
              ? `${Math.round(position.column)}, ${Math.round(position.row)}`
              : "INVENTORY"}
          </strong>
        </span>
        <span>
          <small>LINKS</small>
          <strong>
            {links} / {portLimits.traffic + portLimits.data}
          </strong>
        </span>
      </div>
      <ul>
        {portLimits.traffic > 0 && (
          <li>
            트래픽 포트 {portUsage.traffic}/{portLimits.traffic}
          </li>
        )}
        {portLimits.data > 0 && (
          <li>
            데이터 포트 {portUsage.data}/{portLimits.data}
          </li>
        )}
        {copy.stats.map((stat) => (
          <li key={stat}>{stat}</li>
        ))}
        {nodeId === "database" && (
          <li>
            {architecture.databaseIndexed
              ? "DB Index 적용 · Slow Query 단축"
              : "DB Index 미적용"}
          </li>
        )}
      </ul>
      <small className="node-details-hint">
        {nodeId === "entry" || nodeId === "exit"
          ? "고정 I/O · 우클릭/Shift+드래그로 링크 연결"
          : "드래그로 이동 · 우클릭/Shift+드래그로 링크 연결"}
      </small>
    </aside>
  );
}
