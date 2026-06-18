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
            ? "SERVICE OPEN"
            : paused
              ? "TIMER PAUSED"
              : "BEFORE OPEN"}
        </span>
        <strong>
          {phase === "running"
            ? "서비스 개시 · 사용자 요청 처리 중"
            : paused
              ? "정보창을 닫으면 계속됩니다"
              : `서비스 개시까지 ${String(seconds).padStart(2, "0")}초 전`}
        </strong>
      </div>
      <div className="auto-wave-track">
        <i style={{ width: `${elapsedPercent}%` }} />
      </div>
    </section>
  );
}
