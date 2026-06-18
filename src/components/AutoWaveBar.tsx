import type { GamePhase } from "../store/gameStore";

interface AutoWaveBarProps {
  phase: GamePhase;
  remainingMs: number;
  totalMs: number;
  paused: boolean;
}

export function AutoWaveBar({
  phase,
  remainingMs,
  totalMs,
  paused,
}: AutoWaveBarProps): React.JSX.Element {
  const elapsedPercent =
    phase === "prepare"
      ? Math.min(100, ((totalMs - remainingMs) / totalMs) * 100)
      : phase === "running"
        ? 100
        : 0;
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));

  return (
    <section className="auto-wave-bar" aria-label="자동 웨이브 시작 시간">
      <div className="auto-wave-copy">
        <span>
          {phase === "running"
            ? "WAVE ACTIVE"
            : paused
              ? "TIMER PAUSED"
              : "AUTO DEPLOY"}
        </span>
        <strong>
          {phase === "running"
            ? "트래픽 처리 중"
            : paused
              ? "정보창을 닫으면 계속됩니다"
              : `${seconds}초 후 자동 시작`}
        </strong>
      </div>
      <div className="auto-wave-track">
        <i style={{ width: `${elapsedPercent}%` }} />
      </div>
    </section>
  );
}

