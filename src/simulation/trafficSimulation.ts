export type BuildSystemType = "loadBalancer" | "logicServer";
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

export interface ArchitectureConfig {
  serverCount: 1 | 2;
  hasLoadBalancer: boolean;
  loadBalancerPosition?: GridPosition;
  secondServerPosition?: GridPosition;
  connections: ArchitectureConnection[];
}

export interface WaveDefinition {
  id: number;
  name: string;
  requestCount: number;
  spawnDurationMs: number;
  targetSuccessRate: number;
  description: string;
}

export type TrafficEventType =
  | "spawned"
  | "routed"
  | "queued"
  | "started"
  | "completed"
  | "dropped"
  | "timed_out";

export interface TrafficEvent {
  at: number;
  requestId: number;
  type: TrafficEventType;
  serverId?: number;
  queueLength?: number;
  activeCount?: number;
}

export interface ServerMetrics {
  serverId: number;
  handled: number;
  peakQueue: number;
  peakActive: number;
}

export interface WaveMetrics {
  total: number;
  completed: number;
  dropped: number;
  timedOut: number;
  successRate: number;
  averageLatencyMs: number;
  durationMs: number;
  peakQueue: number;
  earnedCoins: number;
  passed: boolean;
}

export interface WaveSimulationResult {
  wave: WaveDefinition;
  architecture: ArchitectureConfig;
  events: TrafficEvent[];
  servers: ServerMetrics[];
  metrics: WaveMetrics;
  bottleneck: string;
}

interface RequestState {
  id: number;
  spawnAt: number;
  serverId: number;
  remainingMs: number;
}

interface ServerState {
  id: number;
  active: RequestState[];
  queue: RequestState[];
  handled: number;
  peakQueue: number;
  peakActive: number;
}

const TICK_MS = 100;
const SERVER_CONCURRENCY = 2;
const SERVER_PROCESSING_MS = 620;
const SERVER_QUEUE_CAPACITY = 7;
const REQUEST_DEADLINE_MS = 3_600;
const MAX_SIMULATION_MS = 30_000;

export const WAVES: readonly WaveDefinition[] = [
  {
    id: 1,
    name: "첫 손님",
    requestCount: 20,
    spawnDurationMs: 8_000,
    targetSuccessRate: 0.95,
    description: "20개의 일반 조회 요청이 일정하게 들어옵니다.",
  },
  {
    id: 2,
    name: "점심시간 폭주",
    requestCount: 50,
    spawnDurationMs: 8_000,
    targetSuccessRate: 0.9,
    description: "50개의 요청이 몰립니다. 단일 서버의 한계를 확인하세요.",
  },
] as const;

function createSpawnTimes(wave: WaveDefinition): number[] {
  if (wave.requestCount <= 1) {
    return [0];
  }

  const interval = wave.spawnDurationMs / (wave.requestCount - 1);
  return Array.from({ length: wave.requestCount }, (_, index) =>
    Math.round(index * interval),
  );
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
    hasDirectConnection(architecture, "entry", "loadBalancer") &&
    hasDirectConnection(architecture, "loadBalancer", "serverA") &&
    hasDirectConnection(architecture, "loadBalancer", "serverB") &&
    hasDirectConnection(architecture, "serverA", "database") &&
    hasDirectConnection(architecture, "serverB", "database")
  );
}

function selectServer(balancedRoute: boolean, requestId: number): number {
  if (!balancedRoute) {
    return 0;
  }

  return requestId % 2;
}

function startRequest(
  server: ServerState,
  request: RequestState,
  at: number,
  events: TrafficEvent[],
): void {
  server.active.push(request);
  server.peakActive = Math.max(server.peakActive, server.active.length);
  events.push({
    at,
    requestId: request.id,
    type: "started",
    serverId: server.id,
    queueLength: server.queue.length,
    activeCount: server.active.length,
  });
}

