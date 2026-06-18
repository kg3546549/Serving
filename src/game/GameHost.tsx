import { useEffect, useRef } from "react";
import Phaser from "phaser";
import type {
  ArchitectureNodeId,
  BuildSystemType,
  GridPosition,
  WaveSimulationResult,
} from "../simulation/trafficSimulation";
import type { LiveWaveMetrics } from "../store/gameStore";
import { ArchitectureScene } from "./ArchitectureScene";
import {
  GAME_EVENTS,
  gameEvents,
  type WaveCompletePayload,
  type WaveProgressPayload,
  type SystemPlacementPayload,
  type ConnectionRequestPayload,
} from "./bridge/gameEvents";

interface GameHostProps {
  onReady: () => void;
  onWaveProgress: (metrics: LiveWaveMetrics) => void;
  onWaveComplete: (result: WaveSimulationResult) => void;
  onSystemPlacement: (
    systemType: BuildSystemType,
    position: GridPosition,
  ) => void;
  onConnectionRequest: (
    from: ArchitectureNodeId,
    to: ArchitectureNodeId,
  ) => void;
}

export function GameHost({
  onReady,
  onWaveProgress,
  onWaveComplete,
  onSystemPlacement,
  onConnectionRequest,
}: GameHostProps): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const unsubscribeReady = gameEvents.on<void>(
      GAME_EVENTS.SCENE_READY,
      onReady,
    );
    const unsubscribeProgress = gameEvents.on<WaveProgressPayload>(
      GAME_EVENTS.WAVE_PROGRESS,
      ({ metrics }) => onWaveProgress(metrics),
    );
    const unsubscribeComplete = gameEvents.on<WaveCompletePayload>(
      GAME_EVENTS.WAVE_COMPLETE,
      ({ result }) => onWaveComplete(result),
    );
    const unsubscribePlacement = gameEvents.on<SystemPlacementPayload>(
      GAME_EVENTS.SYSTEM_PLACEMENT_REQUEST,
      ({ systemType, position }) => onSystemPlacement(systemType, position),
    );
    const unsubscribeConnection = gameEvents.on<ConnectionRequestPayload>(
      GAME_EVENTS.CONNECTION_REQUEST,
      ({ from, to }) => onConnectionRequest(from, to),
    );

    const game = new Phaser.Game({
      type: Phaser.WEBGL,
      width: 1200,
      height: 720,
      parent: hostRef.current,
      backgroundColor: "#f6f0de",
      scene: [ArchitectureScene],
      antialias: true,
      transparent: false,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      render: {
        pixelArt: false,
        roundPixels: false,
      },
    });

    return () => {
      unsubscribeReady();
      unsubscribeProgress();
      unsubscribeComplete();
      unsubscribePlacement();
      unsubscribeConnection();
      game.destroy(true);
    };
  }, [
    onConnectionRequest,
    onReady,
    onSystemPlacement,
    onWaveComplete,
    onWaveProgress,
  ]);

  return (
    <div
      ref={hostRef}
      className="game-canvas"
      aria-label="아키텍처 디펜스 게임 월드"
    />
  );
}
