import { CONFIG } from "./config";
import type { Direction, GridPoint } from "./types";

export interface PixelPoint {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const DIRECTION_STEP: Record<Direction, GridPoint> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function tileToCenter(point: GridPoint): PixelPoint {
  return {
    x: point.x * CONFIG.tileSize + CONFIG.tileSize / 2,
    y: point.y * CONFIG.tileSize + CONFIG.tileSize / 2,
  };
}

export function pixelToTile(point: PixelPoint): GridPoint {
  return {
    x: Math.floor(point.x / CONFIG.tileSize),
    y: Math.floor(point.y / CONFIG.tileSize),
  };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function centeredRect(point: PixelPoint, size: number): Rect {
  return {
    x: point.x - size / 2,
    y: point.y - size / 2,
    width: size,
    height: size,
  };
}

export function inGrid(point: GridPoint): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < CONFIG.gridColumns && point.y < CONFIG.gridRows;
}

