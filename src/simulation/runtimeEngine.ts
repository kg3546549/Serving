import type { RequestOperation, WaveDefinition } from "../campaign/campaignData";
import {
  DEFAULT_ARCHITECTURE_PERFORMANCE,
  getConnectionLength,
  getRequestOperation,
  hasDirectConnection,
  isArchitectureNodePlaced,
  type ArchitectureConfig,
  type ArchitectureNodeId,
  type DatabaseMetrics,
  type ServerMetrics,
  type WaveSimulationResult,
} from "./trafficSimulation";

export type RuntimePacketPhase =
  | "toServer"
  | "queuedAtServer"
  | "processingServer"
  | "toDatabase"
  | "queuedAtDatabase"
  | "processingDatabase"
  | "toExit"
  | "completed"
  | "dropped"
  | "timedOut";

export interface RuntimePacket {
  id: number;
  operation: RequestOperation;
  phase: RuntimePacketPhase;
  spawnAtMs: number;
  deadlineAtMs: number;
  serverNodeId: "serverA" | "serverB";
  path: ArchitectureNodeId[];
  pathSegmentIndex: number;
  pathProgressMs: number;
  pathDurationMs: number;
  remainingProcessMs: number;
  enteredPhaseAtMs: number;
}

export interface RuntimeNodeState {
  nodeId: ArchitectureNodeId;
  queue: number[];
  active: number[];
}

export interface RuntimeMetrics {
  completed: number;
  readCompleted: number;
  writeCompleted: number;
  dropped: number;
  timedOut: number;
  failed: number;
  activePackets: number;
  averageLatencyMs: number;
  earnedCoins: number;
  passed: boolean;
  peakServerQueue: number;
  peakDatabaseQueue: number;
}

export interface RuntimeSimulationState {
  timeMs: number;
  wave: WaveDefinition;
  architecture: ArchitectureConfig;
  packets: RuntimePacket[];
  pendingSpawnIds: number[];
  nodes: Record<ArchitectureNodeId, RuntimeNodeState>;
  metrics: RuntimeMetrics;
  latencies: number[];
  serverHandled: Record<"serverA" | "serverB", number>;
  serverPeakActive: Record<"serverA" | "serverB", number>;
  databaseHandled: number;
  databaseReads: number;
  databaseWrites: number;
  databaseSlowReads: number;
  databasePeakActive: number;
}

export function getRuntimePacketTimeoutProgress(
  packet: RuntimePacket,
  timeMs: number,
): number {
  const duration = Math.max(1, packet.deadlineAtMs - packet.spawnAtMs);
  return Math.min(
    1,
    Math.max(0, (timeMs - packet.spawnAtMs) / duration),
  );
}

interface ServerRoutePlan {
  nodeId: "serverA" | "serverB";
  requestPath: ArchitectureNodeId[] | null;
  databasePath: ArchitectureNodeId[] | null;
  responsePath: ArchitectureNodeId[] | null;
}

const TICK_PROCESS_SERVER_MS = 1_200;
const TICK_PROCESS_DATABASE_READ_MS = 700;
const TICK_PROCESS_DATABASE_WRITE_MS = 1_050;
const TICK_PROCESS_DATABASE_SLOW_MS = 2_100;
const TICK_LINK_TRAVEL_MS = 250;
const TICK_LINK_HANDOFF_MS = 100;

function createNodeState(nodeId: ArchitectureNodeId): RuntimeNodeState {
  return { nodeId, queue: [], active: [] };
}

function createNodes(): Record<ArchitectureNodeId, RuntimeNodeState> {
  return {
    entry: createNodeState("entry"),
    exit: createNodeState("exit"),
    loadBalancer: createNodeState("loadBalancer"),
    serverA: createNodeState("serverA"),
    serverB: createNodeState("serverB"),
    database: createNodeState("database"),
  };
}

