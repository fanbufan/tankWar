import type { EnemyType, GridPoint, LevelDefinition } from "../game/types";

type LevelSymbol = "." | "#" | "=" | "%" | "~" | "_";

const GRID_SIZE = 13;
const STAGE_COUNT = 35;
const ENEMIES_PER_STAGE = 20;

const PLAYER_SPAWN: GridPoint = { x: 4, y: 12 };
const BASE: GridPoint = { x: 6, y: 12 };
const ENEMY_SPAWN_POINTS: GridPoint[] = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 12, y: 0 }];

const THEME_NAMES = [
  "Brick Canal",
  "Frozen Line",
  "Grass Citadel",
  "Water Cross",
  "Steel Gate",
  "Mirror Maze",
  "Open Field",
];

export const LEVELS: LevelDefinition[] = Array.from({ length: STAGE_COUNT }, (_, stageIndex) => ({
  id: stageIndex + 1,
  name: `${THEME_NAMES[stageIndex % THEME_NAMES.length]} ${Math.floor(stageIndex / THEME_NAMES.length) + 1}`,
  map: makeMap(stageIndex),
  playerSpawn: { ...PLAYER_SPAWN },
  base: { ...BASE },
  enemySpawnPoints: ENEMY_SPAWN_POINTS.map((point) => ({ ...point })),
  enemyQueue: enemyQueueForStage(stageIndex),
}));

function enemyQueueForStage(stageIndex: number): EnemyType[] {
  return Array.from({ length: ENEMIES_PER_STAGE }, (_, index) => {
    const phase = index + stageIndex * 2;

    if (stageIndex >= 28 && index % 4 === 0) return "armor";
    if (phase % 7 === 0) return "armor";
    if (phase % 5 === 0) return "power";
    if (phase % 3 === 0 || (stageIndex >= 14 && index % 4 === 1)) return "fast";
    return "normal";
  });
}

function makeMap(stageIndex: number): string[] {
  const grid = makeEmptyGrid();
  const band = Math.floor(stageIndex / THEME_NAMES.length);

  addTheme(grid, stageIndex % THEME_NAMES.length, band);
  addDifficultyLayer(grid, band, stageIndex);
  clearPlayAnchors(grid);

  return grid.map((row) => row.join(""));
}

function makeEmptyGrid(): LevelSymbol[][] {
  return Array.from({ length: GRID_SIZE }, () => Array.from({ length: GRID_SIZE }, () => ".") as LevelSymbol[]);
}

function addTheme(grid: LevelSymbol[][], theme: number, band: number): void {
  if (theme === 0) {
    addBrickCanal(grid, band);
    return;
  }

  if (theme === 1) {
    addFrozenLine(grid, band);
    return;
  }

  if (theme === 2) {
    addGrassCitadel(grid, band);
    return;
  }

  if (theme === 3) {
    addWaterCross(grid, band);
    return;
  }

  if (theme === 4) {
    addSteelGate(grid, band);
    return;
  }

  if (theme === 5) {
    addMirrorMaze(grid, band);
    return;
  }

  addOpenField(grid, band);
}

function addBrickCanal(grid: LevelSymbol[][], band: number): void {
  for (const y of [2, 4, 8, 10]) {
    mirrorSet(grid, 2, y, "#");
    mirrorSet(grid, 4, y, "#");
  }

  for (const y of [3, 9]) {
    mirrorSet(grid, 2, y, "~");
    mirrorSet(grid, 3, y, "~");
  }

  for (const y of [5, 7]) {
    mirrorSet(grid, 2, y, band >= 2 ? "=" : "#");
    mirrorSet(grid, 5, y, "#");
  }

  setTile(grid, 6, 4, "=");
  setTile(grid, 6, 8, "#");
}

function addFrozenLine(grid: LevelSymbol[][], band: number): void {
  for (const y of [5, 7]) {
    for (let x = 1; x < GRID_SIZE - 1; x += 1) {
      if (x !== 6) setTile(grid, x, y, "_");
    }
  }

  for (const y of [2, 3, 9, 10]) {
    mirrorSet(grid, 2, y, "#");
    mirrorSet(grid, 4, y, band >= 2 && y % 2 === 0 ? "=" : "#");
  }

  mirrorSet(grid, 1, 6, "#");
  mirrorSet(grid, 5, 6, band >= 3 ? "=" : "#");
}

function addGrassCitadel(grid: LevelSymbol[][], band: number): void {
  for (const y of [2, 3, 8, 9]) {
    mirrorSet(grid, 2, y, "%");
    mirrorSet(grid, 3, y, "%");
    mirrorSet(grid, 5, y, "#");
  }

  for (const y of [4, 6]) {
    mirrorSet(grid, 1, y, "#");
    mirrorSet(grid, 4, y, band >= 2 ? "=" : "#");
  }

  setTile(grid, 6, 5, "#");
  setTile(grid, 6, 7, band >= 3 ? "=" : "#");
}

