import type {
  RequestOperation,
  WaveDefinition,
} from "../campaign/campaignData";

export type BuildSystemType =
  | "ec2"
  | "apache"
  | "apiGateway"
  | "sqs"
  | "eks"
  | "rdsPrimary"
  | "nlb"
  | "cognito"
  | "rdsReplica"
  | "redis"
  | "alb"
  | "waf"
  | "lambda"
  | "ecs"
  | "documentDb"
  | "kafka"
  | "dynamoDb"
  | "s3"
  | "route53"
  | "shield";

export type MaintenanceItemType =
  | "emergencyMaintenance"
  | "extendedMaintenance"
  | "additionalMaintenance";

export type ShopItemType = BuildSystemType | MaintenanceItemType;

export type NodeCategory =
  | "server"
  | "database"
  | "loadBalancer"
  | "queue"
  | "security"
  | "cache"
  | "storage";

export type AugmentType =
  | "serverRam"
  | "serverCpu"
  | "autoScaler"
  | "dbQuery"
  | "dbStorage"
  | "dbSharding"
  | "dax"
  | "lbBackends"
  | "lbAlgorithm"
  | "lbHealth"
  | "queuePartitions"
  | "queueConsumers"
  | "cacheHitRate"
  | "securityRules"
  | "scrubbing"
  | "storageThroughput";

export interface NodeInstance {
  id: string;
  type: BuildSystemType;
  starLevel: 1 | 2 | 3;
  augment?: AugmentType;
  modules?: BuildSystemType[];
}

export interface ArchitecturePerformance {
  serverConcurrency: number;
  serverQueueCapacity: number;
  serverProcessingMultiplier: number;
  databaseConcurrency: number;
  databaseQueueCapacity: number;
  databaseProcessingMultiplier: number;
  responseMultiplier: number;
  loadBalancerBackendLimit: number;
}

export const DEFAULT_ARCHITECTURE_PERFORMANCE: ArchitecturePerformance = {
  serverConcurrency: 2,
  serverQueueCapacity: 6,
  serverProcessingMultiplier: 1,
  databaseConcurrency: 2,
  databaseQueueCapacity: 8,
  databaseProcessingMultiplier: 1,
  responseMultiplier: 1,
  loadBalancerBackendLimit: 2,
};

export type ArchitectureNodeId =
  | "entry"
  | "exit"
  | "loadBalancer"
  | "serverA"
  | "serverB"
  | "database";

export interface GridPosition {
  column: number;
  row: number;
}

export interface BoardRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ArchitectureConnection {
  from: ArchitectureNodeId;
  to: ArchitectureNodeId;
}

export type LinkLevel = 1 | 2 | 3;
export type BoardLevel = 1 | 2 | 3;
export type ConnectionKind = "traffic" | "data";
export type ConnectionFlow = "request" | "response" | "duplex" | "data";

export interface LinkTier {
  level: LinkLevel;
  maxEdgeCells: number;
  totalCells: number;
  upgradeCost: number | null;
}

export interface BoardTier {
  level: BoardLevel;
  columns: number;
  rows: number;
  width: number;
  height: number;
  upgradeCost: number | null;
}

export interface ConnectionValidation {
  valid: boolean;
  reason: string;
  kind?: ConnectionKind;
  length?: number;
}

export type ArchitectureNodePositions = Partial<
  Record<ArchitectureNodeId, GridPosition>
>;

export const BOARD_WORLD_CENTER = { x: 600, y: 380 } as const;
export const NODE_WORLD_RADIUS = 72;
export const LINK_DISTANCE_UNIT = 110;

export const FIXED_ENTRY_POSITION: GridPosition = { column: 320, row: 280 };
export const FIXED_EXIT_POSITION: GridPosition = { column: 880, row: 280 };

export const DEFAULT_NODE_POSITIONS: ArchitectureNodePositions = {
  entry: FIXED_ENTRY_POSITION,
  exit: FIXED_EXIT_POSITION,
  loadBalancer: { column: 600, row: 240 },
  serverA: { column: 470, row: 380 },
  serverB: { column: 730, row: 380 },
  database: { column: 600, row: 520 },
};

export interface ArchitectureConfig {
  serverCount: 0 | 1 | 2;
  hasLoadBalancer: boolean;
  hasDatabase: boolean;
  databaseIndexed: boolean;
  linkLevel: LinkLevel;
  boardLevel: BoardLevel;
  nodePositions: ArchitectureNodePositions;
  connections: ArchitectureConnection[];
  boardSlots: {
    loadBalancer: string | null;
    serverA: string | null;
    serverB: string | null;
    database: string | null;
  };
  performance?: ArchitecturePerformance;
}

export const LINK_TIERS: readonly LinkTier[] = [
  { level: 1, maxEdgeCells: 4, totalCells: 8, upgradeCost: 60 },
  { level: 2, maxEdgeCells: 6, totalCells: 22, upgradeCost: 100 },
  { level: 3, maxEdgeCells: 9, totalCells: 36, upgradeCost: null },
] as const;

export const BOARD_TIERS: readonly BoardTier[] = [
  { level: 1, columns: 7, rows: 4, width: 760, height: 390, upgradeCost: 90 },
  { level: 2, columns: 10, rows: 5, width: 980, height: 500, upgradeCost: 140 },
  { level: 3, columns: 13, rows: 6, width: 1160, height: 610, upgradeCost: null },
] as const;

export const NODE_PORT_LIMITS: Readonly<
  Record<ArchitectureNodeId, Record<ConnectionKind, number>>
