import type { WaveSimulationResult } from "../simulation/trafficSimulation";

interface ResultModalProps {
  result: WaveSimulationResult;
  finalClear: boolean;
  expansionUnlocked: boolean;
  onContinue: () => void;
  onRestart: () => void;
}

export function ResultModal({
  result,
  finalClear,
  expansionUnlocked,
  onContinue,
  onRestart,
}: ResultModalProps): React.JSX.Element {
  const successPercent = Math.round(result.metrics.successRate * 100);
  const title = finalClear
    ? "서비스를 지켰어요!"
    : result.metrics.passed
      ? "첫 웨이브 완료"
      : "서버가 버티지 못했어요";

  return (
    <div className="soft-overlay">
      <section
        className="result-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-title"
      >
        <div
          className={`result-face ${result.metrics.passed ? "success" : "failure"}`}
          aria-hidden="true"
        >
          {result.metrics.passed ? "ᵔᴗᵔ" : "•︵•"}
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
            <strong>{result.metrics.peakQueue}</strong>
            <span>최대 Queue</span>
          </div>
          <div>
            <strong>+{result.metrics.earnedCoins}</strong>
            <span>획득 코인</span>
          </div>
        </div>

        {expansionUnlocked && !result.metrics.passed && (
          <div className="unlock-callout">
            <strong>새 시스템 해금</strong>
            <span>Load Balancer · Logic Server B</span>
          </div>
        )}

        {finalClear ? (
          <button type="button" className="soft-primary" onClick={onRestart}>
            처음부터 다시
          </button>
        ) : (
          <button type="button" className="soft-primary" onClick={onContinue}>
            {result.metrics.passed ? "다음 웨이브" : "구조 다시 설계"}
          </button>
        )}
      </section>
    </div>
  );
}
