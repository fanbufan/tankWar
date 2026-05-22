import { describe, expect, it } from "vitest";
import { canOccupyTile, isBulletBlockedByTile, applyBulletToTile } from "../src/game/collision";
import type { TileType } from "../src/game/types";

describe("terrain collision", () => {
  it("blocks tanks on walls, water, steel, and base tiles but not grass or ice", () => {
    const blocked: TileType[] = ["brick", "steel", "water", "base"];
    const passable: TileType[] = ["empty", "grass", "ice"];

    expect(blocked.every((tile) => canOccupyTile(tile) === false)).toBe(true);
    expect(passable.every((tile) => canOccupyTile(tile) === true)).toBe(true);
  });

  it("lets bullets destroy brick, stop on steel, pass through grass, and destroy the base", () => {
    expect(isBulletBlockedByTile("grass")).toBe(false);
    expect(applyBulletToTile("brick")).toEqual({ nextTile: "empty", destroyed: true, baseDestroyed: false });
    expect(applyBulletToTile("steel")).toEqual({ nextTile: "steel", destroyed: false, baseDestroyed: false });
    expect(applyBulletToTile("base")).toEqual({ nextTile: "baseDestroyed", destroyed: true, baseDestroyed: true });
  });
});

