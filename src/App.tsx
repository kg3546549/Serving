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
import { AugmentPopup } from "./components/AugmentPopup";
import { AutoWaveBar } from "./components/AutoWaveBar";
import { HelpModal } from "./components/HelpModal";
import { InfrastructureUpgradePopup } from "./components/InfrastructureUpgradePopup";
import { InventoryDock } from "./components/InventoryDock";
import { MainMenu } from "./components/MainMenu";
import { MissionHud } from "./components/MissionHud";
import { NodeDetails } from "./components/NodeDetails";
import { ResultModal } from "./components/ResultModal";
import { ResourceDetailsPopup } from "./components/ResourceDetailsPopup";
import { ShopDock } from "./components/ShopDock";
import { GAME_EVENTS, gameEvents } from "./game/bridge/gameEvents";
import {
  getBoardTier,
  getLinkTier,
  getTotalConnectionCells,
  simulateTrafficWave,
  type ArchitectureNodeId,
  type GridPosition,
  type NodeInstance,
  type ShopItemType,
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
const EMERGENCY_MAINTENANCE_DURATION_MS = 15_000;

export function App(): React.JSX.Element {
  const [isHelpOpen, setHelpOpen] = useState(false);
  const [selectedNode, setSelectedNode] =
    useState<ArchitectureNodeId | null>(null);
  const [selectedResource, setSelectedResource] = useState<{
    type: ShopItemType;
    instance?: NodeInstance;
  } | null>(null);
  const [prepRemainingMs, setPrepRemainingMs] =
    useState(FIRST_WAVE_PREP_DURATION_MS);
  const autoWaveStartedRef = useRef(false);
  const autoInspectStarterRef = useRef(false);

  const phase = useGameStore((state) => state.phase);
  const waveIndex = useGameStore((state) => state.waveIndex);
  const coins = useGameStore((state) => state.coins);
  const serviceHp = useGameStore((state) => state.serviceHp);
  const worldReady = useGameStore((state) => state.worldReady);
  const architecture = useGameStore((state) => state.architecture);
  const inventory = useGameStore((state) => state.inventory);
  const liveMetrics = useGameStore((state) => state.liveMetrics);
  const lastResult = useGameStore((state) => state.lastResult);
  const playerLevel = useGameStore((state) => state.playerLevel);
  const playerXp = useGameStore((state) => state.playerXp);
  const shopItems = useGameStore((state) => state.shopItems);
  const augmentState = useGameStore((state) => state.augmentState);
  const pendingInfrastructureUpgrades = useGameStore(
    (state) => state.pendingInfrastructureUpgrades,
  );
  const maintenanceMode = useGameStore((state) => state.maintenanceMode);
  const maintenanceExtensionMs = useGameStore(
    (state) => state.maintenanceExtensionMs,
  );
  const emergencyMaintenanceCharges = useGameStore(
    (state) => state.emergencyMaintenanceCharges,
  );

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
  const useEmergencyMaintenance = useGameStore(
    (state) => state.useEmergencyMaintenance,
  );
  const rollShop = useGameStore((state) => state.rollShop);
  const buyXp = useGameStore((state) => state.buyXp);
  const buyShopItem = useGameStore((state) => state.buyShopItem);
  const sellNode = useGameStore((state) => state.sellNode);
  const selectAugment = useGameStore((state) => state.selectAugment);
  const chooseInfrastructureUpgrade = useGameStore(
    (state) => state.chooseInfrastructureUpgrade,
  );
  const placeNode = useGameStore((state) => state.placeNode);
  const moveNode = useGameStore((state) => state.moveNode);
  const toggleConnection = useGameStore((state) => state.toggleConnection);
  const clearConnections = useGameStore((state) => state.clearConnections);
  const resetCampaign = useGameStore((state) => state.resetCampaign);

  const wave = STAGE_ONE_WAVES[waveIndex];
  const prepDurationMs =
    maintenanceMode === "emergency"
      ? EMERGENCY_MAINTENANCE_DURATION_MS
      : maintenanceMode === "regular"
        ? MAINTENANCE_DURATION_MS + maintenanceExtensionMs
        : FIRST_WAVE_PREP_DURATION_MS;
  const boardTier = getBoardTier(architecture.boardLevel);
  const linkTier = getLinkTier(architecture.linkLevel);

  const handleStartMission = useCallback(() => {
    void unlockAudio();
    startMission();
  }, [startMission]);

  const handleWorldReady = useCallback(() => {
    setWorldReady(true);
  }, [setWorldReady]);

  const handleWaveProgress = useCallback(
    (metrics: LiveWaveMetrics) => updateWaveProgress(metrics),
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
    autoWaveStartedRef.current = false;
    setPrepRemainingMs(MAINTENANCE_DURATION_MS + maintenanceExtensionMs);
    continueAfterResult();
    gameEvents.emit(GAME_EVENTS.RESET_WORLD, undefined);
  }, [continueAfterResult, maintenanceExtensionMs]);

  const handleEmergencyMaintenance = useCallback(() => {
    if (phase !== "running" || emergencyMaintenanceCharges <= 0) {
      return;
    }
    setSelectedNode(null);
    autoWaveStartedRef.current = false;
    setPrepRemainingMs(EMERGENCY_MAINTENANCE_DURATION_MS);
    useEmergencyMaintenance();
    gameEvents.emit(GAME_EVENTS.RESET_WORLD, undefined);
  }, [
    emergencyMaintenanceCharges,
    phase,
    useEmergencyMaintenance,
  ]);

  const handleRestart = useCallback(() => {
    setSelectedNode(null);
    autoWaveStartedRef.current = false;
    autoInspectStarterRef.current = false;
    setPrepRemainingMs(FIRST_WAVE_PREP_DURATION_MS);
    resetCampaign();
    gameEvents.emit(GAME_EVENTS.RESET_WORLD, undefined);
  }, [resetCampaign]);

  const handleSelectNode = useCallback(
    (nodeId: ArchitectureNodeId, instanceId?: string) => {
      gameEvents.emit(GAME_EVENTS.INVENTORY_SELECT, { nodeId, instanceId });
    },
    [],
  );

  const handleCancelPlacement = useCallback(() => {
    gameEvents.emit(GAME_EVENTS.BUILD_CANCEL, undefined);
  }, []);

  const handleNodePlacement = useCallback(
    (
      nodeId: ArchitectureNodeId,
      position: GridPosition,
      instanceId?: string,
    ) => placeNode(nodeId, position, instanceId),
    [placeNode],
  );

  const handleConnectionRequest = useCallback(
    (from: ArchitectureNodeId, to: ArchitectureNodeId) =>
      toggleConnection(from, to),
    [toggleConnection],
  );

  const handleNodeMove = useCallback(
    (nodeId: ArchitectureNodeId, position: GridPosition) =>
      moveNode(nodeId, position),
    [moveNode],
  );

  const handleDropNode = useCallback(
    (
      nodeId: ArchitectureNodeId,
      clientX: number,
      clientY: number,
      instanceId?: string,
    ) => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        ".game-canvas canvas",
      );
      if (!canvas) {
        handleCancelPlacement();
        return;
      }
      const bounds = canvas.getBoundingClientRect();
      const x = clientX - bounds.left;
      const y = clientY - bounds.top;
      gameEvents.emit(GAME_EVENTS.INVENTORY_DROP, {
        nodeId,
        x,
        y,
        instanceId,
      });
    },
    [handleCancelPlacement],
  );

  useEffect(() => {
    if (worldReady) {
      gameEvents.emit(GAME_EVENTS.CONFIGURE_ARCHITECTURE, { architecture });
    }
  }, [architecture, worldReady]);

  useEffect(() => {
    if (phase !== "prepare") {
      return;
    }
    autoWaveStartedRef.current = false;
    setPrepRemainingMs(prepDurationMs);
  }, [maintenanceMode, phase, prepDurationMs, waveIndex]);

  const isTimerPaused =
    isHelpOpen ||
    selectedResource !== null ||
    augmentState !== null ||
    pendingInfrastructureUpgrades > 0;

  useEffect(() => {
    if (phase !== "prepare" || !worldReady || isTimerPaused) {
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
      waveIndex === 0 &&
      architecture.hasDatabase &&
      !autoInspectStarterRef.current
    ) {
      autoInspectStarterRef.current = true;
      setSelectedNode("database");
    }
  }, [architecture.hasDatabase, phase, waveIndex]);

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
    <main className="infra-game">
      <section className="infra-main">
        <MissionHud
          stageNumber={ACTIVE_STAGE.id}
          stageName={ACTIVE_STAGE.name}
          waveNumber={wave.id}
          waveCount={STAGE_ONE_WAVES.length}
          waveTotal={wave.requestCount}
          protocol={wave.protocol}
          serviceHp={serviceHp}
          coins={coins}
          liveMetrics={liveMetrics}
          isRunning={phase === "running"}
          onHelp={() => setHelpOpen(true)}
        />

        <section className="board-stage" aria-label="아키텍처 보드">
          <div className="board-stage-layout">
            <div className="board-surface">
              <div className="board-meta board-meta--overlay">
                <span>BOARD {boardTier.level}</span>
                <b>{boardTier.columns}×{boardTier.rows}</b>
                <i />
                <span>LINK {linkTier.level}</span>
                <b>{getTotalConnectionCells(architecture)}/{linkTier.totalCells}</b>
              </div>
              <div className="world-frame">
                <Suspense
                  fallback={<div className="world-loading">보드 준비 중...</div>}
                >
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
            </div>
            {selectedNode && (
              <NodeDetails
                nodeId={selectedNode}
                architecture={architecture}
                onClose={() => setSelectedNode(null)}
              />
            )}
          </div>
        </section>

        {(phase === "prepare" || phase === "running") && (
          <AutoWaveBar
            phase={phase}
            maintenanceMode={maintenanceMode}
            remainingMs={prepRemainingMs}
            totalMs={prepDurationMs}
            paused={isTimerPaused}
            emergencyMaintenanceCharges={emergencyMaintenanceCharges}
            onEmergencyMaintenance={handleEmergencyMaintenance}
          />
        )}

        {(phase === "prepare" || phase === "running") && (
          <InventoryDock
            inventory={inventory}
            architecture={architecture}
            disabled={phase !== "prepare"}
            onSelectNode={handleSelectNode}
            onDropNode={handleDropNode}
            onCancelPlacement={handleCancelPlacement}
            onInspectItem={(item) =>
              setSelectedResource({ type: item.type, instance: item })
            }
          />
        )}
      </section>

      <ShopDock
        playerLevel={playerLevel}
        playerXp={playerXp}
        shopItems={shopItems}
        inventory={inventory}
        coins={coins}
        disabled={phase !== "prepare"}
        wave={wave}
        emergencyMaintenanceCharges={emergencyMaintenanceCharges}
        maintenanceExtensionMs={maintenanceExtensionMs}
        onRollShop={() => rollShop(false)}
        onBuyXp={buyXp}
        onBuyShopItem={buyShopItem}
        onInspectItem={(type) => setSelectedResource({ type })}
        onClearConnections={clearConnections}
      />

      {isHelpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      {selectedResource && (
        <ResourceDetailsPopup
          type={selectedResource.type}
          instance={selectedResource.instance}
          onClose={() => setSelectedResource(null)}
          onSell={
            selectedResource.instance && phase === "prepare"
              ? () => {
                  sellNode(selectedResource.instance!.id);
                  setSelectedResource(null);
                }
              : undefined
          }
        />
      )}
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
      {augmentState && (
        <AugmentPopup
          augmentState={augmentState}
          onSelectAugment={selectAugment}
        />
      )}
      {!augmentState && pendingInfrastructureUpgrades > 0 && (
        <InfrastructureUpgradePopup
          architecture={architecture}
          pendingCount={pendingInfrastructureUpgrades}
          onSelect={chooseInfrastructureUpgrade}
        />
      )}
    </main>
  );
}
