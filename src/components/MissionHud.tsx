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
    const tookDamage = serviceHp < prevHpRef.current;
    prevHpRef.current = serviceHp;
    if (tookDamage) {
      setIsDamaged(true);
      const timer = setTimeout(() => setIsDamaged(false), 500);
      return () => clearTimeout(timer);
    }
  }, [serviceHp]);

  const prevCoinsRef = useRef(coins);
  const [isCoinsGained, setIsCoinsGained] = useState(false);

  useEffect(() => {
    const gainedCoins = coins > prevCoinsRef.current;
    prevCoinsRef.current = coins;
    if (gainedCoins) {
      setIsCoinsGained(true);
      const timer = setTimeout(() => setIsCoinsGained(false), 400);
      return () => clearTimeout(timer);
    }
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <strong>{stageName}</strong>
            <button
              type="button"
              className="help-circle-button"
              onClick={onHelp}
              aria-label="도움말 열기"
              style={{
                display: "grid",
                placeItems: "center",
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                background: "var(--ui-blue-soft)",
                border: "1px solid var(--ui-line-strong)",
                color: "var(--ui-blue-strong)",
                fontSize: "11px",
                fontWeight: 900,
                cursor: "pointer"
              }}
            >
              i
            </button>
          </div>
          <span className="mission-copy-subtitle" style={{ fontSize: "10px", color: "var(--ui-muted)" }}>
            기본 API 아키텍처 구축
          </span>
        </div>
      </div>

      <div className="mission-wave" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}>
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
          </svg>
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
          aria-live="polite"
          style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center", justifyContent: "center" }}
        >
          <small style={{ fontSize: "10px", fontWeight: 850, color: "var(--ui-muted)", display: "flex", alignItems: "center" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ui-red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "4px" }}>
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
            </svg>
            SERVICE HP
          </small>
          <strong style={{ fontSize: "24px", fontWeight: 850, display: "flex", alignItems: "baseline" }}>
            {serviceHp}
            <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--ui-muted)", marginLeft: "4px" }}>
              / 100
            </span>
          </strong>
          <div style={{
            width: "100%",
            height: "6px",
            background: "rgba(239, 92, 112, 0.15)",
            borderRadius: "3px",
            overflow: "hidden",
            border: "1px solid rgba(239, 92, 112, 0.25)",
            marginTop: "2px"
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

        <span 
          className="mini-resource traffic" 
          aria-live="polite"
          style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center", justifyContent: "center" }}
        >
          <small style={{ fontSize: "10px", fontWeight: 850, color: "var(--ui-muted)", display: "flex", alignItems: "center" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ui-blue)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "4px" }}>
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
            REQUESTS
          </small>
          <strong style={{ fontSize: "24px", fontWeight: 850, display: "flex", alignItems: "baseline" }}>
            {requestValue}
          </strong>
          <div style={{
            width: "100%",
            height: "6px",
            background: "rgba(44, 126, 220, 0.15)",
            borderRadius: "3px",
            overflow: "hidden",
            border: "1px solid rgba(44, 126, 220, 0.25)",
            marginTop: "2px"
          }}>
            <div style={{
              width: "100%",
              height: "100%",
              background: "linear-gradient(90deg, #2c7cdc, #4a97f0)",
              borderRadius: "3px"
            }} />
          </div>
        </span>

        <span
          className={`mini-resource credits ${isCoinsGained ? "credits-gain-bounce" : ""}`}
          aria-label={`보유 재화 $${coins}`}
          aria-live="polite"
          style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center", justifyContent: "center" }}
        >
          <small style={{ fontSize: "10px", fontWeight: 850, color: "var(--ui-muted)", display: "flex", alignItems: "center" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ui-gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "4px" }}>
              <line x1="12" x2="12" y1="2" y2="22" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            CREDITS
          </small>
          <strong style={{ fontSize: "24px", fontWeight: 850, display: "flex", alignItems: "baseline" }}>
            ${coins}
          </strong>
          <div style={{
            width: "100%",
            height: "6px",
            background: "rgba(217, 160, 44, 0.15)",
            borderRadius: "3px",
            overflow: "hidden",
            border: "1px solid rgba(217, 160, 44, 0.25)",
            marginTop: "2px"
          }}>
            <div style={{
              width: "100%",
              height: "100%",
              background: "linear-gradient(90deg, #d9a02c, #fbbf24)",
              borderRadius: "3px"
            }} />
          </div>
        </span>
      </div>
    </header>
  );
}
