import { describe, expect, it } from "vitest";
import {
  DEFAULT_NODE_POSITIONS,
  simulateTrafficWave,
  WAVES,
  type ArchitectureConfig,
} from "./trafficSimulation";

const singleServer: ArchitectureConfig = {
  serverCount: 1,
  hasLoadBalancer: false,
  nodePositions: DEFAULT_NODE_POSITIONS,
  connections: [
    { from: "entry", to: "serverA" },
    { from: "serverA", to: "database" },
  ],
};

describe("simulateTrafficWave", () => {
  it("handles the first 20 requests with one server", () => {
    const result = simulateTrafficWave(WAVES[0], singleServer);

    expect(result.metrics.passed).toBe(true);
    expect(result.metrics.completed).toBe(20);
    expect(result.metrics.dropped).toBe(0);
  });

  it("exposes the single-server bottleneck during the 50 request wave", () => {
    const result = simulateTrafficWave(WAVES[1], singleServer);

    expect(result.metrics.passed).toBe(false);
    expect(result.metrics.successRate).toBeLessThan(0.9);
    expect(result.metrics.peakQueue).toBeGreaterThan(0);
    expect(result.bottleneck).toContain("Logic Server A");
  });

  it("passes the burst after adding a load balancer and second server", () => {
    const result = simulateTrafficWave(WAVES[1], {
      serverCount: 2,
      hasLoadBalancer: true,
      nodePositions: DEFAULT_NODE_POSITIONS,
      connections: [
        { from: "entry", to: "loadBalancer" },
        { from: "loadBalancer", to: "serverA" },
        { from: "loadBalancer", to: "serverB" },
        { from: "serverA", to: "database" },
        { from: "serverB", to: "database" },
      ],
    });

    expect(result.metrics.passed).toBe(true);
    expect(result.metrics.completed).toBe(50);
    expect(result.servers[0].handled).toBeGreaterThan(0);
    expect(result.servers[1].handled).toBeGreaterThan(0);
  });

  it("does not route traffic to the second server without a load balancer", () => {
    const result = simulateTrafficWave(WAVES[1], {
      serverCount: 2,
      hasLoadBalancer: false,
      nodePositions: DEFAULT_NODE_POSITIONS,
      connections: [
        { from: "entry", to: "serverA" },
        { from: "serverA", to: "database" },
      ],
    });

    expect(result.metrics.passed).toBe(false);
    expect(result.servers).toHaveLength(1);
    expect(result.bottleneck).toContain("분산 경로");
  });

  it("drops all traffic when the player has not drawn a complete route", () => {
    const result = simulateTrafficWave(WAVES[0], {
      serverCount: 1,
      hasLoadBalancer: false,
      nodePositions: DEFAULT_NODE_POSITIONS,
      connections: [],
    });

    expect(result.metrics.completed).toBe(0);
    expect(result.metrics.dropped).toBe(20);
    expect(result.bottleneck).toContain("경로");
  });
});
