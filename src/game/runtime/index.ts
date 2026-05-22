import { LEVELS } from "../../levels";
import { applyBulletToTile, canOccupyTile, isBulletBlockedByTile } from "../collision";
import { CONFIG, GAME_HEIGHT } from "../config";
import { centeredRect, DIRECTION_STEP, inGrid, pixelToTile, rectsOverlap, tileToCenter } from "../geometry";
import { parseLevel } from "../level";
import type { Direction, EnemyType, GridPoint, ParsedLevel, PowerUpType, TileType } from "../types";
import type {
  RuntimeBulletSnapshot,
  RuntimeEvent,
  RuntimeExplosionSnapshot,
  RuntimeHudSnapshot,
  RuntimeInitialEnemy,
  RuntimeInput,
  RuntimeOptions,
  RuntimePowerUpSnapshot,
  RuntimeSnapshot,
  RuntimeStatus,
  RuntimeTankSnapshot,
  StageTuning,
} from "./types";

interface RuntimeTank {
  id: string;
  owner: "player" | "enemy";
  type: "player" | EnemyType;
  position: { x: number; y: number };
  direction: Direction;
  speed: number;
  armor: number;
  lives: number;
  powerLevel: number;
  cooldownUntil: number;
  decisionAt: number;
  invulnerableUntil: number;
  spawnPointIndex?: number;
}

interface RuntimeBullet {
  id: string;
  owner: "player" | "enemy";
  position: { x: number; y: number };
  direction: Direction;
  speed: number;
  power: number;
}

interface RuntimePowerUp {
  type: PowerUpType;
  tile: GridPoint;
  expiresAt: number;
}

interface RuntimeExplosion {
  position: { x: number; y: number };
  until: number;
}

export interface Runtime {
  levelIndex: number;
  score: number;
  level: ParsedLevel;
  grid: TileType[][];
  player: RuntimeTank;
  enemies: RuntimeTank[];
  bullets: RuntimeBullet[];
  explosions: RuntimeExplosion[];
  powerUps: RuntimePowerUp[];
  enemyQueue: EnemyType[];
  elapsedMs: number;
  accumulatorMs: number;
  status: RuntimeStatus;
  nextEnemySpawnAt: number;
  nextPowerUpAt: number;
  nextEnemySpawnIndex: number;
  powerUpCursor: number;
  enemySpawnsDisabled: boolean;
  baseFortifiedUntil: number;
  enemyFrozenUntil: number;
  lastPausePressed: boolean;
  rng: number;
}

const DIRECTIONS: Direction[] = ["up", "down", "left", "right"];
const POWER_UP_ORDER: PowerUpType[] = ["star", "helmet", "clock", "shovel", "bomb", "tank"];
const SCORE_BY_ENEMY: Record<EnemyType, number> = {
  normal: 200,
  fast: 300,
  armor: 400,
};

export function getStageTuning(levelIndex: number): StageTuning {
  const stage = Math.min(Math.max(levelIndex, 0), 2);

  return {
    basePressure: [62, 72, 84][stage],
    enemySpawnIntervalMs: [1500, 1300, 1120][stage],
    powerUpSpawnIntervalMs: [7800, 8600, 9400][stage],
    enemyFireCooldownScale: [1, 0.92, 0.84][stage],
  };
}