> = {
  entry: { traffic: 1, data: 0 },
  exit: { traffic: 1, data: 0 },
  loadBalancer: { traffic: 4, data: 0 },
  serverA: { traffic: 2, data: 1 },
  serverB: { traffic: 1, data: 1 },
  database: { traffic: 0, data: 2 },
} as const;

export function getLinkTier(level: LinkLevel): LinkTier {
  return LINK_TIERS[level - 1] ?? LINK_TIERS[0];
}

export function getBoardTier(level: BoardLevel): BoardTier {
  return BOARD_TIERS[level - 1] ?? BOARD_TIERS[0];
}

export function isGridPositionAvailable(
  architecture: ArchitectureConfig,
  position: GridPosition,
): boolean {
  const rect = getBoardBounds(architecture.boardLevel);
  return (
    position.column >= rect.left + NODE_WORLD_RADIUS &&
    position.column <= rect.left + rect.width - NODE_WORLD_RADIUS &&
    position.row >= rect.top + NODE_WORLD_RADIUS &&
    position.row <= rect.top + rect.height - NODE_WORLD_RADIUS
  );
}

export function getBoardBounds(level: BoardLevel): BoardRect {
  const tier = getBoardTier(level);
  return {
    left: BOARD_WORLD_CENTER.x - tier.width / 2,
    top: BOARD_WORLD_CENTER.y - tier.height / 2,
    width: tier.width,
    height: tier.height,
  };
}

export function getNodeDistance(
  architecture: ArchitectureConfig,
  left: ArchitectureNodeId,
  right: ArchitectureNodeId,
): number {
  const from = architecture.nodePositions[left];
  const to = architecture.nodePositions[right];
  if (!from || !to) {
    return 0;
  }
  return Math.hypot(from.column - to.column, from.row - to.row);
}

export function getConnectionLength(
  architecture: ArchitectureConfig,
  connection: ArchitectureConnection,
): number {
  const distance = getNodeDistance(
    architecture,
    connection.from,
    connection.to,
  );
  return Math.max(1, Math.ceil(distance / LINK_DISTANCE_UNIT));
}

export function getTotalConnectionCells(
  architecture: ArchitectureConfig,
): number {
  return architecture.connections.reduce(
    (total, connection) =>
      total + getConnectionLength(architecture, connection),
    0,
  );
}

function isServer(nodeId: ArchitectureNodeId): boolean {
  return nodeId === "serverA" || nodeId === "serverB";
}

export function getConnectionKind(
  left: ArchitectureNodeId,
  right: ArchitectureNodeId,
): ConnectionKind | null {
  if (
    (isServer(left) && right === "database") ||
    (left === "database" && isServer(right))
  ) {
    return "data";
  }
  if (
    (left === "entry" &&
      (right === "loadBalancer" || right === "serverA")) ||
    (right === "entry" &&
      (left === "loadBalancer" || left === "serverA")) ||
    (left === "exit" &&
      (right === "loadBalancer" || right === "serverA")) ||
    (right === "exit" &&
      (left === "loadBalancer" || left === "serverA")) ||
    (left === "loadBalancer" && isServer(right)) ||
    (right === "loadBalancer" && isServer(left))
  ) {
    return "traffic";
  }
  return null;
}

export function getConnectionFlow(
  left: ArchitectureNodeId,
  right: ArchitectureNodeId,
): ConnectionFlow | null {
  const kind = getConnectionKind(left, right);
  if (kind === "data") {
    return "data";
  }
  if (left === "entry" || right === "entry") {
    return "request";
  }
  if (left === "exit" || right === "exit") {
    return "response";
  }
  if (kind === "traffic") {
    return "duplex";
  }
  return null;
}

export function getNodePortUsage(
  architecture: ArchitectureConfig,
  nodeId: ArchitectureNodeId,
): Record<ConnectionKind, number> {
  return architecture.connections.reduce(
    (usage, connection) => {
      if (connection.from !== nodeId && connection.to !== nodeId) {
        return usage;
      }
      const kind = getConnectionKind(connection.from, connection.to);
      if (kind) {
        usage[kind] += 1;
      }
      return usage;
    },
    { traffic: 0, data: 0 },
  );
}

function validatePortUsage(
  architecture: ArchitectureConfig,
): ConnectionValidation {
  for (const nodeId of Object.keys(NODE_PORT_LIMITS) as ArchitectureNodeId[]) {
    const usage = getNodePortUsage(architecture, nodeId);
    for (const kind of ["traffic", "data"] as const) {
      const limit = NODE_PORT_LIMITS[nodeId][kind];
      if (usage[kind] > limit) {
        const label = kind === "traffic" ? "트래픽" : "데이터";
        return {
          valid: false,
          reason: `${nodeId}의 ${label} 포트는 ${limit}개까지만 연결할 수 있습니다.`,
          kind,
        };
      }
    }
  }
  return { valid: true, reason: "연결 가능" };
}

