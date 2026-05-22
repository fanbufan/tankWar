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

  grid[level.base.y][level.base.x] = "base";

  return {
    ...level,
    enemyQueue: [...level.enemyQueue],
    enemySpawnPoints: level.enemySpawnPoints.map((point) => ({ ...point })),
    playerSpawn: { ...level.playerSpawn },
    base: { ...level.base },
    grid,
  };
}