export function createRuntime(levelIndex: number, score = 0, options: RuntimeOptions = {}): Runtime {
  const level = parseLevel(LEVELS[levelIndex]);
  const tuning = getStageTuning(levelIndex);
  const playerTile = options.playerTile ?? level.playerSpawn;
  const runtime: Runtime = {
    levelIndex,
    score,
    level,
    grid: level.grid.map((row) => [...row]),
    player: {
      id: "player",
      owner: "player",
      type: "player",
      position: tileToCenter(playerTile),
      direction: options.playerDirection ?? "up",
      speed: CONFIG.playerSpeed,
      armor: 1,
      lives: CONFIG.playerLives,
      powerLevel: 1,
      cooldownUntil: 0,
      decisionAt: 0,
      invulnerableUntil: options.playerInvulnerableUntil ?? 1600,
    },
    enemies: [],
    bullets: [],
    explosions: [],
    powerUps: [],
    enemyQueue: [...level.enemyQueue],
    elapsedMs: 0,
    accumulatorMs: 0,
    status: "playing",
    nextEnemySpawnAt: 0,
    nextPowerUpAt: tuning.powerUpSpawnIntervalMs,
    nextEnemySpawnIndex: 0,
    powerUpCursor: levelIndex,
    enemySpawnsDisabled: options.disableEnemySpawns ?? false,
    baseFortifiedUntil: 0,
    enemyFrozenUntil: 0,
    lastPausePressed: false,
    rng: options.seed ?? 17 + levelIndex * 97,
  };

  for (const enemy of options.initialEnemies ?? []) {
    addEnemy(runtime, enemy);
  }

  if (!options.suppressInitialEnemies && runtime.enemies.length === 0) {
    spawnEnemy(runtime);
    spawnEnemy(runtime);
  }

  return runtime;
}

export function stepRuntime(runtime: Runtime, input: RuntimeInput, deltaMs: number): RuntimeEvent[] {
  const events: RuntimeEvent[] = [];

  if (input.pause && !runtime.lastPausePressed && (runtime.status === "playing" || runtime.status === "paused")) {
    runtime.status = runtime.status === "paused" ? "playing" : "paused";
  }

  runtime.lastPausePressed = input.pause;

  if (runtime.status !== "playing") {
    return events;
  }

  runtime.accumulatorMs += Math.min(deltaMs, 100);

  while (runtime.accumulatorMs >= CONFIG.fixedStepMs && runtime.status === "playing") {
    tickRuntime(runtime, input, CONFIG.fixedStepMs, events);
    runtime.accumulatorMs -= CONFIG.fixedStepMs;
  }

  return events;
}

export function toggleRuntimePause(runtime: Runtime): void {
  if (runtime.status === "playing") {
    runtime.status = "paused";
    return;
  }

  if (runtime.status === "paused") {
    runtime.status = "playing";
  }
}

export function getRuntimeSnapshot(runtime: Runtime): RuntimeSnapshot {
  return {
    elapsedMs: runtime.elapsedMs,
    levelIndex: runtime.levelIndex,
    status: runtime.status,
    base: { ...runtime.level.base },
    grid: runtime.grid.map((row) => [...row]),
    player: tankSnapshot(runtime.player),
    enemies: runtime.enemies.map(tankSnapshot),
    bullets: runtime.bullets.map(bulletSnapshot),
    powerUps: runtime.powerUps.map(powerUpSnapshot),
    explosions: runtime.explosions.map(explosionSnapshot),
    hud: hudSnapshot(runtime),
    baseFortifiedUntil: runtime.baseFortifiedUntil,
    enemyFrozenUntil: runtime.enemyFrozenUntil,
  };
}

function tickRuntime(runtime: Runtime, input: RuntimeInput, stepMs: number, events: RuntimeEvent[]): void {
  runtime.elapsedMs += stepMs;
  const seconds = stepMs / 1000;

  updatePlayer(runtime, input, seconds, events);
  updateEnemies(runtime, seconds, events);
  updateBullets(runtime, seconds, events);
  updatePowerUps(runtime, events);
  updateExplosions(runtime);
  spawnEnemiesOnSchedule(runtime);
  spawnPowerUpOnSchedule(runtime);
  checkRuntimeEnd(runtime, events);
}

function updatePlayer(runtime: Runtime, input: RuntimeInput, seconds: number, events: RuntimeEvent[]): void {
  const direction = directionFromInput(input);

  if (direction) {
    moveTank(runtime, runtime.player, direction, runtime.player.speed * seconds);
  }

  if (input.fire) {
    tryFire(runtime, runtime.player, events);
  }
}

