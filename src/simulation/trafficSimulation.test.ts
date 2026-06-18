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
  nodePositions: {
    entry: DEFAULT_NODE_POSITIONS.entry,
    serverA: DEFAULT_NODE_POSITIONS.serverA,
    database: DEFAULT_NODE_POSITIONS.database,
  },
  connections: [
    { from: "entry", to: "serverA" },
    { from: "serverA", to: "database" },
  ],
};

const scaledArchitecture: ArchitectureConfig = {
  serverCount: 2,
  hasLoadBalancer: true,
  hasDatabase: true,
  databaseIndexed: true,
  linkLevel: 2,
  nodePositions: { ...DEFAULT_NODE_POSITIONS },
  connections: [
    { from: "entry", to: "loadBalancer" },
    { from: "loadBalancer", to: "serverA" },
    { from: "loadBalancer", to: "serverB" },
    { from: "serverA", to: "database" },
    { from: "serverB", to: "database" },
  ],
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

  it("drops all traffic when the complete request route is missing", () => {
    const result = simulateTrafficWave(STAGE_ONE_WAVES[0], {
      ...directArchitecture,
      connections: [],
    });

    expect(result.metrics.completed).toBe(0);
    expect(result.metrics.dropped).toBe(6);
    expect(result.bottleneckNode).toBe("route");
  });
});