function createSpawnIds(wave: WaveDefinition): number[] {
  return Array.from({ length: wave.requestCount }, (_, index) => index + 1);
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

function getDatabaseProcessMs(operation: RequestOperation): number {
  if (operation === "write") {
    return TICK_PROCESS_DATABASE_WRITE_MS;
  }
  if (operation === "slowRead") {
    return TICK_PROCESS_DATABASE_SLOW_MS;
  }
  return TICK_PROCESS_DATABASE_READ_MS;
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

function resolveServerPlans(
  architecture: ArchitectureConfig,
): ServerRoutePlan[] {
  return (["serverA", "serverB"] as const)
    .filter((nodeId) => isArchitectureNodePlaced(architecture, nodeId))
    .map((nodeId) => ({
      nodeId,
      requestPath: resolveRequestPath(architecture, nodeId),
      databasePath: resolveDatabasePath(architecture, nodeId),
      responsePath: resolveResponsePath(architecture, nodeId),
    }))
    .filter((plan) => plan.requestPath !== null);
}

function getPathDurationMs(
  architecture: ArchitectureConfig,
  path: ArchitectureNodeId[],
): number {
  if (path.length < 2) {
    return 0;
  }
  let total = 0;
  for (let index = 0; index < path.length - 1; index += 1) {
    total +=
      getConnectionLength(architecture, {
        from: path[index],
        to: path[index + 1],
      }) * TICK_LINK_TRAVEL_MS;
    if (index < path.length - 2) {
      total += TICK_LINK_HANDOFF_MS;
    }
  }
  return total;
}

function packetHasBrokenPath(
  architecture: ArchitectureConfig,
  path: ArchitectureNodeId[],
): boolean {
  for (let index = 0; index < path.length - 1; index += 1) {
    if (!hasDirectConnection(architecture, path[index], path[index + 1])) {
      return true;
    }
  }
  return false;
}

function getServerQueueCapacity(architecture: ArchitectureConfig): number {
  const performance = {
    ...DEFAULT_ARCHITECTURE_PERFORMANCE,
    ...architecture.performance,
  };
  return performance.serverQueueCapacity;
}

function getServerConcurrency(architecture: ArchitectureConfig): number {
  const performance = {
    ...DEFAULT_ARCHITECTURE_PERFORMANCE,
    ...architecture.performance,
  };
  return performance.serverConcurrency;
}

function getDatabaseQueueCapacity(architecture: ArchitectureConfig): number {
  const performance = {
    ...DEFAULT_ARCHITECTURE_PERFORMANCE,
    ...architecture.performance,
  };
  return performance.databaseQueueCapacity;
}

function getDatabaseConcurrency(architecture: ArchitectureConfig): number {
  const performance = {
    ...DEFAULT_ARCHITECTURE_PERFORMANCE,
    ...architecture.performance,
  };
  return performance.databaseConcurrency;
}

function getLeastBusyServer(
  plans: ServerRoutePlan[],
  nodes: Record<ArchitectureNodeId, RuntimeNodeState>,
): ServerRoutePlan | null {
  const sorted = [...plans].sort((left, right) => {
    const leftLoad =
      nodes[left.nodeId].queue.length + nodes[left.nodeId].active.length;
    const rightLoad =
      nodes[right.nodeId].queue.length + nodes[right.nodeId].active.length;
    return leftLoad - rightLoad;
  });
  return sorted[0] ?? null;
}

function startTravel(
  packet: RuntimePacket,
  phase: RuntimePacketPhase,
  path: ArchitectureNodeId[],
  architecture: ArchitectureConfig,
  timeMs: number,
): void {
  packet.phase = phase;
  packet.path = path;
  packet.pathSegmentIndex = 0;
  packet.pathProgressMs = 0;
  packet.pathDurationMs = getPathDurationMs(architecture, path);
  packet.enteredPhaseAtMs = timeMs;
}

function markDropped(packet: RuntimePacket, state: RuntimeSimulationState): void {
  packet.phase = "dropped";
  state.metrics.dropped += 1;
  state.metrics.failed += 1;
}

function markTimedOut(packet: RuntimePacket, state: RuntimeSimulationState): void {
  packet.phase = "timedOut";
  state.metrics.timedOut += 1;
  state.metrics.failed += 1;
}

function releaseActivePacket(
  node: RuntimeNodeState,
  packetId: number,
): void {
  node.active = node.active.filter((activeId) => activeId !== packetId);
}

function tryStartServerWork(
  state: RuntimeSimulationState,
  packet: RuntimePacket,
): void {
  const serverNode = state.nodes[packet.serverNodeId];
  if (serverNode.active.length < getServerConcurrency(state.architecture)) {
    serverNode.active.push(packet.id);
    state.serverPeakActive[packet.serverNodeId] = Math.max(
      state.serverPeakActive[packet.serverNodeId],
      serverNode.active.length,
    );
    packet.phase = "processingServer";
    packet.remainingProcessMs = TICK_PROCESS_SERVER_MS;
    packet.enteredPhaseAtMs = state.timeMs;
  } else if (serverNode.queue.length < getServerQueueCapacity(state.architecture)) {
    serverNode.queue.push(packet.id);
    packet.phase = "queuedAtServer";
    packet.enteredPhaseAtMs = state.timeMs;
  } else {
    markDropped(packet, state);
  }
}

function tryStartDatabaseWork(
  state: RuntimeSimulationState,
  packet: RuntimePacket,
): void {
  const databaseNode = state.nodes.database;
  if (databaseNode.active.length < getDatabaseConcurrency(state.architecture)) {
    databaseNode.active.push(packet.id);
    state.databasePeakActive = Math.max(
      state.databasePeakActive,
      databaseNode.active.length,
    );
    packet.phase = "processingDatabase";
    packet.remainingProcessMs = getDatabaseProcessMs(packet.operation);
    packet.enteredPhaseAtMs = state.timeMs;
  } else if (
    databaseNode.queue.length < getDatabaseQueueCapacity(state.architecture)
  ) {
    databaseNode.queue.push(packet.id);
    packet.phase = "queuedAtDatabase";
    packet.enteredPhaseAtMs = state.timeMs;
  } else {
    markDropped(packet, state);
  }
}

function pumpQueues(state: RuntimeSimulationState): void {
  for (const nodeId of ["serverA", "serverB"] as const) {
    const node = state.nodes[nodeId];
    while (
      node.queue.length > 0 &&
      node.active.length < getServerConcurrency(state.architecture)
    ) {
      const packetId = node.queue.shift();
      const packet = state.packets.find((candidate) => candidate.id === packetId);
      if (!packet || packet.phase !== "queuedAtServer") {
        continue;
      }
      node.active.push(packet.id);
      packet.phase = "processingServer";
      packet.remainingProcessMs = TICK_PROCESS_SERVER_MS;
      packet.enteredPhaseAtMs = state.timeMs;
    }
  }

  const databaseNode = state.nodes.database;
  while (
    databaseNode.queue.length > 0 &&
    databaseNode.active.length < getDatabaseConcurrency(state.architecture)
  ) {
    const packetId = databaseNode.queue.shift();
    const packet = state.packets.find((candidate) => candidate.id === packetId);
    if (!packet || packet.phase !== "queuedAtDatabase") {
      continue;
    }
    databaseNode.active.push(packet.id);
    packet.phase = "processingDatabase";
    packet.remainingProcessMs = getDatabaseProcessMs(packet.operation);
    packet.enteredPhaseAtMs = state.timeMs;
  }
}

export function createRuntimeSimulationState(
  architecture: ArchitectureConfig,
  wave: WaveDefinition,
): RuntimeSimulationState {
  return {
    timeMs: 0,
    wave,
    architecture,
    packets: [],
    pendingSpawnIds: createSpawnIds(wave),
    nodes: createNodes(),
    metrics: {
      completed: 0,
      readCompleted: 0,
      writeCompleted: 0,
      dropped: 0,
      timedOut: 0,
      failed: 0,
      activePackets: 0,
      averageLatencyMs: 0,
      earnedCoins: 0,
      passed: false,
      peakServerQueue: 0,
      peakDatabaseQueue: 0,
    },
    latencies: [],
    serverHandled: { serverA: 0, serverB: 0 },
    serverPeakActive: { serverA: 0, serverB: 0 },
    databaseHandled: 0,
    databaseReads: 0,
    databaseWrites: 0,
    databaseSlowReads: 0,
    databasePeakActive: 0,
  };
}

export function applyRuntimeArchitectureMutation(
  state: RuntimeSimulationState,
  architecture: ArchitectureConfig,
): RuntimeSimulationState {
  state.architecture = architecture;
  for (const packet of state.packets) {
    if (
      (packet.phase === "toServer" ||
        packet.phase === "toDatabase" ||
        packet.phase === "toExit") &&
      packetHasBrokenPath(architecture, packet.path)
    ) {
      markDropped(packet, state);
    }
  }
  return state;
}

export function stepRuntimeSimulation(
  state: RuntimeSimulationState,
  deltaMs: number,
): RuntimeSimulationState {
  state.timeMs += deltaMs;
  const spawnTimes = createSpawnTimes(state.wave);
  const plans = resolveServerPlans(state.architecture);

  for (let index = state.pendingSpawnIds.length - 1; index >= 0; index -= 1) {
    const requestId = state.pendingSpawnIds[index];
    const spawnAtMs = spawnTimes[requestId - 1] ?? 0;
    if (spawnAtMs > state.timeMs) {
      continue;
    }
    const plan = getLeastBusyServer(plans, state.nodes);
    if (!plan?.requestPath) {
      state.packets.push({
        id: requestId,
        operation: getRequestOperation(state.wave, requestId),
        phase: "dropped",
        spawnAtMs,
        deadlineAtMs: spawnAtMs + state.wave.deadlineMs,
        serverNodeId: "serverA",
        path: ["entry"],
        pathSegmentIndex: 0,
        pathProgressMs: 0,
        pathDurationMs: 0,
        remainingProcessMs: 0,
        enteredPhaseAtMs: state.timeMs,
      });
      state.metrics.dropped += 1;
      state.metrics.failed += 1;
      state.pendingSpawnIds.splice(index, 1);
      continue;
    }
    const packet: RuntimePacket = {
      id: requestId,
      operation: getRequestOperation(state.wave, requestId),
      phase: "toServer",
      spawnAtMs,
      deadlineAtMs: spawnAtMs + state.wave.deadlineMs,
      serverNodeId: plan.nodeId,
      path: plan.requestPath,
      pathSegmentIndex: 0,
      pathProgressMs: 0,
      pathDurationMs: getPathDurationMs(state.architecture, plan.requestPath),
      remainingProcessMs: 0,
      enteredPhaseAtMs: state.timeMs,
    };
    state.packets.push(packet);
    state.pendingSpawnIds.splice(index, 1);
  }

  for (const packet of state.packets) {
    if (
      packet.phase === "completed" ||
      packet.phase === "dropped" ||
      packet.phase === "timedOut"
    ) {
      continue;
    }
    if (state.timeMs >= packet.deadlineAtMs) {
      if (packet.phase === "processingServer") {
        releaseActivePacket(state.nodes[packet.serverNodeId], packet.id);
      }
      if (packet.phase === "processingDatabase") {
        releaseActivePacket(state.nodes.database, packet.id);
      }
      markTimedOut(packet, state);
      continue;
    }

    if (
      packet.phase === "toServer" ||
      packet.phase === "toDatabase" ||
      packet.phase === "toExit"
    ) {
      if (packetHasBrokenPath(state.architecture, packet.path)) {
        markDropped(packet, state);
        continue;
      }
      packet.pathProgressMs += deltaMs;
      if (packet.pathProgressMs < packet.pathDurationMs) {
        continue;
      }
      if (packet.phase === "toServer") {
        tryStartServerWork(state, packet);
      } else if (packet.phase === "toDatabase") {
        tryStartDatabaseWork(state, packet);
      } else {
        packet.phase = "completed";
        state.metrics.completed += 1;
        if (packet.operation === "write") {
          state.metrics.writeCompleted += 1;
        } else {
          state.metrics.readCompleted += 1;
        }
        state.latencies.push(state.timeMs - packet.spawnAtMs);
      }
      continue;
    }

    if (packet.phase === "processingServer") {
      packet.remainingProcessMs -= deltaMs;
      if (packet.remainingProcessMs > 0) {
        continue;
      }
      releaseActivePacket(state.nodes[packet.serverNodeId], packet.id);
      state.serverHandled[packet.serverNodeId] += 1;
      const nextPath = resolveDatabasePath(state.architecture, packet.serverNodeId);
      if (!nextPath) {
        markDropped(packet, state);
        continue;
      }
      startTravel(
        packet,
        "toDatabase",
        nextPath,
        state.architecture,
        state.timeMs,
      );
      continue;
    }

    if (packet.phase === "processingDatabase") {
      packet.remainingProcessMs -= deltaMs;
      if (packet.remainingProcessMs > 0) {
        continue;
      }
      releaseActivePacket(state.nodes.database, packet.id);
      state.databaseHandled += 1;
      if (packet.operation === "write") {
        state.databaseWrites += 1;
      } else if (packet.operation === "slowRead") {
        state.databaseSlowReads += 1;
      } else {
        state.databaseReads += 1;
      }
      const nextPath = resolveResponsePath(state.architecture, packet.serverNodeId);
      if (!nextPath) {
        markDropped(packet, state);
        continue;
      }
      startTravel(
        packet,
        "toExit",
        nextPath,
        state.architecture,
        state.timeMs,
      );
    }
  }

  pumpQueues(state);
  state.metrics.peakServerQueue = Math.max(
    state.metrics.peakServerQueue,
    state.nodes.serverA.queue.length,
    state.nodes.serverB.queue.length,
  );
  state.metrics.peakDatabaseQueue = Math.max(
    state.metrics.peakDatabaseQueue,
    state.nodes.database.queue.length,
  );
  state.metrics.activePackets = state.packets.filter(
    (packet) =>
      packet.phase !== "completed" &&
      packet.phase !== "dropped" &&
      packet.phase !== "timedOut",
  ).length;
  return state;
}

export function isRuntimeWaveSettled(state: RuntimeSimulationState): boolean {
  return (
    state.pendingSpawnIds.length === 0 &&
    state.metrics.activePackets === 0
  );
}

export function buildWaveResultFromRuntime(
  state: RuntimeSimulationState,
): WaveSimulationResult {
  const total = state.wave.requestCount;
  const successRate = total === 0 ? 0 : state.metrics.completed / total;
  const averageLatencyMs =
    state.latencies.length === 0
      ? 0
      : Math.round(
          state.latencies.reduce((sum, value) => sum + value, 0) /
            state.latencies.length,
        );
  const failed = state.metrics.dropped + state.metrics.timedOut;
  const passed = successRate >= state.wave.targetSuccessRate;
  let bottleneckNode: WaveSimulationResult["bottleneckNode"] = "none";
  let bottleneck =
    "요청이 서버 처리, DB 작업, 응답 반환까지 안정적으로 완료되었습니다.";
  if (!passed && state.metrics.peakDatabaseQueue >= state.metrics.peakServerQueue) {
    bottleneckNode = "database";
    bottleneck = "Primary DB 처리열이 병목입니다. DB 경로와 모듈 구성을 재정비해야 합니다.";
  } else if (!passed) {
    bottleneckNode = "server";
    bottleneck = "App Server 처리열이 병목입니다. 링크 재배선이나 서버 증설이 필요합니다.";
  }

  const servers: ServerMetrics[] = (["serverA", "serverB"] as const)
    .filter(
      (nodeId) =>
        isArchitectureNodePlaced(state.architecture, nodeId),
    )
    .map((nodeId, index) => ({
      serverId: index,
      handled: state.serverHandled[nodeId],
      peakQueue:
        nodeId === "serverA"
          ? state.nodes.serverA.queue.length
          : state.nodes.serverB.queue.length,
      peakActive: state.serverPeakActive[nodeId],
    }));

  const database: DatabaseMetrics = {
    handled: state.databaseHandled,
    reads: state.databaseReads,
    writes: state.databaseWrites,
    slowReads: state.databaseSlowReads,
    peakQueue: state.metrics.peakDatabaseQueue,
    peakActive: state.databasePeakActive,
  };

  return {
    wave: state.wave,
    architecture: state.architecture,
    events: [],
    servers,
    database,
    metrics: {
      total,
      completed: state.metrics.completed,
      readCompleted: state.metrics.readCompleted,
      writeCompleted: state.metrics.writeCompleted,
      dropped: state.metrics.dropped,
      timedOut: state.metrics.timedOut,
      failed,
      successRate,
      averageLatencyMs,
      durationMs: state.timeMs,
      peakServerQueue: state.metrics.peakServerQueue,
      peakDatabaseQueue: state.metrics.peakDatabaseQueue,
      earnedCoins: state.metrics.completed * 1 + (passed ? 35 : 15),
      passed,
    },
    bottleneckNode,
    bottleneck,
  };
}
