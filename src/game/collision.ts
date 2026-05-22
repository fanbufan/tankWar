import type { TileType } from "./types";

export function canOccupyTile(tile: TileType): boolean {
  return tile === "empty" || tile === "grass" || tile === "ice";
}

export function isBulletBlockedByTile(tile: TileType): boolean {
  return tile === "brick" || tile === "steel" || tile === "base" || tile === "baseDestroyed";
}

export function applyBulletToTile(tile: TileType): { nextTile: TileType; destroyed: boolean; baseDestroyed: boolean } {
  if (tile === "brick") {
    return { nextTile: "empty", destroyed: true, baseDestroyed: false };
  }

  if (tile === "base") {
    return { nextTile: "baseDestroyed", destroyed: true, baseDestroyed: true };
  }

  return { nextTile: tile, destroyed: false, baseDestroyed: false };
}
