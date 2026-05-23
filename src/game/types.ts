export type Direction = "up" | "down" | "left" | "right";
export type TileType = "empty" | "brick" | "steel" | "grass" | "water" | "ice" | "base" | "baseDestroyed";
export type EnemyType = "normal" | "fast" | "power" | "armor";
export type PowerUpType = "star" | "bomb" | "clock" | "shovel" | "helmet" | "tank";
export type ActorOwner = "player" | "enemy";

export interface GridPoint {
  x: number;
  y: number;
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
  pause: boolean;
}

export interface LevelDefinition {
  id: number;
  name: string;
  map: string[];
  playerSpawn: GridPoint;
  base: GridPoint;
  enemySpawnPoints: GridPoint[];
  enemyQueue: EnemyType[];
}

export interface ParsedLevel extends LevelDefinition {
  grid: TileType[][];
}

export interface TankState {
  id: string;
  owner: ActorOwner;
  type: EnemyType | "player";
  tile: GridPoint;
  direction: Direction;
  lives: number;
  armor: number;
  powerLevel: number;
  cooldownUntil: number;
  invulnerableUntil: number;
}

export interface BulletState {
  id: string;
  owner: ActorOwner;
  tile: GridPoint;
  direction: Direction;
}

export interface GameState {
  level: ParsedLevel;
  elapsedMs: number;
  player: TankState;
  enemies: TankState[];
  bullets: BulletState[];
  remainingEnemies: number;
  enemyQueue: EnemyType[];
  baseDestroyed: boolean;
  baseFortifiedUntil: number;
  enemyFrozenUntil: number;
  nextEnemySpawnIndex: number;
}