export function validateArchitectureConnections(
  architecture: ArchitectureConfig,
): ConnectionValidation {
  const tier = getLinkTier(architecture.linkLevel);
  for (const connection of architecture.connections) {
    const kind = getConnectionKind(connection.from, connection.to);
    if (!kind) {
      return {
        valid: false,
        reason: "이 장비 조합은 직접 연결할 수 없습니다.",
      };
    }
    if (
      !architecture.nodePositions[connection.from] ||
      !architecture.nodePositions[connection.to]
    ) {
      return {
        valid: false,
        reason: "배치되지 않은 장비는 연결할 수 없습니다.",
      };
    }
    if (
      !isGridPositionAvailable(
        architecture,
        architecture.nodePositions[connection.from]!,
      ) ||
      !isGridPositionAvailable(
        architecture,
        architecture.nodePositions[connection.to]!,
      )
    ) {
      return {
        valid: false,
        reason: "현재 보드 영역 밖의 장비는 링크를 사용할 수 없습니다.",
      };
    }
    const length = getConnectionLength(architecture, connection);
    if (length > tier.maxEdgeCells) {
      return {
        valid: false,
        reason: `LINK LV.${tier.level}의 링크 하나는 최대 ${tier.maxEdgeCells}칸입니다.`,
        kind,
        length,
      };
    }
  }
  const totalCells = getTotalConnectionCells(architecture);
  if (totalCells > tier.totalCells) {
    return {
      valid: false,
      reason: `LINK LV.${tier.level}의 전체 링크 용량은 ${tier.totalCells}칸입니다.`,
    };
  }
  return validatePortUsage(architecture);
}

export function validateNewConnection(
  architecture: ArchitectureConfig,
  from: ArchitectureNodeId,
  to: ArchitectureNodeId,
): ConnectionValidation {
  if (from === to) {
    return { valid: false, reason: "같은 장비끼리는 연결할 수 없습니다." };
  }
  if (!architecture.nodePositions[from] || !architecture.nodePositions[to]) {
    return {
      valid: false,
      reason: "배치되지 않은 장비는 연결할 수 없습니다.",
    };
  }
  if (
    !isGridPositionAvailable(architecture, architecture.nodePositions[from]!) ||
    !isGridPositionAvailable(architecture, architecture.nodePositions[to]!)
  ) {
    return {
      valid: false,
      reason: "보드를 확장해야 이 위치의 장비를 연결할 수 있습니다.",
    };
  }
  const kind = getConnectionKind(from, to);
  if (!kind) {
    return {
      valid: false,
      reason: "허용되지 않은 연결입니다. 트래픽 경로와 DB 경로를 확인하세요.",
    };
  }
  const candidate: ArchitectureConfig = {
    ...architecture,
    connections: [...architecture.connections, { from, to }],
  };
  const validation = validateArchitectureConnections(candidate);
  return {
    ...validation,
    kind,
    length: getConnectionLength(candidate, { from, to }),
  };
}

export function isArchitectureNodePlaced(
  architecture: ArchitectureConfig,
  nodeId: ArchitectureNodeId,
): boolean {
  return architecture.nodePositions[nodeId] !== undefined;
}

export type TrafficEventType =
  | "spawned"
  | "routed"
  | "server_queued"
  | "server_started"
  | "database_routed"
  | "database_queued"
  | "database_started"
  | "database_completed"
  | "response_started"
  | "completed"
  | "dropped"
  | "timed_out";

export interface TrafficEvent {
  at: number;
  requestId: number;
  type: TrafficEventType;
  operation?: RequestOperation;
  serverId?: number;
  serverQueueLength?: number;
  serverActiveCount?: number;
  databaseQueueLength?: number;
  databaseActiveCount?: number;
}

export interface ServerMetrics {
  serverId: number;
  handled: number;
  peakQueue: number;
  peakActive: number;
}

export interface DatabaseMetrics {
  handled: number;
  reads: number;
  writes: number;
  slowReads: number;
  peakQueue: number;
  peakActive: number;
}

export interface WaveMetrics {
  total: number;
  completed: number;
  readCompleted: number;
  writeCompleted: number;
  dropped: number;
  timedOut: number;
  failed: number;
  successRate: number;
  averageLatencyMs: number;
  durationMs: number;
  peakServerQueue: number;
  peakDatabaseQueue: number;
  earnedCoins: number;
  passed: boolean;
}

export type BottleneckNode = "route" | "server" | "database" | "none";

export interface WaveSimulationResult {
  wave: WaveDefinition;
  architecture: ArchitectureConfig;
  events: TrafficEvent[];
  servers: ServerMetrics[];
  database: DatabaseMetrics;
  metrics: WaveMetrics;
  bottleneckNode: BottleneckNode;
  bottleneck: string;
}

interface RequestState {
  id: number;
  spawnAt: number;
  serverId: number;
  operation: RequestOperation;
  remainingMs: number;
}

interface PendingRequest {
  request: RequestState;
  arriveAt: number;
}

interface ResponseState {
  request: RequestState;
  completeAt: number;
}

interface ServerRoutePlan {
  serverId: number;
  nodeId: "serverA" | "serverB";
  requestPath: ArchitectureNodeId[] | null;
  databasePath: ArchitectureNodeId[] | null;
  responsePath: ArchitectureNodeId[] | null;
}

interface ServerState {
  id: number;
  active: RequestState[];
  queue: RequestState[];
  handled: number;
  peakQueue: number;
  peakActive: number;
}

interface DatabaseState {
  active: RequestState[];
  queue: RequestState[];
  handled: number;
  reads: number;
  writes: number;
  slowReads: number;
  peakQueue: number;
  peakActive: number;
}

const TICK_MS = 100;
const SERVER_PROCESSING_MS = 1_200;
const DATABASE_QUEUE_CAPACITY = 8;
const DATABASE_INDEXED_QUEUE_CAPACITY = 14;
const DATABASE_READ_MS = 650;
const DATABASE_WRITE_MS = 1_050;
const DATABASE_SLOW_READ_MS = 2_200;
const DATABASE_INDEXED_READ_MS = 380;
const DATABASE_INDEXED_WRITE_MS = 820;
const DATABASE_INDEXED_SLOW_READ_MS = 850;
const LINK_TRAVEL_MS = 150;
const LINK_HANDOFF_MS = 60;
const MAX_SIMULATION_MS = 60_000;

