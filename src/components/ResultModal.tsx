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
        <h2 id="result-title">{title}</h2>
        <p className="result-caption">{result.bottleneck}</p>

        <div className="result-metrics">
          <div>
            <strong>{successPercent}%</strong>
            <span>성공률</span>
          </div>
          <div>
            <strong>{result.metrics.averageLatencyMs}ms</strong>
            <span>평균 지연</span>
          </div>
          <div>
            <strong>{result.metrics.peakServerQueue}</strong>
            <span>Server Queue</span>
          </div>
          <div>
            <strong>+{result.metrics.earnedCoins}</strong>
            <span>성공 코인</span>
          </div>
          <div>
            <strong>{result.metrics.peakDatabaseQueue}</strong>
            <span>DB Queue</span>
          </div>
          <div>
            <strong>{result.metrics.writeCompleted}</strong>
            <span>저장 완료</span>
          </div>
        </div>

        <div className="hp-damage-report">
          <span>서비스 HP</span>
          <strong>
            {serviceHp} <small>(-{hpDamage})</small>
          </strong>
        </div>

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
