import { describe, expect, it } from "vitest";
import { STAGE_ONE_WAVES } from "../campaign/campaignData";
import {
  DEFAULT_NODE_POSITIONS,
  simulateTrafficWave,
  type ArchitectureConfig,
} from "./trafficSimulation";

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
    serverA: null,
    serverB: null,
    database: null,
  },
};

const scaledArchitecture: ArchitectureConfig = {
  serverCount: 2,
  hasLoadBalancer: true,
  hasDatabase: true,
  databaseIndexed: true,
  linkLevel: 2,
  boardLevel: 2,
  nodePositions: { ...DEFAULT_NODE_POSITIONS },
  connections: [
    { from: "entry", to: "loadBalancer" },
    { from: "loadBalancer", to: "exit" },
    { from: "loadBalancer", to: "serverA" },
    { from: "loadBalancer", to: "serverB" },
    { from: "serverA", to: "database" },
    { from: "serverB", to: "database" },
  ],
  boardSlots: {
    loadBalancer: null,
    serverA: null,
    serverB: null,
    database: null,
  },
};

describe("simulateTrafficWave", () => {
  it("requires server processing, DB work, and a returned response", () => {
    const result = simulateTrafficWave(
      STAGE_ONE_WAVES[0],
      directArchitecture,
    );
    const requestEvents = result.events
      .filter((event) => event.requestId === 1)
      .map((event) => event.type);

    expect(requestEvents).toEqual([
      "spawned",
      "routed",
      "server_started",
      "database_routed",
      "database_started",
      "database_completed",
      "response_started",
      "completed",
    ]);
    expect(result.metrics.completed).toBe(6);
    expect(result.database.handled).toBe(6);
    expect(result.metrics.passed).toBe(true);
  });

  it("exposes the single-server bottleneck when traffic grows", () => {
    const result = simulateTrafficWave(
      STAGE_ONE_WAVES[4],
      directArchitecture,
    );

    expect(result.metrics.passed).toBe(false);
    expect(result.metrics.peakServerQueue).toBeGreaterThan(0);
    expect(result.bottleneckNode).toBe("server");
  });

  it("passes the scale-out wave with a balanced two-server route", () => {
    const result = simulateTrafficWave(
      STAGE_ONE_WAVES[4],
      scaledArchitecture,
    );

    expect(result.metrics.passed).toBe(true);
    expect(result.servers).toHaveLength(2);
    expect(result.servers[0].handled).toBeGreaterThan(0);
    expect(result.servers[1].handled).toBeGreaterThan(0);
  });

  it("uses the DB index to handle the final slow-query wave", () => {
    const withoutIndex = simulateTrafficWave(STAGE_ONE_WAVES[9], {
      ...scaledArchitecture,
      databaseIndexed: false,
    });
    const withIndex = simulateTrafficWave(
      STAGE_ONE_WAVES[9],
      scaledArchitecture,
    );

    expect(withoutIndex.metrics.successRate).toBeLessThan(
      withIndex.metrics.successRate,
    );
    expect(withIndex.metrics.passed).toBe(true);
    expect(withIndex.database.slowReads).toBeGreaterThan(0);
  });

  it("times out requests when the free-placement route becomes too long", () => {
    const longRoute = simulateTrafficWave({
      ...STAGE_ONE_WAVES[0],
      deadlineMs: 2_400,
    }, {
      ...scaledArchitecture,
      nodePositions: {
        ...scaledArchitecture.nodePositions,
        loadBalancer: { column: 600, row: 130 },
        serverA: { column: 220, row: 500 },
        serverB: { column: 980, row: 500 },
        database: { column: 600, row: 600 },
      },
    });

    expect(longRoute.metrics.timedOut).toBeGreaterThan(0);
    expect(longRoute.metrics.failed).toBeGreaterThan(0);
  });

  it("drops all traffic when the complete request route is missing", () => {
    const result = simulateTrafficWave(STAGE_ONE_WAVES[0], {
      ...directArchitecture,
      connections: [],
    });

    expect(result.metrics.completed).toBe(0);
    expect(result.metrics.dropped).toBe(6);
    expect(result.bottleneckNode).toBe("route");
  });

  it("lets requests reach the app server before failing when the DB link is missing", () => {
    const result = simulateTrafficWave(STAGE_ONE_WAVES[0], {
      ...directArchitecture,
      connections: [
        { from: "entry", to: "serverA" },
        { from: "serverA", to: "exit" },
      ],
    });
    const requestEvents = result.events
      .filter((event) => event.requestId === 1)
      .map((event) => event.type);

    expect(requestEvents).toEqual([
      "spawned",
      "routed",
      "server_started",
      "dropped",
    ]);
    expect(result.metrics.completed).toBe(0);
    expect(result.metrics.dropped).toBe(6);
    expect(result.bottleneckNode).toBe("route");
  });
});
