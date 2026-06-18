import type {
  RequestOperation,
  WaveDefinition,
} from "../campaign/campaignData";

export type BuildSystemType =
  | "serverA"
  | "database"
  | "loadBalancer"
  | "serverB"
  | "dbIndex";

export type ArchitectureNodeId =
  | "entry"
  | "loadBalancer"
  | "serverA"
  | "serverB"
  | "database";

export interface GridPosition {
  column: number;
  row: number;
}

export interface ArchitectureConnection {
  from: ArchitectureNodeId;
  to: ArchitectureNodeId;
}

export type LinkLevel = 1 | 2 | 3;
export type ConnectionKind = "traffic" | "data";

export interface LinkTier {
  level: LinkLevel;
  maxEdgeCells: number;
  totalCells: number;
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

export const FIXED_ENTRY_POSITION: GridPosition = { column: 0, row: 2 };

export const DEFAULT_NODE_POSITIONS: ArchitectureNodePositions = {
  entry: FIXED_ENTRY_POSITION,
  loadBalancer: { column: 2, row: 2 },
  serverA: { column: 4, row: 2 },
  serverB: { column: 4, row: 4 },
  database: { column: 8, row: 2 },
};

export interface ArchitectureConfig {
  serverCount: 0 | 1 | 2;
  hasLoadBalancer: boolean;
  hasDatabase: boolean;
  databaseIndexed: boolean;
  linkLevel: LinkLevel;
  nodePositions: ArchitectureNodePositions;
  connections: ArchitectureConnection[];
}

export const LINK_TIERS: readonly LinkTier[] = [
  { level: 1, maxEdgeCells: 4, totalCells: 8, upgradeCost: 60 },
  { level: 2, maxEdgeCells: 6, totalCells: 22, upgradeCost: 100 },
  { level: 3, maxEdgeCells: 9, totalCells: 36, upgradeCost: null },
] as const;

export const NODE_PORT_LIMITS: Readonly<
  Record<ArchitectureNodeId, Record<ConnectionKind, number>>
> = {
  entry: { traffic: 1, data: 0 },
  loadBalancer: { traffic: 3, data: 0 },
  serverA: { traffic: 1, data: 1 },
  serverB: { traffic: 1, data: 1 },
  database: { traffic: 0, data: 2 },
} as const;

export function getLinkTier(level: LinkLevel): LinkTier {
  return LINK_TIERS[level - 1] ?? LINK_TIERS[0];
}

export function getConnectionLength(
  architecture: ArchitectureConfig,
  connection: ArchitectureConnection,
): number {
  const from = architecture.nodePositions[connection.from];
  const to = architecture.nodePositions[connection.to];
  if (!from || !to) {
    return 0;
  }
  return (
    Math.abs(from.column - to.column) +
    Math.abs(from.row - to.row)
  );
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
    (left === "loadBalancer" && isServer(right)) ||
    (right === "loadBalancer" && isServer(left))
  ) {
    return "traffic";
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
    const length = getConnectionLength(architecture, connection);
    if (length > tier.maxEdgeCells) {
      return {
        valid: false,
        reason: `LINK LV.${tier.level}의 간선 하나는 최대 ${tier.maxEdgeCells}칸입니다.`,
        kind,
        length,
      };
    }
  }
  const totalCells = getTotalConnectionCells(architecture);
  if (totalCells > tier.totalCells) {
    return {
      valid: false,
      reason: `LINK LV.${tier.level}의 전체 간선 예산은 ${tier.totalCells}칸입니다.`,
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
const SERVER_CONCURRENCY = 2;
const SERVER_PROCESSING_MS = 1_200;
const SERVER_QUEUE_CAPACITY = 6;
const DATABASE_CONCURRENCY = 2;
const DATABASE_QUEUE_CAPACITY = 8;
const DATABASE_INDEXED_QUEUE_CAPACITY = 14;
const DATABASE_READ_MS = 650;
const DATABASE_WRITE_MS = 1_050;
const DATABASE_SLOW_READ_MS = 2_200;
const DATABASE_INDEXED_READ_MS = 380;
const DATABASE_INDEXED_WRITE_MS = 820;
const DATABASE_INDEXED_SLOW_READ_MS = 850;
const DIRECT_ROUTE_MS = 360;
const BALANCED_ROUTE_MS = 560;
const SERVER_TO_DATABASE_MS = 360;
const DIRECT_RESPONSE_MS = 720;
const BALANCED_RESPONSE_MS = 980;
const MAX_SIMULATION_MS = 60_000;

export const SYSTEM_CATALOG: Readonly<
  Record<
    BuildSystemType,
    {
      name: string;
      description: string;
      cost: number;
      unlockWave: number;
      nodeId?: ArchitectureNodeId;
    }
  >
> = {
  serverA: {
    name: "App Server A",
    description: "HTTPS 요청의 비즈니스 로직을 처리합니다.",
    cost: 60,
    unlockWave: 1,
    nodeId: "serverA",
  },
  database: {
    name: "Primary DB",
    description: "데이터를 읽거나 저장하고 응답 데이터를 만듭니다.",
    cost: 80,
    unlockWave: 1,
    nodeId: "database",
  },
  loadBalancer: {
    name: "Load Balancer",
    description: "요청을 두 App Server에 Round Robin으로 분산합니다.",
    cost: 80,
    unlockWave: 5,
    nodeId: "loadBalancer",
  },
  serverB: {
    name: "App Server B",
    description: "서버 처리 슬롯과 Queue 용량을 확장합니다.",
    cost: 70,
    unlockWave: 5,
    nodeId: "serverB",
  },
  dbIndex: {
    name: "DB Index",
    description: "읽기와 Slow Query 시간을 줄이고 DB Queue를 확장합니다.",
    cost: 110,
    unlockWave: 8,
  },
} as const;

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
    isArchitectureNodePlaced(architecture, "serverA") &&
    isArchitectureNodePlaced(architecture, "database") &&
    hasDirectConnection(architecture, "entry", "serverA") &&
    hasDirectConnection(architecture, "serverA", "database")
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
    isArchitectureNodePlaced(architecture, "loadBalancer") &&
    isArchitectureNodePlaced(architecture, "serverA") &&
    isArchitectureNodePlaced(architecture, "serverB") &&
    isArchitectureNodePlaced(architecture, "database") &&
    hasDirectConnection(architecture, "entry", "loadBalancer") &&
    hasDirectConnection(architecture, "loadBalancer", "serverA") &&
    hasDirectConnection(architecture, "loadBalancer", "serverB") &&
    hasDirectConnection(architecture, "serverA", "database") &&
    hasDirectConnection(architecture, "serverB", "database")
  );
}

function selectServer(balancedRoute: boolean, requestId: number): number {
  return balancedRoute ? requestId % 2 : 0;
}

function getDatabaseProcessingMs(
  operation: RequestOperation,
  indexed: boolean,
): number {
  if (indexed) {
    if (operation === "write") {
      return DATABASE_INDEXED_WRITE_MS;
    }
    return operation === "slowRead"
      ? DATABASE_INDEXED_SLOW_READ_MS
      : DATABASE_INDEXED_READ_MS;
  }
  if (operation === "write") {
    return DATABASE_WRITE_MS;
  }
  return operation === "slowRead"
    ? DATABASE_SLOW_READ_MS
    : DATABASE_READ_MS;
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
      "요청 경로가 완성되지 않았습니다. 고정 입구, App Server, Primary DB를 배치하고 연결하세요.",
  };
}

