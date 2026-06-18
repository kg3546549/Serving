import { describe, expect, it } from "vitest";
import { STAGE_ONE_WAVES } from "../campaign/campaignData";
import { simulateTrafficWave } from "../simulation/trafficSimulation";
import { useGameStore } from "./gameStore";

describe("campaign store", () => {
  it("starts with only the fixed ingress and no owned equipment", () => {
    useGameStore.getState().resetCampaign();
    const state = useGameStore.getState();

    expect(state.ownedNodes).toEqual([]);
    expect(state.architecture.serverCount).toBe(0);
    expect(state.architecture.hasDatabase).toBe(false);
    expect(state.architecture.nodePositions.entry).toEqual({
      column: 0,
      row: 1,
    });
  });

  it("buys, places, and connects the minimum Stage 1 architecture", () => {
    useGameStore.getState().resetCampaign();
    useGameStore.getState().purchaseSystem("serverA");
    useGameStore.getState().purchaseSystem("database");
    useGameStore.getState().placeNode("serverA", { column: 4, row: 1 });
    useGameStore.getState().placeNode("database", { column: 8, row: 1 });
    useGameStore.getState().toggleConnection("entry", "serverA");
    useGameStore.getState().toggleConnection("serverA", "database");

    const state = useGameStore.getState();
    expect(state.coins).toBe(100);
    expect(state.ownedNodes).toEqual(["serverA", "database"]);
    expect(state.architecture.connections).toHaveLength(2);
  });

  it("keeps later-stage equipment locked until its wave", () => {
    useGameStore.getState().resetCampaign();
    useGameStore.getState().purchaseSystem("loadBalancer");
    expect(useGameStore.getState().ownedNodes).not.toContain("loadBalancer");

    useGameStore.setState({ waveIndex: 4, coins: 300 });
    useGameStore.getState().purchaseSystem("loadBalancer");
    expect(useGameStore.getState().ownedNodes).toContain("loadBalancer");
  });

  it("does not allow the fixed ingress to move", () => {
    useGameStore.getState().resetCampaign();
    useGameStore.getState().moveNode("entry", { column: 3, row: 2 });
    expect(useGameStore.getState().architecture.nodePositions.entry).toEqual({
      column: 0,
      row: 1,
    });
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
