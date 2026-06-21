import { describe, expect, it } from "vitest";
import { STAGE_ONE_WAVES } from "../campaign/campaignData";
import {
  DEFAULT_NODE_POSITIONS,
  type ArchitectureConfig,
} from "./trafficSimulation";
import {
  applyRuntimeArchitectureMutation,
  createRuntimeSimulationState,
  getRuntimePacketTimeoutProgress,
  stepRuntimeSimulation,
} from "./runtimeEngine";

const directArchitecture: ArchitectureConfig = {
  serverCount: 1,
  hasLoadBalancer: false,
  hasDatabase: true,
  databaseIndexed: false,
  linkLevel: 1,
  boardLevel: 1,
  nodePositions: {
    entry: DEFAULT_NODE_POSITIONS.entry,
    exit: DEFAULT_NODE_POSITIONS.exit,
    serverA: { column: 430, row: 300 },
    database: { column: 620, row: 470 },
  },
  connections: [
    { from: "entry", to: "serverA" },
    { from: "serverA", to: "database" },
    { from: "serverA", to: "exit" },
  ],
  boardSlots: {
    loadBalancer: null,
    serverA: "server-unit-a",
    serverB: null,
    database: "db-unit-a",
  },
};

describe("runtimeEngine", () => {
  it("progresses requests through runtime phases to completion", () => {
    const state = createRuntimeSimulationState(
      directArchitecture,
      STAGE_ONE_WAVES[0],
    );

    for (let tick = 0; tick < 160; tick += 1) {
      stepRuntimeSimulation(state, 100);
    }

    expect(state.metrics.completed).toBeGreaterThan(0);
    expect(state.metrics.failed).toBe(0);
  });

  it("drops in-flight packets when hot-plugging breaks an active route", () => {
    const state = createRuntimeSimulationState(
      directArchitecture,
      STAGE_ONE_WAVES[0],
    );

    stepRuntimeSimulation(state, 100);

    const brokenArchitecture: ArchitectureConfig = {
      ...directArchitecture,
      connections: directArchitecture.connections.filter(
        (connection) =>
          !(
            (connection.from === "entry" && connection.to === "serverA") ||
            (connection.from === "serverA" && connection.to === "entry")
          ),
      ),
    };
    applyRuntimeArchitectureMutation(state, brokenArchitecture);
    stepRuntimeSimulation(state, 100);

    expect(state.metrics.dropped).toBeGreaterThan(0);
    expect(
      state.packets.some((packet) => packet.phase === "dropped"),
    ).toBe(true);
  });

  it("creates a visible dropped packet when no request route exists", () => {
    const architecture: ArchitectureConfig = {
      ...directArchitecture,
      serverCount: 0,
      hasDatabase: false,
      nodePositions: {
        entry: DEFAULT_NODE_POSITIONS.entry,
        exit: DEFAULT_NODE_POSITIONS.exit,
      },
      connections: [],
      boardSlots: {
        loadBalancer: null,
        serverA: null,
        serverB: null,
        database: null,
      },
    };
    const state = createRuntimeSimulationState(
      architecture,
      STAGE_ONE_WAVES[0],
    );

    stepRuntimeSimulation(state, 100);

    expect(state.metrics.dropped).toBe(1);
    expect(state.packets).toHaveLength(1);
    expect(state.packets[0].phase).toBe("dropped");
  });

  it("fills each packet timeout ring from its own deadline", () => {
    const state = createRuntimeSimulationState(
      directArchitecture,
      STAGE_ONE_WAVES[0],
    );
    stepRuntimeSimulation(state, 100);
    const packet = state.packets[0];

    expect(
      getRuntimePacketTimeoutProgress(
        packet,
        packet.spawnAtMs + STAGE_ONE_WAVES[0].deadlineMs / 2,
      ),
    ).toBeCloseTo(0.5);
    expect(
      getRuntimePacketTimeoutProgress(packet, packet.deadlineAtMs + 1_000),
    ).toBe(1);
  });
});
