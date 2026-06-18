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
    name: "트래픽 입구",
    role: "웨이브의 모든 요청이 생성되는 시작 지점",
    color: "mint",
    stats: ["요청 생성", "외부 트래픽", "경로 시작점"],
  },
  loadBalancer: {
    name: "로드밸런서",
    role: "요청을 앱 서버 A와 B에 Round Robin으로 분산",
    color: "purple",
    stats: ["Round Robin", "백엔드 2대", "분산 계층"],
  },
  serverA: {
    name: "앱 서버 A",
    role: "비즈니스 요청을 처리하고 데이터베이스로 전달",
    color: "blue",
    stats: ["동시 처리 2", "Queue 7", "처리 시간 620ms"],
  },
  serverB: {
    name: "앱 서버 B",
    role: "폭주 웨이브에서 서버 A의 처리 부하를 분담",
    color: "blue",
    stats: ["동시 처리 2", "Queue 7", "처리 시간 620ms"],
  },
  database: {
    name: "데이터베이스",
    role: "처리 완료 요청이 도착하는 데이터 계층",
    color: "yellow",
    stats: ["최종 목적지", "응답 생성", "관리형 데이터"],
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
            {position.column + 1} × {position.row + 1}
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
      </ul>
      <small className="node-details-hint">
        우클릭 드래그 후 빈 칸에 놓으면 이동, 다른 장비에 놓으면 연결
      </small>
    </aside>
  );
}

