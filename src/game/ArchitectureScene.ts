import Phaser from "phaser";
import type {
  ArchitectureConfig,
  ArchitectureNodeId,
  GridPosition,
  TrafficEvent,
  WaveSimulationResult,
} from "../simulation/trafficSimulation";
import {
  DEFAULT_NODE_POSITIONS,
  getBoardTier,
  getConnectionFlow,
  getConnectionLength,
  getLinkTier,
  getTotalConnectionCells,
  hasBalancedRoute,
  hasDirectConnection,
  isArchitectureNodePlaced,
  isGridPositionAvailable,
  validateArchitectureConnections,
  validateNewConnection,
} from "../simulation/trafficSimulation";
import type { LiveWaveMetrics } from "../store/gameStore";
import {
  GAME_EVENTS,
  gameEvents,
  type ArchitecturePayload,
  type CameraCommand,
  type InventoryDropPayload,
  type InventorySelectPayload,
} from "./bridge/gameEvents";
import { resolveNodeGesture } from "./nodeGesture";

interface NodeView {
  id: ArchitectureNodeId;
  container: Phaser.GameObjects.Container;
  pressure?: Phaser.GameObjects.Graphics;
  queueText?: Phaser.GameObjects.Text;
  stateText?: Phaser.GameObjects.Text;
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
}

