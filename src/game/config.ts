export const CONFIG = {
  gridColumns: 13,
  gridRows: 13,
  tileSize: 32,
  sidePanelWidth: 128,
  tankSize: 26,
  bulletSize: 6,
  fixedStepMs: 16,
  turnSnapPixels: 16,
  maxActiveEnemies: 4,
  enemiesPerLevel: 20,
  playerLives: 3,
  playerFireCooldownMs: 380,
  enemyFireCooldownMs: 1150,
  enemySpawnIntervalMs: 1500,
  playerSpeed: 104,
  enemySpeeds: {
    normal: 68,
    fast: 94,
    armor: 54,
  },
  bulletSpeed: 250,
  powerUpSpawnIntervalMs: 8500,
  powerUpDurations: {
    helmetMs: 8000,
    shovelMs: 10000,
    clockMs: 6500,
  },
} as const;

export const GAME_WIDTH = CONFIG.gridColumns * CONFIG.tileSize + CONFIG.sidePanelWidth;
export const GAME_HEIGHT = CONFIG.gridRows * CONFIG.tileSize;