function updateEnemies(runtime: Runtime, seconds: number, events: RuntimeEvent[]): void {
  if (runtime.elapsedMs < runtime.enemyFrozenUntil) {
    return;
  }

  for (const enemy of runtime.enemies) {
    if (runtime.elapsedMs >= enemy.decisionAt) {
      enemy.direction = chooseEnemyDirection(runtime, enemy);
      enemy.decisionAt = runtime.elapsedMs + nextRandom(runtime, 430, 830);
    }

    const moved = moveTank(runtime, enemy, enemy.direction, enemy.speed * seconds);

    if (!moved) {
      enemy.direction = chooseFallbackDirection(runtime, enemy);
      enemy.decisionAt = runtime.elapsedMs + 180;
    }

    if (runtime.elapsedMs >= enemy.cooldownUntil) {
      tryFire(runtime, enemy, events);
    }
  }
}

function updateBullets(runtime: Runtime, seconds: number, events: RuntimeEvent[]): void {
  const keptBullets: RuntimeBullet[] = [];

  for (const bullet of runtime.bullets) {
    const step = DIRECTION_STEP[bullet.direction];
    bullet.position.x += step.x * bullet.speed * seconds;
    bullet.position.y += step.y * bullet.speed * seconds;

    if (!isInsideBoard(bullet.position)) {
      addExplosion(runtime, bullet.position, events);
      continue;
    }

    if (handleBulletTerrainCollision(runtime, bullet, events)) {
      continue;
    }

    if (handleBulletTankCollision(runtime, bullet, events)) {
      continue;
    }

    keptBullets.push(bullet);
  }

  runtime.bullets = keptBullets;
}

function updatePowerUps(runtime: Runtime, events: RuntimeEvent[]): void {
  runtime.powerUps = runtime.powerUps.filter((powerUp) => powerUp.expiresAt > runtime.elapsedMs);
  const playerTile = pixelToTile(runtime.player.position);
  const collected = runtime.powerUps.find((powerUp) => powerUp.tile.x === playerTile.x && powerUp.tile.y === playerTile.y);

  if (!collected) {
    return;
  }

  applyPlayerPowerUp(runtime, collected.type, events);
  runtime.powerUps = runtime.powerUps.filter((powerUp) => powerUp !== collected);
}

function updateExplosions(runtime: Runtime): void {
  runtime.explosions = runtime.explosions.filter((explosion) => explosion.until > runtime.elapsedMs);
}

function spawnEnemiesOnSchedule(runtime: Runtime): void {
  if (runtime.enemySpawnsDisabled) {
    return;
  }

  if (runtime.elapsedMs < runtime.nextEnemySpawnAt) {
    return;
  }

  spawnEnemy(runtime);
  runtime.nextEnemySpawnAt = runtime.elapsedMs + getStageTuning(runtime.levelIndex).enemySpawnIntervalMs;
}

function spawnPowerUpOnSchedule(runtime: Runtime): void {
  if (runtime.elapsedMs < runtime.nextPowerUpAt || runtime.powerUps.length > 0) {
    return;
  }

  const candidates: GridPoint[] = [];

  for (let y = 1; y < CONFIG.gridRows - 1; y += 1) {
    for (let x = 1; x < CONFIG.gridColumns - 1; x += 1) {
      const tile = { x, y };

      if (terrainAt(runtime, tile) === "empty" && !isTankAt(runtime, tile)) {
        candidates.push(tile);
      }
    }
  }

  if (candidates.length === 0) {
    return;
  }

  const tile = candidates[(runtime.levelIndex * 17 + runtime.powerUpCursor * 11) % candidates.length];
  const type = POWER_UP_ORDER[runtime.powerUpCursor % POWER_UP_ORDER.length];
  runtime.powerUps.push({ type, tile, expiresAt: runtime.elapsedMs + 10000 });
  runtime.powerUpCursor += 1;
  runtime.nextPowerUpAt = runtime.elapsedMs + getStageTuning(runtime.levelIndex).powerUpSpawnIntervalMs;
}

