import type { NetworkProtocol } from "../campaign/campaignData";
import type { LiveWaveMetrics } from "../store/gameStore";

interface MissionHudProps {
  stageNumber: number;
  stageName: string;
  waveNumber: number;
  waveCount: number;
  waveTotal: number;
  protocol: NetworkProtocol;
  serviceHp: number;
  liveMetrics: LiveWaveMetrics;
  isRunning: boolean;
  onHelp: () => void;
}

export function MissionHud({
  stageNumber,
  stageName,
  waveNumber,
  waveCount,
  waveTotal,
  protocol,
  serviceHp,
  liveMetrics,
  isRunning,
  onHelp,
}: MissionHudProps): React.JSX.Element {
  const settledRequests = liveMetrics.completed + liveMetrics.failed;
  const progressPercent =
    waveTotal === 0 ? 0 : Math.min(100, (settledRequests / waveTotal) * 100);

  return (
    <header className="mission-hud">
      <div
        className="stage-chip"
        aria-label={`현재 스테이지 ${stageNumber}`}
      >
        <small>STAGE</small>
        <span>{String(stageNumber).padStart(2, "0")}</span>
      </div>

      <div className="mission-title">
        <div>
          <strong>{stageName}</strong>
          <span>
            {protocol} · WAVE {String(waveNumber).padStart(2, "0")} /{" "}
            {String(waveCount).padStart(2, "0")}
          </span>
        </div>
        <div
          className="wave-progress"
          aria-label={`요청 처리 ${settledRequests}/${waveTotal}`}
        >
          <i style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="mini-resources">
        <span
          className="mini-resource hp"
          aria-label={`서비스 HP ${serviceHp}`}
        >
          <small>SERVICE HP</small>
          <strong>♥ {serviceHp}</strong>
        </span>
        <span className="mini-resource traffic" aria-live="polite">
          <small>
            {isRunning
              ? `DB Q ${liveMetrics.databaseQueue}`
              : "REQUESTS"}
          </small>
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
