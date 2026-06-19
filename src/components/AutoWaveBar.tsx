import type { GamePhase, MaintenanceMode } from "../store/gameStore";

interface AutoWaveBarProps {
  phase: GamePhase;
  maintenanceMode: MaintenanceMode;
  remainingMs: number;
  totalMs: number;
  paused: boolean;
  emergencyMaintenanceCharges: number;
  onEmergencyMaintenance: () => void;
}

export function AutoWaveBar({
  phase,
  maintenanceMode,
  remainingMs,
  totalMs,
  paused,
  emergencyMaintenanceCharges,
  onEmergencyMaintenance,
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
        <span>{phase === "running" ? "WAVE 진행 중" : maintenanceLabel}</span>
        <strong>
          {phase === "running"
            ? "정상 운영을 계속합니다."
            : paused
              ? "정보창을 닫으면 점검시간이 계속됩니다."
              : `${String(seconds).padStart(2, "0")}초 후 서비스를 개시합니다.`}
        </strong>
      </div>
      <div className="auto-wave-track">
        <i style={{ width: `${elapsedPercent}%` }} />
      </div>
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
