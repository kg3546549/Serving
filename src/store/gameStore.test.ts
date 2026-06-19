import { describe, expect, it } from "vitest";
import { STAGE_ONE_WAVES } from "../campaign/campaignData";
import { simulateTrafficWave } from "../simulation/trafficSimulation";
import { useGameStore } from "./gameStore";

describe("campaign store", () => {
  it("starts with fixed ingress and egress, a small board, and no equipment", () => {
    useGameStore.getState().resetCampaign();
    const state = useGameStore.getState();

    expect(state.ownedNodes).toEqual([]);
    expect(state.architecture.serverCount).toBe(0);
    expect(state.architecture.hasDatabase).toBe(false);
    expect(state.architecture.nodePositions.entry).toEqual({
      column: 1,
      row: 0,
    });
    expect(state.architecture.nodePositions.exit).toEqual({
      column: 5,
      row: 0,
    });
    expect(state.architecture.boardLevel).toBe(1);
  });

  it("buys, places, and connects the minimum Stage 1 architecture", () => {
    useGameStore.getState().resetCampaign();
    useGameStore.getState().purchaseSystem("serverA");
    useGameStore.getState().purchaseSystem("database");
    useGameStore.getState().placeNode("serverA", { column: 3, row: 1 });
    useGameStore.getState().placeNode("database", { column: 3, row: 3 });
    useGameStore.getState().toggleConnection("entry", "serverA");
    useGameStore.getState().toggleConnection("serverA", "database");
    useGameStore.getState().toggleConnection("serverA", "exit");

    const state = useGameStore.getState();
    expect(state.coins).toBe(100);
    expect(state.ownedNodes).toEqual(["serverA", "database"]);
    expect(state.architecture.connections).toHaveLength(3);
  });

  it("keeps later-stage equipment locked until its wave", () => {
    useGameStore.getState().resetCampaign();
    useGameStore.getState().purchaseSystem("loadBalancer");
    expect(useGameStore.getState().ownedNodes).not.toContain("loadBalancer");

    useGameStore.setState({ waveIndex: 4, coins: 300 });
    useGameStore.getState().purchaseSystem("loadBalancer");
    expect(useGameStore.getState().ownedNodes).toContain("loadBalancer");
  });

  it("does not allow the fixed ingress or egress to move", () => {
    useGameStore.getState().resetCampaign();
    useGameStore.getState().moveNode("entry", { column: 3, row: 2 });
    useGameStore.getState().moveNode("exit", { column: 4, row: 2 });
    expect(useGameStore.getState().architecture.nodePositions.entry).toEqual({
      column: 1,
      row: 0,
    });
    expect(useGameStore.getState().architecture.nodePositions.exit).toEqual({
      column: 5,
      row: 0,
    });
  });

  it("enforces board, topology, port, and link capacity limits", () => {
    useGameStore.getState().resetCampaign();
    useGameStore.setState({ waveIndex: 4, coins: 1_000 });
    useGameStore.getState().purchaseSystem("serverA");
    useGameStore.getState().purchaseSystem("database");
    useGameStore.getState().purchaseSystem("loadBalancer");
    useGameStore.getState().purchaseSystem("serverB");
    useGameStore.getState().placeNode("loadBalancer", { column: 3, row: 1 });
    useGameStore.getState().placeNode("serverA", { column: 5, row: 2 });
    useGameStore.getState().placeNode("serverB", { column: 5, row: 4 });
    expect(
      useGameStore.getState().architecture.nodePositions.serverB,
    ).toBeUndefined();

    useGameStore.getState().upgradeBoard();
    useGameStore.getState().placeNode("serverB", { column: 5, row: 4 });
    useGameStore.getState().placeNode("database", { column: 8, row: 3 });
    expect(useGameStore.getState().architecture.boardLevel).toBe(2);

    useGameStore.getState().toggleConnection("entry", "database");
    expect(useGameStore.getState().architecture.connections).toHaveLength(0);

    useGameStore.getState().toggleConnection("entry", "serverA");
    useGameStore.getState().toggleConnection("exit", "serverA");
    useGameStore.getState().toggleConnection("loadBalancer", "serverA");
    expect(useGameStore.getState().architecture.connections).toHaveLength(2);

    useGameStore.getState().clearConnections();
    useGameStore.getState().toggleConnection("entry", "loadBalancer");
    useGameStore.getState().toggleConnection("exit", "loadBalancer");
    useGameStore.getState().toggleConnection("loadBalancer", "serverA");
    expect(useGameStore.getState().architecture.connections).toHaveLength(2);

    useGameStore.getState().upgradeLinks();
    useGameStore.getState().toggleConnection("loadBalancer", "serverA");
    useGameStore.getState().toggleConnection("loadBalancer", "serverB");
    useGameStore.getState().toggleConnection("serverA", "database");
    useGameStore.getState().toggleConnection("serverB", "database");
    expect(useGameStore.getState().architecture.connections).toHaveLength(6);
    expect(useGameStore.getState().architecture.linkLevel).toBe(2);
  });

  it("reduces service HP and advances after a failed wave", () => {
    useGameStore.getState().resetCampaign();
    const result = simulateTrafficWave(
      STAGE_ONE_WAVES[0],
      useGameStore.getState().architecture,
    );
    useGameStore.setState({ phase: "running" });

    useGameStore.getState().completeWave(result);
    expect(useGameStore.getState().serviceHp).toBe(91);
    expect(useGameStore.getState().phase).toBe("result");

    useGameStore.getState().continueAfterResult();
    expect(useGameStore.getState().waveIndex).toBe(1);
    expect(useGameStore.getState().phase).toBe("prepare");
  });
});
