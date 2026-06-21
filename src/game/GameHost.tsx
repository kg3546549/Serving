import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import type {
  ArchitectureNodeId,
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
  type NodePlacementPayload,
  type ConnectionRequestPayload,
  type NodeDetailsRequestPayload,
  type NodeMoveRequestPayload,
  type CameraChangedPayload,
  type CameraCommand,
} from "./bridge/gameEvents";

interface GameHostProps {
  onReady: () => void;
  onWaveProgress: (metrics: LiveWaveMetrics) => void;
  onWaveComplete: (result: WaveSimulationResult) => void;
  onNodePlacement: (
    nodeId: ArchitectureNodeId,
    position: GridPosition,
    instanceId?: string,
  ) => void;
  onConnectionRequest: (
    from: ArchitectureNodeId,
    to: ArchitectureNodeId,
  ) => void;
  onNodeMove: (
    nodeId: ArchitectureNodeId,
    position: GridPosition,
  ) => void;
  onNodeDetails: (nodeId: ArchitectureNodeId) => void;
}

export function GameHost({
  onReady,
  onWaveProgress,
  onWaveComplete,
  onNodePlacement,
  onConnectionRequest,
  onNodeMove,
  onNodeDetails,
}: GameHostProps): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const [cameraZoom, setCameraZoom] = useState(1);

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
    const unsubscribePlacement = gameEvents.on<NodePlacementPayload>(
      GAME_EVENTS.NODE_PLACEMENT_REQUEST,
      ({ nodeId, position, instanceId }) =>
        onNodePlacement(nodeId, position, instanceId),
    );
    const unsubscribeConnection = gameEvents.on<ConnectionRequestPayload>(
      GAME_EVENTS.CONNECTION_REQUEST,
      ({ from, to }) => onConnectionRequest(from, to),
    );
    const unsubscribeMove = gameEvents.on<NodeMoveRequestPayload>(
      GAME_EVENTS.NODE_MOVE_REQUEST,
      ({ nodeId, position }) => onNodeMove(nodeId, position),
    );
    const unsubscribeDetails = gameEvents.on<NodeDetailsRequestPayload>(
      GAME_EVENTS.NODE_DETAILS_REQUEST,
      ({ nodeId }) => onNodeDetails(nodeId),
    );
    const unsubscribeCamera = gameEvents.on<CameraChangedPayload>(
      GAME_EVENTS.CAMERA_CHANGED,
      ({ zoom }) => setCameraZoom(zoom),
    );

    const game = new Phaser.Game(({
      type: Phaser.WEBGL,
      width: 1200,
      height: 720,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      parent: hostRef.current,
      backgroundColor: "#f3f8ff",
      disableContextMenu: true,
      scene: [ArchitectureScene],
      antialias: true,
      transparent: false,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1200,
        height: 720,
      },
      render: {
        pixelArt: false,
        roundPixels: false,
      },
    }) as Phaser.Types.Core.GameConfig & { resolution: number });

    return () => {
      unsubscribeReady();
      unsubscribeProgress();
      unsubscribeComplete();
      unsubscribePlacement();
      unsubscribeConnection();
      unsubscribeMove();
      unsubscribeDetails();
      unsubscribeCamera();
      game.destroy(true);
    };
  }, [
    onConnectionRequest,
    onReady,
    onNodeDetails,
    onNodeMove,
    onNodePlacement,
    onWaveComplete,
    onWaveProgress,
  ]);

  return (
    <>
      <div
        ref={hostRef}
        className="game-canvas"
        aria-label="아키텍처 디펜스 게임 월드"
      />
      <div className="board-camera-help" aria-label="보드 화면 조작">
        <button
          type="button"
          onClick={() =>
            gameEvents.emit<CameraCommand>(
              GAME_EVENTS.CAMERA_COMMAND,
              "reset",
            )
          }
          aria-label="보드 화면 초기화"
        >
          ⛶
        </button>
        <button
          type="button"
          onClick={() =>
            gameEvents.emit<CameraCommand>(
              GAME_EVENTS.CAMERA_COMMAND,
              "zoomOut",
            )
          }
          aria-label="보드 축소"
        >
          −
        </button>
        <span>{Math.round(cameraZoom * 100)}%</span>
        <button
          type="button"
          onClick={() =>
            gameEvents.emit<CameraCommand>(
              GAME_EVENTS.CAMERA_COMMAND,
              "zoomIn",
            )
          }
          aria-label="보드 확대"
        >
          ＋
        </button>
      </div>
    </>
  );
}
