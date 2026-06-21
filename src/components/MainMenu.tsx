import type { BuildSystemType } from "../simulation/trafficSimulation";
import { ResourceIcon } from "./DeviceIcon";

interface MainMenuProps {
  onStart: () => void;
}

const equipment: Array<{
  type: BuildSystemType;
  category: string;
  name: string;
  description: string;
  tone: string;
}> = [
  {
    type: "apiGateway",
    category: "ROUTING",
    name: "Load Balancer",
    description: "유입 요청을 여러 App Server로 분산합니다.",
    tone: "purple",
  },
  {
    type: "ec2",
    category: "COMPUTE",
    name: "App Server",
    description: "요청을 처리하고 DB 작업을 실행합니다.",
    tone: "blue",
  },
  {
    type: "rdsPrimary",
    category: "DATABASE",
    name: "Primary DB",
    description: "읽기와 쓰기를 처리합니다. 지연이 누적되면 병목이 됩니다.",
    tone: "teal",
  },
  {
    type: "sqs",
    category: "MODULE",
    name: "Queue · Cache",
    description: "폭주를 흡수하거나 반복 조회의 응답 시간을 줄입니다.",
    tone: "gold",
  },
];

function FlowNode({
  type,
  label,
  className = "",
}: {
  type: BuildSystemType;
  label: string;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={`menu-flow-node ${className}`}>
      <span>
        <ResourceIcon type={type} />
      </span>
      <strong>{label}</strong>
    </div>
  );
}

export function MainMenu({ onStart }: MainMenuProps): React.JSX.Element {
  return (
    <main className="menu-screen">
      <div className="menu-backdrop" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>

      <div className="menu-dashboard">
        <header className="menu-topbar">
          <div className="menu-brand">
            <span className="menu-brand-mark">S/B</span>
            <div>
              <strong>STACK BREACH</strong>
              <small>REALTIME ARCHITECTURE PUZZLE</small>
            </div>
          </div>
          <div className="menu-system-state">
            <span><i /> SIMULATION READY</span>
            <b>STAGE 01 · HTTPS</b>
          </div>
        </header>

        <section className="menu-hero">
          <div className="menu-hero-copy">
            <div className="menu-stage-title">
              <span className="menu-stage-chip">
                <small>STAGE</small>
                <b>01</b>
              </span>
              <div>
                <small>BASIC HTTPS API</small>
                <strong>기본 HTTPS API</strong>
              </div>
            </div>

            <p className="menu-kicker">INFRASTRUCTURE DEFENSE · GRAPH PUZZLE</p>
            <h1>
              요청이 흐르는
              <span>아키텍처를 설계하세요.</span>
            </h1>
            <p className="menu-lead">
              장비를 구매해 자유롭게 배치하고 선으로 연결하세요. 요청은
              연결된 경로를 따라 실시간으로 이동하며, 제한 시간 안에 응답하지
              못하면 타임아웃으로 실패합니다.
            </p>

            <div className="menu-actions">
              <button type="button" className="menu-start" onClick={onStart}>
                <span>서비스 운영 시작</span>
                <b>→</b>
              </button>
              <div className="menu-objective">
                <small>FIRST OBJECTIVE</small>
                <strong>Ingress → App Server → DB → Egress</strong>
              </div>
            </div>
          </div>

          <div className="menu-architecture-preview" aria-label="게임 흐름 미리보기">
            <header>
              <div>
                <small>LIVE ARCHITECTURE</small>
                <strong>요청 경로 미리보기</strong>
              </div>
              <span><i /> ONLINE</span>
            </header>

            <div className="menu-network-map">
              <div className="menu-route menu-route--request" />
              <div className="menu-route menu-route--data" />
              <div className="menu-route menu-route--response" />
              <span className="menu-packet menu-packet--one" />
              <span className="menu-packet menu-packet--two" />
              <FlowNode type="apiGateway" label="Ingress" className="ingress" />
              <FlowNode type="ec2" label="App Server" className="server" />
              <FlowNode type="rdsPrimary" label="Primary DB" className="database" />
              <FlowNode type="apiGateway" label="Egress" className="egress" />
            </div>

            <div className="menu-preview-metrics">
              <article>
                <span className="menu-ring menu-ring--success"><b>92%</b></span>
                <div><small>SUCCESS</small><strong>응답 완료율</strong></div>
              </article>
              <article>
                <span className="menu-ring menu-ring--latency"><b>3.2s</b></span>
                <div><small>DEADLINE</small><strong>최대 지연시간</strong></div>
              </article>
              <article>
                <span className="menu-ring menu-ring--queue"><b>04</b></span>
                <div><small>QUEUE</small><strong>대기 요청</strong></div>
              </article>
            </div>
          </div>
        </section>

        <section className="menu-guide" aria-label="게임 및 장비 설명">
          <article className="menu-rules">
            <header>
              <div>
                <small>HOW TO PLAY</small>
                <strong>서비스를 설계하는 방법</strong>
              </div>
              <span>실시간 개입 가능</span>
            </header>
            <ol>
              <li>
                <b>01</b>
                <div><strong>구매하고 배치</strong><span>재화로 장비를 구매해 보드 어디든 배치합니다.</span></div>
              </li>
              <li>
                <b>02</b>
                <div><strong>선을 연결</strong><span>장비를 이어 요청·데이터·응답 경로를 완성합니다.</span></div>
              </li>
              <li>
                <b>03</b>
                <div><strong>병목에 대응</strong><span>운영 중에도 재배선하고 장비를 증설해 타임아웃을 막습니다.</span></div>
              </li>
            </ol>
          </article>

          <article className="menu-equipment">
            <header>
              <div>
                <small>EQUIPMENT GUIDE</small>
                <strong>핵심 장비 역할</strong>
              </div>
              <span>우클릭으로 상세 확인</span>
            </header>
            <div className="menu-equipment-grid">
              {equipment.map((item) => (
                <div className={`menu-equipment-card ${item.tone}`} key={item.name}>
                  <span className="menu-equipment-icon">
                    <ResourceIcon type={item.type} />
                  </span>
                  <div>
                    <small>{item.category}</small>
                    <strong>{item.name}</strong>
                    <p>{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
