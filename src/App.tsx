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
import { ACTIVE_STAGE, STAGE_ONE_WAVES } from "./campaign/campaignData";
import { BuildDock } from "./components/BuildDock";
import { AutoWaveBar } from "./components/AutoWaveBar";
import { HelpModal } from "./components/HelpModal";
import { InventoryDock } from "./components/InventoryDock";
import { MainMenu } from "./components/MainMenu";
import { MissionHud } from "./components/MissionHud";
import { NodeDetails } from "./components/NodeDetails";
import { ResultModal } from "./components/ResultModal";
import { GAME_EVENTS, gameEvents } from "./game/bridge/gameEvents";
import {
  type ArchitectureNodeId,
  type GridPosition,
  simulateTrafficWave,
  type WaveSimulationResult,
} from "./simulation/trafficSimulation";
import {
  useGameStore,
  type LiveWaveMetrics,
} from "./store/gameStore";

const GameHost = lazy(() =>
  import("./game/GameHost").then((module) => ({ default: module.GameHost })),
);

const FIRST_WAVE_PREP_DURATION_MS = 60_000;
const MAINTENANCE_DURATION_MS = 25_000;

export function App(): React.JSX.Element {
  const [isHelpOpen, setHelpOpen] = useState(false);
  const [selectedNode, setSelectedNode] =
    useState<ArchitectureNodeId | null>(null);
  const [prepRemainingMs, setPrepRemainingMs] =
    useState(FIRST_WAVE_PREP_DURATION_MS);
  const autoWaveStartedRef = useRef(false);
  const phase = useGameStore((state) => state.phase);
  const waveIndex = useGameStore((state) => state.waveIndex);
  const coins = useGameStore((state) => state.coins);
  const serviceHp = useGameStore((state) => state.serviceHp);
  const worldReady = useGameStore((state) => state.worldReady);
  const architecture = useGameStore((state) => state.architecture);
  const ownedNodes = useGameStore((state) => state.ownedNodes);
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
  const purchaseSystem = useGameStore((state) => state.purchaseSystem);
  const placeNode = useGameStore((state) => state.placeNode);
  const moveNode = useGameStore((state) => state.moveNode);
  const toggleConnection = useGameStore((state) => state.toggleConnection);
  const upgradeLinks = useGameStore((state) => state.upgradeLinks);
  const clearConnections = useGameStore((state) => state.clearConnections);
  const resetCampaign = useGameStore((state) => state.resetCampaign);
  const wave = STAGE_ONE_WAVES[waveIndex];
  const prepDurationMs =
    waveIndex === 0
      ? FIRST_WAVE_PREP_DURATION_MS
      : MAINTENANCE_DURATION_MS;

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

  const handleSelectNode = useCallback((nodeId: ArchitectureNodeId) => {
    gameEvents.emit(GAME_EVENTS.INVENTORY_SELECT, { nodeId });
  }, []);

  const handleCancelPlacement = useCallback(() => {
    gameEvents.emit(GAME_EVENTS.BUILD_CANCEL, undefined);
  }, []);

  const handleNodePlacement = useCallback(
    (nodeId: ArchitectureNodeId, position: GridPosition) => {
      placeNode(nodeId, position);
    },
    [placeNode],
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

  const handleDropNode = useCallback(
    (nodeId: ArchitectureNodeId, clientX: number, clientY: number) => {
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
      gameEvents.emit(GAME_EVENTS.INVENTORY_DROP, { nodeId, x, y });
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
    setPrepRemainingMs(prepDurationMs);
  }, [phase, prepDurationMs, waveIndex]);

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
        stageNumber={ACTIVE_STAGE.id}
        stageName={ACTIVE_STAGE.name}
        waveNumber={wave.id}
        waveCount={STAGE_ONE_WAVES.length}
        waveTotal={wave.requestCount}
        protocol={wave.protocol}
        serviceHp={serviceHp}
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
              onNodePlacement={handleNodePlacement}
              onConnectionRequest={handleConnectionRequest}
              onNodeMove={handleNodeMove}
              onNodeDetails={setSelectedNode}
            />
          </Suspense>
        </div>
        <BuildDock
          architecture={architecture}
          ownedNodes={ownedNodes}
          coins={coins}
          disabled={phase !== "prepare"}
          waveIndex={waveIndex}
          wave={wave}
          onPurchaseSystem={purchaseSystem}
          onUpgradeLinks={upgradeLinks}
          onClearConnections={clearConnections}
        />
      </section>

      {(phase === "prepare" || phase === "running") && (
        <section className="bottom-operations" aria-label="운영 준비">
          <AutoWaveBar
            phase={phase}
            remainingMs={prepRemainingMs}
            totalMs={prepDurationMs}
            paused={isTimerPaused}
          />
          <InventoryDock
            architecture={architecture}
            ownedNodes={ownedNodes}
            disabled={phase !== "prepare"}
            onSelectNode={handleSelectNode}
            onDropNode={handleDropNode}
            onCancelPlacement={handleCancelPlacement}
          />
        </section>
      )}

      {selectedNode && (
        <NodeDetails
          nodeId={selectedNode}
          architecture={architecture}
          onClose={() => setSelectedNode(null)}
        />
      )}
      {isHelpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      {(phase === "result" ||
        phase === "cleared" ||
        phase === "defeated") &&
        lastResult && (
        <ResultModal
          result={lastResult}
          finalClear={phase === "cleared"}
          defeated={phase === "defeated"}
          serviceHp={serviceHp}
          hpDamage={Math.min(
            30,
            Math.ceil(lastResult.metrics.failed * 1.5),
          )}
          onContinue={handleContinue}
          onRestart={handleRestart}
        />
      )}
    </main>
  );
}