function spawnEnemy(runtime: Runtime): void {
  if (runtime.enemyQueue.length === 0 || runtime.enemies.length >= CONFIG.maxActiveEnemies) {
    return;
  }

  const type = runtime.enemyQueue.shift();

  if (!type) {
    return;
  }

  const spawnPointIndex = runtime.nextEnemySpawnIndex % runtime.level.enemySpawnPoints.length;
  const spawn = runtime.level.enemySpawnPoints[spawnPointIndex];
  addEnemy(runtime, { type, tile: spawn, direction: "down", cooldownUntil: enemyCooldown(runtime) }, spawnPointIndex);
  runtime.nextEnemySpawnIndex += 1;
}

function addEnemy(runtime: Runtime, enemy: RuntimeInitialEnemy, spawnPointIndex?: number): void {
  runtime.enemies.push({
    id: `enemy-${runtime.elapsedMs}-${runtime.enemies.length}-${runtime.nextEnemySpawnIndex}`,
    owner: "enemy",
    type: enemy.type,
    position: tileToCenter(enemy.tile),
    direction: enemy.direction,
    speed: CONFIG.enemySpeeds[enemy.type],
    armor: enemy.type === "armor" ? 3 : 1,
    lives: 1,
    powerLevel: 1,
    cooldownUntil: enemy.cooldownUntil ?? enemyCooldown(runtime),
    decisionAt: enemy.decisionAt ?? runtime.elapsedMs,
    invulnerableUntil: enemy.invulnerableUntil ?? runtime.elapsedMs + 650,
    spawnPointIndex,
  });
}

function tryFire(runtime: Runtime, tank: RuntimeTank, events: RuntimeEvent[]): void {
  if (tank.cooldownUntil > runtime.elapsedMs) {
    return;
  }

  if (tank.owner === "player" && runtime.bullets.some((bullet) => bullet.owner === "player")) {
    return;
  }

  const step = DIRECTION_STEP[tank.direction];
  const muzzleOffset = CONFIG.tankSize / 2 + CONFIG.bulletSize;
  const position = {
    x: tank.position.x + step.x * muzzleOffset,
    y: tank.position.y + step.y * muzzleOffset,
  };

  runtime.bullets.push({
    id: `bullet-${tank.id}-${runtime.elapsedMs}-${runtime.bullets.length}`,
    owner: tank.owner,
    position,
    direction: tank.direction,
    speed: CONFIG.bulletSpeed,
    power: tank.owner === "player" ? tank.powerLevel : 1,
  });

  tank.cooldownUntil = runtime.elapsedMs + (tank.owner === "player" ? CONFIG.playerFireCooldownMs : enemyCooldown(runtime));
  events.push({ type: "shot", owner: tank.owner, position: { ...position } });
}

function moveTank(runtime: Runtime, tank: RuntimeTank, direction: Direction, distance: number): boolean {
  tank.direction = direction;
  const nextPosition = assistedPosition(tank.position, direction, distance);

  if (!canTankStandAt(runtime, nextPosition, tank)) {
    return false;
  }

  tank.position = nextPosition;
  return true;
}

function assistedPosition(position: { x: number; y: number }, direction: Direction, distance: number): { x: number; y: number } {
  const step = DIRECTION_STEP[direction];
  const next = {
    x: position.x + step.x * distance,
    y: position.y + step.y * distance,
  };

  if (direction === "up" || direction === "down") {
    next.x = snapAxis(position.x);
  } else {
    next.y = snapAxis(position.y);
  }

  return next;
}

function snapAxis(value: number): number {
  const center = Math.round((value - CONFIG.tileSize / 2) / CONFIG.tileSize) * CONFIG.tileSize + CONFIG.tileSize / 2;

  if (Math.abs(value - center) <= CONFIG.turnSnapPixels) {
    return center;
  }

  return value;
}

