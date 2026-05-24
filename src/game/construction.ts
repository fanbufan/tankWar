import { CONFIG } from "./config";
import type { EnemyType, GridPoint, LevelDefinition, TileType } from "./types";

export type EditableConstructionTile = "empty" | "brick" | "steel" | "grass" | "water" | "ice";

export const CONSTRUCTION_PLAYER_SPAWN: GridPoint = { x: 4, y: 12 };
export const CONSTRUCTION_PLAYER_2_SPAWN: GridPoint = { x: 8, y: 12 };
export const CONSTRUCTION_BASE: GridPoint = { x: 6, y: 12 };
export const CONSTRUCTION_ENEMY_SPAWNS: GridPoint[] = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 12, y: 0 }];
export const CONSTRUCTION_TILE_ORDER: EditableConstructionTile[] = ["empty", "brick", "steel", "grass", "water", "ice"];

const SYMBOL_BY_TILE: Record<TileType, string> = {
  empty: ".",
  brick: "#",
  steel: "=",
  grass: "%",
  water: "~",
  ice: "_",
  base: "$",
  baseDestroyed: "x",
};

const DEFAULT_CUSTOM_ENEMY_QUEUE: EnemyType[] = Array.from({ length: CONFIG.enemiesPerLevel }, (_, index) => {
  if (index % 7 === 6) return "armor";
  if (index % 5 === 4) return "power";
  if (index % 3 === 2) return "fast";
  return "normal";
});

export function createConstructionGrid(): TileType[][] {
  const grid = Array.from({ length: CONFIG.gridRows }, () => Array.from({ length: CONFIG.gridColumns }, () => "empty" as TileType));
  return normalizeConstructionGrid(grid);
}

export function cycleConstructionTile(grid: TileType[][], tile: GridPoint, reverse = false): TileType[][] {
  if (isConstructionLockedTile(tile)) {
    return grid.map((row) => [...row]);
  }

  const current = editableTileAt(grid, tile);
  const index = CONSTRUCTION_TILE_ORDER.indexOf(current);
  const delta = reverse ? -1 : 1;
  const next = CONSTRUCTION_TILE_ORDER[(index + delta + CONSTRUCTION_TILE_ORDER.length) % CONSTRUCTION_TILE_ORDER.length];

  return setConstructionTile(grid, tile, next);
}

export function setConstructionTile(grid: TileType[][], tile: GridPoint, tileType: EditableConstructionTile): TileType[][] {
  const next = grid.map((row) => [...row]);

  if (!inConstructionGrid(tile) || isConstructionLockedTile(tile)) {
    return normalizeConstructionGrid(next);
  }

  next[tile.y][tile.x] = tileType;
  return normalizeConstructionGrid(next);
}

export function buildConstructionLevel(grid: TileType[][]): LevelDefinition {
  const normalized = normalizeConstructionGrid(grid);

  return {
    id: 0,
    name: "CONSTRUCTION",
    map: normalized.map((row) => row.map((tile) => SYMBOL_BY_TILE[tile]).join("")),
    playerSpawn: { ...CONSTRUCTION_PLAYER_SPAWN },
    base: { ...CONSTRUCTION_BASE },
    enemySpawnPoints: CONSTRUCTION_ENEMY_SPAWNS.map((point) => ({ ...point })),
    enemyQueue: [...DEFAULT_CUSTOM_ENEMY_QUEUE],
  };
}

export function isConstructionLockedTile(tile: GridPoint): boolean {
  return constructionLockedTiles().some((locked) => locked.x === tile.x && locked.y === tile.y);
}

function normalizeConstructionGrid(grid: TileType[][]): TileType[][] {
  const next: TileType[][] = Array.from({ length: CONFIG.gridRows }, (_, y) =>
    Array.from({ length: CONFIG.gridColumns }, (_, x) => editableTileAt(grid, { x, y })),
  );

  for (const point of constructionLockedTiles()) {
    next[point.y][point.x] = lockedTileType(point);
  }

  return next;
}

function editableTileAt(grid: TileType[][], tile: GridPoint): EditableConstructionTile {
  if (!inConstructionGrid(tile)) {
    return "empty";
  }

  const current = grid[tile.y]?.[tile.x];
  return CONSTRUCTION_TILE_ORDER.includes(current as EditableConstructionTile) ? (current as EditableConstructionTile) : "empty";
}

function constructionLockedTiles(): GridPoint[] {
  return [
    ...CONSTRUCTION_ENEMY_SPAWNS.flatMap((spawn) => spawnPortalTiles(spawn)),
    CONSTRUCTION_PLAYER_SPAWN,
    CONSTRUCTION_PLAYER_2_SPAWN,
    ...baseGuardTiles(CONSTRUCTION_BASE),
    CONSTRUCTION_BASE,
  ];
}

function spawnPortalTiles(spawn: GridPoint): GridPoint[] {
  const tiles: GridPoint[] = [];

  for (let y = spawn.y; y <= spawn.y + 1 && y < CONFIG.gridRows; y += 1) {
    for (let x = Math.max(0, spawn.x - 1); x <= Math.min(CONFIG.gridColumns - 1, spawn.x + 1); x += 1) {
      tiles.push({ x, y });
    }
  }

  if (spawn.x === CONSTRUCTION_BASE.x && spawn.y + 2 < CONFIG.gridRows) {
    tiles.push({ x: spawn.x, y: spawn.y + 2 });
  }

  return tiles;
}

function baseGuardTiles(base: GridPoint): GridPoint[] {
  return [
    { x: base.x - 1, y: base.y },
    { x: base.x + 1, y: base.y },
    { x: base.x - 1, y: base.y - 1 },
    { x: base.x, y: base.y - 1 },
    { x: base.x + 1, y: base.y - 1 },
  ];
}

function lockedTileType(tile: GridPoint): TileType {
  if (tile.x === CONSTRUCTION_BASE.x && tile.y === CONSTRUCTION_BASE.y) {
    return "base";
  }

  if (baseGuardTiles(CONSTRUCTION_BASE).some((guard) => guard.x === tile.x && guard.y === tile.y)) {
    return "brick";
  }

  if (tile.x === CONSTRUCTION_BASE.x && tile.y === 2) {
    return "steel";
  }

  return "empty";
}

function inConstructionGrid(tile: GridPoint): boolean {
  return tile.x >= 0 && tile.x < CONFIG.gridColumns && tile.y >= 0 && tile.y < CONFIG.gridRows;
}