export const SYSTEM_CATALOG: Readonly<
  Record<
    BuildSystemType,
    {
      name: string;
      description: string;
      cost: number;
      tier: number;
      category: NodeCategory;
      unlockWave: number;
      nodeId?: ArchitectureNodeId;
    }
  >
> = {
  ec2: { name: "EC2 App Server", description: "HTTPS 비즈니스 로직을 처리합니다.", cost: 4, tier: 1, category: "server", unlockWave: 1, nodeId: "serverA" },
  apache: { name: "Apache Web Server", description: "정적 리소스와 기본 웹 요청을 처리합니다.", cost: 4, tier: 1, category: "server", unlockWave: 1, nodeId: "serverB" },
  apiGateway: { name: "API Gateway", description: "요청 라우팅과 기본 인증을 담당합니다.", cost: 4, tier: 1, category: "loadBalancer", unlockWave: 1, nodeId: "loadBalancer" },
  sqs: { name: "SQS Message Queue", description: "폭주 요청을 큐에 저장해 서버를 보호합니다.", cost: 4, tier: 1, category: "queue", unlockWave: 1 },
  eks: { name: "EKS Container Node", description: "컨테이너 기반 처리 서버를 확장합니다.", cost: 12, tier: 2, category: "server", unlockWave: 1, nodeId: "serverA" },
  rdsPrimary: { name: "RDS Primary DB", description: "요청 데이터를 읽고 영구 저장합니다.", cost: 12, tier: 2, category: "database", unlockWave: 1, nodeId: "database" },
  nlb: { name: "Network Load Balancer", description: "L4 연결을 빠르게 여러 서버로 분산합니다.", cost: 12, tier: 2, category: "loadBalancer", unlockWave: 1, nodeId: "loadBalancer" },
  cognito: { name: "Cognito Auth Server", description: "사용자 인증과 권한 검증을 처리합니다.", cost: 12, tier: 2, category: "security", unlockWave: 1 },
  rdsReplica: { name: "RDS Read Replica", description: "DB 읽기 요청을 복제본으로 분산합니다.", cost: 25, tier: 3, category: "database", unlockWave: 1 },
  redis: { name: "ElastiCache Redis", description: "자주 조회되는 데이터를 메모리에서 응답합니다.", cost: 25, tier: 3, category: "cache", unlockWave: 1 },
  alb: { name: "Application Load Balancer", description: "L7 규칙으로 요청을 지능적으로 분산합니다.", cost: 25, tier: 3, category: "loadBalancer", unlockWave: 1, nodeId: "loadBalancer" },
  waf: { name: "AWS WAF", description: "악성 웹 요청을 서버 진입 전에 차단합니다.", cost: 25, tier: 3, category: "security", unlockWave: 1 },
  lambda: { name: "Lambda Serverless", description: "부하에 따라 자동 확장되는 처리 함수를 추가합니다.", cost: 50, tier: 4, category: "server", unlockWave: 1, nodeId: "serverA" },
  ecs: { name: "ECS Batch Worker", description: "대용량 비동기 작업을 별도로 처리합니다.", cost: 50, tier: 4, category: "server", unlockWave: 1, nodeId: "serverB" },
  documentDb: { name: "DocumentDB", description: "대규모 문서 데이터를 분산 저장합니다.", cost: 50, tier: 4, category: "database", unlockWave: 1, nodeId: "database" },
  kafka: { name: "MSK Kafka", description: "이벤트 스트림을 파티션 단위로 처리합니다.", cost: 50, tier: 4, category: "queue", unlockWave: 1 },
  dynamoDb: { name: "DynamoDB", description: "글로벌 규모의 NoSQL 요청을 처리합니다.", cost: 90, tier: 5, category: "database", unlockWave: 1, nodeId: "database" },
  s3: { name: "S3 Object Storage", description: "대용량 객체와 정적 콘텐츠를 저장합니다.", cost: 90, tier: 5, category: "storage", unlockWave: 1 },
  route53: { name: "Route 53 Global", description: "글로벌 DNS와 지역 라우팅을 제공합니다.", cost: 90, tier: 5, category: "loadBalancer", unlockWave: 1, nodeId: "loadBalancer" },
  shield: { name: "Shield DDoS", description: "대규모 DDoS 트래픽을 정화합니다.", cost: 90, tier: 5, category: "security", unlockWave: 1 }
} as const;

export const MAINTENANCE_CATALOG: Readonly<
  Record<
    MaintenanceItemType,
    { name: string; description: string; cost: number }
  >
> = {
  emergencyMaintenance: {
    name: "긴급점검",
    description: "서비스 운영 중 즉시 서버를 멈추고 점검시간을 엽니다.",
    cost: 12,
  },
  extendedMaintenance: {
    name: "연장점검",
    description: "이후 정기점검 시간을 10초 늘립니다.",
    cost: 12,
  },
  additionalMaintenance: {
    name: "추가점검",
    description: "긴급점검 1회와 정기점검 시간 10초를 함께 추가합니다.",
    cost: 24,
  },
};

export function isMaintenanceItem(
  item: ShopItemType,
): item is MaintenanceItemType {
  return item in MAINTENANCE_CATALOG;
}

function createSpawnTimes(wave: WaveDefinition): number[] {
  if (wave.requestCount <= 1) {
    return [0];
  }
  const interval = wave.spawnDurationMs / (wave.requestCount - 1);
  return Array.from({ length: wave.requestCount }, (_, index) =>
    Math.round(index * interval),
  );
}

