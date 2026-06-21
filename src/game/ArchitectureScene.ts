import Phaser from "phaser";
import type {
  ArchitectureConfig,
  ArchitectureNodeId,
  GridPosition,
  TrafficEvent,
  WaveSimulationResult,
  NodeInstance,
} from "../simulation/trafficSimulation";
import {
  applyRuntimeArchitectureMutation,
  buildWaveResultFromRuntime,
  createRuntimeSimulationState,
  isRuntimeWaveSettled,
  stepRuntimeSimulation,
  type RuntimePacket,
  type RuntimeSimulationState,
} from "../simulation/runtimeEngine";
import {
  DEFAULT_NODE_POSITIONS,
  getBoardBounds,
  getBoardTier,
  getConnectionFlow,
  getConnectionLength,
  getLinkTier,
  getTotalConnectionCells,
  hasBalancedRoute,
  hasDirectConnection,
  isArchitectureNodePlaced,
  isGridPositionAvailable,
  LINK_DISTANCE_UNIT,
  NODE_WORLD_RADIUS,
  validateArchitectureConnections,
  validateNewConnection,
} from "../simulation/trafficSimulation";
import type { LiveWaveMetrics } from "../store/gameStore";
import { useGameStore } from "../store/gameStore";
import {
  GAME_EVENTS,
  gameEvents,
  type ArchitecturePayload,
  type CameraCommand,
  type InventoryDropPayload,
  type InventorySelectPayload,
  type StartWavePayload,
} from "./bridge/gameEvents";
import { resolveNodeGesture } from "./nodeGesture";

interface NodeView {
  id: ArchitectureNodeId;
  container: Phaser.GameObjects.Container;
  pressure?: Phaser.GameObjects.Graphics;
  queueText?: Phaser.GameObjects.Text;
  stateText?: Phaser.GameObjects.Text;
  modulesGlow?: Phaser.GameObjects.Graphics;
}

interface GridCellView {
  position: GridPosition;
  center: Phaser.Math.Vector2;
  rectangle: Phaser.GameObjects.Rectangle;
}

interface NodeGesture {
  nodeId: ArchitectureNodeId;
  startX: number;
  startY: number;
  dragged: boolean;
  mode: "move" | "connect";
  origin: Phaser.Math.Vector2;
}

interface BoardPanGesture {
  pointerX: number;
  pointerY: number;
  scrollX: number;
  scrollY: number;
  dragged: boolean;
}

const WIDTH = 1200;
const HEIGHT = 720;
const PLAYBACK_SCALE = 1;
const TEXT_RESOLUTION = 3;
const BOARD_ZOOM = {
  min: 0.45,
  max: 2,
  step: 0.1,
};
const GRID = {
  columns: 13,
  rows: 6,
  left: 64,
  top: 132,
  cellWidth: 122,
  cellHeight: 94,
};
const COLORS = {
  cream: 0xf3f7fc,
  paper: 0xffffff,
  grass: 0xeaf3fe,
  grid: 0xcddcee,
  ink: 0x243c63,
  muted: 0x7187a6,
  mint: 0x3fceb0,
  mintDark: 0x1e9f92,
  blue: 0x3484ec,
  blueDark: 0x1468d4,
  purple: 0x9070e4,
  purpleDark: 0x6847c8,
  yellow: 0xefbb45,
  orange: 0xea9a32,
  pink: 0xf29aac,
  red: 0xe96b72,
  green: 0x4dbd72,
  path: 0xc2d3eb,
};

export class ArchitectureScene extends Phaser.Scene {
  private architecture: ArchitectureConfig = {
    serverCount: 0,
    hasLoadBalancer: false,
    hasDatabase: false,
    databaseIndexed: false,
    linkLevel: 1,
    boardLevel: 1,
    nodePositions: {
      entry: { ...DEFAULT_NODE_POSITIONS.entry! },
      exit: { ...DEFAULT_NODE_POSITIONS.exit! },
    },
    connections: [],
    boardSlots: {
      loadBalancer: null,
      serverA: null,
      serverB: null,
      database: null,
    },
  };
  private nodes = new Map<ArchitectureNodeId, NodeView>();
  private gridCells: GridCellView[] = [];
  private columnLabels: Phaser.GameObjects.Text[] = [];
  private rowLabels: Phaser.GameObjects.Text[] = [];
  private requestViews = new Map<number, Phaser.GameObjects.Container>();
  private requestTrails = new Map<
    number,
    Phaser.GameObjects.Particles.ParticleEmitter
  >();
  private boardGraphics!: Phaser.GameObjects.Graphics;
  private pathGraphics!: Phaser.GameObjects.Graphics;
  private previewGraphics!: Phaser.GameObjects.Graphics;
  private statusPanel!: Phaser.GameObjects.Rectangle;
  private statusText!: Phaser.GameObjects.Text;
  private cameraBounds = new Phaser.Geom.Rectangle();
  private activePlacementNode: ArchitectureNodeId | null = null;
  private activePlacementInstanceId: string | null = null;
  private nodeGesture: NodeGesture | null = null;
  private boardPanGesture: BoardPanGesture | null = null;
  private isSpacePressed = false;
  private suppressBoardPanUntilPointerUp = false;
  private moveTargetPosition: GridPosition | null = null;
  private activeTimers: Phaser.Time.TimerEvent[] = [];
  private isWaveRunning = false;
  private runtimeState: RuntimeSimulationState | null = null;
  private runtimeTickTimer: Phaser.Time.TimerEvent | null = null;
  private runtimePacketPhases = new Map<number, RuntimePacket["phase"]>();
  private progress: LiveWaveMetrics = {
    completed: 0,
    failed: 0,
    queueByServer: [0, 0],
    databaseQueue: 0,
  };
  private unsubscribers: Array<() => void> = [];

  constructor() {
    super("architecture-scene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#f3f7fc");
    this.input.mouse?.disableContextMenu();
    this.createVfxTextures();
    this.boardGraphics = this.add.graphics().setDepth(0);
    this.drawPastelWorld();
    this.createGrid();
    this.pathGraphics = this.add.graphics().setDepth(2);
    this.previewGraphics = this.add.graphics().setDepth(3);
    this.createNodes();
    this.createStatusBanner();
    this.bindGameEvents();
    this.bindPointerDrawing();
    this.bindBoardCameraControls();
    this.applyArchitecture(false);
    this.fitBoardView(false);
    this.scale.on(
      Phaser.Scale.Events.RESIZE,
      this.handleScaleResize,
      this,
    );
    this.time.delayedCall(0, () => this.fitBoardView(false));

    gameEvents.emit(GAME_EVENTS.SCENE_READY, undefined);
  }

