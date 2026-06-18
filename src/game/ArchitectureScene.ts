import Phaser from "phaser";
import type {
  ArchitectureConfig,
  ArchitectureNodeId,
  BuildSystemType,
  GridPosition,
  TrafficEvent,
  WaveSimulationResult,
} from "../simulation/trafficSimulation";
import {
  hasBalancedRoute,
  hasSingleServerRoute,
} from "../simulation/trafficSimulation";
import type { LiveWaveMetrics } from "../store/gameStore";
import {
  GAME_EVENTS,
  gameEvents,
  type ArchitecturePayload,
  type BuildDropPayload,
  type BuildSelectPayload,
} from "./bridge/gameEvents";
import { resolveNodeGesture } from "./nodeGesture";

interface NodeView {
  id: ArchitectureNodeId;
  container: Phaser.GameObjects.Container;
  pressure?: Phaser.GameObjects.Graphics;
  queueText?: Phaser.GameObjects.Text;
  face?: Phaser.GameObjects.Text;
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
}

const WIDTH = 1200;
const HEIGHT = 720;
const PLAYBACK_SCALE = 0.78;
const GRID = {
  columns: 9,
  rows: 4,
  left: 120,
  top: 160,
  cellWidth: 110,
  cellHeight: 100,
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
    serverCount: 1,
    hasLoadBalancer: false,
    nodePositions: {
      entry: { column: 0, row: 1 },
      loadBalancer: { column: 2, row: 1 },
      serverA: { column: 5, row: 0 },
      serverB: { column: 5, row: 2 },
      database: { column: 8, row: 1 },
    },
    connections: [],
  };
  private nodes = new Map<ArchitectureNodeId, NodeView>();
  private gridCells: GridCellView[] = [];
  private requestViews = new Map<number, Phaser.GameObjects.Container>();
  private pathGraphics!: Phaser.GameObjects.Graphics;
  private previewGraphics!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
  private activeBuildType: BuildSystemType | null = null;
  private nodeGesture: NodeGesture | null = null;
  private moveTargetPosition: GridPosition | null = null;
  private activeTimers: Phaser.Time.TimerEvent[] = [];
  private isWaveRunning = false;
  private progress: LiveWaveMetrics = {
    completed: 0,
    failed: 0,
    queueByServer: [0, 0],
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
    this.applyArchitecture(false);

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
          const builtLoadBalancer =
            !this.architecture.hasLoadBalancer && architecture.hasLoadBalancer;
          const builtSecondServer =
            this.architecture.serverCount === 1 &&
            architecture.serverCount === 2;
          this.architecture = architecture;
          this.applyArchitecture(builtLoadBalancer || builtSecondServer);
        },
      ),
      gameEvents.on<void>(GAME_EVENTS.RESET_WORLD, () => this.resetWorld()),
      gameEvents.on<BuildSelectPayload>(
        GAME_EVENTS.BUILD_SELECT,
        ({ systemType }) => this.beginPlacement(systemType),
      ),
      gameEvents.on<void>(GAME_EVENTS.BUILD_CANCEL, () =>
        this.cancelPlacement(),
      ),
      gameEvents.on<BuildDropPayload>(GAME_EVENTS.BUILD_DROP, (payload) =>
        this.handleBuildDrop(payload),
      ),
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const unsubscribe of this.unsubscribers) {
        unsubscribe();
      }
    });
  }

  private drawPastelWorld(): void {
    const sky = this.add.graphics();
    sky.fillStyle(0xeaf6e7, 1);
    sky.fillRect(0, 0, WIDTH, 145);
    sky.fillStyle(COLORS.cream, 1);
    sky.fillRect(0, 145, WIDTH, HEIGHT - 145);

    sky.fillStyle(0xffffff, 0.78);
    sky.fillEllipse(120, 68, 180, 58);
    sky.fillCircle(75, 56, 38);
    sky.fillCircle(130, 42, 48);
    sky.fillCircle(178, 58, 34);
    sky.fillEllipse(1040, 74, 170, 55);
    sky.fillCircle(995, 58, 35);
    sky.fillCircle(1042, 45, 45);
    sky.fillCircle(1086, 60, 31);

    sky.fillStyle(COLORS.grass, 0.9);
    sky.fillEllipse(100, 660, 450, 165);
    sky.fillEllipse(1080, 660, 520, 180);

    const dots = this.add.graphics();
    for (let index = 0; index < 50; index += 1) {
      dots.fillStyle(index % 3 === 0 ? COLORS.purple : COLORS.mint, 0.16);
      dots.fillCircle(
        35 + ((index * 97) % 1130),
        175 + ((index * 61) % 385),
        index % 5 === 0 ? 3 : 2,
      );
    }
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
            GRID.cellWidth - 12,
            GRID.cellHeight - 12,
            COLORS.paper,
            0.68,
          )
          .setStrokeStyle(2, COLORS.grid, 0.52)
          .setDepth(1)
          .setInteractive({ useHandCursor: true });

        rectangle.on("pointerover", () => {
          if (this.activeBuildType && !this.isOccupied(position)) {
            rectangle.setFillStyle(0xe6f7ef, 1);
            rectangle.setStrokeStyle(4, COLORS.mint, 1);
          }
        });
        rectangle.on("pointerout", () => this.styleGridCell(position));
        rectangle.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
          if (
            pointer.button === 0 &&
            this.activeBuildType &&
            !this.isOccupied(position)
          ) {
            this.requestPlacement(this.activeBuildType, position);
          }
        });
        this.gridCells.push({ position, center, rectangle });
      }
    }
  }

  private createNodes(): void {
    this.nodes.set(
      "entry",
      this.createEntryNode(this.gridToWorld(this.architecture.nodePositions.entry)),
    );
    this.nodes.set(
      "serverA",
      this.createServerNode(
        "serverA",
        this.gridToWorld(this.architecture.nodePositions.serverA),
        "앱 서버 A",
      ),
    );
    this.nodes.set(
      "database",
      this.createDatabaseNode(
        this.gridToWorld(this.architecture.nodePositions.database),
      ),
    );
    this.nodes.set(
      "loadBalancer",
      this.createLoadBalancerNode(
        this.gridToWorld(this.architecture.nodePositions.loadBalancer),
      ),
    );
    this.nodes.set(
      "serverB",
      this.createServerNode(
        "serverB",
        this.gridToWorld(this.architecture.nodePositions.serverB),
        "앱 서버 B",
      ),
    );
  }

  private createEntryNode(position: Phaser.Math.Vector2): NodeView {
    const container = this.add.container(position.x, position.y).setDepth(6);
    const shadow = this.add.ellipse(0, 37, 70, 18, 0x796f61, 0.12);
    const body = this.add.circle(0, 0, 31, 0xd8f2e8);
    body.setStrokeStyle(4, COLORS.mint);
    const arrow = this.add
      .text(0, -5, "→", {
        color: "#4c9f87",
        fontFamily: "Arial",
        fontSize: "26px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const face = this.add
      .text(0, 15, "•ᴗ•", {
        color: "#578779",
        fontFamily: "Trebuchet MS",
        fontSize: "9px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const label = this.createNodeLabel("트래픽 입구", 0, 50);
    container.add([shadow, body, arrow, face, label]);
    this.makeConnectable(container, "entry");
    return { id: "entry", container, face };
  }

  private createServerNode(
    id: "serverA" | "serverB",
    position: Phaser.Math.Vector2,
    title: string,
  ): NodeView {
    const container = this.add.container(position.x, position.y).setDepth(6);
    const pressure = this.add.graphics();
    const shadow = this.add.ellipse(0, 38, 76, 18, 0x796f61, 0.12);
    const body = this.add.graphics();
    body.fillStyle(0xddeafe, 1);
    body.fillRoundedRect(-33, -31, 66, 62, 17);
    body.lineStyle(4, COLORS.blue, 1);
    body.strokeRoundedRect(-33, -31, 66, 62, 17);
    body.fillStyle(0xbdd8f6, 1);
    body.fillRoundedRect(-22, -14, 44, 25, 7);
    const face = this.add
      .text(0, -19, "•ᴗ•", {
        color: "#587ba1",
        fontFamily: "Trebuchet MS",
        fontSize: "10px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const rack = this.add.graphics();
    for (let row = 0; row < 2; row += 1) {
      rack.fillStyle(0x8fbbe9, 1);
      rack.fillRoundedRect(-17, -5 + row * 11, 34, 7, 2);
      rack.fillStyle(COLORS.green, 1);
      rack.fillCircle(-12, -2 + row * 11, 1.7);
    }
    const label = this.createNodeLabel(title, 0, 48);
    const queueText = this.add
      .text(0, 62, "대기 0", {
        color: "#7f8290",
        fontFamily: "Trebuchet MS",
        fontSize: "9px",
        fontStyle: "bold",
        backgroundColor: "#fffdf8",
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5);
    container.add([pressure, shadow, body, face, rack, label, queueText]);
    this.makeConnectable(container, id);
    return { id, container, pressure, queueText, face };
  }

  private createLoadBalancerNode(position: Phaser.Math.Vector2): NodeView {
    const container = this.add.container(position.x, position.y).setDepth(6);
    const shadow = this.add.ellipse(0, 37, 72, 18, 0x796f61, 0.12);
    const body = this.add.graphics();
    body.fillStyle(0xeee7fb, 1);
    body.fillRoundedRect(-31, -31, 62, 62, 18);
    body.lineStyle(4, COLORS.purple, 1);
    body.strokeRoundedRect(-31, -31, 62, 62, 18);
    const icon = this.add
      .text(0, -4, "↗↘", {
        color: "#7662af",
        fontFamily: "Arial",
        fontSize: "20px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const face = this.add
      .text(0, 17, "•ᴗ•", {
        color: "#78689f",
        fontFamily: "Trebuchet MS",
        fontSize: "9px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const label = this.createNodeLabel("로드밸런서", 0, 49);
    container.add([shadow, body, icon, face, label]);
    this.makeConnectable(container, "loadBalancer");
    return { id: "loadBalancer", container, face };
  }

  private createDatabaseNode(position: Phaser.Math.Vector2): NodeView {
    const container = this.add.container(position.x, position.y).setDepth(6);
    const shadow = this.add.ellipse(0, 39, 72, 18, 0x796f61, 0.12);
    const body = this.add.rectangle(0, 2, 54, 48, 0xffe8a4);
    body.setStrokeStyle(4, COLORS.yellow);
    const top = this.add.ellipse(0, -21, 54, 20, 0xffefb9);
    top.setStrokeStyle(4, COLORS.yellow);
    const bottom = this.add.ellipse(0, 25, 54, 18, 0xffe8a4);
    bottom.setStrokeStyle(4, COLORS.yellow);
    const face = this.add
      .text(0, 3, "•‿•", {
        color: "#9a7a2d",
        fontFamily: "Trebuchet MS",
        fontSize: "10px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const label = this.createNodeLabel("데이터베이스", 0, 53);
    container.add([shadow, body, bottom, top, face, label]);
    this.makeConnectable(container, "database");
    return { id: "database", container, face };
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
        fontSize: "10px",
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
      if (
        (pointer.button === 2 || pointer.rightButtonDown()) &&
        !this.isWaveRunning &&
        this.isNodeActive(nodeId)
      ) {
        this.nodeGesture = {
          nodeId,
          startX: pointer.worldX,
          startY: pointer.worldY,
          dragged: false,
        };
        this.statusText.setText(
          "다른 장비에 놓으면 연결 · 빈 격자에 놓으면 이동",
        );
      }
    });
  }

  private bindPointerDrawing(): void {
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
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
      this.previewGraphics.lineStyle(7, COLORS.mint, 0.78);
      this.previewGraphics.lineBetween(
        source.x,
        source.y,
        pointer.worldX,
        pointer.worldY,
      );
      const gridPosition = this.worldToGrid(pointer.worldX, pointer.worldY);
      const nextMoveTarget =
        gridPosition &&
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
      if (!this.nodeGesture) {
        return;
      }
      const gesture = this.nodeGesture;
      const source = gesture.nodeId;
      const target = this.findNodeAt(pointer.worldX, pointer.worldY, source);
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
        gameEvents.emit(GAME_EVENTS.CONNECTION_REQUEST, {
          from: resolution.from,
          to: resolution.to,
        });
        this.statusText.setText(
          "경로를 연결했어요! 같은 선을 다시 그리면 제거됩니다",
        );
      } else if (resolution.type === "move") {
        gameEvents.emit(GAME_EVENTS.NODE_MOVE_REQUEST, {
          nodeId: resolution.nodeId,
          position: resolution.position,
        });
        this.statusText.setText("장비 위치를 옮겼습니다");
      } else {
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
        "우클릭: 정보 · 우클릭 드래그: 연결 또는 이동",
        {
        color: "#676975",
        fontFamily: "Trebuchet MS",
        fontSize: "13px",
        fontStyle: "bold",
        },
      )
      .setOrigin(0.5)
      .setDepth(21);
  }

  private applyArchitecture(playBuildEffect: boolean): void {
    const loadBalancer = this.nodes.get("loadBalancer")!;
    const serverB = this.nodes.get("serverB")!;
    for (const [nodeId, node] of this.nodes) {
      const position = this.gridToWorld(
        this.architecture.nodePositions[nodeId],
      );
      node.container.setPosition(position.x, position.y);
    }
    loadBalancer.container.setVisible(this.architecture.hasLoadBalancer);
    serverB.container.setVisible(this.architecture.serverCount === 2);
    this.drawConnections();
    this.refreshGrid();
    if (playBuildEffect) {
      const target =
        this.architecture.serverCount === 2 &&
        serverB.container.visible &&
        serverB.container.scaleX === 1
          ? serverB.container
          : loadBalancer.container;
      this.playBuildPop(target);
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
      this.pathGraphics.lineStyle(13, COLORS.path, 0.62);
      this.pathGraphics.lineBetween(from.x, from.y, to.x, to.y);
      this.pathGraphics.lineStyle(6, COLORS.mint, 0.9);
      this.pathGraphics.lineBetween(from.x, from.y, to.x, to.y);
      this.pathGraphics.fillStyle(0xffffff, 0.75);
      for (let step = 0.22; step < 1; step += 0.22) {
        this.pathGraphics.fillCircle(
          Phaser.Math.Linear(from.x, to.x, step),
          Phaser.Math.Linear(from.y, to.y, step),
          2.5,
        );
      }
    }
  }

  private beginPlacement(systemType: BuildSystemType): void {
    if (this.isWaveRunning) {
      return;
    }
    this.activeBuildType = systemType;
    this.statusText.setText("초록색 격자 칸을 골라 장비를 놓아 주세요");
    this.refreshGrid();
  }

  private cancelPlacement(): void {
    this.activeBuildType = null;
    this.refreshGrid();
  }

  private handleBuildDrop(payload: BuildDropPayload): void {
    const position = this.worldToGrid(payload.x, payload.y);
    if (!position || this.isOccupied(position)) {
      this.statusText.setText("비어 있는 격자 칸에 놓아 주세요");
      this.cameras.main.shake(100, 0.002);
      return;
    }
    this.requestPlacement(payload.systemType, position);
  }

  private requestPlacement(
    systemType: BuildSystemType,
    position: GridPosition,
  ): void {
    gameEvents.emit(GAME_EVENTS.SYSTEM_PLACEMENT_REQUEST, {
      systemType,
      position,
    });
    this.activeBuildType = null;
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
    const occupied = this.isOccupied(position);
    const isMoveTarget =
      this.moveTargetPosition?.column === position.column &&
      this.moveTargetPosition?.row === position.row;
    const active = (Boolean(this.activeBuildType) && !occupied) || isMoveTarget;
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
            ? "모든 트래픽을 안전하게 보냈어요!"
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
      .text(WIDTH / 2, HEIGHT / 2, `웨이브 ${waveId}\n3`, {
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
      text.setText(`웨이브 ${waveId}\n${value}`);
      text.setScale(0.7);
      await this.tweenPromise({
        targets: text,
        scale: 1,
        duration: 210,
        ease: "Back.Out",
      });
      await this.wait(180);
    }
    text.setText("출발!");
    await this.wait(180);
    curtain.destroy();
    text.destroy();
  }

  private presentEvent(event: TrafficEvent): void {
    if (event.type === "spawned") {
      this.spawnRequest(event.requestId);
      return;
    }
    if (event.serverId !== undefined) {
      this.updateServerState(
        event.serverId,
        event.queueLength ?? 0,
        event.activeCount ?? 0,
      );
    }
    if (event.type === "routed" && event.serverId !== undefined) {
      this.routeRequest(event.requestId, event.serverId);
    } else if (event.type === "queued" && event.serverId !== undefined) {
      this.queueRequest(event.requestId, event.serverId, event.queueLength ?? 1);
      this.progress.queueByServer[event.serverId] = event.queueLength ?? 0;
      this.emitProgress();
    } else if (event.type === "started" && event.serverId !== undefined) {
      this.processRequest(event.requestId, event.serverId);
      this.progress.queueByServer[event.serverId] = event.queueLength ?? 0;
      this.emitProgress();
    } else if (event.type === "completed") {
      this.completeRequest(event.requestId);
      this.progress.completed += 1;
      this.emitProgress();
    } else if (event.type === "dropped" || event.type === "timed_out") {
      this.failRequest(event.requestId);
      this.progress.failed += 1;
      this.emitProgress();
    }
  }

  private spawnRequest(requestId: number): void {
    const entry = this.getNodePosition("entry");
    const colors = [COLORS.blue, COLORS.mint, COLORS.purple, COLORS.yellow];
    const color = colors[requestId % colors.length];
    const container = this.add.container(entry.x, entry.y).setDepth(12);
    const glow = this.add.circle(0, 0, 15, color, 0.18);
    const body = this.add.circle(0, 0, 8, color, 1);
    body.setStrokeStyle(3, 0xffffff, 1);
    const face = this.add
      .text(0, 0, "•", {
        color: "#ffffff",
        fontFamily: "Arial",
        fontSize: "8px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    container.add([glow, body, face]);
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
    void this.moveAlongPoints(request, points.slice(1), 165);
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
      duration: 150,
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
      duration: 150,
    });
  }

  private completeRequest(requestId: number): void {
    const request = this.requestViews.get(requestId);
    if (!request) {
      return;
    }
    const database = this.getNodePosition("database");
    request.setAlpha(1).setScale(0.75);
    this.tweens.add({
      targets: request,
      x: database.x,
      y: database.y,
      duration: 240,
      onComplete: () => {
        this.tweens.add({
          targets: request,
          x: WIDTH + 20,
          alpha: 0,
          duration: 220,
          onComplete: () => this.destroyRequest(requestId),
        });
      },
    });
  }

  private failRequest(requestId: number): void {
    const request = this.requestViews.get(requestId);
    if (!request) {
      return;
    }
    request.add(
      this.add
        .text(0, -18, "!", {
          color: "#e25f73",
          fontFamily: "Arial",
          fontSize: "14px",
          fontStyle: "bold",
        })
        .setOrigin(0.5),
    );
    this.tweens.add({
      targets: request,
      y: request.y + 30,
      alpha: 0,
      angle: 25,
      duration: 280,
      onComplete: () => this.destroyRequest(requestId),
    });
  }

  private updateServerState(
    serverId: number,
    queueLength: number,
    activeCount: number,
  ): void {
    const node = this.nodes.get(serverId === 0 ? "serverA" : "serverB");
    if (!node?.pressure || !node.queueText || !node.face) {
      return;
    }
    const pressure = Math.min(
      1,
      (queueLength / 7) * 0.75 + (activeCount / 2) * 0.25,
    );
    node.queueText.setText(`대기 ${queueLength}`);
    node.face.setText(
      pressure >= 0.85 ? "×︵×" : pressure >= 0.6 ? "•△•" : "•ᴗ•",
    );
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
    return { column, row };
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
    if (nodeId === "loadBalancer") {
      return this.architecture.hasLoadBalancer;
    }
    if (nodeId === "serverB") {
      return this.architecture.serverCount === 2;
    }
    return true;
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

  private emitProgress(): void {
    gameEvents.emit(GAME_EVENTS.WAVE_PROGRESS, {
      metrics: {
        completed: this.progress.completed,
        failed: this.progress.failed,
        queueByServer: [...this.progress.queueByServer] as [number, number],
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
    };
    this.updateServerState(0, 0, 0);
    this.updateServerState(1, 0, 0);
    this.emitProgress();
  }

  private resetWorld(): void {
    this.isWaveRunning = false;
    this.nodeGesture = null;
    this.moveTargetPosition = null;
    this.previewGraphics.clear();
    this.resetTraffic();
    this.applyArchitecture(false);
    this.statusText.setText(
      "우클릭: 정보 · 우클릭 드래그: 연결 또는 이동",
    );
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