const WIDTH = 1200;
const HEIGHT = 720;
const PLAYBACK_SCALE = 1;
const BOARD_ZOOM = {
  min: 0.6,
  max: 2,
  step: 0.1,
};
const GRID = {
  columns: 13,
  rows: 6,
  left: 45,
  top: 150,
  cellWidth: 72,
  cellHeight: 70,
};
const COLORS = {
  cream: 0xfff8e8,
  paper: 0xfffffb,
  grass: 0xdcefc3,
  grid: 0xd8cfbd,
  ink: 0x5b5d69,
  muted: 0x96939c,
  mint: 0x7dd9be,
  mintDark: 0x49ae91,
  blue: 0x88b8ef,
  blueDark: 0x598bc4,
  purple: 0xb4a1e5,
  purpleDark: 0x7862b7,
  yellow: 0xf6d477,
  orange: 0xf3a66c,
  pink: 0xf29aac,
  red: 0xe86d7e,
  green: 0x79cf94,
  path: 0xc7b998,
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
  private requestViews = new Map<number, Phaser.GameObjects.Container>();
  private pathGraphics!: Phaser.GameObjects.Graphics;
  private previewGraphics!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
  private activePlacementNode: ArchitectureNodeId | null = null;
  private activePlacementInstanceId: string | null = null;
  private nodeGesture: NodeGesture | null = null;
  private boardPanGesture: BoardPanGesture | null = null;
  private isSpacePressed = false;
  private suppressBoardPanUntilPointerUp = false;
  private moveTargetPosition: GridPosition | null = null;
  private activeTimers: Phaser.Time.TimerEvent[] = [];
  private isWaveRunning = false;
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
    this.cameras.main.setBackgroundColor("#fff8e8");
    this.input.mouse?.disableContextMenu();
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

    gameEvents.emit(GAME_EVENTS.SCENE_READY, undefined);
    this.cameras.main.fadeIn(300, 255, 248, 232);
  }

  private bindGameEvents(): void {
    this.unsubscribers.push(
      gameEvents.on<WaveSimulationResult>(
        GAME_EVENTS.WAVE_REQUEST,
        (result) => void this.playWave(result),
      ),
      gameEvents.on<ArchitecturePayload>(
        GAME_EVENTS.CONFIGURE_ARCHITECTURE,
        ({ architecture }) => {
          const boardLevelChanged =
            architecture.boardLevel !== this.architecture.boardLevel;
          const placedNewNode = (
            Object.keys(architecture.nodePositions) as ArchitectureNodeId[]
          ).some(
            (nodeId) =>
              architecture.nodePositions[nodeId] !== undefined &&
              this.architecture.nodePositions[nodeId] === undefined,
          );
          this.architecture = architecture;
          this.applyArchitecture(placedNewNode);
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
    });
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
        const cameraCenterX = camera.width / 2;
        const cameraCenterY = camera.height / 2;
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
        camera.scrollX =
          beforeZoom.x -
          cameraCenterX -
          (pointer.x - cameraCenterX) / nextZoom;
        camera.scrollY =
          beforeZoom.y -
          cameraCenterY -
          (pointer.y - cameraCenterY) / nextZoom;
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
      };
      this.input.setDefaultCursor("grabbing");
    });
  }

  private resetBoardView(): void {
    this.fitBoardView();
  }

  private fitBoardView(showStatus = true): void {
    const camera = this.cameras.main;
    const boardTier = getBoardTier(this.architecture.boardLevel);
    const zoomByLevel = {
      1: 1.05,
      2: 0.88,
      3: 0.72,
    } as const;
    const boardCenterX =
      GRID.left + (boardTier.columns * GRID.cellWidth) / 2;
    const boardCenterY =
      GRID.top + (boardTier.rows * GRID.cellHeight) / 2;

    camera.setZoom(zoomByLevel[boardTier.level]);
    camera.centerOn(boardCenterX, boardCenterY);
    this.boardPanGesture = null;
    this.input.setDefaultCursor("default");
    this.syncCameraMetadata();
    if (showStatus) {
      this.statusText.setText("활성 보드 영역에 화면을 맞췄습니다");
    }
  }

  private adjustBoardZoom(delta: number): void {
    const camera = this.cameras.main;
    camera.setZoom(
      Phaser.Math.Clamp(
        Number((camera.zoom + delta).toFixed(2)),
        BOARD_ZOOM.min,
        BOARD_ZOOM.max,
      ),
    );
    this.syncCameraMetadata();
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
    gameEvents.emit(GAME_EVENTS.CAMERA_CHANGED, { zoom: camera.zoom });
  }

  private drawPastelWorld(): void {
    const sky = this.add.graphics();
    sky.fillStyle(0xe9f3ee, 1);
    sky.fillRect(-WIDTH, -HEIGHT, WIDTH * 3, HEIGHT + 865);
    sky.fillStyle(COLORS.cream, 1);
    sky.fillRect(-WIDTH, 145, WIDTH * 3, HEIGHT * 2);
    sky.lineStyle(2, COLORS.grid, 0.45);
    sky.lineBetween(-WIDTH, 145, WIDTH * 2, 145);
  }

  private createGrid(): void {
    for (let row = 0; row < GRID.rows; row += 1) {
      for (let column = 0; column < GRID.columns; column += 1) {
        const position = { column, row };
        const center = this.gridToWorld(position);
        const rectangle = this.add
          .rectangle(
            center.x,
            center.y,
            GRID.cellWidth - 8,
            GRID.cellHeight - 8,
            COLORS.paper,
            0.68,
          )
          .setStrokeStyle(2, COLORS.grid, 0.52)
          .setDepth(1)
          .setInteractive({ useHandCursor: true });

        rectangle.on("pointerover", () => {
          if (
            isGridPositionAvailable(this.architecture, position) &&
            this.activePlacementNode &&
            !this.isOccupied(position)
          ) {
            rectangle.setFillStyle(0xe6f7ef, 1);
            rectangle.setStrokeStyle(4, COLORS.mint, 1);
          }
        });
        rectangle.on("pointerout", () => this.styleGridCell(position));
        rectangle.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
          if (
            pointer.button === 0 &&
            isGridPositionAvailable(this.architecture, position) &&
            this.activePlacementNode &&
            !this.isOccupied(position)
          ) {
            this.requestPlacement(this.activePlacementNode, position, true, this.activePlacementInstanceId ?? undefined);
          }
        });
        this.gridCells.push({ position, center, rectangle });
      }
    }
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
    const shadow = this.add.ellipse(0, 38, 72, 16, 0x36556f, 0.14);
    const tile = this.add.rectangle(0, 0, 66, 66, 0x0078d4);
    tile.setStrokeStyle(3, 0xffffff, 0.9);
    const icon = this.add.graphics();
    icon.lineStyle(4, 0xffffff, 1);
    icon.strokeCircle(-12, -9, 7);
    icon.strokeCircle(12, -9, 7);
    icon.beginPath();
    icon.arc(-12, 18, 13, Phaser.Math.DegToRad(195), Phaser.Math.DegToRad(345));
    icon.strokePath();
    icon.beginPath();
    icon.arc(12, 18, 13, Phaser.Math.DegToRad(195), Phaser.Math.DegToRad(345));
    icon.strokePath();
    const label = this.createNodeLabel("Traffic Ingress · FIXED", 0, 50);
    container.add([shadow, tile, icon, label]);
    this.makeConnectable(container, "entry");
    return { id: "entry", container };
  }

  private createExitNode(position: Phaser.Math.Vector2): NodeView {
    const container = this.add.container(position.x, position.y).setDepth(6);
    const shadow = this.add.ellipse(0, 38, 72, 16, 0x36556f, 0.14);
    const tile = this.add.rectangle(0, 0, 66, 66, COLORS.purpleDark);
    tile.setStrokeStyle(3, 0xffffff, 0.9);
    const icon = this.add.graphics();
    icon.lineStyle(5, 0xffffff, 1);
    icon.strokeCircle(0, 0, 19);
    icon.lineBetween(-10, 0, -2, 9);
    icon.lineBetween(-2, 9, 13, -9);
    const label = this.createNodeLabel("Response Egress · FIXED", 0, 50);
    container.add([shadow, tile, icon, label]);
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
    const shadow = this.add.ellipse(0, 39, 78, 16, 0x36556f, 0.14);
    const body = this.add.graphics();
    body.fillStyle(0x0078d4, 1);
    body.fillRect(-34, -32, 68, 64);
    body.lineStyle(3, 0xffffff, 0.9);
    body.strokeRect(-34, -32, 68, 64);
    body.lineStyle(4, 0xffffff, 1);
    body.strokeRect(-22, -18, 44, 29);
    body.lineBetween(-13, 20, 13, 20);
    body.lineBetween(0, 11, 0, 20);
    const stateText = this.add
      .text(0, -1, "APP", {
        color: "#ffffff",
        fontFamily: "Arial",
        fontSize: "12px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const label = this.createNodeLabel(title, 0, 48);
    const queueText = this.add
      .text(0, 62, "대기 0", {
        color: "#7f8290",
        fontFamily: "Trebuchet MS",
        fontSize: "11px",
        fontStyle: "bold",
        backgroundColor: "#fffdf8",
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5);
    container.add([pressure, shadow, body, stateText, label, queueText]);
    this.makeConnectable(container, id);
    return { id, container, pressure, queueText, stateText };
  }

  private createLoadBalancerNode(position: Phaser.Math.Vector2): NodeView {
    const container = this.add.container(position.x, position.y).setDepth(6);
    const shadow = this.add.ellipse(0, 38, 74, 16, 0x36556f, 0.14);
    const body = this.add.graphics();
    body.fillStyle(0x5c2d91, 1);
    body.fillRect(-33, -32, 66, 64);
    body.lineStyle(3, 0xffffff, 0.9);
    body.strokeRect(-33, -32, 66, 64);
    body.lineStyle(4, 0xffffff, 1);
    body.strokeRect(-7, -7, 14, 14);
    body.lineBetween(0, -27, 0, -7);
    body.lineBetween(0, 7, 0, 27);
    body.lineBetween(-27, 0, -7, 0);
    body.lineBetween(7, 0, 27, 0);
    const label = this.createNodeLabel("Load Balancer", 0, 49);
    container.add([shadow, body, label]);
    this.makeConnectable(container, "loadBalancer");
    return { id: "loadBalancer", container };
  }

  private createDatabaseNode(position: Phaser.Math.Vector2): NodeView {
    const container = this.add.container(position.x, position.y).setDepth(6);
    const pressure = this.add.graphics();
    const shadow = this.add.ellipse(0, 39, 72, 16, 0x36556f, 0.14);
    const tile = this.add.rectangle(0, 0, 66, 66, 0x0089d6);
    tile.setStrokeStyle(3, 0xffffff, 0.9);
    const database = this.add.graphics();
    database.fillStyle(0xffffff, 1);
    database.fillEllipse(0, -17, 38, 13);
    database.fillRect(-19, -17, 38, 34);
    database.fillEllipse(0, 17, 38, 13);
    database.lineStyle(2, 0x0089d6, 1);
    database.strokeEllipse(0, -5, 38, 13);
    database.strokeEllipse(0, 7, 38, 13);
    const label = this.createNodeLabel("Primary DB", 0, 50);
    const stateText = this.add
      .text(0, 0, "DB", {
        color: "#0074a8",
        fontFamily: "Arial",
        fontSize: "10px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const queueText = this.add
      .text(0, 62, "대기 0", {
        color: "#7f8290",
        fontFamily: "Trebuchet MS",
        fontSize: "11px",
        fontStyle: "bold",
        backgroundColor: "#fffdf8",
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5);
    container.add([
      pressure,
      shadow,
      tile,
      database,
      stateText,
      label,
      queueText,
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
        color: "#5f616d",
        fontFamily: "Trebuchet MS",
        fontSize: "12px",
        fontStyle: "bold",
        backgroundColor: "#fffdf8",
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5);
  }

  private makeConnectable(
    container: Phaser.GameObjects.Container,
    nodeId: ArchitectureNodeId,
  ): void {
    container.setSize(76, 76);
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
        gameEvents.emit(GAME_EVENTS.NODE_DETAILS_REQUEST, { nodeId });
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
        !this.isWaveRunning &&
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
            : "빈 격자 칸으로 장비를 이동하세요",
        );
      }
    });
  }

  private bindPointerDrawing(): void {
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.boardPanGesture && pointer.isDown) {
        const camera = this.cameras.main;
        camera.scrollX =
          this.boardPanGesture.scrollX -
          (pointer.x - this.boardPanGesture.pointerX) / camera.zoom;
        camera.scrollY =
          this.boardPanGesture.scrollY -
          (pointer.y - this.boardPanGesture.pointerY) / camera.zoom;
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
        const sourceGrid =
          this.architecture.nodePositions[this.nodeGesture.nodeId];
        const pointerGrid = this.worldToGrid(pointer.worldX, pointer.worldY);
        const tier = getLinkTier(this.architecture.linkLevel);
        const previewLength =
          sourceGrid && pointerGrid
            ? Math.abs(sourceGrid.column - pointerGrid.column) +
              Math.abs(sourceGrid.row - pointerGrid.row)
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
        this.boardPanGesture = null;
        this.input.setDefaultCursor(this.isSpacePressed ? "grab" : "default");
        this.syncCameraMetadata();
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

      if (resolution.type === "details") {
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
        this.statusText.setText("빈 격자 칸이나 다른 장비 위에 놓아 주세요");
        this.cameras.main.shake(100, 0.002);
      }
      this.refreshGrid();
    });
  }

  private createStatusBanner(): void {
    const panel = this.add
      .rectangle(WIDTH / 2, 102, 430, 44, 0xfffffb, 0.94)
      .setStrokeStyle(3, COLORS.mint, 0.7)
      .setDepth(20);
    this.statusText = this.add
      .text(
        WIDTH / 2,
        102,
        "포트 제한 · 링크 길이 · 보드 영역을 확인하세요",
        {
          color: "#676975",
          fontFamily: "Trebuchet MS",
          fontSize: "15px",
          fontStyle: "bold",
        },
      )
      .setOrigin(0.5)
      .setDepth(21);
  }

  private applyArchitecture(playBuildEffect: boolean): void {
    for (const [nodeId, node] of this.nodes) {
      const gridPosition = this.architecture.nodePositions[nodeId];
      node.container.setVisible(Boolean(gridPosition));
      if (gridPosition) {
        const position = this.gridToWorld(gridPosition);
        node.container.setPosition(position.x, position.y);
      }
    }
    this.drawConnections();
    this.refreshGrid();
    this.showLinkBudget();
    if (playBuildEffect) {
      const target = [...this.nodes.values()].find(
        (node) => node.container.visible && node.container.scaleX === 1,
      );
      if (target) {
        this.playBuildPop(target.container);
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
      this.pathGraphics.lineStyle(13, COLORS.path, 0.62);
      this.drawOrthogonalLine(this.pathGraphics, from, to);
      if (flow === "duplex") {
        this.pathGraphics.lineStyle(8, COLORS.blue, 0.95);
        this.drawOrthogonalLine(this.pathGraphics, from, to);
        this.pathGraphics.lineStyle(3, COLORS.purple, 1);
        this.drawOrthogonalLine(this.pathGraphics, from, to);
      } else {
        const pathColor =
          flow === "request"
            ? COLORS.blue
            : flow === "response"
              ? COLORS.purple
              : COLORS.yellow;
        this.pathGraphics.lineStyle(6, pathColor, 0.95);
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
    const linkTier = getLinkTier(this.architecture.linkLevel);
    const boardTier = getBoardTier(this.architecture.boardLevel);
    this.statusText.setText(
      `BOARD LV.${boardTier.level} ${boardTier.columns}×${boardTier.rows} · LINK LV.${linkTier.level} ${getTotalConnectionCells(this.architecture)}/${linkTier.totalCells}칸`,
    );
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
    if (this.isWaveRunning) {
      return;
    }
    this.activePlacementNode = nodeId;
    this.activePlacementInstanceId = instanceId ?? null;
    this.statusText.setText("초록색 격자 칸을 골라 장비를 놓아 주세요");
    this.refreshGrid();
  }

  private cancelPlacement(): void {
    this.activePlacementNode = null;
    this.activePlacementInstanceId = null;
    this.refreshGrid();
  }

  private handleInventoryDrop(payload: InventoryDropPayload): void {
    const worldPosition = this.cameras.main.getWorldPoint(payload.x, payload.y);
    const position = this.worldToGrid(worldPosition.x, worldPosition.y);
    if (
      !position ||
      !isGridPositionAvailable(this.architecture, position) ||
      this.isOccupied(position)
    ) {
      this.statusText.setText("현재 보드의 비어 있는 격자 칸에 놓아 주세요");
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
    for (const cell of this.gridCells) {
      this.styleGridCell(cell.position);
    }
  }

  private styleGridCell(position: GridPosition): void {
    const cell = this.gridCells.find(
      (candidate) =>
        candidate.position.column === position.column &&
        candidate.position.row === position.row,
    );
    if (!cell) {
      return;
    }
    const available = isGridPositionAvailable(this.architecture, position);
    cell.rectangle.setVisible(available);
    if (!available) {
      return;
    }
    if (cell.rectangle.input) {
      cell.rectangle.input.cursor = this.activePlacementNode
        ? "pointer"
        : "grab";
    }
    const occupied = this.isOccupied(position);
    const isMoveTarget =
      this.moveTargetPosition?.column === position.column &&
      this.moveTargetPosition?.row === position.row;
    const active =
      (Boolean(this.activePlacementNode) && !occupied) || isMoveTarget;
    cell.rectangle.setFillStyle(
      occupied ? 0xf0eadc : active ? 0xe5f6ec : COLORS.paper,
      occupied ? 0.38 : active ? 0.95 : 0.68,
    );
    cell.rectangle.setStrokeStyle(
      active ? 4 : 2,
      active ? COLORS.mint : COLORS.grid,
      active ? 1 : 0.52,
    );
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
    this.requestViews.set(requestId, container);
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
    return new Phaser.Math.Vector2(
      GRID.left + GRID.cellWidth / 2 + position.column * GRID.cellWidth,
      GRID.top + GRID.cellHeight / 2 + position.row * GRID.cellHeight,
    );
  }

  private worldToGrid(x: number, y: number): GridPosition | null {
    const column = Math.floor((x - GRID.left) / GRID.cellWidth);
    const row = Math.floor((y - GRID.top) / GRID.cellHeight);
    if (
      column < 0 ||
      column >= GRID.columns ||
      row < 0 ||
      row >= GRID.rows
    ) {
      return null;
    }
    const position = { column, row };
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
        candidate.column === position.column &&
        candidate.row === position.row
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
          52
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
          52
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
    this.requestViews.get(requestId)?.destroy(true);
    this.requestViews.delete(requestId);
  }

  private resetTraffic(): void {
    for (const timer of this.activeTimers) {
      timer.remove(false);
    }
    this.activeTimers = [];
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
