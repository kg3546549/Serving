import { describe, expect, it } from "vitest";
import { resolveNodeGesture } from "./nodeGesture";

describe("resolveNodeGesture", () => {
  it("opens details after a short right click", () => {
    expect(
      resolveNodeGesture({
        dragged: false,
        source: "entry",
        target: null,
        position: { column: 0, row: 1 },
        positionOccupied: false,
      }),
    ).toEqual({ type: "details", nodeId: "entry" });
  });

  it("connects nodes when a right drag ends on another device", () => {
    expect(
      resolveNodeGesture({
        dragged: true,
        source: "entry",
        target: "serverA",
        position: { column: 5, row: 0 },
        positionOccupied: true,
      }),
    ).toEqual({ type: "connect", from: "entry", to: "serverA" });
  });

  it("moves a node when a right drag ends on an empty grid cell", () => {
    expect(
      resolveNodeGesture({
        dragged: true,
        source: "entry",
        target: null,
        position: { column: 2, row: 3 },
        positionOccupied: false,
      }),
    ).toEqual({
      type: "move",
      nodeId: "entry",
      position: { column: 2, row: 3 },
    });
  });

  it("uses release distance when intermediate pointer moves are missing", () => {
    expect(
      resolveNodeGesture({
        dragged: false,
        movementDistance: 120,
        source: "serverA",
        target: null,
        position: { column: 3, row: 2 },
        positionOccupied: false,
      }),
    ).toEqual({
      type: "move",
      nodeId: "serverA",
      position: { column: 3, row: 2 },
    });
  });

  it("rejects a right drag ending outside an available cell", () => {
    expect(
      resolveNodeGesture({
        dragged: true,
        source: "entry",
        target: null,
        position: null,
        positionOccupied: true,
      }),
    ).toEqual({ type: "invalid" });
  });
});
