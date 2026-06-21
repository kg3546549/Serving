import { describe, expect, it } from "vitest";
import { STAGE_ONE_WAVES } from "../campaign/campaignData";
import {
  DEFAULT_NODE_POSITIONS,
  type ArchitectureConfig,
} from "./trafficSimulation";
import {
  applyRuntimeArchitectureMutation,
  createRuntimeSimulationState,
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
});