function canTankStandAt(runtime: Runtime, position: { x: number; y: number }, tank: RuntimeTank): boolean {
  const rect = centeredRect(position, CONFIG.tankSize);
  const inset = 0;
  const corners = [
    { x: rect.x + inset, y: rect.y + inset },
    { x: rect.x + rect.width - inset, y: rect.y + inset },
    { x: rect.x + inset, y: rect.y + rect.height - inset },
    { x: rect.x + rect.width - inset, y: rect.y + rect.height - inset },
  ];

  for (const corner of corners) {
    const tile = pixelToTile(corner);

    if (!inGrid(tile) || !canOccupyTile(terrainAt(runtime, tile))) {
      return false;
    }
  }

  const others = tank.owner === "player" ? runtime.enemies : [runtime.player, ...runtime.enemies.filter((enemy) => enemy !== tank)];

  return !others.some((other) => rectsOverlap(rect, centeredRect(other.position, CONFIG.tankSize - 3)));
}

function handleBulletTerrainCollision(runtime: Runtime, bullet: RuntimeBullet, events: RuntimeEvent[]): boolean {
  const tile = pixelToTile(bullet.position);

  if (!inGrid(tile)) {
    return true;
  }

  const terrain = terrainAt(runtime, tile);

  if (terrain === "steel" && bullet.owner === "player" && bullet.power >= 3 && !isBaseGuardTile(runtime, tile)) {
    setTile(runtime, tile, "empty");
    addExplosion(runtime, bullet.position, events);
    events.push({ type: "hit", owner: bullet.owner, position: { ...bullet.position } });
    return true;
  }

  if (!isBulletBlockedByTile(terrain)) {
    return false;
  }

  const result = applyBulletToTile(terrain);

  if (terrain === "brick" || terrain === "base") {
    setTile(runtime, tile, result.nextTile);
  }

  if (result.baseDestroyed) {
    runtime.status = "defeat";
    events.push({ type: "base-destroyed", position: { ...bullet.position } });
  }

  addExplosion(runtime, bullet.position, events);
  events.push({ type: "hit", owner: bullet.owner, position: { ...bullet.position } });
  return true;
}

function handleBulletTankCollision(runtime: Runtime, bullet: RuntimeBullet, events: RuntimeEvent[]): boolean {
  if (bullet.owner === "player") {
    const enemy = runtime.enemies.find((candidate) => rectsOverlap(centeredRect(candidate.position, CONFIG.tankSize), centeredRect(bullet.position, CONFIG.bulletSize)));

    if (!enemy || enemy.invulnerableUntil > runtime.elapsedMs) {
      return false;
    }

    enemy.armor -= bullet.power;
    addExplosion(runtime, enemy.position, events);
    events.push({ type: "hit", owner: "player", position: { ...enemy.position } });

    if (enemy.armor <= 0) {
      runtime.score += SCORE_BY_ENEMY[enemy.type as EnemyType];
      runtime.enemies = runtime.enemies.filter((candidate) => candidate !== enemy);
      maybeDropPowerUp(runtime, enemy);
    }

    return true;
  }

  if (runtime.player.invulnerableUntil > runtime.elapsedMs) {
    return false;
  }

  if (!rectsOverlap(centeredRect(runtime.player.position, CONFIG.tankSize), centeredRect(bullet.position, CONFIG.bulletSize))) {
    return false;
  }

  runtime.player.lives -= 1;
  runtime.player.position = tileToCenter(runtime.level.playerSpawn);
  runtime.player.direction = "up";
  runtime.player.invulnerableUntil = runtime.elapsedMs + 1800;
  addExplosion(runtime, runtime.player.position, events);
  events.push({ type: "life-lost", owner: "player", position: { ...runtime.player.position } });
  return true;
}

