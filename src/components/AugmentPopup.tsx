import type { AugmentType } from "../simulation/trafficSimulation";
import type { AugmentState } from "../store/gameStore";

interface AugmentPopupProps {
  augmentState: AugmentState;
  onSelectAugment: (augment: AugmentType) => void;
}

const AUGMENT_CATALOG: Record<
  AugmentType,
  { name: string; description: string; rare: boolean; metric: string }
> = {
  serverRam: { name: "RAM 증설", description: "서버 Queue 용량을 늘려 순간 폭주를 버팁니다.", rare: false, metric: "QUEUE +4" },
  serverCpu: { name: "CPU 증설", description: "서버 요청 처리 시간을 단축합니다.", rare: false, metric: "LATENCY -28%" },
  autoScaler: { name: "Auto Scaler", description: "부하에 맞춰 처리 슬롯을 자동 확장합니다.", rare: true, metric: "SLOT +1" },
  dbQuery: { name: "쿼리 최적화", description: "DB 읽기와 Slow Query 처리 시간을 줄입니다.", rare: false, metric: "QUERY -32%" },
  dbStorage: { name: "DB 용량 증설", description: "DB 대기열과 저장 버퍼를 확장합니다.", rare: false, metric: "QUEUE +6" },
  dbSharding: { name: "DB 분산기", description: "쿼리를 여러 DB 처리 슬롯으로 분산합니다.", rare: true, metric: "DB SLOT +2" },
  dax: { name: "DAX 캐시", description: "DB 앞단 인메모리 캐시로 응답 속도를 크게 높입니다.", rare: true, metric: "QUERY -52%" },
  lbBackends: { name: "백엔드 슬롯 확장", description: "로드밸런서가 관리할 수 있는 서버 수를 늘립니다.", rare: false, metric: "BACKEND +2" },
  lbAlgorithm: { name: "라우팅 알고리즘", description: "부하 기반 분산으로 응답 경로 효율을 높입니다.", rare: true, metric: "ROUTE SMART" },
  lbHealth: { name: "Health Check 강화", description: "불안정 서버를 빠르게 제외해 응답 지연을 줄입니다.", rare: false, metric: "RESPONSE -12%" },
  queuePartitions: { name: "파티션 확장", description: "Kafka/SQS 메시지 처리 병렬성을 높입니다.", rare: true, metric: "PARTITION +2" },
  queueConsumers: { name: "Consumer 증설", description: "대기 중인 비동기 작업을 더 빠르게 소모합니다.", rare: false, metric: "CONSUMER +2" },
  cacheHitRate: { name: "Cache Hit 향상", description: "반복 DB 조회를 캐시 응답으로 전환합니다.", rare: false, metric: "HIT RATE +20%" },
  securityRules: { name: "보안 규칙 최적화", description: "정상 요청의 검사 오버헤드를 줄입니다.", rare: false, metric: "FILTER FAST" },
  scrubbing: { name: "DDoS Scrubbing", description: "대규모 악성 트래픽을 서버 도착 전에 정화합니다.", rare: true, metric: "ATTACK BLOCK" },
  storageThroughput: { name: "스토리지 처리량", description: "객체 읽기와 저장 처리량을 확장합니다.", rare: false, metric: "I/O +40%" },
};

export function AugmentPopup({
  augmentState,
  onSelectAugment,
}: AugmentPopupProps): React.JSX.Element {
  return (
    <div className="choice-overlay">
      <section
        className="choice-modal augment-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="augment-title"
      >
        <span className="choice-kicker">EQUIPMENT UPGRADE</span>
        <h2 id="augment-title">
          {augmentState.equipmentName} {augmentState.starLevel}성 증강
        </h2>
        <p>장비 역할에 맞는 성능 업그레이드 하나를 선택하세요.</p>
        <div className="choice-options">
          {augmentState.options.map((option) => {
            const augment = AUGMENT_CATALOG[option];
            return (
              <button
                type="button"
                key={option}
                className={`choice-card ${augment.rare ? "rare" : ""}`}
                onClick={() => onSelectAugment(option)}
              >
                <small>{augment.rare ? "RARE AUGMENT" : "STANDARD AUGMENT"}</small>
                <strong>{augment.name}</strong>
                <span>{augment.description}</span>
                <b>{augment.metric}</b>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
