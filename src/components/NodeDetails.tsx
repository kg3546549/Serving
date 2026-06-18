import type {
  ArchitectureConfig,
  ArchitectureNodeId,
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
    role: "모든 외부 요청이 들어오고 최종 응답이 돌아가는 고정 지점",
    color: "mint",
    stats: ["위치 고정", "요청 생성", "응답 도착점"],
  },
  loadBalancer: {
    name: "Load Balancer",
    role: "요청을 앱 서버 A와 B에 Round Robin으로 분산",
    color: "purple",
    stats: ["Round Robin", "백엔드 2대", "분산 계층"],
  },
  serverA: {
    name: "App Server A",
    role: "HTTPS 요청의 비즈니스 로직을 처리하고 DB 작업을 요청",
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
          <small>GRID</small>
          <strong>
            {position
              ? `${position.column + 1} × ${position.row + 1}`
              : "INVENTORY"}
          </strong>
        </span>
        <span>
          <small>LINKS</small>
          <strong>{links}</strong>
        </span>
      </div>
      <ul>
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
        {nodeId === "entry"
          ? "고정 입구 · 우클릭 드래그로 다른 장비와 연결"
          : "좌클릭 드래그로 이동 · 우클릭 드래그로 연결"}
      </small>
    </aside>
  );
}
