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
  coins: number;
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
  coins,
  liveMetrics,
  isRunning,
  onHelp,
}: MissionHudProps): React.JSX.Element {
  const settledRequests = liveMetrics.completed + liveMetrics.failed;
  const progressPercent =
    waveTotal === 0 ? 0 : Math.min(100, (settledRequests / waveTotal) * 100);

  return (
    <header className="mission-hud">
      <div className="mission-stage">
        <div
          className="stage-chip"
          aria-label={`현재 스테이지 ${stageNumber}`}
        >
          <small>STAGE</small>
          <span>{String(stageNumber).padStart(2, "0")}</span>
        </div>
        <div className="mission-copy">
          <strong>{stageName}</strong>
          <div className="mission-description">
            <span>HTTPS 엔드포인트를 제공하는 기본 API 아키텍처</span>
            <button type="button" onClick={onHelp}>
              도움말
            </button>
          </div>
        </div>
      </div>

      <div className="mission-wave">
        <span>
          {protocol} · WAVE {String(waveNumber).padStart(2, "0")} /{" "}
          {String(waveCount).padStart(2, "0")}
        </span>
        <div
          className="wave-progress"
          aria-label={`요청 처리 ${settledRequests}/${waveTotal}`}
        >
          <i style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="mini-resources">
        <span className="mini-resource hp" aria-label={`서비스 HP ${serviceHp}`}>
          <small>SERVICE HP</small>
          <strong>{serviceHp} / 100</strong>
        </span>
        <span className="mini-resource traffic" aria-live="polite">
          <small>REQUESTS</small>
          <strong>
            {isRunning
              ? `${liveMetrics.completed + liveMetrics.failed} / ${waveTotal}`
              : waveTotal}
          </strong>
        </span>
        <span className="mini-resource credits" aria-label={`보유 재화 ${coins}`}>
          <small>CREDITS</small>
          <strong>{coins}</strong>
        </span>
      </div>
    </header>
  );
}
