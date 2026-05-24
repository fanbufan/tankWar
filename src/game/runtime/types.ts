import type { Direction, EnemyType, GridPoint, InputState, LevelDefinition, PowerUpType, TileType } from "../types";
import type { PixelPoint } from "../geometry";

export type RuntimeInput = InputState;
export type RuntimeStatus = "playing" | "paused" | "level-complete" | "victory" | "defeat";
export type TerrainDamageSide = "top" | "right" | "bottom" | "left";
export type RuntimeEventType =
  | "shot"
  | "enemy-spawned"
  | "enemy-destroyed"
  | "hit"
  | "explosion"
  | "powerup-spawned"
  | "powerup-collected"
  | "bonus-life"
  | "life-lost"
  | "player-stunned"
  | "base-destroyed"
  | "level-complete";

export interface RuntimeEvent {
  type: RuntimeEventType;
  owner?: "player" | "enemy";
  position?: PixelPoint;
  enemyType?: EnemyType;
  powerUp?: PowerUpType;
  score?: number;
}

export interface RuntimeTankSnapshot {
  id: string;
  owner: "player" | "enemy";
  type: "player" | EnemyType;
  position: PixelPoint;
  tile: GridPoint;
  direction: Direction;
  armor: number;
  lives: number;
  powerLevel: number;
  invulnerableUntil: number;
  stunnedUntil: number;
  carriesPowerUp: boolean;
  spawningUntil: number;
  spawnPointIndex?: number;
}

export interface RuntimeBulletSnapshot {
  id: string;
  owner: "player" | "enemy";
  position: PixelPoint;
  direction: Direction;
  power: number;
}

export interface RuntimePowerUpSnapshot {
  type: PowerUpType;
  tile: GridPoint;
  expiresAt: number;
}

export interface RuntimeExplosionSnapshot {
  position: PixelPoint;
  until: number;
}

export interface RuntimeHudSnapshot {
  stageLabel: string;
  isCustomStage: boolean;
  lives: number;
  livesP2?: number;
  enemies: number;
  score: number;
  power: number;
  powerP2?: number;
  item?: PowerUpType;
}

export interface RuntimeTerrainDamageSnapshot {
  tile: GridPoint;
  kind: "brick" | "steel";
  brickMask?: number;
  steelHits?: Partial<Record<TerrainDamageSide, number>>;
}

export interface RuntimeStageStatsSnapshot {
  destroyedEnemies: Record<EnemyType, number>;
  enemyScore: Record<EnemyType, number>;
  powerUpScore: number;
  bonusLives: number;
  totalScore: number;
}

export interface RuntimeSnapshot {
  elapsedMs: number;
  levelIndex: number;
  status: RuntimeStatus;
  base: GridPoint;
  grid: TileType[][];
  player: RuntimeTankSnapshot;
  player2?: RuntimeTankSnapshot;
  enemies: RuntimeTankSnapshot[];
  bullets: RuntimeBulletSnapshot[];
  powerUps: RuntimePowerUpSnapshot[];
  explosions: RuntimeExplosionSnapshot[];
  terrainDamage: RuntimeTerrainDamageSnapshot[];
  stageStats: RuntimeStageStatsSnapshot;
  hud: RuntimeHudSnapshot;
  baseFortifiedUntil: number;
  enemyFrozenUntil: number;
}

export interface RuntimeInitialEnemy {
  type: EnemyType;
  tile: GridPoint;
  direction: Direction;
  cooldownUntil?: number;
  decisionAt?: number;
  invulnerableUntil?: number;
  carriesPowerUp?: boolean;
  spawningUntil?: number;
}

export interface RuntimeOptions {
  suppressInitialEnemies?: boolean;
  disableEnemySpawns?: boolean;
  twoPlayers?: boolean;
  playerTile?: GridPoint;
  player2Tile?: GridPoint;
  playerDirection?: Direction;
  player2Direction?: Direction;
  playerInvulnerableUntil?: number;
  player2InvulnerableUntil?: number;
  initialEnemies?: RuntimeInitialEnemy[];
  customLevel?: LevelDefinition;
  seed?: number;
}

export interface StageTuning {
  basePressure: number;
  enemySpawnIntervalMs: number;
  powerUpSpawnIntervalMs: number;
  enemyFireCooldownScale: number;
}

export interface RuntimeInputFrame {
  player1: RuntimeInput;
  player2?: RuntimeInput;
  pause?: boolean;
}