function startServerRequest(
  server: ServerState,
  request: RequestState,
  at: number,
  events: TrafficEvent[],
): void {
  request.remainingMs = SERVER_PROCESSING_MS;
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
): void {
  request.remainingMs = getDatabaseProcessingMs(request.operation, indexed);
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
  const balancedRoute = hasBalancedRoute(architecture);
  const singleServerRoute = hasSingleServerRoute(architecture);
  const effectiveServerCount = balancedRoute ? 2 : singleServerRoute ? 1 : 0;

  if (effectiveServerCount === 0) {
    return createNoRouteResult(wave, architecture);
  }

  const servers: ServerState[] = Array.from(
    { length: effectiveServerCount },
    (_, id) => ({
      id,
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
            now + (balancedRoute ? BALANCED_RESPONSE_MS : DIRECT_RESPONSE_MS),
        });
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
      database.active.length < DATABASE_CONCURRENCY &&
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
        );
      }
    }

    for (let index = pendingDatabase.length - 1; index >= 0; index -= 1) {
      const pending = pendingDatabase[index];
      if (timedOut(pending.request, now, wave)) {
        failTimeout(pending.request);
        pendingDatabase.splice(index, 1);
      } else if (pending.arriveAt <= now) {
        const capacity = architecture.databaseIndexed
          ? DATABASE_INDEXED_QUEUE_CAPACITY
          : DATABASE_QUEUE_CAPACITY;
        if (database.active.length < DATABASE_CONCURRENCY) {
          startDatabaseRequest(
            database,
            pending.request,
            architecture.databaseIndexed,
            now,
            events,
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
            arriveAt: now + SERVER_TO_DATABASE_MS,
          });
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
        server.active.length < SERVER_CONCURRENCY &&
        server.queue.length > 0
      ) {
        const request = server.queue.shift();
        if (request) {
          startServerRequest(server, request, now, events);
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
        if (server.active.length < SERVER_CONCURRENCY) {
          startServerRequest(server, pending.request, now, events);
        } else if (server.queue.length < SERVER_QUEUE_CAPACITY) {
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
      const serverId = selectServer(balancedRoute, requestId - 1);
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
        arriveAt: now + (balancedRoute ? BALANCED_ROUTE_MS : DIRECT_ROUTE_MS),
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
  if (!passed && database.peakQueue >= peakServerQueue) {
    bottleneckNode = "database";
    bottleneck =
      "Primary DB Queue가 병목입니다. DB Index로 조회 시간을 줄여야 합니다.";
  } else if (!passed) {
    bottleneckNode = "server";
    bottleneck =
      architecture.serverCount === 2 && !balancedRoute
        ? "두 번째 App Server가 있지만 Load Balancer 분산 경로가 완성되지 않았습니다."
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