function addWaterCross(grid: LevelSymbol[][], band: number): void {
  for (const y of [3, 4, 8, 9]) {
    mirrorSet(grid, 2, y, "~");
    mirrorSet(grid, 3, y, "~");
  }

  for (const y of [2, 5, 7, 10]) {
    mirrorSet(grid, 1, y, "#");
    mirrorSet(grid, 5, y, "#");
  }

  setTile(grid, 6, 6, band >= 3 ? "=" : "#");
}

function addSteelGate(grid: LevelSymbol[][], band: number): void {
  for (const y of [2, 4, 6, 8, 10]) {
    mirrorSet(grid, 2, y, y === 6 || band >= 2 ? "=" : "#");
    mirrorSet(grid, 4, y, "#");
  }

  for (const y of [3, 9]) {
    mirrorSet(grid, 5, y, "%");
  }

  setTile(grid, 6, 4, "=");
  setTile(grid, 6, 8, band >= 3 ? "=" : "#");
}

function addMirrorMaze(grid: LevelSymbol[][], band: number): void {
  for (let y = 2; y <= 10; y += 1) {
    const left = y % 2 === 0 ? 1 : 3;
    const right = y % 2 === 0 ? 4 : 2;
    mirrorSet(grid, left, y, "#");
    mirrorSet(grid, right, y, band >= 3 && y % 3 === 0 ? "=" : "#");
  }

  mirrorSet(grid, 5, 3, "%");
  mirrorSet(grid, 5, 9, "%");
  setTile(grid, 6, 6, band >= 2 ? "~" : "#");
}

function addOpenField(grid: LevelSymbol[][], band: number): void {
  for (const y of [2, 6, 10]) {
    mirrorSet(grid, 2, y, "#");
    mirrorSet(grid, 5, y, "#");
  }

  for (const y of [4, 8]) {
    mirrorSet(grid, 3, y, "%");
    mirrorSet(grid, 4, y, band >= 2 ? "_" : "%");
  }

  if (band >= 3) {
    mirrorSet(grid, 1, 5, "~");
    mirrorSet(grid, 1, 7, "~");
  }
}

function addDifficultyLayer(grid: LevelSymbol[][], band: number, stageIndex: number): void {
  if (band >= 1) {
    mirrorSet(grid, 1 + (stageIndex % 2), 11, "#");
    mirrorSet(grid, 4, 3 + (stageIndex % 3), "%");
  }

  if (band >= 2) {
    mirrorSet(grid, 3, 6, stageIndex % 2 === 0 ? "=" : "#");
    mirrorSet(grid, 5, 2 + (stageIndex % 2), "#");
  }

  if (band >= 3) {
    mirrorSet(grid, 2, 5 + (stageIndex % 3), stageIndex % 2 === 0 ? "~" : "_");
  }

  if (band >= 4) {
    mirrorSet(grid, 4, 10, "=");
    setTile(grid, 6, 9, "#");
  }
}

function clearPlayAnchors(grid: LevelSymbol[][]): void {
  for (const spawn of ENEMY_SPAWN_POINTS) {
    for (let y = spawn.y; y <= spawn.y + 1; y += 1) {
      for (let x = Math.max(0, spawn.x - 1); x <= Math.min(GRID_SIZE - 1, spawn.x + 1); x += 1) {
        setTile(grid, x, y, ".");
      }
    }
  }

  for (const tile of [
    PLAYER_SPAWN,
    { x: PLAYER_SPAWN.x, y: PLAYER_SPAWN.y - 1 },
    { x: PLAYER_SPAWN.x, y: PLAYER_SPAWN.y - 2 },
    { x: PLAYER_SPAWN.x - 1, y: PLAYER_SPAWN.y },
    { x: BASE.x - 2, y: BASE.y },
    { x: BASE.x + 2, y: BASE.y },
    { x: BASE.x - 2, y: BASE.y - 1 },
    { x: BASE.x + 2, y: BASE.y - 1 },
  ]) {
    setTile(grid, tile.x, tile.y, ".");
  }
}

function mirrorSet(grid: LevelSymbol[][], x: number, y: number, symbol: LevelSymbol): void {
  setTile(grid, x, y, symbol);
  setTile(grid, GRID_SIZE - 1 - x, y, symbol);
}

function setTile(grid: LevelSymbol[][], x: number, y: number, symbol: LevelSymbol): void {
  if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
    grid[y][x] = symbol;
  }
}