export function getRequestOperation(
  wave: WaveDefinition,
  requestId: number,
): RequestOperation {
  if (wave.slowQueryEvery && requestId % wave.slowQueryEvery === 0) {
    return "slowRead";
  }
  if (wave.writeEvery && requestId % wave.writeEvery === 0) {
    return "write";
  }
  return "read";
}

export function hasDirectConnection(
  architecture: ArchitectureConfig,
  left: ArchitectureNodeId,
  right: ArchitectureNodeId,
): boolean {
  return architecture.connections.some(
    (connection) =>
      (connection.from === left && connection.to === right) ||
      (connection.from === right && connection.to === left),
  );
}

export function hasSingleServerRoute(
  architecture: ArchitectureConfig,
): boolean {
  return (
    architecture.serverCount >= 1 &&
    architecture.hasDatabase &&
    isArchitectureNodePlaced(architecture, "entry") &&
    isArchitectureNodePlaced(architecture, "exit") &&
    isArchitectureNodePlaced(architecture, "serverA") &&
    isArchitectureNodePlaced(architecture, "database") &&
    hasDirectConnection(architecture, "entry", "serverA") &&
    hasDirectConnection(architecture, "serverA", "database") &&
    hasDirectConnection(architecture, "serverA", "exit")
  );
}

export function hasBalancedRoute(
  architecture: ArchitectureConfig,
): boolean {
  return (
    architecture.hasLoadBalancer &&
    architecture.serverCount === 2 &&
    architecture.hasDatabase &&
    isArchitectureNodePlaced(architecture, "entry") &&
    isArchitectureNodePlaced(architecture, "exit") &&
    isArchitectureNodePlaced(architecture, "loadBalancer") &&
    isArchitectureNodePlaced(architecture, "serverA") &&
    isArchitectureNodePlaced(architecture, "serverB") &&
    isArchitectureNodePlaced(architecture, "database") &&
    hasDirectConnection(architecture, "entry", "loadBalancer") &&
    hasDirectConnection(architecture, "loadBalancer", "exit") &&
    hasDirectConnection(architecture, "loadBalancer", "serverA") &&
    hasDirectConnection(architecture, "loadBalancer", "serverB") &&
    hasDirectConnection(architecture, "serverA", "database") &&
    hasDirectConnection(architecture, "serverB", "database")
  );
}

function resolveRequestPath(
  architecture: ArchitectureConfig,
  nodeId: "serverA" | "serverB",
): ArchitectureNodeId[] | null {
  if (!isArchitectureNodePlaced(architecture, nodeId)) {
    return null;
  }
  if (
    architecture.hasLoadBalancer &&
    isArchitectureNodePlaced(architecture, "loadBalancer") &&
    hasDirectConnection(architecture, "entry", "loadBalancer") &&
    hasDirectConnection(architecture, "loadBalancer", nodeId)
  ) {
    return ["entry", "loadBalancer", nodeId];
  }
  if (
    nodeId === "serverA" &&
    hasDirectConnection(architecture, "entry", "serverA")
  ) {
    return ["entry", "serverA"];
  }
  return null;
}

function resolveDatabasePath(
  architecture: ArchitectureConfig,
  nodeId: "serverA" | "serverB",
): ArchitectureNodeId[] | null {
  if (
    !architecture.hasDatabase ||
    !isArchitectureNodePlaced(architecture, nodeId) ||
    !isArchitectureNodePlaced(architecture, "database") ||
    !hasDirectConnection(architecture, nodeId, "database")
  ) {
    return null;
  }
  return [nodeId, "database"];
}

function resolveResponsePath(
  architecture: ArchitectureConfig,
  nodeId: "serverA" | "serverB",
): ArchitectureNodeId[] | null {
  if (
    !isArchitectureNodePlaced(architecture, nodeId) ||
    !isArchitectureNodePlaced(architecture, "database") ||
    !hasDirectConnection(architecture, nodeId, "database")
  ) {
    return null;
  }
  if (
    architecture.hasLoadBalancer &&
    isArchitectureNodePlaced(architecture, "loadBalancer") &&
    hasDirectConnection(architecture, nodeId, "loadBalancer") &&
    hasDirectConnection(architecture, "loadBalancer", "exit")
  ) {
    return ["database", nodeId, "loadBalancer", "exit"];
  }
  if (
    nodeId === "serverA" &&
    hasDirectConnection(architecture, "serverA", "exit")
  ) {
    return ["database", "serverA", "exit"];
  }
  return null;
}

function resolveServerRoutePlans(
  architecture: ArchitectureConfig,
): ServerRoutePlan[] {
  const plans: ServerRoutePlan[] = [];
  const candidates: Array<"serverA" | "serverB"> = ["serverA", "serverB"];

  for (const nodeId of candidates) {
    if (!isArchitectureNodePlaced(architecture, nodeId)) {
      continue;
    }
    plans.push({
      serverId: plans.length,
      nodeId,
      requestPath: resolveRequestPath(architecture, nodeId),
      databasePath: resolveDatabasePath(architecture, nodeId),
      responsePath: resolveResponsePath(architecture, nodeId),
    });
  }

  return plans;
}

function selectServer(
  plans: ServerRoutePlan[],
  requestId: number,
): ServerRoutePlan {
  return plans[requestId % plans.length] ?? plans[0];
}

function getLinkTransitMs(
  architecture: ArchitectureConfig,
  from: ArchitectureNodeId,
  to: ArchitectureNodeId,
): number {
  return getConnectionLength(architecture, { from, to }) * LINK_TRAVEL_MS;
}

