import { useEffect, useRef, useState } from "react";
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
  const prevHpRef = useRef(serviceHp);
  const [isDamaged, setIsDamaged] = useState(false);

  useEffect(() => {
    if (serviceHp < prevHpRef.current) {
      setIsDamaged(true);
      const timer = setTimeout(() => setIsDamaged(false), 500);
      return () => clearTimeout(timer);
    }
    prevHpRef.current = serviceHp;
  }, [serviceHp]);

  const prevCoinsRef = useRef(coins);
  const [isCoinsGained, setIsCoinsGained] = useState(false);

  useEffect(() => {
    if (coins > prevCoinsRef.current) {
      setIsCoinsGained(true);
      const timer = setTimeout(() => setIsCoinsGained(false), 400);
      return () => clearTimeout(timer);
    }
    prevCoinsRef.current = coins;
  }, [coins]);

  const settledRequests = liveMetrics.completed + liveMetrics.failed;
  const progressPercent =
    waveTotal === 0 ? 0 : Math.min(100, (settledRequests / waveTotal) * 100);
  const requestValue = isRunning
    ? `${settledRequests} / 초`
    : `${waveTotal} / 초`;

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
          <span className="mission-copy-subtitle">
            HTTPS 엔드포인트를 제공하는 기본 API 아키텍처를 구축하세요.
          </span>
          <div className="mission-description">
            <button type="button" onClick={onHelp} aria-label="도움말 열기">
              i
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
        <span 
          className={`mini-resource hp ${isDamaged ? "hp-damaged-shake" : ""}`} 
          aria-label={`서비스 HP ${serviceHp}`}
          style={{ display: "flex", flexDirection: "column", gap: "5px" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", width: "100%" }}>
            <small>SERVICE HP</small>
            <strong style={{ fontSize: "14px" }}>{serviceHp} / 100</strong>
          </div>
          <div style={{
            width: "100%",
            height: "6px",
            background: "rgba(239, 92, 112, 0.15)",
            borderRadius: "3px",
            overflow: "hidden",
            border: "1px solid rgba(239, 92, 112, 0.25)"
          }}>
            <div style={{
              width: `${serviceHp}%`,
              height: "100%",
              background: "linear-gradient(90deg, #ef5c70, #ff8fa2)",
              borderRadius: "3px",
              transition: "width 0.3s ease-out"
            }} />
          </div>
        </span>
        <span className="mini-resource traffic" aria-live="polite">
          <small>REQUESTS</small>
          <strong>{requestValue}</strong>
        </span>
        <span className={`mini-resource credits ${isCoinsGained ? "credits-gain-bounce" : ""}`} aria-label={`보유 재화 ${coins}`}>
          <small>CREDITS</small>
          <strong>{coins}</strong>
        </span>
      </div>
    </header>
  );
}