export function simulateTrafficWave(
  wave: WaveDefinition,
  architecture: ArchitectureConfig,
): WaveSimulationResult {
  const balancedRoute = hasBalancedRoute(architecture);
  const singleServerRoute = hasSingleServerRoute(architecture);
  const effectiveServerCount = balancedRoute ? 2 : singleServerRoute ? 1 : 0;

  if (effectiveServerCount === 0) {
    const events = Array.from({ length: wave.requestCount }, (_, index) => {
      const at = Math.round((index * wave.spawnDurationMs) / wave.requestCount);
      return [
        { at, requestId: index + 1, type: "spawned" as const },
        {
          at: at + 420,
          requestId: index + 1,
          type: "dropped" as const,
        },
      ];
    }).flat();

    return {
      wave,
      architecture,
      events,
      servers: [],
      metrics: {
        total: wave.requestCount,
        completed: 0,
        dropped: wave.requestCount,
        timedOut: 0,
        successRate: 0,
        averageLatencyMs: 0,
        durationMs: wave.spawnDurationMs + 420,
        peakQueue: 0,
        earnedCoins: 0,
        passed: false,
      },
      bottleneck:
        "트래픽 경로가 끊겨 있습니다. 입구, 처리 서버, 데이터베이스를 선으로 연결하세요.",
    };
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
  const events: TrafficEvent[] = [];
  const spawnTimes = createSpawnTimes(wave);
  const completedLatencies: number[] = [];
  let nextRequestIndex = 0;
  let completed = 0;
  let dropped = 0;
  let timedOut = 0;
  let now = 0;

  while (now <= MAX_SIMULATION_MS) {
    for (const server of servers) {
      const stillActive: RequestState[] = [];

      for (const request of server.active) {
        request.remainingMs -= TICK_MS;
        const age = now - request.spawnAt;

        if (age > REQUEST_DEADLINE_MS) {
          timedOut += 1;
          events.push({
            at: now,
            requestId: request.id,
            type: "timed_out",
            serverId: server.id,
            queueLength: server.queue.length,
            activeCount: server.active.length - 1,
          });
        } else if (request.remainingMs <= 0) {
          completed += 1;
          server.handled += 1;
          completedLatencies.push(age);
          events.push({
            at: now,
            requestId: request.id,
            type: "completed",
            serverId: server.id,
            queueLength: server.queue.length,
            activeCount: server.active.length - 1,
          });
        } else {
          stillActive.push(request);
        }
      }

      server.active = stillActive;

      const waiting: RequestState[] = [];
      for (const request of server.queue) {
        if (now - request.spawnAt > REQUEST_DEADLINE_MS) {
          timedOut += 1;
          events.push({
            at: now,
            requestId: request.id,
            type: "timed_out",
            serverId: server.id,
            queueLength: Math.max(0, server.queue.length - 1),
            activeCount: server.active.length,
          });
        } else {
          waiting.push(request);
        }
      }
      server.queue = waiting;

      while (
        server.active.length < SERVER_CONCURRENCY &&
        server.queue.length > 0
      ) {
        const request = server.queue.shift();
        if (request) {
          startRequest(server, request, now, events);
        }
      }
    }

    while (
      nextRequestIndex < spawnTimes.length &&
      spawnTimes[nextRequestIndex] <= now
    ) {
      const requestId = nextRequestIndex + 1;
      const spawnAt = spawnTimes[nextRequestIndex];
      const serverId = selectServer(balancedRoute, requestId - 1);
      const server = servers[serverId];
      const request: RequestState = {
        id: requestId,
        spawnAt,
        serverId,
        remainingMs: SERVER_PROCESSING_MS,
      };

      events.push({ at: now, requestId, type: "spawned" });
      events.push({
        at: now,
        requestId,
        type: "routed",
        serverId,
        queueLength: server.queue.length,
        activeCount: server.active.length,
      });

      if (server.active.length < SERVER_CONCURRENCY) {
        startRequest(server, request, now, events);
      } else if (server.queue.length < SERVER_QUEUE_CAPACITY) {
        server.queue.push(request);
        server.peakQueue = Math.max(server.peakQueue, server.queue.length);
        events.push({
          at: now,
          requestId,
          type: "queued",
          serverId,
          queueLength: server.queue.length,
          activeCount: server.active.length,
        });
      } else {
        dropped += 1;
        events.push({
          at: now + 320,
          requestId,
          type: "dropped",
          serverId,
          queueLength: server.queue.length,
          activeCount: server.active.length,
        });
      }

      nextRequestIndex += 1;
    }

    const settled = completed + dropped + timedOut;
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
  const peakQueue = Math.max(...servers.map((server) => server.peakQueue), 0);
  const passed = successRate >= wave.targetSuccessRate;

  let bottleneck =
    effectiveServerCount === 1
      ? "단일 서버가 현재 트래픽을 안정적으로 처리했습니다."
      : "두 서버가 요청을 안정적으로 처리했습니다.";
  if (!passed && effectiveServerCount === 1) {
    if (architecture.serverCount === 2 && !balancedRoute) {
      bottleneck =
        "두 번째 서버까지 이어지는 분산 경로가 완성되지 않았습니다.";
    } else {
      bottleneck = "Logic Server A의 처리 슬롯과 대기열이 가득 찼습니다.";
    }
  } else if (!passed) {
    bottleneck = "현재 처리량으로는 이번 요청 폭주를 감당할 수 없습니다.";
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
    metrics: {
      total: wave.requestCount,
      completed,
      dropped,
      timedOut,
      successRate,
      averageLatencyMs,
      durationMs: now,
      peakQueue,
      earnedCoins: completed * 2 + (passed ? 40 : 20),
      passed,
    },
    bottleneck,
  };
}
