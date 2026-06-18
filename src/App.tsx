import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  playWaveCleared,
  playWaveFailed,
  playWaveStart,
  unlockAudio,
} from "./audio/audioDirector";
import { BuildDock } from "./components/BuildDock";
import { AutoWaveBar } from "./components/AutoWaveBar";
import { HelpModal } from "./components/HelpModal";
import { MainMenu } from "./components/MainMenu";
import { MissionHud } from "./components/MissionHud";
import { NodeDetails } from "./components/NodeDetails";
import { ResultModal } from "./components/ResultModal";
import { GAME_EVENTS, gameEvents } from "./game/bridge/gameEvents";
import {
  type ArchitectureNodeId,
  type BuildSystemType,
  type GridPosition,
  simulateTrafficWave,
  WAVES,
  type WaveSimulationResult,
} from "./simulation/trafficSimulation";
import {
  useGameStore,
  type LiveWaveMetrics,
} from "./store/gameStore";

const GameHost = lazy(() =>
  import("./game/GameHost").then((module) => ({ default: module.GameHost })),
);

const PREP_DURATION_MS = 20_000;

export function App(): React.JSX.Element {
  const [isHelpOpen, setHelpOpen] = useState(false);
  const [selectedNode, setSelectedNode] =
    useState<ArchitectureNodeId | null>(null);
  const [prepRemainingMs, setPrepRemainingMs] =
    useState(PREP_DURATION_MS);
  const autoWaveStartedRef = useRef(false);
  const phase = useGameStore((state) => state.phase);
  const waveIndex = useGameStore((state) => state.waveIndex);
  const coins = useGameStore((state) => state.coins);
  const worldReady = useGameStore((state) => state.worldReady);
  const architecture = useGameStore((state) => state.architecture);
  const expansionUnlocked = useGameStore(
    (state) => state.expansionUnlocked,
  );
  const shopLevel = useGameStore((state) => state.shopLevel);
  const shopRotation = useGameStore((state) => state.shopRotation);
  const liveMetrics = useGameStore((state) => state.liveMetrics);
  const lastResult = useGameStore((state) => state.lastResult);
  const startMission = useGameStore((state) => state.startMission);
  const setWorldReady = useGameStore((state) => state.setWorldReady);
  const beginWave = useGameStore((state) => state.beginWave);
  const updateWaveProgress = useGameStore(
    (state) => state.updateWaveProgress,
  );
  const completeWave = useGameStore((state) => state.completeWave);
  const continueAfterResult = useGameStore(
    (state) => state.continueAfterResult,
  );
  const placeSystem = useGameStore((state) => state.placeSystem);
  const moveNode = useGameStore((state) => state.moveNode);
  const toggleConnection = useGameStore((state) => state.toggleConnection);
  const upgradeShop = useGameStore((state) => state.upgradeShop);
  const rerollShop = useGameStore((state) => state.rerollShop);
  const clearConnections = useGameStore((state) => state.clearConnections);
  const resetCampaign = useGameStore((state) => state.resetCampaign);
  const wave = WAVES[waveIndex];

  const handleStartMission = useCallback(() => {
    void unlockAudio();
    startMission();
  }, [startMission]);

  const handleWorldReady = useCallback(() => {
    setWorldReady(true);
  }, [setWorldReady]);

  const handleWaveProgress = useCallback(
    (metrics: LiveWaveMetrics) => {
      updateWaveProgress(metrics);
    },
    [updateWaveProgress],
  );

  const handleWaveComplete = useCallback(
    (result: WaveSimulationResult) => {
      completeWave(result);
      if (result.metrics.passed) {
        playWaveCleared();
      } else {
        playWaveFailed();
      }
    },
    [completeWave],
  );

  const handleStartWave = useCallback(() => {
    if (
      phase !== "prepare" ||
      !worldReady ||
      autoWaveStartedRef.current
    ) {
      return;
    }

    autoWaveStartedRef.current = true;
    const result = simulateTrafficWave(wave, architecture);
    beginWave(result);
    playWaveStart();
    gameEvents.emit(GAME_EVENTS.WAVE_REQUEST, result);
  }, [architecture, beginWave, phase, wave, worldReady]);

  const handleContinue = useCallback(() => {
    setSelectedNode(null);
    continueAfterResult();
    gameEvents.emit(GAME_EVENTS.RESET_WORLD, undefined);
  }, [continueAfterResult]);

  const handleRestart = useCallback(() => {
    setSelectedNode(null);
    resetCampaign();
    gameEvents.emit(GAME_EVENTS.RESET_WORLD, undefined);
  }, [resetCampaign]);

  const handleSelectSystem = useCallback((systemType: BuildSystemType) => {
    gameEvents.emit(GAME_EVENTS.BUILD_SELECT, { systemType });
  }, []);

  const handleCancelPlacement = useCallback(() => {
    gameEvents.emit(GAME_EVENTS.BUILD_CANCEL, undefined);
  }, []);

  const handleSystemPlacement = useCallback(
    (systemType: BuildSystemType, position: GridPosition) => {
      placeSystem(systemType, position);
    },
    [placeSystem],
  );

  const handleConnectionRequest = useCallback(
    (from: ArchitectureNodeId, to: ArchitectureNodeId) => {
      toggleConnection(from, to);
    },
    [toggleConnection],
  );

  const handleNodeMove = useCallback(
    (nodeId: ArchitectureNodeId, position: GridPosition) => {
      moveNode(nodeId, position);
    },
    [moveNode],
  );

  const handleDropSystem = useCallback(
    (systemType: BuildSystemType, clientX: number, clientY: number) => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        ".game-canvas canvas",
      );
      if (!canvas) {
        handleCancelPlacement();
        return;
      }

      const bounds = canvas.getBoundingClientRect();
      const x = ((clientX - bounds.left) / bounds.width) * 1200;
      const y = ((clientY - bounds.top) / bounds.height) * 720;
      gameEvents.emit(GAME_EVENTS.BUILD_DROP, { systemType, x, y });
    },
    [handleCancelPlacement],
  );

  useEffect(() => {
    if (!worldReady) {
      return;
    }

    gameEvents.emit(GAME_EVENTS.CONFIGURE_ARCHITECTURE, { architecture });
  }, [architecture, worldReady]);

  useEffect(() => {
    if (phase !== "prepare") {
      return;
    }
    autoWaveStartedRef.current = false;
    setPrepRemainingMs(PREP_DURATION_MS);
  }, [phase, waveIndex]);

  const isTimerPaused = isHelpOpen || selectedNode !== null;

  useEffect(() => {
    if (
      phase !== "prepare" ||
      !worldReady ||
      isTimerPaused
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      setPrepRemainingMs((remaining) => Math.max(0, remaining - 100));
    }, 100);
    return () => window.clearInterval(timer);
  }, [isTimerPaused, phase, worldReady]);

  useEffect(() => {
    if (
      phase === "prepare" &&
      worldReady &&
      !isTimerPaused &&
      prepRemainingMs === 0
    ) {
      handleStartWave();
    }
  }, [
    handleStartWave,
    isTimerPaused,
    phase,
    prepRemainingMs,
    worldReady,
  ]);

  if (phase === "menu") {
    return <MainMenu onStart={handleStartMission} />;
  }

  return (
    <main className="game-shell">
      <MissionHud
        waveNumber={wave.id}
        waveTotal={wave.requestCount}
        liveMetrics={liveMetrics}
        isRunning={phase === "running"}
        onHelp={() => setHelpOpen(true)}
      />

      <section className="play-board">
        <div className="world-frame">
          <Suspense fallback={<div className="world-loading">보드 준비 중...</div>}>
            <GameHost
              onReady={handleWorldReady}
              onWaveProgress={handleWaveProgress}
              onWaveComplete={handleWaveComplete}
              onSystemPlacement={handleSystemPlacement}
              onConnectionRequest={handleConnectionRequest}
              onNodeMove={handleNodeMove}
              onNodeDetails={setSelectedNode}
            />
          </Suspense>
        </div>
        <BuildDock
          architecture={architecture}
          coins={coins}
          expansionUnlocked={expansionUnlocked}
          shopLevel={shopLevel}
          shopRotation={shopRotation}
          disabled={phase !== "prepare"}
          wave={wave}
          onSelectSystem={handleSelectSystem}
          onDropSystem={handleDropSystem}
          onCancelPlacement={handleCancelPlacement}
          onClearConnections={clearConnections}
          onUpgradeShop={upgradeShop}
          onRerollShop={rerollShop}
        />
      </section>

      {(phase === "prepare" || phase === "running") && (
        <AutoWaveBar
          phase={phase}
          remainingMs={prepRemainingMs}
          totalMs={PREP_DURATION_MS}
          paused={isTimerPaused}
        />
      )}

      {selectedNode && (
        <NodeDetails
          nodeId={selectedNode}
          architecture={architecture}
          onClose={() => setSelectedNode(null)}
        />
      )}
      {isHelpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      {(phase === "result" || phase === "cleared") && lastResult && (
        <ResultModal
          result={lastResult}
          finalClear={phase === "cleared"}
          expansionUnlocked={expansionUnlocked}
          onContinue={handleContinue}
          onRestart={handleRestart}
        />
      )}
    </main>
  );
}
