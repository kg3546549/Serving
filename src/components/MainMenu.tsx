import { useEffect, useMemo, useState } from "react";
import type {
  BuildSystemType,
  NodeCategory,
} from "../simulation/trafficSimulation";
import { SYSTEM_CATALOG } from "../simulation/trafficSimulation";
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

type GuideView = "game" | "equipment";
type EquipmentFilter = "all" | NodeCategory;

const categoryLabels: Record<NodeCategory, string> = {
  server: "컴퓨트",
  database: "데이터베이스",
  loadBalancer: "라우팅",
  queue: "큐",
  security: "보안",
  cache: "캐시",
  storage: "스토리지",
};

const categoryFilters: EquipmentFilter[] = [
  "all",
  "server",
  "loadBalancer",
  "database",
  "queue",
  "cache",
  "security",
  "storage",
];

function getPlacementLabel(type: BuildSystemType): string {
  const spec = SYSTEM_CATALOG[type];
  if (spec.nodeId) {
    return "보드에 직접 배치";
  }
  if (
    spec.category === "queue" ||
    spec.category === "cache" ||
    spec.category === "security" ||
    spec.category === "storage"
  ) {
    return "보유 시 패시브 적용";
  }
  return "패시브 효과";
}

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

function GameGuide(): React.JSX.Element {
  return (
    <div className="menu-guide-content">
      <section className="guide-flow">
        <header>
          <small>CORE LOOP</small>
          <strong>한 웨이브의 진행 방식</strong>
        </header>
        <div className="guide-flow-track">
          <span><b>1</b><strong>구매</strong><small>Credits로 장비 확보</small></span>
          <i>→</i>
          <span><b>2</b><strong>배치</strong><small>보드에 자유 배치</small></span>
          <i>→</i>
          <span><b>3</b><strong>연결</strong><small>요청·DB·응답 경로 완성</small></span>
          <i>→</i>
          <span><b>4</b><strong>운영</strong><small>실시간 병목 대응</small></span>
        </div>
      </section>

      <div className="guide-topic-grid">
        <section>
          <small>REQUEST LIFECYCLE</small>
          <strong>요청은 선을 따라 이동합니다</strong>
          <ul>
            <li><b>REQUEST</b><span>Ingress에서 App Server로 이동</span></li>
            <li><b>DATA</b><span>서버 처리 후 DB 읽기·쓰기 수행</span></li>
            <li><b>RESPONSE</b><span>DB 결과가 Egress까지 돌아오면 성공</span></li>
          </ul>
        </section>
        <section>
          <small>FAIL CONDITIONS</small>
          <strong>실패 요청은 Service HP를 깎습니다</strong>
          <ul>
            <li><b>DROP</b><span>경로 단절 또는 큐 용량 초과</span></li>
            <li><b>TIMEOUT</b><span>요청별 최대 지연시간 초과</span></li>
            <li><b>BOTTLENECK</b><span>서버·DB 처리량보다 요청이 많음</span></li>
          </ul>
        </section>
        <section>
          <small>CONTROLS</small>
          <strong>보드 조작</strong>
          <ul>
            <li><b>좌클릭</b><span>장비 선택 및 빈 공간 배치</span></li>
            <li><b>드래그</b><span>장비 이동, 빈 공간에서 맵 이동</span></li>
            <li><b>우클릭 드래그</b><span>장비 간 링크 연결·해제</span></li>
            <li><b>휠 / R</b><span>확대·축소 / 보드 시점 초기화</span></li>
          </ul>
        </section>
        <section>
          <small>PROGRESSION</small>
          <strong>재화로 성장합니다</strong>
          <ul>
            <li><b>Credits</b><span>장비 구매, 상점 갱신, 레벨업에 사용</span></li>
            <li><b>Player Level</b><span>레벨업 비용은 증가하고 고티어 등장률 상승</span></li>
            <li><b>3-COPY</b><span>같은 장비 3개가 합쳐져 별 등급 상승</span></li>
            <li><b>Hot Plug</b><span>운영 중 재배선 가능, 끊긴 패킷은 손실</span></li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function EquipmentGuide({
  filter,
  onFilterChange,
}: {
  filter: EquipmentFilter;
  onFilterChange: (filter: EquipmentFilter) => void;
}): React.JSX.Element {
  const items = useMemo(
    () =>
      (Object.keys(SYSTEM_CATALOG) as BuildSystemType[])
        .filter(
          (type) =>
            filter === "all" || SYSTEM_CATALOG[type].category === filter,
        )
        .sort((left, right) => {
          const tierDifference =
            SYSTEM_CATALOG[left].tier - SYSTEM_CATALOG[right].tier;
          return tierDifference || SYSTEM_CATALOG[left].cost - SYSTEM_CATALOG[right].cost;
        }),
    [filter],
  );

  return (
    <div className="equipment-guide">
      <div className="equipment-filters" aria-label="장비 카테고리">
        {categoryFilters.map((category) => (
          <button
            type="button"
            className={filter === category ? "active" : ""}
            aria-pressed={filter === category}
            onClick={() => onFilterChange(category)}
            key={category}
          >
            {category === "all" ? "전체 20" : categoryLabels[category]}
          </button>
        ))}
      </div>
      <div className="equipment-catalog">
        {items.map((type) => {
          const spec = SYSTEM_CATALOG[type];
          return (
            <article className={`equipment-catalog-card category-${spec.category}`} key={type}>
              <span className="equipment-catalog-icon">
                <ResourceIcon type={type} />
              </span>
              <div className="equipment-catalog-copy">
                <small>{categoryLabels[spec.category]}</small>
                <strong>{spec.name}</strong>
                <p>{spec.description}</p>
                <span>{getPlacementLabel(type)}</span>
              </div>
              <div className="equipment-catalog-meta">
                <span>TIER {spec.tier}</span>
                <b>● {spec.cost}</b>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function GuideDialog({
  view,
  onViewChange,
  onClose,
}: {
  view: GuideView;
  onViewChange: (view: GuideView) => void;
  onClose: () => void;
}): React.JSX.Element {
  const [equipmentFilter, setEquipmentFilter] =
    useState<EquipmentFilter>("all");

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="menu-guide-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="menu-guide-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-guide-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="menu-guide-dialog-header">
          <div>
            <small>OPERATOR MANUAL</small>
            <h2 id="menu-guide-title">서비스 운영 가이드</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="가이드 닫기"
            autoFocus
          >
            ×
          </button>
        </header>
        <nav className="menu-guide-tabs" aria-label="가이드 메뉴">
          <button
            type="button"
            className={view === "game" ? "active" : ""}
            aria-pressed={view === "game"}
            onClick={() => onViewChange("game")}
          >
            게임 설명
          </button>
          <button
            type="button"
            className={view === "equipment" ? "active" : ""}
            aria-pressed={view === "equipment"}
            onClick={() => onViewChange("equipment")}
          >
            장비 도감 <span>20</span>
          </button>
        </nav>
        <div className="menu-guide-dialog-body">
          {view === "game" ? (
            <GameGuide />
          ) : (
            <EquipmentGuide
              filter={equipmentFilter}
              onFilterChange={setEquipmentFilter}
            />
          )}
        </div>
      </section>
    </div>
  );
}

export function MainMenu({ onStart }: MainMenuProps): React.JSX.Element {
  const [guideView, setGuideView] = useState<GuideView | null>(null);

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
            <nav className="menu-quick-nav" aria-label="시작 화면 도움말">
              <button type="button" onClick={() => setGuideView("game")}>
                게임 설명
              </button>
              <button type="button" onClick={() => setGuideView("equipment")}>
                장비 도감
              </button>
            </nav>
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
              <button type="button" onClick={() => setGuideView("game")}>
                전체 설명
              </button>
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
              <button type="button" onClick={() => setGuideView("equipment")}>
                전체 장비 20종
              </button>
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
      {guideView && (
        <GuideDialog
          view={guideView}
          onViewChange={setGuideView}
          onClose={() => setGuideView(null)}
        />
      )}
    </main>
  );
}
