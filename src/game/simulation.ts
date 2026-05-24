import type { ActorOwner, GameState, PowerUpType } from "./types";
import { LEVELS } from "../levels";
import { CONFIG } from "./config";
import { parseLevel } from "./level";

const DIRECTION_STEP = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
} as const;

export function createGameState(levelIndex: number): GameState {
  const level = parseLevel(LEVELS[levelIndex]);
  const enemyQueue = [...level.enemyQueue];

  return {
    level,
    elapsedMs: 0,
    player: {
      id: "player",
      owner: "player",
      type: "player",
      tile: { ...level.playerSpawn },
      direction: "up",
      lives: CONFIG.playerLives,
      armor: 1,
      powerLevel: 1,
      cooldownUntil: 0,
      invulnerableUntil: 0,
    },
    enemies: [],
    bullets: [],
    remainingEnemies: enemyQueue.length,
    enemyQueue,
    baseDestroyed: false,
    baseFortifiedUntil: 0,
    enemyFrozenUntil: 0,
    nextEnemySpawnIndex: 0,
  };
}

export function spawnEnemy(state: GameState): void {
  if (state.enemies.length >= CONFIG.maxActiveEnemies || state.enemyQueue.length === 0) {
    return;
  }

  const type = state.enemyQueue.shift();

  if (!type) {
    return;
  }

  const spawnPoint = state.level.enemySpawnPoints[state.nextEnemySpawnIndex % state.level.enemySpawnPoints.length];

  state.enemies.push({
    id: `enemy-${state.elapsedMs}-${state.nextEnemySpawnIndex}`,
    owner: "enemy",
    type,
    tile: { ...spawnPoint },
    direction: "down",
    lives: 1,
    armor: CONFIG.enemyTypes[type].health,
    powerLevel: 1,
    cooldownUntil: state.elapsedMs + 700,
    invulnerableUntil: state.elapsedMs + 600,
  });

  state.nextEnemySpawnIndex += 1;
  state.remainingEnemies = state.enemyQueue.length;
}

export function fireBullet(state: GameState, owner: ActorOwner): boolean {
  const shooter = owner === "player" ? state.player : state.enemies[0];

  if (!shooter || shooter.cooldownUntil > state.elapsedMs) {
    return false;
  }

  const step = DIRECTION_STEP[shooter.direction];

  state.bullets.push({
    id: `bullet-${owner}-${state.elapsedMs}-${state.bullets.length}`,
    owner,
    tile: {
      x: shooter.tile.x + step.x,
      y: shooter.tile.y + step.y,
    },
    direction: shooter.direction,
  });

  shooter.cooldownUntil = state.elapsedMs + CONFIG.playerFireCooldownMs;
  return true;
}

export function tickGame(state: GameState, deltaMs: number): void {
  state.elapsedMs += deltaMs;
}

export function applyPowerUp(state: GameState, powerUp: PowerUpType): void {
  if (powerUp === "star") {
    state.player.powerLevel = Math.min(CONFIG.maxPlayerPowerLevel, state.player.powerLevel + 1);
    return;
  }

  if (powerUp === "helmet") {
    state.player.invulnerableUntil = state.elapsedMs + CONFIG.powerUpDurations.helmetMs;
    return;
  }

  if (powerUp === "shovel") {
    state.baseFortifiedUntil = state.elapsedMs + CONFIG.powerUpDurations.shovelMs;
    return;
  }

  if (powerUp === "tank") {
    state.player.lives += 1;
    return;
  }

  if (powerUp === "clock") {
    state.enemyFrozenUntil = state.elapsedMs + CONFIG.powerUpDurations.clockMs;
    return;
  }

  state.enemies = [];
}
