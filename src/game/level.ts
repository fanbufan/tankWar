import type { LevelDefinition, ParsedLevel, TileType } from "./types";
import { CONFIG } from "./config";

const TILE_BY_SYMBOL: Record<string, TileType> = {
  ".": "empty",
  "#": "brick",
  "=": "steel",
  "%": "grass",
  "~": "water",
  "_": "ice",
  "$": "base",
  "x": "baseDestroyed",
};

function tileFromSymbol(symbol: string): TileType {
  const tile = TILE_BY_SYMBOL[symbol];

  if (!tile) {
    throw new Error(`Unknown level tile symbol "${symbol}".`);
  }

  return tile;
}

export function parseLevel(level: LevelDefinition): ParsedLevel {
  if (level.map.length !== CONFIG.gridRows) {
    throw new Error(`Level ${level.id} must have ${CONFIG.gridRows} rows.`);
  }

  const grid = level.map.map((row, rowIndex) => {
    if (row.length !== CONFIG.gridColumns) {
      throw new Error(`Level ${level.id} row ${rowIndex} must have ${CONFIG.gridColumns} columns.`);
    }

    return Array.from(row, tileFromSymbol);
  });

  clearTankSpawns(grid, level);
  normalizeSpawnSafety(grid, level);
  normalizeBaseGuard(grid, level);

  return {
    ...level,
    enemyQueue: [...level.enemyQueue],
    enemySpawnPoints: level.enemySpawnPoints.map((point) => ({ ...point })),
    playerSpawn: { ...level.playerSpawn },
    base: { ...level.base },
    grid,
  };
}

function clearTankSpawns(grid: TileType[][], level: LevelDefinition): void {
  for (const point of [level.playerSpawn, ...level.enemySpawnPoints]) {
    grid[point.y][point.x] = "empty";
  }

  for (const point of level.enemySpawnPoints) {
    for (let y = point.y; y <= point.y + 1 && y < CONFIG.gridRows; y += 1) {
      for (let x = Math.max(0, point.x - 1); x <= Math.min(CONFIG.gridColumns - 1, point.x + 1); x += 1) {
        grid[y][x] = "empty";
      }
    }
  }
}

function normalizeSpawnSafety(grid: TileType[][], level: LevelDefinition): void {
  for (const point of level.enemySpawnPoints) {
    if (point.x !== level.base.x) {
      continue;
    }

    const safetyTile = { x: point.x, y: point.y + 2 };

    if (safetyTile.y < CONFIG.gridRows) {
      grid[safetyTile.y][safetyTile.x] = "steel";
    }
  }
}

function normalizeBaseGuard(grid: TileType[][], level: LevelDefinition): void {
  const { x, y } = level.base;

  for (let yy = y - 1; yy <= y; yy += 1) {
    for (let xx = x - 2; xx <= x + 2; xx += 1) {
      if (yy >= 0 && yy < CONFIG.gridRows && xx >= 0 && xx < CONFIG.gridColumns) {
        grid[yy][xx] = "empty";
      }
    }
  }

  for (const guard of baseGuardTiles(level.base)) {
    grid[guard.y][guard.x] = "brick";
  }

  grid[y][x] = "base";
}

function baseGuardTiles(base: { x: number; y: number }): Array<{ x: number; y: number }> {
  return [
    { x: base.x - 1, y: base.y },
    { x: base.x + 1, y: base.y },
    { x: base.x - 1, y: base.y - 1 },
    { x: base.x, y: base.y - 1 },
    { x: base.x + 1, y: base.y - 1 },
  ];
}