function maybeDropPowerUp(runtime: Runtime, enemy: RuntimeTank): void {
  if ((runtime.score / 100 + runtime.powerUpCursor) % 4 !== 0 || runtime.powerUps.length > 0) {
    return;
  }

  const tile = pixelToTile(enemy.position);

  if (inGrid(tile) && terrainAt(runtime, tile) === "empty") {
    const type = POWER_UP_ORDER[runtime.powerUpCursor % POWER_UP_ORDER.length];
    runtime.powerUps.push({ type, tile, expiresAt: runtime.elapsedMs + 10000 });
    runtime.powerUpCursor += 1;
  }
}

function applyPlayerPowerUp(runtime: Runtime, type: PowerUpType, events: RuntimeEvent[]): void {
  runtime.score += 100;
  events.push({ type: "powerup-collected", powerUp: type, score: runtime.score });

  if (type === "star") {
    runtime.player.powerLevel = Math.min(3, runtime.player.powerLevel + 1);
    return;
  }

  if (type === "helmet") {
    runtime.player.invulnerableUntil = runtime.elapsedMs + CONFIG.powerUpDurations.helmetMs;
    return;
  }

  if (type === "shovel") {
    runtime.baseFortifiedUntil = runtime.elapsedMs + CONFIG.powerUpDurations.shovelMs;
    return;
  }

  if (type === "tank") {
    runtime.player.lives += 1;
    return;
  }

  if (type === "clock") {
    runtime.enemyFrozenUntil = runtime.elapsedMs + CONFIG.powerUpDurations.clockMs;
    return;
  }

  for (const enemy of runtime.enemies) {
    addExplosion(runtime, enemy.position, events);
    runtime.score += 100;
  }

  runtime.enemies = [];
}

function chooseEnemyDirection(runtime: Runtime, enemy: RuntimeTank): Direction {
  const enemyTile = pixelToTile(enemy.position);
  const tuning = getStageTuning(runtime.levelIndex);
  const target = nextRandom(runtime, 1, 100) <= tuning.basePressure ? runtime.level.base : pixelToTile(runtime.player.position);
  const primary = directionToward(enemyTile, target);

  if (primary && canMoveOnePixel(runtime, enemy, primary)) {
    return primary;
  }

  return chooseFallbackDirection(runtime, enemy);
}

function directionToward(from: GridPoint, to: GridPoint): Direction | undefined {
  if (Math.abs(to.x - from.x) > Math.abs(to.y - from.y)) {
    return to.x < from.x ? "left" : "right";
  }

  if (to.y !== from.y) {
    return to.y < from.y ? "up" : "down";
  }

  if (to.x !== from.x) {
    return to.x < from.x ? "left" : "right";
  }

  return undefined;
}

function chooseFallbackDirection(runtime: Runtime, enemy: RuntimeTank): Direction {
  const start = nextRandom(runtime, 0, DIRECTIONS.length - 1);

  for (let offset = 0; offset < DIRECTIONS.length; offset += 1) {
    const direction = DIRECTIONS[(start + offset) % DIRECTIONS.length];

    if (direction !== enemy.direction && canMoveOnePixel(runtime, enemy, direction)) {
      return direction;
    }
  }

  return enemy.direction;
}

function canMoveOnePixel(runtime: Runtime, tank: RuntimeTank, direction: Direction): boolean {
  const step = DIRECTION_STEP[direction];

  return canTankStandAt(runtime, { x: tank.position.x + step.x, y: tank.position.y + step.y }, tank);
}

function checkRuntimeEnd(runtime: Runtime, events: RuntimeEvent[]): void {
  if (runtime.status !== "playing") {
    return;
  }

  if (runtime.player.lives <= 0) {
    runtime.status = "defeat";
    return;
  }

  if (runtime.enemyQueue.length === 0 && runtime.enemies.length === 0) {
    runtime.status = runtime.levelIndex >= LEVELS.length - 1 ? "victory" : "level-complete";
    events.push({ type: "level-complete", score: runtime.score });
  }
}

