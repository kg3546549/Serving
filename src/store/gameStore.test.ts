import { describe, expect, it } from "vitest";
import { DEFAULT_NODE_POSITIONS } from "../simulation/trafficSimulation";
import {
  getShopPrice,
  getShopUpgradeCost,
  LOAD_BALANCER_COST,
  SECOND_SERVER_COST,
  useGameStore,
} from "./gameStore";

describe("shop economy", () => {
  it("applies the current reroll discount to equipment prices", () => {
    expect(
      getShopPrice(LOAD_BALANCER_COST, 1, 1, "loadBalancer"),
    ).toBe(68);
    expect(
      getShopPrice(SECOND_SERVER_COST, 1, 0, "logicServer"),
    ).toBe(90);
  });

  it("adds a five percent discount for each shop level", () => {
    expect(
      getShopPrice(LOAD_BALANCER_COST, 3, 0, "loadBalancer"),
    ).toBe(72);
    expect(
      getShopPrice(SECOND_SERVER_COST, 3, 0, "logicServer"),
    ).toBe(80);
  });

  it("stops shop upgrades at level three", () => {
    expect(getShopUpgradeCost(1)).toBe(60);
    expect(getShopUpgradeCost(2)).toBe(100);
    expect(getShopUpgradeCost(3)).toBeNull();
  });

  it("spends currency on level upgrades, rerolls, placement, and movement", () => {
    useGameStore.setState({
      phase: "prepare",
      coins: 300,
      expansionUnlocked: true,
      shopLevel: 1,
      shopRotation: 0,
      architecture: {
        serverCount: 1,
        hasLoadBalancer: false,
        nodePositions: { ...DEFAULT_NODE_POSITIONS },
        connections: [],
      },
    });

    useGameStore.getState().upgradeShop();
    expect(useGameStore.getState().shopLevel).toBe(2);
    expect(useGameStore.getState().coins).toBe(240);

    useGameStore.getState().rerollShop();
    expect(useGameStore.getState().shopRotation).toBe(1);
    expect(useGameStore.getState().coins).toBe(225);

    useGameStore
      .getState()
      .placeSystem("loadBalancer", { column: 2, row: 3 });
    expect(useGameStore.getState().architecture.hasLoadBalancer).toBe(true);
    expect(
      useGameStore.getState().architecture.nodePositions.loadBalancer,
    ).toEqual({ column: 2, row: 3 });

    useGameStore
      .getState()
      .moveNode("loadBalancer", { column: 3, row: 3 });
    expect(
      useGameStore.getState().architecture.nodePositions.loadBalancer,
    ).toEqual({ column: 3, row: 3 });

    useGameStore.getState().resetCampaign();
  });
});
