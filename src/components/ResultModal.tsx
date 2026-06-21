import type { WaveSimulationResult } from "../simulation/trafficSimulation";

interface ResultModalProps {
  result: WaveSimulationResult;
  finalClear: boolean;
  defeated: boolean;
  serviceHp: number;
  hpDamage: number;
  onContinue: () => void;
  onRestart: () => void;
}

export function ResultModal({
  result,
  finalClear,
  defeated,
  serviceHp,
  hpDamage,
  onContinue,
  onRestart,
}: ResultModalProps): React.JSX.Element {
  const successPercent = Math.round(result.metrics.successRate * 100);
  const title = defeated
    ? "서비스 운영 종료"
    : finalClear
      ? "운영 일정 완료"
      : "서비스 점검시간";
  const summaryLabel = defeated
    ? "치명적 장애"
    : result.metrics.passed
      ? "안정적 마감"
      : "병목 발생";
  const metricCards = [
    { label: "성공률", value: `${successPercent}%`, tone: "blue" },
    {
      label: "평균 지연",
      value: `${result.metrics.averageLatencyMs}ms`,
      tone: "purple",
    },
    {
      label: "성공 코인",
      value: `+${result.metrics.earnedCoins}`,
      tone: "gold",
    },
    {
      label: "서버 대기",
      value: `${result.metrics.peakServerQueue}`,
      tone: "slate",
    },
    {
      label: "DB 대기",
      value: `${result.metrics.peakDatabaseQueue}`,
      tone: "slate",
    },
    {
      label: "저장 완료",
      value: `${result.metrics.writeCompleted}`,
      tone: "mint",
    },
  ] as const;

  return (
    <div className="soft-overlay">
      <section
        className="result-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-title"
      >
        <div className={`result-status-icon ${result.metrics.passed ? "success" : "failure"}`} aria-hidden="true">
          {result.metrics.passed ? "✓" : "!"}
        </div>
        <span className="result-kicker">{summaryLabel}</span>
        <h2 id="result-title">{title}</h2>
        <p className="result-caption">이번 운영을 마감했습니다. 아래 진단을 보고 다음 구성을 정리하세요.</p>

        <section className="result-diagnosis">
          <small>점검 메모</small>
          <strong>{result.bottleneck}</strong>
        </section>

        <div className="result-metrics">
          {metricCards.map((card) => (
            <div key={card.label} className={`result-metric-card tone-${card.tone}`}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </div>
          ))}
        </div>

        <section className="hp-damage-report">
          <div>
            <span>서비스 HP</span>
            <small>이번 운영에서 누적된 손상</small>
          </div>
          <strong>
            {serviceHp} <small>(-{hpDamage})</small>
          </strong>
        </section>

        {result.wave.id === 4 && (
          <div className="unlock-callout">
            <strong>새 시스템 해금</strong>
            <span>Load Balancer · App Server B</span>
          </div>
        )}

        {result.wave.id === 7 && (
          <div className="unlock-callout">
            <strong>새 시스템 해금</strong>
            <span>DB Index · Slow Query 최적화</span>
          </div>
        )}

        {finalClear || defeated ? (
          <button type="button" className="soft-primary" onClick={onRestart}>
            처음부터 다시
          </button>
        ) : (
          <button type="button" className="soft-primary" onClick={onContinue}>
            점검시간 시작
          </button>
        )}
      </section>
    </div>
  );
}
