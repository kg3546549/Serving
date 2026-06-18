import type { LiveWaveMetrics } from "../store/gameStore";

interface MissionHudProps {
  waveNumber: number;
  waveTotal: number;
  liveMetrics: LiveWaveMetrics;
  isRunning: boolean;
  onHelp: () => void;
}

export function MissionHud({
  waveNumber,
  waveTotal,
  liveMetrics,
  isRunning,
  onHelp,
}: MissionHudProps): React.JSX.Element {
  const settledRequests = liveMetrics.completed + liveMetrics.failed;
  const progressPercent =
    waveTotal === 0 ? 0 : Math.min(100, (settledRequests / waveTotal) * 100);

  return (
    <header className="mission-hud">
      <div className="stage-chip" aria-label="현재 스테이지 3">
        <small>STAGE</small>
        <span>03</span>
      </div>

      <div className="mission-title">
        <div>
          <strong>서버 한 대의 한계</strong>
          <span>WAVE 0{waveNumber} / 02</span>
        </div>
        <div className="wave-progress" aria-label={`요청 처리 ${settledRequests}/${waveTotal}`}>
          <i style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="mini-resources">
        <span className="mini-resource traffic" aria-live="polite">
          <small>{isRunning ? "LIVE TRAFFIC" : "REQUESTS"}</small>
          <strong>
            {isRunning ? `${liveMetrics.completed} / ${waveTotal}` : waveTotal}
          </strong>
        </span>
        <button
          type="button"
          className="help-button"
          onClick={onHelp}
          aria-label="도움말 열기"
        >
          i
        </button>
      </div>
    </header>
  );
}
