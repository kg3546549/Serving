import type {
  GamePhase,
  GameSpeedMultiplier,
  MaintenanceMode,
} from "../store/gameStore";

interface AutoWaveBarProps {
  phase: GamePhase;
  maintenanceMode: MaintenanceMode;
  gameSpeed: GameSpeedMultiplier;
  remainingMs: number;
  totalMs: number;
  paused: boolean;
  emergencyMaintenanceCharges: number;
  onEmergencyMaintenance: () => void;
  onSkipPrepare?: () => void;
  onChangeGameSpeed: (speed: GameSpeedMultiplier) => void;
}

export function AutoWaveBar({
  phase,
  maintenanceMode,
  gameSpeed,
  remainingMs,
  totalMs,
  paused,
  emergencyMaintenanceCharges,
  onEmergencyMaintenance,
  onSkipPrepare,
  onChangeGameSpeed,
}: AutoWaveBarProps): React.JSX.Element {
  const elapsedPercent =
    phase === "prepare"
      ? Math.min(100, ((totalMs - remainingMs) / totalMs) * 100)
      : phase === "running"
        ? 100
        : 0;
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const maintenanceLabel =
    maintenanceMode === "emergency"
      ? "긴급점검"
      : maintenanceMode === "regular"
        ? "정기점검"
        : "서비스 준비";

  return (
    <section className="auto-wave-bar" aria-label="서비스 운영 상태">
      <div className="wave-control-mark" aria-hidden="true">
        {phase === "running" ? "Ⅱ" : "▶"}
      </div>
      <div className="auto-wave-copy">
        <span>{phase === "running" ? "WAVE 진행 중" : `${maintenanceLabel} 진행 중`}</span>
        <strong>
          {phase === "running"
            ? "정해진 흐름에 따라 서비스가 계속 진행됩니다."
            : paused
              ? "정보창을 닫으면 점검시간이 계속됩니다."
              : `${String(seconds).padStart(2, "0")}초 후 서비스를 개시합니다.`}
        </strong>
      </div>
      <div className="auto-wave-track">
        <i style={{ width: `${elapsedPercent}%` }} />
      </div>
      <div className="speed-control" aria-label="게임 속도">
        {([1, 2, 4] as const).map((speed) => (
          <button
            key={speed}
            type="button"
            className={`speed-control-button ${gameSpeed === speed ? "active" : ""}`}
            onClick={() => onChangeGameSpeed(speed)}
            aria-pressed={gameSpeed === speed}
          >
            {speed}x
          </button>
        ))}
      </div>
      {phase === "prepare" && onSkipPrepare && (
        <button
          type="button"
          className="emergency-maintenance-button"
          onClick={onSkipPrepare}
        >
          준비 스킵
        </button>
      )}
      {phase === "running" && (
        <button
          type="button"
          className="emergency-maintenance-button"
          onClick={onEmergencyMaintenance}
          disabled={emergencyMaintenanceCharges <= 0}
        >
          긴급점검 {emergencyMaintenanceCharges}
        </button>
      )}
    </section>
  );
}
