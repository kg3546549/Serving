import { describe, expect, it } from "vitest";
import { STAGE_ONE_WAVES } from "../campaign/campaignData";
import { simulateTrafficWave } from "../simulation/trafficSimulation";
import { useGameStore } from "./gameStore";

describe("campaign store", () => {
  it("starts with fixed I/O, eight inventory slots, and a small board", () => {
    useGameStore.getState().resetCampaign();
    const state = useGameStore.getState();

    expect(state.inventory).toEqual(Array(8).fill(null));
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

  it("buys, keeps, places, and connects the minimum architecture", () => {
    useGameStore.getState().resetCampaign();
    useGameStore.setState({
      coins: 1_000,
      shopItems: ["ec2", "rdsPrimary", null, null, null],
    });

    useGameStore.getState().buyShopItem(0);
    useGameStore.getState().buyShopItem(1);
    const purchased = useGameStore.getState().inventory;
    const server = purchased.find((item) => item?.type === "ec2");
    const database = purchased.find((item) => item?.type === "rdsPrimary");

    useGameStore
      .getState()
      .placeNode("serverA", { column: 3, row: 1 }, server!.id);
    useGameStore
      .getState()
      .placeNode("database", { column: 3, row: 3 }, database!.id);
    useGameStore.getState().toggleConnection("entry", "serverA");
    useGameStore.getState().toggleConnection("serverA", "database");
    useGameStore.getState().toggleConnection("serverA", "exit");

    const state = useGameStore.getState();
    expect(state.inventory.filter(Boolean)).toHaveLength(2);
    expect(state.architecture.connections).toHaveLength(3);
    expect(state.architecture.boardSlots.serverA).toBe(server!.id);
    expect(state.architecture.boardSlots.database).toBe(database!.id);
  });

  it("does not allow fixed ingress or egress to move", () => {
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

  it("uses level-up rewards for board and link expansion", () => {
    useGameStore.getState().resetCampaign();
    useGameStore.setState({ coins: 100 });
    useGameStore.getState().buyXp();

    expect(useGameStore.getState().playerLevel).toBe(2);
    expect(useGameStore.getState().pendingInfrastructureUpgrades).toBe(1);

    useGameStore.getState().chooseInfrastructureUpgrade("board");
    expect(useGameStore.getState().architecture.boardLevel).toBe(2);

    useGameStore.setState({ pendingInfrastructureUpgrades: 1 });
    useGameStore.getState().chooseInfrastructureUpgrade("link");
    expect(useGameStore.getState().architecture.linkLevel).toBe(2);
  });

  it("does not queue an expansion choice when board and link are maxed", () => {
    useGameStore.getState().resetCampaign();
    useGameStore.setState((state) => ({
      phase: "prepare",
      playerLevel: 3,
      playerXp: 9,
      coins: 100,
      architecture: {
        ...state.architecture,
        boardLevel: 3,
        linkLevel: 3,
      },
      pendingInfrastructureUpgrades: 0,
    }));

    useGameStore.getState().buyXp();

    expect(useGameStore.getState().playerLevel).toBe(4);
    expect(useGameStore.getState().pendingInfrastructureUpgrades).toBe(0);
  });

  it("merges three identical units and opens a role-specific augment", () => {
    useGameStore.getState().resetCampaign();
    useGameStore.setState({
      coins: 100,
      shopItems: ["ec2", "ec2", "ec2", null, null],
    });

    useGameStore.getState().buyShopItem(0);
    useGameStore.getState().buyShopItem(1);
    useGameStore.getState().buyShopItem(2);

    const owned = useGameStore.getState().inventory.filter(Boolean);
    expect(owned).toHaveLength(1);
    expect(owned[0]?.starLevel).toBe(2);
    expect(useGameStore.getState().augmentState?.options).toHaveLength(3);
  });

  it("purchases maintenance passives and enables emergency maintenance", () => {
    useGameStore.getState().resetCampaign();
    useGameStore.setState({
      coins: 100,
      shopItems: [
        "emergencyMaintenance",
        "extendedMaintenance",
        "additionalMaintenance",
        null,
        null,
      ],
    });
    useGameStore.getState().buyShopItem(0);
    useGameStore.getState().buyShopItem(1);
    useGameStore.getState().buyShopItem(2);

    expect(useGameStore.getState().emergencyMaintenanceCharges).toBe(2);
    expect(useGameStore.getState().maintenanceExtensionMs).toBe(20_000);

    useGameStore.setState({ phase: "running" });
    useGameStore.getState().useEmergencyMaintenance();
    expect(useGameStore.getState().phase).toBe("prepare");
    expect(useGameStore.getState().maintenanceMode).toBe("emergency");
    expect(useGameStore.getState().emergencyMaintenanceCharges).toBe(1);
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