  private bindGameEvents(): void {
    this.unsubscribers.push(
      gameEvents.on<StartWavePayload>(
        GAME_EVENTS.WAVE_REQUEST,
        ({ wave, architecture }) =>
          void this.startRealtimeWave(wave, architecture),
      ),
      gameEvents.on<ArchitecturePayload>(
        GAME_EVENTS.CONFIGURE_ARCHITECTURE,
        ({ architecture }) => {
          const boardLevelChanged =
            architecture.boardLevel !== this.architecture.boardLevel;
          const placedNodeId = (
            Object.keys(architecture.nodePositions) as ArchitectureNodeId[]
          ).find(
            (nodeId) =>
              architecture.nodePositions[nodeId] !== undefined &&
              this.architecture.nodePositions[nodeId] === undefined,
          );
          const addedConnection = architecture.connections.find(
            (connection) =>
              !this.architecture.connections.some(
                (current) =>
                  (current.from === connection.from &&
                    current.to === connection.to) ||
                  (current.from === connection.to &&
                    current.to === connection.from),
              ),
          );
          this.architecture = architecture;
          if (this.runtimeState && this.isWaveRunning) {
            applyRuntimeArchitectureMutation(this.runtimeState, architecture);
          }
          this.applyArchitecture(false);
          if (placedNodeId) {
            const node = this.nodes.get(placedNodeId);
            if (node) {
              this.playBuildPop(node.container);
            }
          }
          if (addedConnection) {
            this.playLinkPulse(addedConnection.from, addedConnection.to);
          }
          if (boardLevelChanged) {
            this.fitBoardView(false);
          }
        },
      ),
      gameEvents.on<void>(GAME_EVENTS.RESET_WORLD, () => this.resetWorld()),
      gameEvents.on<InventorySelectPayload>(
        GAME_EVENTS.INVENTORY_SELECT,
        ({ nodeId, instanceId }) => this.beginPlacement(nodeId, instanceId),
      ),
      gameEvents.on<void>(GAME_EVENTS.BUILD_CANCEL, () =>
        this.cancelPlacement(),
      ),
      gameEvents.on<InventoryDropPayload>(
        GAME_EVENTS.INVENTORY_DROP,
        (payload) =>
          this.handleInventoryDrop(payload),
      ),
      gameEvents.on<CameraCommand>(
        GAME_EVENTS.CAMERA_COMMAND,
        (command) => {
          if (command === "reset") {
            this.resetBoardView();
          } else {
            this.adjustBoardZoom(command === "zoomIn" ? 0.1 : -0.1);
          }
        },
      ),
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const unsubscribe of this.unsubscribers) {
        unsubscribe();
      }
      this.input.keyboard?.off("keydown-SPACE");
      this.input.keyboard?.off("keyup-SPACE");
      this.input.keyboard?.off("keydown-R");
      this.scale.off(
        Phaser.Scale.Events.RESIZE,
        this.handleScaleResize,
        this,
      );
    });
  }

  private handleScaleResize(): void {
    this.layoutFixedHud();
    this.fitBoardView(false);
  }

  private bindBoardCameraControls(): void {
    this.input.keyboard?.on("keydown-SPACE", () => {
      this.isSpacePressed = true;
      this.input.setDefaultCursor("grab");
    });
    this.input.keyboard?.on("keyup-SPACE", () => {
      this.isSpacePressed = false;
      if (!this.boardPanGesture) {
        this.input.setDefaultCursor("default");
      }
    });
    this.input.keyboard?.on("keydown-R", () => this.resetBoardView());

    this.input.on(
      "wheel",
      (
        pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number,
      ) => {
        const camera = this.cameras.main;
        const beforeZoom = camera.getWorldPoint(pointer.x, pointer.y);
        const direction = deltaY > 0 ? -1 : 1;
        const nextZoom = Phaser.Math.Clamp(
          Number((camera.zoom + direction * BOARD_ZOOM.step).toFixed(2)),
          BOARD_ZOOM.min,
          BOARD_ZOOM.max,
        );
        if (nextZoom === camera.zoom) {
          return;
        }
        camera.setZoom(nextZoom);
        camera.scrollX = beforeZoom.x - pointer.x / nextZoom;
        camera.scrollY = beforeZoom.y - pointer.y / nextZoom;
        this.updateCameraBounds();
        this.clampCamera();
        this.syncCameraMetadata();
      },
    );

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (
        this.suppressBoardPanUntilPointerUp ||
        this.activePlacementNode ||
        this.nodeGesture ||
        this.isPointerOverNode(pointer.worldX, pointer.worldY)
      ) {
        return;
      }
      const canPanWithPointer =
        pointer.button === 1 ||
        (pointer.button === 0 && this.isSpacePressed) ||
        pointer.button === 0;
      if (!canPanWithPointer) {
        return;
      }
      this.boardPanGesture = {
        pointerX: pointer.x,
        pointerY: pointer.y,
        scrollX: this.cameras.main.scrollX,
        scrollY: this.cameras.main.scrollY,
        dragged: false,
      };
      this.input.setDefaultCursor("grabbing");
    });
  }

  private resetBoardView(): void {
    this.fitBoardView();
  }

  private fitBoardView(showStatus = true): void {
    const camera = this.cameras.main;
    const board = getBoardBounds(this.architecture.boardLevel);
    const zoom = Phaser.Math.Clamp(
      Math.min(
        Math.max(1, camera.width - 160) / Math.max(1, board.width),
        Math.max(1, camera.height - 160) / Math.max(1, board.height),
      ),
      0.82,
      1.18,
    );
    const boardCenterX = board.left + board.width / 2;
    const boardCenterY = board.top + board.height / 2;

    camera.setZoom(Number(zoom.toFixed(2)));
    this.updateCameraBounds();
    camera.centerOn(boardCenterX, boardCenterY);
    this.clampCamera();
    this.boardPanGesture = null;
    this.input.setDefaultCursor("default");
    this.syncCameraMetadata();
    if (showStatus) {
      this.statusText.setText("");
    }
  }

  private adjustBoardZoom(delta: number): void {
    const camera = this.cameras.main;
    const center = camera.getWorldPoint(camera.width / 2, camera.height / 2);
    camera.setZoom(
      Phaser.Math.Clamp(
        Number((camera.zoom + delta).toFixed(2)),
        BOARD_ZOOM.min,
        BOARD_ZOOM.max,
      ),
    );
    this.updateCameraBounds();
    camera.centerOn(center.x, center.y);
    this.clampCamera();
    this.syncCameraMetadata();
  }

  private updateCameraBounds(): void {
    const camera = this.cameras.main;
    const board = getBoardBounds(this.architecture.boardLevel);
    const boardCenterX = board.left + board.width / 2;
    const boardCenterY = board.top + board.height / 2;
    const viewportWidth = camera.width / camera.zoom;
    const viewportHeight = camera.height / camera.zoom;
    const width = Math.max(board.width + 760, viewportWidth + 360);
    const height = Math.max(board.height + 560, viewportHeight + 260);
    const x = boardCenterX - width / 2;
    const y = boardCenterY - height / 2;

    this.cameraBounds.setTo(x, y, width, height);
    camera.setBounds(x, y, width, height, true);
  }

  private clampCamera(): void {
    const camera = this.cameras.main;
    const viewportWidth = camera.width / camera.zoom;
    const viewportHeight = camera.height / camera.zoom;
    const maxX = this.cameraBounds.right - viewportWidth;
    const maxY = this.cameraBounds.bottom - viewportHeight;
    camera.scrollX = Phaser.Math.Clamp(
      camera.scrollX,
      this.cameraBounds.left,
      Math.max(this.cameraBounds.left, maxX),
    );
    camera.scrollY = Phaser.Math.Clamp(
      camera.scrollY,
      this.cameraBounds.top,
      Math.max(this.cameraBounds.top, maxY),
    );
  }

  private syncCameraMetadata(): void {
    const host = this.game.canvas.parentElement;
    if (!host) {
      return;
    }
    const camera = this.cameras.main;
    host.dataset.cameraZoom = camera.zoom.toFixed(2);
    host.dataset.cameraScrollX = camera.scrollX.toFixed(1);
    host.dataset.cameraScrollY = camera.scrollY.toFixed(1);
    host.dataset.cameraMinX = this.cameraBounds.left.toFixed(1);
    host.dataset.cameraMaxX = (
      this.cameraBounds.right -
      camera.width / camera.zoom
    ).toFixed(1);
    host.dataset.cameraMinY = this.cameraBounds.top.toFixed(1);
    host.dataset.cameraMaxY = (
      this.cameraBounds.bottom -
      camera.height / camera.zoom
    ).toFixed(1);
    gameEvents.emit(GAME_EVENTS.CAMERA_CHANGED, { zoom: camera.zoom });
  }

  private createVfxTextures(): void {
    if (this.textures.exists("vfx-dot")) {
      return;
    }
    const dot = this.add.graphics();
    dot.fillStyle(0xffffff, 1);
    dot.fillCircle(6, 6, 6);
    dot.generateTexture("vfx-dot", 12, 12);
    dot.destroy();
  }

  private drawPastelWorld(): void {
    const board = getBoardBounds(this.architecture.boardLevel);
    this.boardGraphics.clear();
    this.boardGraphics.fillStyle(0xf7fbff, 1);
    this.boardGraphics.fillRect(-WIDTH, -HEIGHT, WIDTH * 3, HEIGHT * 3);
    this.boardGraphics.fillGradientStyle(0xffffff, 0xffffff, 0xeef5ff, 0xeef5ff, 1);
    this.boardGraphics.fillRect(
      board.left - 80,
      board.top - 78,
      board.width + 160,
      board.height + 156,
    );
    this.boardGraphics.fillStyle(0xdde9f9, 0.16);
    this.boardGraphics.fillCircle(board.left + 140, board.top + 100, 140);
    this.boardGraphics.fillStyle(0xe7efff, 0.28);
    this.boardGraphics.fillCircle(board.left + board.width - 120, board.top + 120, 110);
    this.boardGraphics.fillStyle(0xd8f0eb, 0.22);
    this.boardGraphics.fillEllipse(
      board.left + board.width / 2,
      board.top + board.height - 36,
      board.width * 0.72,
      140,
    );
    this.boardGraphics.fillStyle(0xffffff, 0.98);
    this.boardGraphics.fillRoundedRect(
      board.left - 20,
      board.top - 26,
      board.width + 40,
      board.height + 52,
      24,
    );
    this.boardGraphics.lineStyle(2, 0xd6e2ef, 1);
    this.boardGraphics.strokeRoundedRect(
      board.left - 20,
      board.top - 26,
      board.width + 40,
      board.height + 52,
      24,
    );
  }

  private createGrid(): void {
    this.columnLabels = [];
    this.rowLabels = [];
    this.gridCells = [];
  }

  private createNodes(): void {
    this.nodes.set(
      "entry",
      this.createEntryNode(this.gridToWorld(DEFAULT_NODE_POSITIONS.entry!)),
    );
    this.nodes.set(
      "exit",
      this.createExitNode(this.gridToWorld(DEFAULT_NODE_POSITIONS.exit!)),
    );
    this.nodes.set(
      "serverA",
      this.createServerNode(
        "serverA",
        this.gridToWorld(DEFAULT_NODE_POSITIONS.serverA!),
        "앱 서버 A",
      ),
    );
    this.nodes.set(
      "database",
      this.createDatabaseNode(
        this.gridToWorld(DEFAULT_NODE_POSITIONS.database!),
      ),
    );
    this.nodes.set(
      "loadBalancer",
      this.createLoadBalancerNode(
        this.gridToWorld(DEFAULT_NODE_POSITIONS.loadBalancer!),
      ),
    );
    this.nodes.set(
      "serverB",
      this.createServerNode(
        "serverB",
        this.gridToWorld(DEFAULT_NODE_POSITIONS.serverB!),
        "앱 서버 B",
      ),
    );
  }

  private createEntryNode(position: Phaser.Math.Vector2): NodeView {
    const container = this.add.container(position.x, position.y).setDepth(6);
    const shadow = this.add.ellipse(0, 48, 86, 16, 0x5c7aa0, 0.12);
    const halo = this.add.circle(0, 0, 40, 0xffffff, 0.92);
    halo.setStrokeStyle(2, 0xdbe6f2, 1);
    const tile = this.add.rectangle(0, 0, 58, 58, 0x1b79df, 1);
    tile.setStrokeStyle(2, 0xffffff, 0.95);
    const icon = this.add.graphics();
    icon.lineStyle(4, 0xffffff, 1);
    icon.strokeCircle(-10, -4, 7);
    icon.strokeCircle(10, -4, 7);
    icon.beginPath();
    icon.arc(-10, 22, 12, Phaser.Math.DegToRad(195), Phaser.Math.DegToRad(345));
    icon.strokePath();
    icon.beginPath();
    icon.arc(10, 22, 12, Phaser.Math.DegToRad(195), Phaser.Math.DegToRad(345));
    icon.strokePath();
    const label = this.createNodeLabel("Traffic Ingress", 0, 54);
    const sub = this.createNodeSubLabel("FIXED", 0, 74);
    const dot = this.createNodeStatusDot(30, 24);
    container.add([shadow, halo, tile, icon, label, sub, dot]);
    this.makeConnectable(container, "entry");
    return { id: "entry", container };
  }

  private createExitNode(position: Phaser.Math.Vector2): NodeView {
    const container = this.add.container(position.x, position.y).setDepth(6);
    const shadow = this.add.ellipse(0, 48, 86, 16, 0x5c7aa0, 0.12);
    const halo = this.add.circle(0, 0, 40, 0xffffff, 0.92);
    halo.setStrokeStyle(2, 0xdbe6f2, 1);
    const tile = this.add.rectangle(0, 0, 58, 58, COLORS.purpleDark, 1);
    tile.setStrokeStyle(2, 0xffffff, 0.95);
    const icon = this.add.graphics();
    icon.lineStyle(5, 0xffffff, 1);
    icon.strokeCircle(0, 3, 17);
    icon.lineBetween(-8, 3, -1, 11);
    icon.lineBetween(-1, 11, 11, -3);
    const label = this.createNodeLabel("Response Egress", 0, 54);
    const sub = this.createNodeSubLabel("FIXED", 0, 74);
    const dot = this.createNodeStatusDot(30, 24);
    container.add([shadow, halo, tile, icon, label, sub, dot]);
    this.makeConnectable(container, "exit");
    return { id: "exit", container };
  }

  private createServerNode(
    id: "serverA" | "serverB",
    position: Phaser.Math.Vector2,
    title: string,
  ): NodeView {
    const container = this.add.container(position.x, position.y).setDepth(6);
    const pressure = this.add.graphics();
    const shadow = this.add.ellipse(0, 48, 86, 16, 0x5c7aa0, 0.12);
    const halo = this.add.circle(0, 0, 40, 0xffffff, 0.92);
    halo.setStrokeStyle(2, 0xdbe6f2, 1);
    const body = this.add.graphics();
    body.fillStyle(0x1b79df, 1);
    body.fillRoundedRect(-29, -29, 58, 58, 14);
    body.lineStyle(3, 0xffffff, 1);
    body.strokeRoundedRect(-29, -29, 58, 58, 14);
    body.strokeRect(-15, -13, 30, 24);
    body.lineBetween(-10, -4, 10, -4);
    body.lineBetween(-10, 4, 10, 4);
    body.lineBetween(-10, 12, 10, 12);
    const stateText = this.add
      .text(0, 54, "APP", {
        color: "#6e839f",
        fontFamily: "Pretendard",
        fontSize: "9px",
        fontStyle: "700",
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RESOLUTION);
    const label = this.createNodeLabel(title, 0, 72);
    const queueText = this.add
      .text(0, 88, "QUEUE 0", {
        color: "#6e839f",
        fontFamily: "Pretendard",
        fontSize: "10px",
        fontStyle: "700",
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RESOLUTION);
    const dot = this.createNodeStatusDot(30, 24);
    container.add([pressure, shadow, halo, body, stateText, label, queueText, dot]);
    this.makeConnectable(container, id);
    return { id, container, pressure, queueText, stateText };
  }

  private createLoadBalancerNode(position: Phaser.Math.Vector2): NodeView {
    const container = this.add.container(position.x, position.y).setDepth(6);
    const shadow = this.add.ellipse(0, 48, 86, 16, 0x5c7aa0, 0.12);
    const halo = this.add.circle(0, 0, 40, 0xffffff, 0.92);
    halo.setStrokeStyle(2, 0xdbe6f2, 1);
    const body = this.add.graphics();
    body.fillStyle(0x7258cb, 1);
    body.fillRoundedRect(-29, -29, 58, 58, 14);
    body.lineStyle(3, 0xffffff, 0.95);
    body.strokeRoundedRect(-29, -29, 58, 58, 14);
    body.lineStyle(4, 0xffffff, 1);
    body.strokeRect(-8, -8, 16, 16);
    body.lineBetween(0, -24, 0, -8);
    body.lineBetween(0, 8, 0, 24);
    body.lineBetween(-24, 0, -8, 0);
    body.lineBetween(8, 0, 24, 0);
    const label = this.createNodeLabel("Load Balancer", 0, 54);
    const sub = this.createNodeSubLabel("RR", 0, 74);
    const dot = this.createNodeStatusDot(30, 24);
    container.add([shadow, halo, body, label, sub, dot]);
    this.makeConnectable(container, "loadBalancer");
    return { id: "loadBalancer", container };
  }

  private createDatabaseNode(position: Phaser.Math.Vector2): NodeView {
    const container = this.add.container(position.x, position.y).setDepth(6);
    const pressure = this.add.graphics();
    const shadow = this.add.ellipse(0, 48, 86, 16, 0x5c7aa0, 0.12);
    const halo = this.add.circle(0, 0, 40, 0xffffff, 0.92);
    halo.setStrokeStyle(2, 0xdbe6f2, 1);
    const tile = this.add.rectangle(0, 0, 58, 58, 0x1da4a0);
    tile.setStrokeStyle(2, 0xffffff, 0.95);
    const database = this.add.graphics();
    database.fillStyle(0xffffff, 1);
    database.fillEllipse(0, -12, 32, 10);
    database.fillRect(-16, -12, 32, 28);
    database.fillEllipse(0, 16, 32, 10);
    database.lineStyle(2, 0x1da4a0, 1);
    database.strokeEllipse(0, 0, 32, 10);
    database.strokeEllipse(0, 9, 32, 10);
    const label = this.createNodeLabel("Primary DB", 0, 72);
    const stateText = this.add
      .text(0, 54, "DB", {
        color: "#6e839f",
        fontFamily: "Pretendard",
        fontSize: "9px",
        fontStyle: "700",
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RESOLUTION);
    const queueText = this.add
      .text(0, 88, "QUEUE 0", {
        color: "#6e839f",
        fontFamily: "Pretendard",
        fontSize: "10px",
        fontStyle: "700",
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RESOLUTION);
    const dot = this.createNodeStatusDot(30, 24);
    container.add([
      pressure,
      shadow,
      halo,
      tile,
      database,
      stateText,
      label,
      queueText,
      dot,
    ]);
    this.makeConnectable(container, "database");
    return {
      id: "database",
      container,
      pressure,
      queueText,
      stateText,
    };
  }

  private createNodeLabel(
    text: string,
    x: number,
    y: number,
  ): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, text, {
        color: "#274365",
        fontFamily: "Pretendard",
        fontSize: "11px",
        fontStyle: "700",
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RESOLUTION);
  }

  private createNodeSubLabel(
    text: string,
    x: number,
    y: number,
  ): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, text, {
        color: "#6d839f",
        fontFamily: "Pretendard",
        fontSize: "10px",
        fontStyle: "700",
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RESOLUTION);
  }

  private createNodeStatusDot(
    x: number,
    y: number,
  ): Phaser.GameObjects.Container {
    const dot = this.add.container(x, y);
    const outer = this.add.circle(0, 0, 6.5, 0xffffff, 1);
    const inner = this.add.circle(0, 0, 4.5, COLORS.green, 1);
    dot.add([outer, inner]);
    return dot;
  }

  private makeConnectable(
    container: Phaser.GameObjects.Container,
    nodeId: ArchitectureNodeId,
  ): void {
    container.setSize(110, 112);
    container.setInteractive({ useHandCursor: true });
    container.on("pointerover", () => {
      if (!this.isWaveRunning) {
        container.setScale(1.08);
      }
    });
    container.on("pointerout", () => container.setScale(1));
    container.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const shiftConnect = Boolean(
        (pointer.event as MouseEvent | undefined)?.shiftKey,
      );
      if (
        (nodeId === "entry" || nodeId === "exit") &&
        pointer.button === 0 &&
        !pointer.rightButtonDown() &&
        !shiftConnect
      ) {
        this.playNodeSelection(nodeId);
        this.statusText.setText(
          nodeId === "entry"
            ? "트래픽 입구는 고정 시설입니다"
            : "응답 출구는 고정 시설입니다",
        );
        return;
      }
      if (
        (pointer.button === 0 ||
          pointer.button === 2 ||
          pointer.rightButtonDown()) &&
        this.isNodeActive(nodeId)
      ) {
        const mode =
          pointer.button === 2 || pointer.rightButtonDown() || shiftConnect
            ? "connect"
            : "move";
        this.nodeGesture = {
          nodeId,
          startX: pointer.worldX,
          startY: pointer.worldY,
          dragged: false,
          mode,
          origin: this.getNodePosition(nodeId),
        };
        this.statusText.setText(
          mode === "connect"
            ? "연결할 장비 위에서 우클릭을 놓으세요"
            : "보드 안의 빈 위치로 장비를 이동하세요",
        );
      }
    });
  }

  private bindPointerDrawing(): void {
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.boardPanGesture && pointer.isDown) {
        const camera = this.cameras.main;
        if (
          Math.hypot(
            pointer.x - this.boardPanGesture.pointerX,
            pointer.y - this.boardPanGesture.pointerY,
          ) > 5
        ) {
          this.boardPanGesture.dragged = true;
        }
        camera.scrollX =
          this.boardPanGesture.scrollX -
          (pointer.x - this.boardPanGesture.pointerX) / camera.zoom;
        camera.scrollY =
          this.boardPanGesture.scrollY -
          (pointer.y - this.boardPanGesture.pointerY) / camera.zoom;
        this.clampCamera();
        this.syncCameraMetadata();
        return;
      }
      if (!this.nodeGesture) {
        return;
      }
      const movement = Phaser.Math.Distance.Between(
        this.nodeGesture.startX,
        this.nodeGesture.startY,
        pointer.worldX,
        pointer.worldY,
      );
      if (movement < 9 && !this.nodeGesture.dragged) {
        return;
      }
      this.nodeGesture.dragged = true;
      const source = this.getNodePosition(this.nodeGesture.nodeId);
      this.previewGraphics.clear();
      if (this.nodeGesture.mode === "connect") {
        const sourcePosition =
          this.architecture.nodePositions[this.nodeGesture.nodeId];
        const previewPosition = this.worldToGrid(pointer.worldX, pointer.worldY);
        const tier = getLinkTier(this.architecture.linkLevel);
        const previewLength =
          sourcePosition && previewPosition
            ? Math.max(
                1,
                Math.ceil(
                  Math.hypot(
                    sourcePosition.column - previewPosition.column,
                    sourcePosition.row - previewPosition.row,
                  ) / LINK_DISTANCE_UNIT,
                ),
              )
            : tier.maxEdgeCells + 1;
        const previewColor =
          previewLength <= tier.maxEdgeCells ? COLORS.blue : COLORS.red;
        this.previewGraphics.lineStyle(7, previewColor, 0.82);
        this.drawOrthogonalLine(
          this.previewGraphics,
          source,
          new Phaser.Math.Vector2(pointer.worldX, pointer.worldY),
        );
      } else {
        this.nodes
          .get(this.nodeGesture.nodeId)
          ?.container.setPosition(pointer.worldX, pointer.worldY);
      }
      const gridPosition = this.worldToGrid(pointer.worldX, pointer.worldY);
      const nextMoveTarget =
        gridPosition &&
        this.nodeGesture.mode === "move" &&
        !this.findNodeAt(
          pointer.worldX,
          pointer.worldY,
          this.nodeGesture.nodeId,
        ) &&
        !this.isOccupied(gridPosition, this.nodeGesture.nodeId)
          ? gridPosition
          : null;
      if (
        nextMoveTarget?.column !== this.moveTargetPosition?.column ||
        nextMoveTarget?.row !== this.moveTargetPosition?.row
      ) {
        this.moveTargetPosition = nextMoveTarget;
        this.refreshGrid();
      }
    });

    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (this.suppressBoardPanUntilPointerUp) {
        this.suppressBoardPanUntilPointerUp = false;
        return;
      }
      if (this.boardPanGesture) {
        const panGesture = this.boardPanGesture;
        this.boardPanGesture = null;
        this.input.setDefaultCursor(this.isSpacePressed ? "grab" : "default");
        this.syncCameraMetadata();
        if (
          this.activePlacementNode &&
          !panGesture.dragged &&
          pointer.button === 0 &&
          !this.isPointerOverNode(pointer.worldX, pointer.worldY)
        ) {
          const position = this.worldToGrid(pointer.worldX, pointer.worldY);
          if (
            position &&
            isGridPositionAvailable(this.architecture, position) &&
            !this.isOccupied(position)
          ) {
            this.requestPlacement(
              this.activePlacementNode,
              position,
              true,
              this.activePlacementInstanceId ?? undefined,
            );
          } else {
            this.statusText.setText("현재 보드의 빈 위치에 놓아 주세요");
            this.cameras.main.shake(100, 0.002);
          }
        }
        return;
      }
      if (
        !this.nodeGesture &&
        this.activePlacementNode &&
        pointer.button === 0 &&
        !this.isPointerOverNode(pointer.worldX, pointer.worldY)
      ) {
        const position = this.worldToGrid(pointer.worldX, pointer.worldY);
        if (
          position &&
          isGridPositionAvailable(this.architecture, position) &&
          !this.isOccupied(position)
        ) {
          this.requestPlacement(
            this.activePlacementNode,
            position,
            true,
            this.activePlacementInstanceId ?? undefined,
          );
        } else {
          this.statusText.setText("현재 보드의 빈 위치에 놓아 주세요");
          this.cameras.main.shake(100, 0.002);
        }
        return;
      }
      if (!this.nodeGesture) {
        return;
      }
      const gesture = this.nodeGesture;
      const source = gesture.nodeId;
      const target =
        gesture.mode === "connect"
          ? this.findNodeAt(pointer.worldX, pointer.worldY, source)
          : null;
      this.nodeGesture = null;
      this.moveTargetPosition = null;
      this.previewGraphics.clear();
      const position = this.worldToGrid(pointer.worldX, pointer.worldY);
      const movementDistance = Phaser.Math.Distance.Between(
        gesture.startX,
        gesture.startY,
        pointer.worldX,
        pointer.worldY,
      );
      const resolution = resolveNodeGesture({
        mode: gesture.mode,
        dragged: gesture.dragged,
        movementDistance,
        source,
        target,
        position,
        positionOccupied: position
          ? this.isOccupied(position, source)
          : true,
      });

      if (resolution.type === "select") {
        this.playNodeSelection(resolution.nodeId);
        this.statusText.setText("장비 선택 · 우클릭하면 상세정보가 열립니다");
      } else if (resolution.type === "details") {
        gameEvents.emit(GAME_EVENTS.NODE_DETAILS_REQUEST, {
          nodeId: resolution.nodeId,
        });
        this.statusText.setText("장비 상세정보를 열었습니다");
      } else if (resolution.type === "connect") {
        const exists = hasDirectConnection(
          this.architecture,
          resolution.from,
          resolution.to,
        );
        const validation = exists
          ? { valid: true, reason: "링크를 제거했습니다." }
          : validateNewConnection(
              this.architecture,
              resolution.from,
              resolution.to,
            );
        if (validation.valid) {
          gameEvents.emit(GAME_EVENTS.CONNECTION_REQUEST, {
            from: resolution.from,
            to: resolution.to,
          });
          const flow = getConnectionFlow(resolution.from, resolution.to);
          const flowLabel =
            flow === "request"
              ? "REQUEST"
              : flow === "response"
                ? "RESPONSE"
                : flow === "duplex"
                  ? "DUPLEX"
                  : "DATA";
          this.statusText.setText(
            exists
              ? "링크를 제거했습니다"
              : `${flowLabel} 링크 ${validation.length}칸 연결 완료`,
          );
        } else {
          this.statusText.setText(validation.reason);
          this.cameras.main.shake(120, 0.0025);
        }
      } else if (resolution.type === "move") {
        const architecture: ArchitectureConfig = {
          ...this.architecture,
          nodePositions: {
            ...this.architecture.nodePositions,
            [resolution.nodeId]: resolution.position,
          },
        };
        const validation = validateArchitectureConnections(architecture);
        if (validation.valid) {
          gameEvents.emit(GAME_EVENTS.NODE_MOVE_REQUEST, {
            nodeId: resolution.nodeId,
            position: resolution.position,
          });
          this.statusText.setText("장비 위치를 옮겼습니다");
        } else {
          const origin = gesture.origin;
          this.nodes
            .get(source)
            ?.container.setPosition(origin.x, origin.y);
          this.statusText.setText(validation.reason);
          this.cameras.main.shake(120, 0.0025);
        }
      } else {
        const origin = gesture.origin;
        this.nodes
          .get(source)
          ?.container.setPosition(origin.x, origin.y);
        this.statusText.setText("보드 안의 빈 위치에 놓아 주세요");
        this.cameras.main.shake(100, 0.002);
      }
      this.refreshGrid();
    });
  }

  private createStatusBanner(): void {
    this.statusPanel = this.add
      .rectangle(0, 0, 420, 34, 0xffffff, 0.96)
      .setStrokeStyle(1, 0xd8e3ef, 1)
      .setDepth(20)
      .setVisible(false);
    this.statusText = this.add
      .text(
        0,
        0,
        "",
        {
          color: "#617790",
          fontFamily: "Pretendard",
          fontSize: "12px",
          fontStyle: "700",
        },
      )
      .setOrigin(0.5)
      .setDepth(21)
      .setVisible(false)
      .setResolution(TEXT_RESOLUTION);
    this.layoutFixedHud();
  }

  private layoutFixedHud(): void {
    if (!this.statusPanel || !this.statusText) {
      return;
    }
    const board = getBoardBounds(this.architecture.boardLevel);
    const width = Math.min(460, Math.max(260, board.width - 120));
    const x = board.left + board.width / 2;
    const y = board.top - 50;
    this.statusPanel.setPosition(x, y).setSize(width, 34);
    this.statusText.setPosition(x, y);
  }

  private applyArchitecture(playBuildEffect: boolean): void {
    this.drawPastelWorld();
    this.layoutFixedHud();
    for (const [nodeId, node] of this.nodes) {
      const position = this.architecture.nodePositions[nodeId];
      node.container.setVisible(Boolean(position));
      if (position) {
        node.container.setPosition(position.column, position.row);
      }
    }
    this.drawConnections();
    this.refreshGrid();
    this.showLinkBudget();
    this.applyNodeModulesVisuals(this.architecture);
    if (playBuildEffect) {
      const target = [...this.nodes.values()].find(
        (node) => node.container.visible && node.container.scaleX === 1,
      );
      if (target) {
        this.playBuildPop(target.container);
      }
    }
  }

  private applyNodeModulesVisuals(architecture: ArchitectureConfig): void {
    const owned = useGameStore.getState().inventory.filter(
      (item): item is NodeInstance => item !== null,
    );
    const byId = new Map(owned.map((item) => [item.id, item]));

    for (const role of ["serverA", "serverB", "database"] as const) {
      const nodeView = this.nodes.get(role);
      if (!nodeView) continue;
      
      const instanceId = architecture.boardSlots[role];
      const item = instanceId ? byId.get(instanceId) : undefined;
      const modules = item?.modules ?? [];

      if (nodeView.modulesGlow) {
        nodeView.modulesGlow.destroy();
        nodeView.modulesGlow = undefined;
      }

      if (modules.length > 0) {
        const glow = this.add.graphics();
        glow.lineStyle(3, 0x06b6d4, 0.8);
        const mods = modules as string[];
        if (mods.includes("redis") || mods.includes("cache")) {
          glow.lineStyle(3.5, 0x7dd9be, 0.95);
        } else if (mods.includes("sqs") || mods.includes("kafka")) {
          glow.lineStyle(3.5, 0xb4a1e5, 0.95);
        } else if (mods.includes("waf")) {
          glow.lineStyle(3.5, 0x88b8ef, 0.95);
        }
        glow.strokeCircle(0, 0, 48);
        nodeView.container.add(glow);
        nodeView.container.sendToBack(glow);
        nodeView.modulesGlow = glow;

        this.tweens.add({
          targets: glow,
          scaleX: 1.08,
          scaleY: 1.08,
          alpha: 0.5,
          duration: 1100,
          yoyo: true,
          loop: -1,
          ease: "Sine.InOut",
        });
      }
    }
  }

  private drawConnections(): void {
    this.pathGraphics.clear();
    for (const connection of this.architecture.connections) {
      if (
        !this.isNodeActive(connection.from) ||
        !this.isNodeActive(connection.to)
      ) {
        continue;
      }
      const from = this.getNodePosition(connection.from);
      const to = this.getNodePosition(connection.to);
      const flow = getConnectionFlow(connection.from, connection.to);
      this.pathGraphics.lineStyle(10, COLORS.path, 0.72);
      this.drawOrthogonalLine(this.pathGraphics, from, to);
      if (flow === "duplex") {
        this.pathGraphics.lineStyle(6, COLORS.blue, 0.94);
        this.drawOrthogonalLine(this.pathGraphics, from, to);
        this.pathGraphics.lineStyle(2, COLORS.purple, 1);
        this.drawOrthogonalLine(this.pathGraphics, from, to);
      } else {
        const pathColor =
          flow === "request"
            ? COLORS.blue
            : flow === "response"
              ? COLORS.purple
              : COLORS.yellow;
        this.pathGraphics.lineStyle(5, pathColor, 0.98);
        this.drawOrthogonalLine(this.pathGraphics, from, to);
      }
      this.pathGraphics.fillStyle(0xffffff, 0.75);
      const length = getConnectionLength(this.architecture, connection);
      for (let step = 1; step < length; step += 1) {
        const ratio = step / length;
        const point = this.getOrthogonalPoint(from, to, ratio);
        this.pathGraphics.fillCircle(
          point.x,
          point.y,
          2.5,
        );
      }
    }
  }

  private showLinkBudget(): void {
    this.statusText.setText("");
  }

  private drawOrthogonalLine(
    graphics: Phaser.GameObjects.Graphics,
    from: Phaser.Math.Vector2,
    to: Phaser.Math.Vector2,
  ): void {
    const corner = new Phaser.Math.Vector2(to.x, from.y);
    graphics.lineBetween(from.x, from.y, corner.x, corner.y);
    graphics.lineBetween(corner.x, corner.y, to.x, to.y);
  }

  private getOrthogonalPoint(
    from: Phaser.Math.Vector2,
    to: Phaser.Math.Vector2,
    ratio: number,
  ): Phaser.Math.Vector2 {
    const horizontal = Math.abs(to.x - from.x);
    const vertical = Math.abs(to.y - from.y);
    const total = horizontal + vertical;
    if (total === 0) {
      return from.clone();
    }
    const distance = total * ratio;
    if (distance <= horizontal) {
      const direction = Math.sign(to.x - from.x);
      return new Phaser.Math.Vector2(from.x + distance * direction, from.y);
    }
    const direction = Math.sign(to.y - from.y);
    return new Phaser.Math.Vector2(
      to.x,
      from.y + (distance - horizontal) * direction,
    );
  }

  private beginPlacement(nodeId: ArchitectureNodeId, instanceId?: string): void {
    this.activePlacementNode = nodeId;
    this.activePlacementInstanceId = instanceId ?? null;
    this.statusText.setText("보드 안의 빈 위치에 장비를 드래그해 놓아 주세요");
    this.refreshGrid();
  }

  private cancelPlacement(): void {
    this.activePlacementNode = null;
    this.activePlacementInstanceId = null;
    this.refreshGrid();
  }

  private handleInventoryDrop(payload: InventoryDropPayload): void {
    const worldPosition = this.cameras.main.getWorldPoint(payload.x, payload.y);

    const targetNodeId = (["serverA", "serverB", "database"] as const).find((role) => {
      const pos = this.getNodePosition(role);
      const isPlaced = isArchitectureNodePlaced(this.architecture, role);
      if (!isPlaced) return false;
      const distance = Phaser.Math.Distance.Between(worldPosition.x, worldPosition.y, pos.x, pos.y);
      return distance < 45;
    });

    if (targetNodeId && payload.instanceId) {
      const store = useGameStore.getState();
      const item = store.inventory.find((i: NodeInstance | null) => i?.id === payload.instanceId);
      if (item) {
        const isModule = ["sqs", "kafka", "redis", "s3", "waf", "cognito", "rdsReplica", "documentDb"].includes(item.type);
        if (isModule) {
          store.equipModule(targetNodeId, payload.instanceId);
          this.activePlacementNode = null;
          this.activePlacementInstanceId = null;
          this.refreshGrid();
          return;
        }
      }
    }

    const position = this.worldToGrid(worldPosition.x, worldPosition.y);
    if (
      !position ||
      !isGridPositionAvailable(this.architecture, position) ||
      this.isOccupied(position)
    ) {
      this.statusText.setText("현재 보드의 빈 위치에 놓아 주세요");
      this.cameras.main.shake(100, 0.002);
      return;
    }
    this.requestPlacement(payload.nodeId, position, false, payload.instanceId);
  }

  private requestPlacement(
    nodeId: ArchitectureNodeId,
    position: GridPosition,
    suppressBoardPan = false,
    instanceId?: string
  ): void {
    this.suppressBoardPanUntilPointerUp = suppressBoardPan;
    gameEvents.emit(GAME_EVENTS.NODE_PLACEMENT_REQUEST, {
      nodeId,
      position,
      instanceId,
    });
    this.activePlacementNode = null;
    this.activePlacementInstanceId = null;
    this.refreshGrid();
  }

  private refreshGrid(): void {
    // Free-placement board keeps no visible grid cells.
  }

  private styleGridCell(position: GridPosition): void {
    void position;
  }

  private async playWave(result: WaveSimulationResult): Promise<void> {
    this.resetTraffic();
    this.isWaveRunning = true;
    this.cancelPlacement();
    await this.showWaveCountdown(result.wave.id);

    for (const event of result.events) {
      this.activeTimers.push(
        this.time.delayedCall(event.at * PLAYBACK_SCALE, () =>
          this.presentEvent(event),
        ),
      );
    }
    const lastEventAt = result.events.at(-1)?.at ?? result.metrics.durationMs;
    this.activeTimers.push(
      this.time.delayedCall(lastEventAt * PLAYBACK_SCALE + 850, () => {
        this.isWaveRunning = false;
        this.statusText.setText(
          result.metrics.passed
            ? "서비스 운영 완료 · 점검시간으로 전환합니다"
            : result.bottleneck,
        );
        if (result.metrics.passed) {
          this.playConfetti();
        } else {
          this.cameras.main.shake(220, 0.004);
        }
        gameEvents.emit(GAME_EVENTS.WAVE_COMPLETE, { result });
      }),
    );
  }

  private async showWaveCountdown(waveId: number): Promise<void> {
    const curtain = this.add
      .rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xfff8e8, 0.7)
      .setDepth(40);
    const text = this.add
      .text(WIDTH / 2, HEIGHT / 2, `서비스 개시\n3`, {
        align: "center",
        color: "#6e6590",
        fontFamily: "Trebuchet MS",
        fontSize: "52px",
        fontStyle: "bold",
        stroke: "#ffffff",
        strokeThickness: 9,
      })
      .setOrigin(0.5)
      .setDepth(41);
    for (const value of ["3", "2", "1"]) {
      text.setText(`서비스 개시\n${value}`);
      text.setScale(0.7);
      await this.tweenPromise({
        targets: text,
        scale: 1,
        duration: 210,
        ease: "Back.Out",
      });
      await this.wait(180);
    }
    text.setText(`PHASE ${waveId}\nOPEN`);
    await this.wait(180);
    curtain.destroy();
    text.destroy();
  }

  private presentEvent(event: TrafficEvent): void {
    if (event.type === "spawned") {
      this.spawnRequest(event.requestId, event.operation ?? "read");
      return;
    }
    if (event.serverId !== undefined) {
      this.updateServerState(
        event.serverId,
        event.serverQueueLength ?? 0,
        event.serverActiveCount ?? 0,
      );
    }
    if (
      event.databaseQueueLength !== undefined ||
      event.databaseActiveCount !== undefined
    ) {
      this.updateDatabaseState(
        event.databaseQueueLength ?? 0,
        event.databaseActiveCount ?? 0,
      );
    }
    if (event.type === "routed" && event.serverId !== undefined) {
      this.routeRequest(event.requestId, event.serverId);
    } else if (
      event.type === "server_queued" &&
      event.serverId !== undefined
    ) {
      this.queueRequest(
        event.requestId,
        event.serverId,
        event.serverQueueLength ?? 1,
      );
      this.progress.queueByServer[event.serverId] =
        event.serverQueueLength ?? 0;
      this.emitProgress();
    } else if (
      event.type === "server_started" &&
      event.serverId !== undefined
    ) {
      this.processRequest(event.requestId, event.serverId);
      this.progress.queueByServer[event.serverId] =
        event.serverQueueLength ?? 0;
      this.emitProgress();
    } else if (event.type === "database_routed") {
      this.routeToDatabase(event.requestId);
    } else if (event.type === "database_queued") {
      this.queueAtDatabase(
        event.requestId,
        event.databaseQueueLength ?? 1,
      );
      this.progress.databaseQueue = event.databaseQueueLength ?? 0;
      this.emitProgress();
    } else if (event.type === "database_started") {
      this.processAtDatabase(event.requestId);
      this.progress.databaseQueue = event.databaseQueueLength ?? 0;
      this.emitProgress();
    } else if (event.type === "database_completed") {
      this.markDatabaseComplete(event.requestId);
    } else if (
      event.type === "response_started" &&
      event.serverId !== undefined
    ) {
      this.returnResponse(event.requestId, event.serverId);
    } else if (event.type === "completed") {
      this.completeRequest(event.requestId);
      this.progress.completed += 1;
      this.emitProgress();
    } else if (
      event.type === "dropped" ||
      event.type === "timed_out"
    ) {
      this.failRequest(
        event.requestId,
        event.type === "timed_out" ? "TIMEOUT" : "DROP",
      );
      this.progress.failed += 1;
      this.emitProgress();
    }
  }

  private spawnRequest(
    requestId: number,
    operation: NonNullable<TrafficEvent["operation"]>,
  ): void {
    const entry = this.isNodeActive("entry")
      ? this.getNodePosition("entry")
      : new Phaser.Math.Vector2(50, HEIGHT / 2);
    const color =
      operation === "slowRead"
        ? COLORS.orange
        : operation === "write"
          ? COLORS.purple
          : COLORS.blue;
    const container = this.add.container(entry.x, entry.y).setDepth(12);
    const shadow = this.add.ellipse(0, 13, 34, 8, 0x35526c, 0.18);
    const card = this.add.rectangle(0, 0, 34, 27, 0xffffff, 1);
    card.setStrokeStyle(3, color, 1);
    const user = this.add.graphics();
    user.fillStyle(color, 1);
    user.fillCircle(-8, -5, 4);
    user.fillRoundedRect(-13, 1, 10, 8, 3);
    const method = this.add
      .text(
        7,
        0,
        operation === "write"
          ? "POST"
          : operation === "slowRead"
            ? "SLOW"
            : "GET",
        {
        color: `#${color.toString(16).padStart(6, "0")}`,
        fontFamily: "Arial",
        fontSize: operation === "write" ? "8px" : "9px",
        fontStyle: "bold",
        },
      )
      .setOrigin(0.5);
    container.add([shadow, card, user, method]);
    container.setScale(0);
    container.postFX.addGlow(color, 1.5, 0, false, 0.1, 6);
    this.requestViews.set(requestId, container);
    const trail = this.add
      .particles(0, 0, "vfx-dot", {
        lifespan: 260,
        frequency: 32,
        quantity: 1,
        speed: { min: 4, max: 16 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 0.72, end: 0 },
        tint: color,
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(10);
    trail.startFollow(container);
    this.requestTrails.set(requestId, trail);
    this.tweens.add({
      targets: container,
      scale: 1,
      duration: 130,
      ease: "Back.Out",
    });
  }

  private routeRequest(requestId: number, serverId: number): void {
    const request = this.requestViews.get(requestId);
    if (!request) {
      return;
    }
    const points = this.getRequestRoute(serverId);
    void this.moveAlongPoints(request, points.slice(1), 420);
  }

  private queueRequest(
    requestId: number,
    serverId: number,
    queueLength: number,
  ): void {
    const request = this.requestViews.get(requestId);
    if (!request) {
      return;
    }
    const target = this.getNodePosition(serverId === 0 ? "serverA" : "serverB");
    const column = (queueLength - 1) % 4;
    this.tweens.add({
      targets: request,
      x: target.x - 48 + column * 19,
      y: target.y + 48,
      scale: 0.76,
      duration: 260,
    });
  }

  private processRequest(requestId: number, serverId: number): void {
    const request = this.requestViews.get(requestId);
    if (!request) {
      return;
    }
    const target = this.getNodePosition(serverId === 0 ? "serverA" : "serverB");
    this.tweens.add({
      targets: request,
      x: target.x,
      y: target.y,
      scale: 0.38,
      alpha: 0.55,
      duration: 300,
    });
  }

  private routeToDatabase(requestId: number): void {
    const request = this.requestViews.get(requestId);
    if (!request) {
      return;
    }
    const database = this.getNodePosition("database");
    request.setAlpha(1).setScale(0.72);
    this.tweens.add({
      targets: request,
      x: database.x,
      y: database.y,
      duration: 340,
      ease: "Sine.InOut",
    });
  }

  private queueAtDatabase(requestId: number, queueLength: number): void {
    const request = this.requestViews.get(requestId);
    if (!request) {
      return;
    }
    const database = this.getNodePosition("database");
    const column = (queueLength - 1) % 5;
    this.tweens.add({
      targets: request,
      x: database.x - 42 + column * 18,
      y: database.y + 49,
      scale: 0.68,
      alpha: 1,
      duration: 230,
    });
  }

  private processAtDatabase(requestId: number): void {
    const request = this.requestViews.get(requestId);
    if (!request) {
      return;
    }
    const database = this.getNodePosition("database");
    this.tweens.add({
      targets: request,
      x: database.x,
      y: database.y,
      scale: 0.28,
      alpha: 0.5,
      duration: 260,
    });
  }

  private markDatabaseComplete(requestId: number): void {
    const request = this.requestViews.get(requestId);
    if (!request) {
      return;
    }
    request.setAlpha(1).setScale(0.7);
    const pulse = this.add
      .circle(request.x, request.y, 18, COLORS.yellow, 0.12)
      .setStrokeStyle(4, COLORS.yellow, 0.9)
      .setDepth(11);
    this.tweens.add({
      targets: pulse,
      scale: 1.8,
      alpha: 0,
      duration: 380,
      onComplete: () => pulse.destroy(),
    });
  }

  private returnResponse(requestId: number, serverId: number): void {
    const request = this.requestViews.get(requestId);
    if (!request) {
      return;
    }
    request.setAlpha(1).setScale(0.72);
    const responseLabel = this.add
      .text(0, -23, "RESPONSE", {
        color: "#6d55aa",
        fontFamily: "Arial",
        fontSize: "10px",
        fontStyle: "bold",
        backgroundColor: "#f3effc",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5);
    request.add(responseLabel);
    void this.moveAlongPoints(
      request,
      this.getResponseRoute(serverId).slice(1),
      260,
    );
  }

  private completeRequest(requestId: number): void {
    const request = this.requestViews.get(requestId);
    if (!request) {
      return;
    }
    const exit = this.getNodePosition("exit");
    request.setPosition(exit.x, exit.y).setAlpha(1).setScale(0.8);
    const pulse = this.add
      .circle(exit.x, exit.y, 28, COLORS.green, 0.12)
      .setStrokeStyle(5, COLORS.green, 0.95)
      .setDepth(11);
    const feedback = this.add
      .text(exit.x, exit.y - 52, "200 OK", {
        color: "#32855c",
        fontFamily: "Arial",
        fontSize: "16px",
        fontStyle: "bold",
        backgroundColor: "#e9f8ef",
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(22);
    this.tweens.add({
      targets: [pulse, feedback],
      y: "-=12",
      scale: 1.35,
      alpha: 0,
      duration: 520,
      onComplete: () => {
        pulse.destroy();
        feedback.destroy();
      },
    });
    this.tweens.add({
      targets: request,
      scale: 1.2,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        this.destroyRequest(requestId);
      },
    });
  }

  private failRequest(requestId: number, reason: string): void {
    const request = this.requestViews.get(requestId);
    if (!request) {
      return;
    }
    request.add(
      this.add
        .text(0, -24, reason, {
          color: "#c43f52",
          fontFamily: "Arial",
          fontSize: reason.length > 4 ? "8px" : "12px",
          fontStyle: "bold",
          backgroundColor: "#fff4f5",
          padding: { x: 5, y: 3 },
        })
        .setOrigin(0.5),
    );
    this.tweens.add({
      targets: request,
      y: request.y + 30,
      alpha: 0,
      angle: 25,
      duration: 520,
      onComplete: () => this.destroyRequest(requestId),
    });
  }

  private updateServerState(
    serverId: number,
    queueLength: number,
    activeCount: number,
  ): void {
    const node = this.nodes.get(serverId === 0 ? "serverA" : "serverB");
    if (!node?.pressure || !node.queueText || !node.stateText) {
      return;
    }
    const pressure = Math.min(
      1,
      (queueLength / 6) * 0.75 + (activeCount / 2) * 0.25,
    );
    node.queueText.setText(`대기 ${queueLength}`);
    node.stateText
      .setText(pressure >= 0.85 ? "CRITICAL" : pressure >= 0.6 ? "DELAY" : "APP")
      .setColor(pressure >= 0.85 ? "#ffd7dd" : "#ffffff");
    node.pressure.clear();
    node.pressure.lineStyle(6, 0xe5dfd2, 0.65);
    node.pressure.strokeCircle(0, 0, 40);
    if (pressure > 0) {
      node.pressure.lineStyle(
        7,
        pressure >= 0.85
          ? COLORS.red
          : pressure >= 0.6
            ? COLORS.orange
            : COLORS.mint,
        0.95,
      );
      node.pressure.beginPath();
      node.pressure.arc(
        0,
        0,
        40,
        Phaser.Math.DegToRad(-90),
        Phaser.Math.DegToRad(-90 + 360 * pressure),
        false,
      );
      node.pressure.strokePath();
    }
  }

  private updateDatabaseState(
    queueLength: number,
    activeCount: number,
  ): void {
    const node = this.nodes.get("database");
    if (!node?.pressure || !node.queueText || !node.stateText) {
      return;
    }
    const queueCapacity = this.architecture.databaseIndexed ? 14 : 8;
    const pressure = Math.min(
      1,
      (queueLength / queueCapacity) * 0.75 + (activeCount / 2) * 0.25,
    );
    node.queueText.setText(
      `대기 ${queueLength}${this.architecture.databaseIndexed ? " · INDEX" : ""}`,
    );
    node.stateText
      .setText(
        pressure >= 0.85
          ? "HOT"
          : this.architecture.databaseIndexed
            ? "INDEX"
            : "DB",
      )
      .setColor(pressure >= 0.85 ? "#a82f43" : "#0074a8");
    node.pressure.clear();
    node.pressure.lineStyle(6, 0xe5dfd2, 0.65);
    node.pressure.strokeCircle(0, 0, 40);
    if (pressure > 0) {
      node.pressure.lineStyle(
        7,
        pressure >= 0.85
          ? COLORS.red
          : pressure >= 0.6
            ? COLORS.orange
            : COLORS.yellow,
        0.95,
      );
      node.pressure.beginPath();
      node.pressure.arc(
        0,
        0,
        40,
        Phaser.Math.DegToRad(-90),
        Phaser.Math.DegToRad(-90 + 360 * pressure),
        false,
      );
      node.pressure.strokePath();
    }
  }

  private getRequestRoute(serverId: number): Phaser.Math.Vector2[] {
    const serverNode: ArchitectureNodeId =
      serverId === 0 ? "serverA" : "serverB";
    if (hasBalancedRoute(this.architecture)) {
      return [
        this.getNodePosition("entry"),
        this.getNodePosition("loadBalancer"),
        this.getNodePosition(serverNode),
      ];
    }
    return [
      this.getNodePosition("entry"),
      this.getNodePosition("serverA"),
    ];
  }

  private getResponseRoute(serverId: number): Phaser.Math.Vector2[] {
    const serverNode: ArchitectureNodeId =
      serverId === 0 ? "serverA" : "serverB";
    if (hasBalancedRoute(this.architecture)) {
      return [
        this.getNodePosition("database"),
        this.getNodePosition(serverNode),
        this.getNodePosition("loadBalancer"),
        this.getNodePosition("exit"),
      ];
    }
    return [
      this.getNodePosition("database"),
      this.getNodePosition("serverA"),
      this.getNodePosition("exit"),
    ];
  }

  private async moveAlongPoints(
    target: Phaser.GameObjects.Container,
    points: Phaser.Math.Vector2[],
    duration: number,
  ): Promise<void> {
    for (const point of points) {
      if (!target.active) {
        return;
      }
      await this.tweenPromise({
        targets: target,
        x: point.x,
        y: point.y,
        duration,
        ease: "Sine.InOut",
      });
    }
  }

  private playBuildPop(target: Phaser.GameObjects.Container): void {
    this.tweens.killTweensOf(target);
    target.setScale(0.2);
    this.tweens.add({
      targets: target,
      scale: 1,
      duration: 420,
      ease: "Back.Out",
    });
    const ring = this.add
      .circle(target.x, target.y, 30, COLORS.mint, 0.08)
      .setStrokeStyle(5, COLORS.mint, 0.7)
      .setDepth(8);
    this.tweens.add({
      targets: ring,
      scale: 2,
      alpha: 0,
      duration: 500,
      onComplete: () => ring.destroy(),
    });
    this.playParticleBurst(target.x, target.y, COLORS.mint, 18);
  }

  private playNodeSelection(nodeId: ArchitectureNodeId): void {
    const target = this.nodes.get(nodeId)?.container;
    if (!target) {
      return;
    }
    this.tweens.killTweensOf(target);
    target.setScale(1);
    this.tweens.add({
      targets: target,
      scale: 1.12,
      duration: 110,
      yoyo: true,
      ease: "Sine.InOut",
    });
    const ring = this.add
      .circle(target.x, target.y, 34, 0x7dd9be, 0.06)
      .setStrokeStyle(4, 0x9ee8d4, 0.95)
      .setDepth(9);
    this.tweens.add({
      targets: ring,
      scale: 1.65,
      alpha: 0,
      duration: 360,
      ease: "Quad.Out",
      onComplete: () => ring.destroy(),
    });
    this.playParticleBurst(target.x, target.y, COLORS.blue, 8);
  }

  private playParticleBurst(
    x: number,
    y: number,
    tint: number,
    count: number,
  ): void {
    const particles = this.add
      .particles(x, y, "vfx-dot", {
        emitting: false,
        lifespan: { min: 260, max: 520 },
        speed: { min: 55, max: 170 },
        scale: { start: 0.7, end: 0 },
        alpha: { start: 0.95, end: 0 },
        tint,
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(18);
    particles.explode(count);
    this.time.delayedCall(650, () => particles.destroy());
  }

  private playLinkPulse(
    fromId: ArchitectureNodeId,
    toId: ArchitectureNodeId,
  ): void {
    const from = this.getNodePosition(fromId);
    const to = this.getNodePosition(toId);
    const corner = new Phaser.Math.Vector2(to.x, from.y);
    const flow = getConnectionFlow(fromId, toId);
    const color =
      flow === "response"
        ? COLORS.purple
        : flow === "data"
          ? COLORS.yellow
          : COLORS.blue;
    const pulse = this.add
      .circle(from.x, from.y, 7, color, 1)
      .setStrokeStyle(3, 0xffffff, 0.9)
      .setDepth(16);
    pulse.postFX.addGlow(color, 2, 0, false, 0.1, 8);
    void (async () => {
      await this.tweenPromise({
        targets: pulse,
        x: corner.x,
        y: corner.y,
        duration: 180,
        ease: "Sine.InOut",
      });
      await this.tweenPromise({
        targets: pulse,
        x: to.x,
        y: to.y,
        duration: 180,
        ease: "Sine.InOut",
      });
      this.playParticleBurst(to.x, to.y, color, 12);
      pulse.destroy();
    })();
  }

  private playConfetti(): void {
    for (let index = 0; index < 28; index += 1) {
      const colors = [COLORS.mint, COLORS.blue, COLORS.purple, COLORS.yellow];
      const piece = this.add
        .rectangle(
          130 + ((index * 91) % 940),
          120,
          7,
          12,
          colors[index % colors.length],
        )
        .setDepth(30)
        .setAngle(index * 31);
      this.tweens.add({
        targets: piece,
        y: 630,
        x: piece.x + ((index % 3) - 1) * 75,
        angle: piece.angle + 250,
        alpha: 0,
        duration: 1100 + (index % 5) * 100,
        onComplete: () => piece.destroy(),
      });
    }
  }

  private gridToWorld(position: GridPosition): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(position.column, position.row);
  }

  private async startRealtimeWave(
    wave: StartWavePayload["wave"],
    architecture: ArchitectureConfig,
  ): Promise<void> {
    this.resetTraffic();
    this.isWaveRunning = true;
    this.cancelPlacement();
    this.runtimePacketPhases.clear();
    await this.showWaveCountdown(wave.id);
  }

  update(time: number, delta: number): void {
    if (this.isWaveRunning) {
      const store = useGameStore.getState();
      store.stepSimulation(delta);
      const nextState = useGameStore.getState().runtimeState;
      if (!nextState) {
        this.isWaveRunning = false;
        this.runtimeState = null;
        return;
      }
      this.runtimeState = nextState;
      this.presentRuntimeState(nextState);
      this.syncPacketPositions(nextState);

      this.updateServerState(
        0,
        nextState.nodes.serverA.queue.length,
        nextState.nodes.serverA.active.length,
      );
      this.updateServerState(
        1,
        nextState.nodes.serverB.queue.length,
        nextState.nodes.serverB.active.length,
      );
      this.updateDatabaseState(
        nextState.nodes.database.queue.length,
        nextState.nodes.database.active.length,
      );
    }
  }

  private syncPacketPositions(state: RuntimeSimulationState): void {
    for (const packet of state.packets) {
      const view = this.requestViews.get(packet.id);
      if (!view) continue;

      if (
        packet.phase === "toServer" ||
        packet.phase === "toDatabase" ||
        packet.phase === "toExit"
      ) {
        const progressRatio = Phaser.Math.Clamp(
          packet.pathProgressMs / Math.max(1, packet.pathDurationMs),
          0,
          1,
        );
        const coords = packet.path.map((nodeId) => this.getNodePosition(nodeId));
        if (coords.length >= 2) {
          const pos = this.getPositionOnPath(coords, progressRatio);
          view.setPosition(pos.x, pos.y);
          view.setScale(1);
          view.setAlpha(1);
        }
      } else if (
        packet.phase === "queuedAtServer" ||
        packet.phase === "queuedAtDatabase"
      ) {
        const nodeId = packet.phase === "queuedAtServer" ? packet.serverNodeId : "database";
        const node = this.getNodePosition(nodeId);
        view.setPosition(node.x, node.y + 44);
        view.setScale(0.72);
        view.setAlpha(1);
      } else if (
        packet.phase === "processingServer" ||
        packet.phase === "processingDatabase"
      ) {
        const nodeId = packet.phase === "processingServer" ? packet.serverNodeId : "database";
        const node = this.getNodePosition(nodeId);
        view.setPosition(node.x, node.y);
        view.setScale(0.35);
        view.setAlpha(0.5);
      }
    }
  }

  private getPositionOnPath(points: Phaser.Math.Vector2[], ratio: number): Phaser.Math.Vector2 {
    if (points.length < 2) return points[0] ?? new Phaser.Math.Vector2();
    let totalLen = 0;
    const lengths: number[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const len = Phaser.Math.Distance.BetweenPoints(points[i], points[i+1]);
      lengths.push(len);
      totalLen += len;
    }
    if (totalLen === 0) return points[0];

    const targetLen = totalLen * ratio;
    let accumulated = 0;
    for (let i = 0; i < points.length - 1; i++) {
      if (accumulated + lengths[i] >= targetLen) {
        const segRatio = (targetLen - accumulated) / lengths[i];
        const x = Phaser.Math.Interpolation.Linear([points[i].x, points[i+1].x], segRatio);
        const y = Phaser.Math.Interpolation.Linear([points[i].y, points[i+1].y], segRatio);
        return new Phaser.Math.Vector2(x, y);
      }
      accumulated += lengths[i];
    }
    return points[points.length - 1];
  }

  private presentRuntimeState(state: RuntimeSimulationState): void {
    for (const packet of state.packets) {
      const previousPhase = this.runtimePacketPhases.get(packet.id);
      if (!previousPhase) {
        this.spawnRequest(packet.id, packet.operation);
      }
      if (packet.phase === previousPhase) {
        continue;
      }
      
      if (packet.phase === "dropped") {
        const request = this.requestViews.get(packet.id);
        if (request) {
          this.playParticleBurst(request.x, request.y, 0xe86d7e, 12);
        }
        this.failRequest(packet.id, "DROP");
      } else if (packet.phase === "timedOut") {
        this.failRequest(packet.id, "TIMEOUT");
      } else if (packet.phase === "completed") {
        this.completeRequest(packet.id);
      }
      this.runtimePacketPhases.set(packet.id, packet.phase);
    }
  }

  private worldToGrid(x: number, y: number): GridPosition | null {
    const position = { column: x, row: y };
    return isGridPositionAvailable(this.architecture, position)
      ? position
      : null;
  }

  private isOccupied(
    position: GridPosition,
    exceptNodeId?: ArchitectureNodeId,
  ): boolean {
    return ([...this.nodes.keys()] as ArchitectureNodeId[]).some((nodeId) => {
      if (nodeId === exceptNodeId || !this.isNodeActive(nodeId)) {
        return false;
      }
      const candidate = this.architecture.nodePositions[nodeId];
      if (!candidate) {
        return false;
      }
      return (
        Math.hypot(
          candidate.column - position.column,
          candidate.row - position.row,
        ) < 120
      );
    });
  }

  private getNodePosition(nodeId: ArchitectureNodeId): Phaser.Math.Vector2 {
    const node = this.nodes.get(nodeId);
    return new Phaser.Math.Vector2(
      node?.container.x ?? 0,
      node?.container.y ?? 0,
    );
  }

  private isNodeActive(nodeId: ArchitectureNodeId): boolean {
    return isArchitectureNodePlaced(this.architecture, nodeId);
  }

  private findNodeAt(
    x: number,
    y: number,
    except: ArchitectureNodeId,
  ): ArchitectureNodeId | null {
    for (const [nodeId, node] of this.nodes) {
      if (
        nodeId !== except &&
        this.isNodeActive(nodeId) &&
        Phaser.Math.Distance.Between(x, y, node.container.x, node.container.y) <
          NODE_WORLD_RADIUS
      ) {
        return nodeId;
      }
    }
    return null;
  }

  private isPointerOverNode(x: number, y: number): boolean {
    for (const [nodeId, node] of this.nodes) {
      if (
        this.isNodeActive(nodeId) &&
        Phaser.Math.Distance.Between(x, y, node.container.x, node.container.y) <
          NODE_WORLD_RADIUS
      ) {
        return true;
      }
    }
    return false;
  }

  private emitProgress(): void {
    gameEvents.emit(GAME_EVENTS.WAVE_PROGRESS, {
      metrics: {
        completed: this.progress.completed,
        failed: this.progress.failed,
        queueByServer: [...this.progress.queueByServer] as [number, number],
        databaseQueue: this.progress.databaseQueue,
      },
    });
  }

  private destroyRequest(requestId: number): void {
    this.requestTrails.get(requestId)?.destroy();
    this.requestTrails.delete(requestId);
    this.requestViews.get(requestId)?.destroy(true);
    this.requestViews.delete(requestId);
  }

  private resetTraffic(): void {
    for (const timer of this.activeTimers) {
      timer.remove(false);
    }
    this.activeTimers = [];
    this.runtimeTickTimer?.remove(false);
    this.runtimeTickTimer = null;
    this.runtimeState = null;
    this.runtimePacketPhases.clear();
    for (const requestId of [...this.requestViews.keys()]) {
      this.destroyRequest(requestId);
    }
    this.progress = {
      completed: 0,
      failed: 0,
      queueByServer: [0, 0],
      databaseQueue: 0,
    };
    this.updateServerState(0, 0, 0);
    this.updateServerState(1, 0, 0);
    this.updateDatabaseState(0, 0);
    this.emitProgress();
  }

  private resetWorld(): void {
    this.isWaveRunning = false;
    this.nodeGesture = null;
    this.moveTargetPosition = null;
    this.previewGraphics.clear();
    this.resetTraffic();
    this.applyArchitecture(false);
    this.fitBoardView(false);
    this.showLinkBudget();
  }

  private wait(duration: number): Promise<void> {
    return new Promise((resolve) => {
      this.time.delayedCall(duration, resolve);
    });
  }

  private tweenPromise(
    config: Phaser.Types.Tweens.TweenBuilderConfig,
  ): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({
        ...config,
        onComplete: () => resolve(),
      });
    });
  }
}