function terrainAt(runtime: Runtime, tile: GridPoint): TileType {
  if (!inGrid(tile)) {
    return "steel";
  }

  if (runtime.elapsedMs < runtime.baseFortifiedUntil && isBaseGuardTile(runtime, tile)) {
    return "steel";
  }

  return runtime.grid[tile.y][tile.x];
}

function setTile(runtime: Runtime, tile: GridPoint, tileType: TileType): void {
  if (inGrid(tile)) {
    runtime.grid[tile.y][tile.x] = tileType;
  }
}

function isBaseGuardTile(runtime: Runtime, tile: GridPoint): boolean {
  const base = runtime.level.base;
  const guards = [
    { x: base.x - 1, y: base.y },
    { x: base.x + 1, y: base.y },
    { x: base.x - 1, y: base.y - 1 },
    { x: base.x, y: base.y - 1 },
    { x: base.x + 1, y: base.y - 1 },
  ];

  return guards.some((guard) => guard.x === tile.x && guard.y === tile.y);
}

function isTankAt(runtime: Runtime, tile: GridPoint): boolean {
  return [runtime.player, ...runtime.enemies].some((tank) => {
    const tankTile = pixelToTile(tank.position);
    return tankTile.x === tile.x && tankTile.y === tile.y;
  });
}

function addExplosion(runtime: Runtime, position: { x: number; y: number }, events: RuntimeEvent[]): void {
  runtime.explosions.push({ position: { ...position }, until: runtime.elapsedMs + 260 });
  events.push({ type: "explosion", position: { ...position } });
}

function directionFromInput(input: RuntimeInput): Direction | undefined {
  if (input.up) return "up";
  if (input.down) return "down";
  if (input.left) return "left";
  if (input.right) return "right";
  return undefined;
}

function isInsideBoard(position: { x: number; y: number }): boolean {
  return position.x >= 0 && position.y >= 0 && position.x <= CONFIG.gridColumns * CONFIG.tileSize && position.y <= GAME_HEIGHT;
}

function enemyCooldown(runtime: Runtime): number {
  return Math.round(CONFIG.enemyFireCooldownMs * getStageTuning(runtime.levelIndex).enemyFireCooldownScale);
}

function nextRandom(runtime: Runtime, min: number, max: number): number {
  runtime.rng = (runtime.rng * 1664525 + 1013904223) >>> 0;
  const range = max - min + 1;
  return min + (runtime.rng % range);
}

function tankSnapshot(tank: RuntimeTank): RuntimeTankSnapshot {
  return {
    id: tank.id,
    owner: tank.owner,
    type: tank.type,
    position: { ...tank.position },
    tile: pixelToTile(tank.position),
    direction: tank.direction,
    armor: tank.armor,
    lives: tank.lives,
    powerLevel: tank.powerLevel,
    invulnerableUntil: tank.invulnerableUntil,
    spawnPointIndex: tank.spawnPointIndex,
  };
}

function bulletSnapshot(bullet: RuntimeBullet): RuntimeBulletSnapshot {
  return {
    id: bullet.id,
    owner: bullet.owner,
    position: { ...bullet.position },
    direction: bullet.direction,
    power: bullet.power,
  };
}

function powerUpSnapshot(powerUp: RuntimePowerUp): RuntimePowerUpSnapshot {
  return {
    type: powerUp.type,
    tile: { ...powerUp.tile },
    expiresAt: powerUp.expiresAt,
  };
}

function explosionSnapshot(explosion: RuntimeExplosion): RuntimeExplosionSnapshot {
  return {
    position: { ...explosion.position },
    until: explosion.until,
  };
}

function hudSnapshot(runtime: Runtime): RuntimeHudSnapshot {
  return {
    stageLabel: `${runtime.levelIndex + 1}/3`,
    lives: runtime.player.lives,
    enemies: runtime.enemyQueue.length + runtime.enemies.length,
    score: runtime.score,
    power: runtime.player.powerLevel,
    item: runtime.powerUps[0]?.type,
  };
}