function getPathTransitMs(
  architecture: ArchitectureConfig,
  path: ArchitectureNodeId[],
): number {
  if (path.length < 2) {
    return 0;
  }
  let duration = 0;
  for (let index = 0; index < path.length - 1; index += 1) {
    duration += getLinkTransitMs(
      architecture,
      path[index],
      path[index + 1],
    );
    if (index < path.length - 2) {
      duration += LINK_HANDOFF_MS;
    }
  }
  return duration;
}

function getDatabaseProcessingMs(
  operation: RequestOperation,
  indexed: boolean,
  multiplier = 1,
): number {
  let duration: number;
  if (indexed) {
    if (operation === "write") {
      duration = DATABASE_INDEXED_WRITE_MS;
    } else {
      duration =
        operation === "slowRead"
          ? DATABASE_INDEXED_SLOW_READ_MS
          : DATABASE_INDEXED_READ_MS;
    }
  } else if (operation === "write") {
    duration = DATABASE_WRITE_MS;
  } else {
    duration =
      operation === "slowRead"
        ? DATABASE_SLOW_READ_MS
        : DATABASE_READ_MS;
  }
  return Math.max(TICK_MS, Math.round(duration * multiplier));
}

function createEmptyDatabaseMetrics(): DatabaseMetrics {
  return {
    handled: 0,
    reads: 0,
    writes: 0,
    slowReads: 0,
    peakQueue: 0,
    peakActive: 0,
  };
}

function createNoRouteResult(
  wave: WaveDefinition,
  architecture: ArchitectureConfig,
): WaveSimulationResult {
  const events = createSpawnTimes(wave).flatMap((at, index) => {
    const requestId = index + 1;
    const operation = getRequestOperation(wave, requestId);
    return [
      { at, requestId, type: "spawned" as const, operation },
      {
        at: at + 500,
        requestId,
        type: "dropped" as const,
        operation,
      },
    ];
  });
  return {
    wave,
    architecture,
    events,
    servers: [],
    database: createEmptyDatabaseMetrics(),
    metrics: {
      total: wave.requestCount,
      completed: 0,
      readCompleted: 0,
      writeCompleted: 0,
      dropped: wave.requestCount,
      timedOut: 0,
      failed: wave.requestCount,
      successRate: 0,
      averageLatencyMs: 0,
      durationMs: wave.spawnDurationMs + 500,
      peakServerQueue: 0,
      peakDatabaseQueue: 0,
      earnedCoins: 10,
      passed: false,
    },
    bottleneckNode: "route",
      bottleneck:
      "요청·응답 경로가 완성되지 않았습니다. 상단 입구와 출구, App Server, Primary DB를 링크로 연결하세요.",
  };
}

function startServerRequest(
  server: ServerState,
  request: RequestState,
  at: number,
  events: TrafficEvent[],
  processingMultiplier: number,
): void {
  request.remainingMs = Math.max(
    TICK_MS,
    Math.round(SERVER_PROCESSING_MS * processingMultiplier),
  );
  server.active.push(request);
  server.peakActive = Math.max(server.peakActive, server.active.length);
  events.push({
    at,
    requestId: request.id,
    type: "server_started",
    operation: request.operation,
    serverId: server.id,
    serverQueueLength: server.queue.length,
    serverActiveCount: server.active.length,
  });
}

function startDatabaseRequest(
  database: DatabaseState,
  request: RequestState,
  indexed: boolean,
  at: number,
  events: TrafficEvent[],
  processingMultiplier: number,
): void {
  request.remainingMs = getDatabaseProcessingMs(
    request.operation,
    indexed,
    processingMultiplier,
  );
  database.active.push(request);
  database.peakActive = Math.max(database.peakActive, database.active.length);
  events.push({
    at,
    requestId: request.id,
    type: "database_started",
    operation: request.operation,
    serverId: request.serverId,
    databaseQueueLength: database.queue.length,
    databaseActiveCount: database.active.length,
  });
}

function timedOut(request: RequestState, now: number, wave: WaveDefinition): boolean {
  return now - request.spawnAt > wave.deadlineMs;
}

export function simulateTrafficWave(
  wave: WaveDefinition,
  architecture: ArchitectureConfig,
): WaveSimulationResult {
  const performance = {
    ...DEFAULT_ARCHITECTURE_PERFORMANCE,
    ...architecture.performance,
  };
  const balancedRoute = hasBalancedRoute(architecture);
  const routePlans = resolveServerRoutePlans(architecture).filter(
    (plan) => plan.requestPath,
  );

  if (routePlans.length === 0) {
    return createNoRouteResult(wave, architecture);
  }

  const servers: ServerState[] = Array.from(
    routePlans,
    (plan) => ({
      id: plan.serverId,
      active: [],
      queue: [],
      handled: 0,
      peakQueue: 0,
      peakActive: 0,
    }),
  );
  const database: DatabaseState = {
    active: [],
    queue: [],
    handled: 0,
    reads: 0,
    writes: 0,
    slowReads: 0,
    peakQueue: 0,
    peakActive: 0,
  };
  const events: TrafficEvent[] = [];
  const spawnTimes = createSpawnTimes(wave);
  const pendingServer: PendingRequest[] = [];
  const pendingDatabase: PendingRequest[] = [];
  const responses: ResponseState[] = [];
  const completedLatencies: number[] = [];
  const hasMissingDatabaseRoute = routePlans.some((plan) => !plan.databasePath);
  const hasMissingResponseRoute = routePlans.some((plan) => !plan.responsePath);
  let nextRequestIndex = 0;
  let completed = 0;
  let readCompleted = 0;
  let writeCompleted = 0;
  let dropped = 0;
  let timeoutCount = 0;
  let now = 0;

  const failTimeout = (request: RequestState): void => {
    timeoutCount += 1;
    events.push({
      at: now,
      requestId: request.id,
      type: "timed_out",
      operation: request.operation,
      serverId: request.serverId,
    });
  };

  while (now <= MAX_SIMULATION_MS) {
    for (let index = responses.length - 1; index >= 0; index -= 1) {
      const response = responses[index];
      if (timedOut(response.request, now, wave)) {
        failTimeout(response.request);
        responses.splice(index, 1);
      } else if (response.completeAt <= now) {
        const { request } = response;
        completed += 1;
        if (request.operation === "write") {
          writeCompleted += 1;
        } else {
          readCompleted += 1;
        }
        completedLatencies.push(now - request.spawnAt);
        events.push({
          at: now,
          requestId: request.id,
          type: "completed",
          operation: request.operation,
          serverId: request.serverId,
        });
        responses.splice(index, 1);
      }
    }

    const databaseStillActive: RequestState[] = [];
    for (const request of database.active) {
      request.remainingMs -= TICK_MS;
      if (timedOut(request, now, wave)) {
        failTimeout(request);
      } else if (request.remainingMs <= 0) {
        database.handled += 1;
        if (request.operation === "write") {
          database.writes += 1;
        } else if (request.operation === "slowRead") {
          database.slowReads += 1;
        } else {
          database.reads += 1;
        }
        events.push({
          at: now,
          requestId: request.id,
          type: "database_completed",
          operation: request.operation,
          serverId: request.serverId,
            databaseQueueLength: database.queue.length,
            databaseActiveCount: Math.max(0, database.active.length - 1),
        });
        const plan = routePlans[request.serverId];
        if (!plan?.responsePath) {
          dropped += 1;
          events.push({
            at: now,
            requestId: request.id,
            type: "dropped",
            operation: request.operation,
            serverId: request.serverId,
          });
        } else {
          events.push({
            at: now,
            requestId: request.id,
            type: "response_started",
            operation: request.operation,
            serverId: request.serverId,
          });
          responses.push({
            request,
            completeAt:
              now +
              Math.round(
                getPathTransitMs(
                  architecture,
                  plan.responsePath,
                ) * performance.responseMultiplier,
              ),
          });
        }
      } else {
        databaseStillActive.push(request);
      }
    }
    database.active = databaseStillActive;
    database.queue = database.queue.filter((request) => {
      if (timedOut(request, now, wave)) {
        failTimeout(request);
        return false;
      }
      return true;
    });
    while (
      database.active.length < performance.databaseConcurrency &&
      database.queue.length > 0
    ) {
      const request = database.queue.shift();
      if (request) {
        startDatabaseRequest(
          database,
          request,
          architecture.databaseIndexed,
          now,
          events,
          performance.databaseProcessingMultiplier,
        );
      }
    }

    for (let index = pendingDatabase.length - 1; index >= 0; index -= 1) {
      const pending = pendingDatabase[index];
      if (timedOut(pending.request, now, wave)) {
        failTimeout(pending.request);
        pendingDatabase.splice(index, 1);
      } else if (pending.arriveAt <= now) {
        const capacity = Math.max(
          performance.databaseQueueCapacity,
          architecture.databaseIndexed
            ? DATABASE_INDEXED_QUEUE_CAPACITY
            : DATABASE_QUEUE_CAPACITY,
        );
        if (database.active.length < performance.databaseConcurrency) {
          startDatabaseRequest(
            database,
            pending.request,
            architecture.databaseIndexed,
            now,
            events,
            performance.databaseProcessingMultiplier,
          );
        } else if (database.queue.length < capacity) {
          database.queue.push(pending.request);
          database.peakQueue = Math.max(
            database.peakQueue,
            database.queue.length,
          );
          events.push({
            at: now,
            requestId: pending.request.id,
            type: "database_queued",
            operation: pending.request.operation,
            serverId: pending.request.serverId,
            databaseQueueLength: database.queue.length,
            databaseActiveCount: database.active.length,
          });
        } else {
          dropped += 1;
          events.push({
            at: now,
            requestId: pending.request.id,
            type: "dropped",
            operation: pending.request.operation,
            serverId: pending.request.serverId,
          });
        }
        pendingDatabase.splice(index, 1);
      }
    }

    for (const server of servers) {
      const stillActive: RequestState[] = [];
      for (const request of server.active) {
        request.remainingMs -= TICK_MS;
        if (timedOut(request, now, wave)) {
          failTimeout(request);
        } else if (request.remainingMs <= 0) {
          server.handled += 1;
          const plan = routePlans[server.id];
          if (!plan?.databasePath) {
            dropped += 1;
            events.push({
              at: now,
              requestId: request.id,
              type: "dropped",
              operation: request.operation,
              serverId: server.id,
            });
          } else {
            events.push({
              at: now,
              requestId: request.id,
              type: "database_routed",
              operation: request.operation,
              serverId: server.id,
              serverQueueLength: server.queue.length,
              serverActiveCount: Math.max(0, server.active.length - 1),
            });
            pendingDatabase.push({
              request,
              arriveAt:
                now +
                getPathTransitMs(
                  architecture,
                  plan.databasePath,
                ),
            });
          }
        } else {
          stillActive.push(request);
        }
      }
      server.active = stillActive;
      server.queue = server.queue.filter((request) => {
        if (timedOut(request, now, wave)) {
          failTimeout(request);
          return false;
        }
        return true;
      });
      while (
        server.active.length < performance.serverConcurrency &&
        server.queue.length > 0
      ) {
        const request = server.queue.shift();
        if (request) {
          startServerRequest(
            server,
            request,
            now,
            events,
            performance.serverProcessingMultiplier,
          );
        }
      }
    }

    for (let index = pendingServer.length - 1; index >= 0; index -= 1) {
      const pending = pendingServer[index];
      if (timedOut(pending.request, now, wave)) {
        failTimeout(pending.request);
        pendingServer.splice(index, 1);
      } else if (pending.arriveAt <= now) {
        const server = servers[pending.request.serverId];
        if (server.active.length < performance.serverConcurrency) {
          startServerRequest(
            server,
            pending.request,
            now,
            events,
            performance.serverProcessingMultiplier,
          );
        } else if (server.queue.length < performance.serverQueueCapacity) {
          server.queue.push(pending.request);
          server.peakQueue = Math.max(server.peakQueue, server.queue.length);
          events.push({
            at: now,
            requestId: pending.request.id,
            type: "server_queued",
            operation: pending.request.operation,
            serverId: server.id,
            serverQueueLength: server.queue.length,
            serverActiveCount: server.active.length,
          });
        } else {
          dropped += 1;
          events.push({
            at: now,
            requestId: pending.request.id,
            type: "dropped",
            operation: pending.request.operation,
            serverId: server.id,
          });
        }
        pendingServer.splice(index, 1);
      }
    }

    while (
      nextRequestIndex < spawnTimes.length &&
      spawnTimes[nextRequestIndex] <= now
    ) {
      const requestId = nextRequestIndex + 1;
      const operation = getRequestOperation(wave, requestId);
      const plan = selectServer(routePlans, requestId - 1);
      const serverId = plan.serverId;
      const request: RequestState = {
        id: requestId,
        spawnAt: spawnTimes[nextRequestIndex],
        serverId,
        operation,
        remainingMs: 0,
      };
      events.push({
        at: now,
        requestId,
        type: "spawned",
        operation,
      });
      events.push({
        at: now,
        requestId,
        type: "routed",
        operation,
        serverId,
      });
      pendingServer.push({
        request,
        arriveAt:
          now +
          getPathTransitMs(
            architecture,
            plan.requestPath ?? ["entry"],
          ),
      });
      nextRequestIndex += 1;
    }

    const settled = completed + dropped + timeoutCount;
    if (nextRequestIndex === wave.requestCount && settled === wave.requestCount) {
      break;
    }
    now += TICK_MS;
  }

  events.sort((left, right) => left.at - right.at);
  const successRate = completed / wave.requestCount;
  const averageLatencyMs =
    completedLatencies.length === 0
      ? 0
      : Math.round(
          completedLatencies.reduce((sum, latency) => sum + latency, 0) /
            completedLatencies.length,
        );
  const peakServerQueue = Math.max(
    ...servers.map((server) => server.peakQueue),
    0,
  );
  const failed = dropped + timeoutCount;
  const passed = successRate >= wave.targetSuccessRate;

  let bottleneckNode: BottleneckNode = "none";
  let bottleneck = "요청이 서버 처리, DB 작업, 응답 반환까지 안정적으로 완료되었습니다.";
  if (!passed && hasMissingDatabaseRoute) {
    bottleneckNode = "route";
    bottleneck =
      "요청은 App Server까지 도달하지만 Primary DB 링크가 없어 처리 후 실패합니다.";
  } else if (!passed && hasMissingResponseRoute) {
    bottleneckNode = "route";
    bottleneck =
      "DB 처리 후 응답이 출구까지 돌아갈 링크가 없어 완료되지 못했습니다.";
  } else if (!passed && database.peakQueue >= peakServerQueue) {
    bottleneckNode = "database";
    bottleneck =
      "Primary DB Queue가 병목입니다. DB Index로 조회 시간을 줄여야 합니다.";
  } else if (!passed) {
    bottleneckNode = "server";
    bottleneck =
      architecture.serverCount === 2 && !balancedRoute
        ? "두 번째 App Server가 있지만 Load Balancer 요청·응답 링크가 완성되지 않았습니다."
        : "App Server 처리 슬롯과 Queue가 포화되었습니다. 수평 확장이 필요합니다.";
  } else if (database.peakQueue >= 6) {
    bottleneckNode = "database";
    bottleneck =
      "이번 웨이브는 통과했지만 Primary DB Queue가 다음 병목으로 커지고 있습니다.";
  } else if (peakServerQueue >= 5) {
    bottleneckNode = "server";
    bottleneck =
      "이번 웨이브는 통과했지만 App Server Queue 여유가 거의 없습니다.";
  }

  return {
    wave,
    architecture,
    events,
    servers: servers.map((server) => ({
      serverId: server.id,
      handled: server.handled,
      peakQueue: server.peakQueue,
      peakActive: server.peakActive,
    })),
    database: {
      handled: database.handled,
      reads: database.reads,
      writes: database.writes,
      slowReads: database.slowReads,
      peakQueue: database.peakQueue,
      peakActive: database.peakActive,
    },
    metrics: {
      total: wave.requestCount,
      completed,
      readCompleted,
      writeCompleted,
      dropped,
      timedOut: timeoutCount,
      failed,
      successRate,
      averageLatencyMs,
      durationMs: now,
      peakServerQueue,
      peakDatabaseQueue: database.peakQueue,
      earnedCoins: completed * 2 + (passed ? 35 : 15),
      passed,
    },
    bottleneckNode,
    bottleneck,
  };
}
