import { LEVELS } from "../../levels";
import { canOccupyTile, isBulletBlockedByTile } from "../collision";
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
  RuntimeInputFrame,
  RuntimeInput,
  RuntimeOptions,
  RuntimePowerUpSnapshot,
  RuntimeSnapshot,
  RuntimeStatus,
  RuntimeStageStatsSnapshot,
  RuntimeTankSnapshot,
  RuntimeTerrainDamageSnapshot,
  StageTuning,
  TerrainDamageSide,
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
  stunnedUntil: number;
  carriesPowerUp: boolean;
  spawningUntil: number;
  slideUntil: number;
  slideDirection?: Direction;
  spawnPointIndex?: number;
}

interface RuntimeBullet {
  id: string;
  owner: "player" | "enemy";
  sourceTankId?: string;
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

interface RuntimeTerrainDamage {
  tile: GridPoint;
  kind: "brick" | "steel";
  brickMask?: number;
  steelHits?: Partial<Record<TerrainDamageSide, number>>;
}

export interface Runtime {
  levelIndex: number;
  score: number;
  level: ParsedLevel;
  grid: TileType[][];
  terrainDamage: RuntimeTerrainDamage[];
  stageStats: RuntimeStageStatsSnapshot;
  player: RuntimeTank;
  player2?: RuntimeTank;
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
  nextBonusLifeScore: number;
  levelClearAt?: number;
  lastPausePressed: boolean;
  isCustomStage: boolean;
  rng: number;
}

const DIRECTIONS: Direction[] = ["up", "down", "left", "right"];
const ENEMY_TYPES: EnemyType[] = ["normal", "fast", "power", "armor"];
const POWER_UP_ORDER: PowerUpType[] = ["star", "helmet", "shovel", "bomb", "clock", "tank"];
const POWER_UP_CARRIER_ORDINALS = new Set([4, 11, 18]);
const DIRECTIONS_BY_PRIORITY: Direction[] = ["down", "left", "right", "up"];
const FULL_BRICK_MASK = 0b1111;
const PLAYER_2_SPAWN: GridPoint = { x: 8, y: 12 };

export function getStageTuning(levelIndex: number): StageTuning {
  const stage = Math.min(Math.max(levelIndex, 0), 2);

  return {
    basePressure: [62, 72, 84][stage],
    enemySpawnIntervalMs: [1500, 1300, 1120][stage],
    powerUpSpawnIntervalMs: [7800, 8600, 9400][stage],
    enemyFireCooldownScale: [1, 0.92, 0.84][stage],
  };
}

function createStageStats(score: number): RuntimeStageStatsSnapshot {
  return {
    destroyedEnemies: enemyNumberRecord(),
    enemyScore: enemyNumberRecord(),
    powerUpScore: 0,
    bonusLives: 0,
    totalScore: score,
  };
}

function enemyNumberRecord(): Record<EnemyType, number> {
  return ENEMY_TYPES.reduce((record, type) => {
    record[type] = 0;
    return record;
  }, {} as Record<EnemyType, number>);
}

function nextBonusLifeScore(score: number): number {
  return (Math.floor(score / CONFIG.extraLifeScoreInterval) + 1) * CONFIG.extraLifeScoreInterval;
}

export function createRuntime(levelIndex: number, score = 0, options: RuntimeOptions = {}): Runtime {
  const level = parseLevel(options.customLevel ?? LEVELS[levelIndex]);
  const playerTile = options.playerTile ?? level.playerSpawn;
  const runtime: Runtime = {
    levelIndex,
    score,
    level,
    grid: level.grid.map((row) => [...row]),
    terrainDamage: [],
    stageStats: createStageStats(score),
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
      stunnedUntil: 0,
      carriesPowerUp: false,
      spawningUntil: 0,
      slideUntil: 0,
    },
    player2: options.twoPlayers
      ? {
          id: "player-2",
          owner: "player",
          type: "player",
          position: tileToCenter(options.player2Tile ?? PLAYER_2_SPAWN),
          direction: options.player2Direction ?? "up",
          speed: CONFIG.playerSpeed,
          armor: 1,
          lives: CONFIG.playerLives,
          powerLevel: 1,
          cooldownUntil: 0,
          decisionAt: 0,
          invulnerableUntil: options.player2InvulnerableUntil ?? 1600,
          stunnedUntil: 0,
          carriesPowerUp: false,
          spawningUntil: 0,
          slideUntil: 0,
        }
      : undefined,
    enemies: [],
    bullets: [],
    explosions: [],
    powerUps: [],
    enemyQueue: [...level.enemyQueue],
    elapsedMs: 0,
    accumulatorMs: 0,
    status: "playing",
    nextEnemySpawnAt: 0,
    nextPowerUpAt: Number.POSITIVE_INFINITY,
    nextEnemySpawnIndex: 0,
    powerUpCursor: levelIndex,
    enemySpawnsDisabled: options.disableEnemySpawns ?? false,
    baseFortifiedUntil: 0,
    enemyFrozenUntil: 0,
    nextBonusLifeScore: nextBonusLifeScore(score),
    levelClearAt: undefined,
    lastPausePressed: false,
    isCustomStage: options.customLevel !== undefined,
    rng: options.seed ?? 17 + levelIndex * 97,
  };

  for (const enemy of options.initialEnemies ?? []) {
    addEnemy(runtime, { ...enemy, spawningUntil: enemy.spawningUntil ?? 0 });
  }

  if (!options.suppressInitialEnemies && runtime.enemies.length === 0) {
    spawnEnemy(runtime);
    spawnEnemy(runtime);
  }

  return runtime;
}

export function stepRuntime(runtime: Runtime, input: RuntimeInput | RuntimeInputFrame, deltaMs: number): RuntimeEvent[] {
  const events: RuntimeEvent[] = [];
  const inputFrame = normalizeInputFrame(input);

  if (inputFrame.pause && !runtime.lastPausePressed && (runtime.status === "playing" || runtime.status === "paused")) {
    runtime.status = runtime.status === "paused" ? "playing" : "paused";
  }

  runtime.lastPausePressed = Boolean(inputFrame.pause);

  if (runtime.status !== "playing") {
    return events;
  }

  runtime.accumulatorMs += Math.min(deltaMs, 100);

  while (runtime.accumulatorMs >= CONFIG.fixedStepMs && runtime.status === "playing") {
    tickRuntime(runtime, inputFrame, CONFIG.fixedStepMs, events);
    runtime.accumulatorMs -= CONFIG.fixedStepMs;
  }

  return events;
}

function normalizeInputFrame(input: RuntimeInput | RuntimeInputFrame): RuntimeInputFrame {
  if ("player1" in input) {
    return { player1: input.player1, player2: input.player2, pause: input.pause ?? input.player1.pause ?? input.player2?.pause ?? false };
  }

  return { player1: input, pause: input.pause };
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
    player2: runtime.player2 ? tankSnapshot(runtime.player2) : undefined,
    enemies: runtime.enemies.map(tankSnapshot),
    bullets: runtime.bullets.map(bulletSnapshot),
    powerUps: runtime.powerUps.map(powerUpSnapshot),
    explosions: runtime.explosions.map(explosionSnapshot),
    terrainDamage: runtime.terrainDamage.map(terrainDamageSnapshot),
    stageStats: stageStatsSnapshot(runtime),
    hud: hudSnapshot(runtime),
    baseFortifiedUntil: runtime.baseFortifiedUntil,
    enemyFrozenUntil: runtime.enemyFrozenUntil,
  };
}

function tickRuntime(runtime: Runtime, input: RuntimeInputFrame, stepMs: number, events: RuntimeEvent[]): void {
  runtime.elapsedMs += stepMs;
  const seconds = stepMs / 1000;

  updatePlayer(runtime, runtime.player, input.player1, seconds, events);

  if (runtime.player2 && input.player2) {
    updatePlayer(runtime, runtime.player2, input.player2, seconds, events);
  }

  updatePowerUps(runtime, events);
  updateEnemies(runtime, seconds, events);
  updateBullets(runtime, seconds, events);
  updateExplosions(runtime);
  spawnEnemiesOnSchedule(runtime, events);
  checkRuntimeEnd(runtime, events);
}

function updatePlayer(runtime: Runtime, player: RuntimeTank, input: RuntimeInput, seconds: number, events: RuntimeEvent[]): void {
  if (player.lives <= 0) {
    return;
  }

  if (player.spawningUntil > runtime.elapsedMs) {
    player.slideUntil = 0;
    player.slideDirection = undefined;
    return;
  }

  if (player.stunnedUntil > runtime.elapsedMs) {
    player.slideUntil = 0;
    player.slideDirection = undefined;
    player.direction = directionFromInput(input) ?? player.direction;

    if (input.fire) {
      tryFire(runtime, player, events);
    }

    return;
  }

  const inputDirection = directionFromInput(input);
  const slidingDirection = !inputDirection && player.slideUntil > runtime.elapsedMs ? player.slideDirection : undefined;
  const direction = inputDirection ?? slidingDirection;

  if (direction) {
    const speed = inputDirection ? player.speed : player.speed * CONFIG.iceSlideSpeedScale;
    const moved = moveTank(runtime, player, direction, speed * seconds);

    if (!moved) {
      player.slideUntil = 0;
      player.slideDirection = undefined;
    }
  }

  if (inputDirection && isTankOnIce(runtime, player)) {
    player.slideUntil = runtime.elapsedMs + CONFIG.iceSlideMs;
    player.slideDirection = inputDirection;
  } else if (inputDirection) {
    player.slideUntil = 0;
    player.slideDirection = undefined;
  } else if (player.slideUntil <= runtime.elapsedMs) {
    player.slideDirection = undefined;
  }

  if (input.fire) {
    tryFire(runtime, player, events);
  }
}

function updateEnemies(runtime: Runtime, seconds: number, events: RuntimeEvent[]): void {
  if (runtime.elapsedMs < runtime.enemyFrozenUntil) {
    return;
  }

  for (const enemy of runtime.enemies) {
    if (runtime.elapsedMs < enemy.spawningUntil) {
      continue;
    }

    const forwardClear = canMoveOnePixel(runtime, enemy, enemy.direction);

    if (runtime.elapsedMs >= enemy.decisionAt && (isNearTileCenter(enemy.position) || !forwardClear)) {
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
  let keptBullets: RuntimeBullet[] = [];

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
      keptBullets = removeSuppressedSourceBullets(runtime, keptBullets);
      continue;
    }

    if (!isBulletSourceSuppressed(runtime, bullet)) {
      keptBullets.push(bullet);
    }
  }

  runtime.bullets = cancelCollidingBullets(runtime, removeSuppressedSourceBullets(runtime, keptBullets), events);
}

function updatePowerUps(runtime: Runtime, events: RuntimeEvent[]): void {
  runtime.powerUps = runtime.powerUps.filter((powerUp) => powerUp.expiresAt > runtime.elapsedMs);
  const collector = activePlayers(runtime).find((player) => {
    const playerTile = pixelToTile(player.position);
    return runtime.powerUps.some((powerUp) => powerUp.tile.x === playerTile.x && powerUp.tile.y === playerTile.y);
  });

  if (!collector) {
    return;
  }

  const collectorTile = pixelToTile(collector.position);
  const collected = runtime.powerUps.find((powerUp) => powerUp.tile.x === collectorTile.x && powerUp.tile.y === collectorTile.y);

  if (!collected) {
    return;
  }

  applyPlayerPowerUp(runtime, collector, collected.type, events);
  runtime.powerUps = runtime.powerUps.filter((powerUp) => powerUp !== collected);
}

function updateExplosions(runtime: Runtime): void {
  runtime.explosions = runtime.explosions.filter((explosion) => explosion.until > runtime.elapsedMs);
}

function spawnEnemiesOnSchedule(runtime: Runtime, events: RuntimeEvent[]): void {
  if (runtime.enemySpawnsDisabled) {
    return;
  }

  if (runtime.elapsedMs < runtime.nextEnemySpawnAt) {
    return;
  }

  spawnEnemy(runtime, events);
  runtime.nextEnemySpawnAt = runtime.elapsedMs + getStageTuning(runtime.levelIndex).enemySpawnIntervalMs;
}

function spawnEnemy(runtime: Runtime, events?: RuntimeEvent[]): void {
  if (runtime.enemyQueue.length === 0 || runtime.enemies.length >= CONFIG.maxActiveEnemies) {
    return;
  }

  const spawnPointIndex = findAvailableSpawnPointIndex(runtime);

  if (spawnPointIndex === undefined) {
    return;
  }

  const type = runtime.enemyQueue.shift();

  if (!type) {
    return;
  }

  const spawnOrdinal = runtime.nextEnemySpawnIndex + 1;
  const carriesPowerUp = POWER_UP_CARRIER_ORDINALS.has(spawnOrdinal);

  if (carriesPowerUp) {
    runtime.powerUps = [];
  }

  const spawn = runtime.level.enemySpawnPoints[spawnPointIndex];
  const spawningUntil = runtime.elapsedMs + CONFIG.enemySpawnLockMs;
  addEnemy(runtime, {
    type,
    tile: spawn,
    direction: "down",
    cooldownUntil: spawningUntil + enemyFireCooldown(runtime, type),
    invulnerableUntil: spawningUntil,
    carriesPowerUp,
    spawningUntil,
  }, spawnPointIndex);
  runtime.nextEnemySpawnIndex += 1;
  events?.push({ type: "enemy-spawned", owner: "enemy", position: tileToCenter(spawn) });
}

function findAvailableSpawnPointIndex(runtime: Runtime): number | undefined {
  for (let offset = 0; offset < runtime.level.enemySpawnPoints.length; offset += 1) {
    const index = (runtime.nextEnemySpawnIndex + offset) % runtime.level.enemySpawnPoints.length;

    if (canSpawnTankAt(runtime, runtime.level.enemySpawnPoints[index])) {
      return index;
    }
  }

  return undefined;
}

function addEnemy(runtime: Runtime, enemy: RuntimeInitialEnemy, spawnPointIndex?: number): void {
  const tuning = CONFIG.enemyTypes[enemy.type];
  runtime.enemies.push({
    id: `enemy-${runtime.elapsedMs}-${runtime.enemies.length}-${runtime.nextEnemySpawnIndex}`,
    owner: "enemy",
    type: enemy.type,
    position: tileToCenter(enemy.tile),
    direction: enemy.direction,
    speed: tuning.movementSpeed,
    armor: tuning.health,
    lives: 1,
    powerLevel: 1,
    cooldownUntil: enemy.cooldownUntil ?? runtime.elapsedMs + enemyFireCooldown(runtime, enemy.type),
    decisionAt: enemy.decisionAt ?? runtime.elapsedMs,
    invulnerableUntil: enemy.invulnerableUntil ?? enemy.spawningUntil ?? 0,
    stunnedUntil: 0,
    carriesPowerUp: enemy.carriesPowerUp ?? false,
    spawningUntil: enemy.spawningUntil ?? 0,
    slideUntil: 0,
    spawnPointIndex,
  });
}

function tryFire(runtime: Runtime, tank: RuntimeTank, events: RuntimeEvent[]): void {
  if (tank.cooldownUntil > runtime.elapsedMs) {
    return;
  }

  const firepower = tank.owner === "player" ? playerFirepower(tank.powerLevel) : undefined;

  if (tank.owner === "player" && runtime.bullets.filter((bullet) => bullet.sourceTankId === tank.id).length >= (firepower?.maxBullets ?? 1)) {
    return;
  }

  if (tank.owner === "enemy" && runtime.bullets.filter((bullet) => bullet.sourceTankId === tank.id).length >= CONFIG.enemyMaxBulletsPerTank) {
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
    sourceTankId: tank.id,
    position,
    direction: tank.direction,
    speed: tank.owner === "player" ? (firepower?.bulletSpeed ?? CONFIG.bulletSpeed) : enemyBulletSpeed(tank.type as EnemyType),
    power: tank.owner === "player" ? tank.powerLevel : 1,
  });

  tank.cooldownUntil = runtime.elapsedMs + (tank.owner === "player" ? CONFIG.playerFireCooldownMs : enemyFireCooldown(runtime, tank.type as EnemyType));
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

  const otherPlayers = activePlayers(runtime).filter((player) => player !== tank);
  const others = tank.owner === "player" ? [...otherPlayers, ...runtime.enemies] : [...otherPlayers, ...runtime.enemies.filter((enemy) => enemy !== tank)];

  return !others.some((other) => rectsOverlap(rect, centeredRect(other.position, CONFIG.tankSize - 3)));
}

function canSpawnTankAt(runtime: Runtime, tile: GridPoint): boolean {
  const position = tileToCenter(tile);
  const rect = centeredRect(position, CONFIG.tankSize);
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x, y: rect.y + rect.height },
    { x: rect.x + rect.width, y: rect.y + rect.height },
  ];

  for (const corner of corners) {
    const cornerTile = pixelToTile(corner);

    if (!inGrid(cornerTile) || !canOccupyTile(terrainAt(runtime, cornerTile))) {
      return false;
    }
  }

  return ![...activePlayers(runtime), ...runtime.enemies].some((tank) => rectsOverlap(rect, centeredRect(tank.position, CONFIG.tankSize - 3)));
}

function cancelCollidingBullets(runtime: Runtime, bullets: RuntimeBullet[], events: RuntimeEvent[]): RuntimeBullet[] {
  const destroyed = new Set<RuntimeBullet>();

  for (let left = 0; left < bullets.length; left += 1) {
    for (let right = left + 1; right < bullets.length; right += 1) {
      const first = bullets[left];
      const second = bullets[right];

      if (first.owner === second.owner || destroyed.has(first) || destroyed.has(second)) {
        continue;
      }

      if (rectsOverlap(centeredRect(first.position, CONFIG.bulletSize * 2), centeredRect(second.position, CONFIG.bulletSize * 2))) {
        destroyed.add(first);
        destroyed.add(second);
        addExplosion(runtime, midpoint(first.position, second.position), events);
        events.push({ type: "hit", position: midpoint(first.position, second.position) });
      }
    }
  }

  return bullets.filter((bullet) => !destroyed.has(bullet));
}

function handleBulletTerrainCollision(runtime: Runtime, bullet: RuntimeBullet, events: RuntimeEvent[]): boolean {
  const tile = pixelToTile(bullet.position);

  if (!inGrid(tile)) {
    return true;
  }

  const terrain = terrainAt(runtime, tile);

  if (terrain === "brick") {
    if (!isBrickSubBlockOccupied(runtime, tile, bullet)) {
      return false;
    }

    applyBrickDamage(runtime, tile, bullet);
    addExplosion(runtime, bullet.position, events);
    events.push({ type: "hit", owner: bullet.owner, position: { ...bullet.position } });
    return true;
  }

  if (terrain === "steel") {
    if (bullet.owner === "player" && playerFirepower(bullet.power).destroysSteel && !isFortifiedBaseGuardTile(runtime, tile)) {
      applySteelDamage(runtime, tile, bullet.direction);
    }

    addExplosion(runtime, bullet.position, events);
    events.push({ type: "hit", owner: bullet.owner, position: { ...bullet.position } });
    return true;
  }

  if (terrain === "base") {
    setTile(runtime, tile, "baseDestroyed");
    runtime.status = "defeat";
    events.push({ type: "base-destroyed", position: { ...bullet.position } });
    addExplosion(runtime, bullet.position, events);
    events.push({ type: "hit", owner: bullet.owner, position: { ...bullet.position } });
    return true;
  }

  if (!isBulletBlockedByTile(terrain)) {
    return false;
  }

  addExplosion(runtime, bullet.position, events);
  events.push({ type: "hit", owner: bullet.owner, position: { ...bullet.position } });
  return true;
}

function applyBrickDamage(runtime: Runtime, tile: GridPoint, bullet: RuntimeBullet): void {
  const damage = getOrCreateTerrainDamage(runtime, tile, "brick");
  const currentMask = damage.brickMask ?? FULL_BRICK_MASK;
  const damageMask = brickDamageMask(tile, bullet);
  const nextMask = currentMask & ~damageMask;

  if (nextMask === 0) {
    setTile(runtime, tile, "empty");
    return;
  }

  damage.brickMask = nextMask;
}

function isBrickSubBlockOccupied(runtime: Runtime, tile: GridPoint, bullet: RuntimeBullet): boolean {
  const damage = runtime.terrainDamage.find((candidate) => candidate.kind === "brick" && sameTile(candidate.tile, tile));
  const currentMask = damage?.brickMask ?? FULL_BRICK_MASK;

  return (currentMask & brickDamageMask(tile, bullet)) !== 0;
}

function applySteelDamage(runtime: Runtime, tile: GridPoint, direction: Direction): void {
  const side = impactSide(direction);
  const damage = getOrCreateTerrainDamage(runtime, tile, "steel");
  const steelHits = damage.steelHits ?? {};
  const hits = (steelHits[side] ?? 0) + 1;

  if (hits >= CONFIG.steelHitsToDestroy) {
    setTile(runtime, tile, "empty");
    return;
  }

  steelHits[side] = hits;
  damage.steelHits = steelHits;
}

function brickImpactMask(tile: GridPoint, bullet: RuntimeBullet): number {
  const localX = bullet.position.x - tile.x * CONFIG.tileSize;
  const localY = bullet.position.y - tile.y * CONFIG.tileSize;
  const left = localX < CONFIG.tileSize / 2;
  const top = localY < CONFIG.tileSize / 2;

  if (bullet.direction === "up" || bullet.direction === "down") {
    return top ? 0b0011 : 0b1100;
  }

  return left ? 0b0101 : 0b1010;
}

function brickDamageMask(tile: GridPoint, bullet: RuntimeBullet): number {
  if (bullet.owner === "player" && playerFirepower(bullet.power).destroysSteel) {
    return FULL_BRICK_MASK;
  }

  return brickImpactMask(tile, bullet);
}

function impactSide(direction: Direction): TerrainDamageSide {
  if (direction === "up") {
    return "bottom";
  }

  if (direction === "down") {
    return "top";
  }

  if (direction === "left") {
    return "right";
  }

  return "left";
}

function handleBulletTankCollision(runtime: Runtime, bullet: RuntimeBullet, events: RuntimeEvent[]): boolean {
  if (bullet.owner === "player") {
    const friendlyTarget = activePlayers(runtime).find((player) => {
      if (player.id === bullet.sourceTankId) {
        return false;
      }

      return rectsOverlap(centeredRect(player.position, CONFIG.tankSize), centeredRect(bullet.position, CONFIG.bulletSize));
    });

    if (friendlyTarget) {
      friendlyTarget.stunnedUntil = runtime.elapsedMs + CONFIG.playerStunMs;
      friendlyTarget.slideUntil = 0;
      friendlyTarget.slideDirection = undefined;
      addExplosion(runtime, bullet.position, events);
      events.push({ type: "hit", owner: "player", position: { ...friendlyTarget.position } });
      events.push({ type: "player-stunned", owner: "player", position: { ...friendlyTarget.position } });
      return true;
    }

    const enemy = runtime.enemies.find((candidate) => rectsOverlap(centeredRect(candidate.position, CONFIG.tankSize), centeredRect(bullet.position, CONFIG.bulletSize)));

    if (!enemy) {
      return false;
    }

    if (enemy.carriesPowerUp) {
      enemy.carriesPowerUp = false;
      spawnCarrierPowerUp(runtime, events);
    }

    if (enemy.invulnerableUntil > runtime.elapsedMs) {
      addExplosion(runtime, bullet.position, events);
      events.push({ type: "hit", owner: "player", position: { ...enemy.position } });
      return true;
    }

    enemy.armor -= 1;
    addExplosion(runtime, enemy.position, events);
    events.push({ type: "hit", owner: "player", position: { ...enemy.position } });

    if (enemy.armor <= 0) {
      destroyEnemy(runtime, enemy, events, playerById(runtime, bullet.sourceTankId));
    }

    return true;
  }

  const target = activePlayers(runtime).find((player) => rectsOverlap(centeredRect(player.position, CONFIG.tankSize), centeredRect(bullet.position, CONFIG.bulletSize)));

  if (!target) {
    return false;
  }

  if (target.invulnerableUntil > runtime.elapsedMs) {
    addExplosion(runtime, bullet.position, events);
    events.push({ type: "hit", owner: "enemy", position: { ...target.position } });
    return true;
  }

  target.lives -= 1;
  addExplosion(runtime, target.position, events);
  runtime.bullets = runtime.bullets.filter((candidate) => candidate.sourceTankId !== target.id);

  if (target.lives > 0) {
    target.position = tileToCenter(target.id === "player-2" ? PLAYER_2_SPAWN : runtime.level.playerSpawn);
    target.direction = "up";
    target.powerLevel = 1;
    target.slideUntil = 0;
    target.slideDirection = undefined;
    target.stunnedUntil = 0;
    target.spawningUntil = runtime.elapsedMs + CONFIG.playerRespawnLockMs;
    target.invulnerableUntil = target.spawningUntil + 1800;
  }

  events.push({ type: "life-lost", owner: "player", position: { ...target.position } });
  return true;
}

function removeSuppressedSourceBullets(runtime: Runtime, bullets: RuntimeBullet[]): RuntimeBullet[] {
  return bullets.filter((bullet) => !isBulletSourceSuppressed(runtime, bullet));
}

function isBulletSourceSuppressed(runtime: Runtime, bullet: RuntimeBullet): boolean {
  if (bullet.owner !== "player" || bullet.sourceTankId === undefined) {
    return false;
  }

  const source = [runtime.player, runtime.player2].find((player): player is RuntimeTank => player !== undefined && player.id === bullet.sourceTankId);

  return source === undefined || source.lives <= 0 || source.spawningUntil > runtime.elapsedMs;
}

function applyPlayerPowerUp(runtime: Runtime, player: RuntimeTank, type: PowerUpType, events: RuntimeEvent[]): void {
  addScore(runtime, CONFIG.powerUpScore, events, player);
  runtime.stageStats.powerUpScore += CONFIG.powerUpScore;
  events.push({ type: "powerup-collected", powerUp: type, score: runtime.score });

  if (type === "star") {
    player.powerLevel = Math.min(CONFIG.maxPlayerPowerLevel, player.powerLevel + 1);
    return;
  }

  if (type === "helmet") {
    player.invulnerableUntil = runtime.elapsedMs + CONFIG.powerUpDurations.helmetMs;
    return;
  }

  if (type === "shovel") {
    repairBaseGuard(runtime);
    runtime.baseFortifiedUntil = runtime.elapsedMs + CONFIG.powerUpDurations.shovelMs;
    return;
  }

  if (type === "tank") {
    player.lives += 1;
    return;
  }

  if (type === "clock") {
    runtime.enemyFrozenUntil = runtime.elapsedMs + CONFIG.powerUpDurations.clockMs;
    return;
  }

  for (const enemy of runtime.enemies) {
    addExplosion(runtime, enemy.position, events);
    events.push({ type: "enemy-destroyed", owner: "player", enemyType: enemy.type as EnemyType, position: { ...enemy.position }, score: 0 });
  }

  runtime.enemies = [];
}

function destroyEnemy(runtime: Runtime, enemy: RuntimeTank, events: RuntimeEvent[], scorer?: RuntimeTank): void {
  recordEnemyScore(runtime, enemy.type as EnemyType, events, enemy.position, scorer);
  runtime.enemies = runtime.enemies.filter((candidate) => candidate !== enemy);
}

function recordEnemyScore(runtime: Runtime, type: EnemyType, events?: RuntimeEvent[], position?: { x: number; y: number }, scorer?: RuntimeTank): void {
  const score = CONFIG.enemyTypes[type].score;
  runtime.stageStats.destroyedEnemies[type] += 1;
  runtime.stageStats.enemyScore[type] += score;
  events?.push({ type: "enemy-destroyed", owner: "player", enemyType: type, position: position ? { ...position } : undefined, score });
  addScore(runtime, score, events, scorer);
}

function addScore(runtime: Runtime, points: number, events?: RuntimeEvent[], bonusRecipient = runtime.player): void {
  runtime.score += points;
  runtime.stageStats.totalScore = runtime.score;

  while (runtime.score >= runtime.nextBonusLifeScore) {
    bonusRecipient.lives += 1;
    runtime.stageStats.bonusLives += 1;
    events?.push({ type: "bonus-life", owner: "player", score: runtime.score });
    runtime.nextBonusLifeScore += CONFIG.extraLifeScoreInterval;
  }
}

function playerById(runtime: Runtime, id: string | undefined): RuntimeTank | undefined {
  if (id === undefined) {
    return undefined;
  }

  return [runtime.player, runtime.player2].find((player): player is RuntimeTank => player !== undefined && player.id === id);
}

function spawnCarrierPowerUp(runtime: Runtime, events: RuntimeEvent[]): void {
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

  const tile = candidates[nextRandom(runtime, 0, candidates.length - 1)];
  const type = POWER_UP_ORDER[runtime.powerUpCursor % POWER_UP_ORDER.length];
  runtime.powerUps = [{ type, tile, expiresAt: runtime.elapsedMs + 10000 }];
  runtime.powerUpCursor += 1;
  events.push({ type: "powerup-spawned", powerUp: type, position: tileToCenter(tile) });
}

function chooseEnemyDirection(runtime: Runtime, enemy: RuntimeTank): Direction {
  const enemyTile = pixelToTile(enemy.position);

  if (canMoveOnePixel(runtime, enemy, enemy.direction)) {
    return enemy.direction;
  }

  for (const target of enemyTargetPriority(runtime, enemyTile)) {
    for (const direction of rankedDirections(runtime, enemy, target, enemyTile)) {
      if (canMoveOnePixel(runtime, enemy, direction)) {
        return direction;
      }
    }
  }

  return chooseFallbackDirection(runtime, enemy, false);
}

function enemyTargetPriority(runtime: Runtime, enemyTile: GridPoint): GridPoint[] {
  const baseFirst = nextRandom(runtime, 0, 99) < getStageTuning(runtime.levelIndex).basePressure;
  const playerTarget = nearestPlayerTile(runtime, enemyTile);

  return baseFirst ? [runtime.level.base, playerTarget] : [playerTarget, runtime.level.base];
}

function nearestPlayerTile(runtime: Runtime, from: GridPoint): GridPoint {
  const players = activePlayers(runtime);

  if (players.length === 0) {
    return runtime.level.base;
  }

  return players
    .map((player) => pixelToTile(player.position))
    .sort((a, b) => manhattan(a, from) - manhattan(b, from))[0];
}

function rankedDirections(runtime: Runtime, enemy: RuntimeTank, target: GridPoint, from: GridPoint): Direction[] {
  const reverse = reverseDirection(enemy.direction);
  const candidates = DIRECTIONS_BY_PRIORITY.filter((direction) => direction !== reverse);
  const jitter = nextRandom(runtime, 0, candidates.length - 1);

  return [...candidates]
    .sort((a, b) => {
      const aDistance = manhattan(nextTile(from, a), target);
      const bDistance = manhattan(nextTile(from, b), target);

      if (aDistance !== bDistance) {
        return aDistance - bDistance;
      }

      return ((DIRECTIONS_BY_PRIORITY.indexOf(a) + jitter) % candidates.length) - ((DIRECTIONS_BY_PRIORITY.indexOf(b) + jitter) % candidates.length);
    });
}

function nextTile(from: GridPoint, direction: Direction): GridPoint {
  const step = DIRECTION_STEP[direction];

  return { x: from.x + step.x, y: from.y + step.y };
}

function manhattan(a: GridPoint, b: GridPoint): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function midpoint(first: { x: number; y: number }, second: { x: number; y: number }): { x: number; y: number } {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

function reverseDirection(direction: Direction): Direction {
  if (direction === "up") {
    return "down";
  }

  if (direction === "down") {
    return "up";
  }

  if (direction === "left") {
    return "right";
  }

  return "left";
}

function chooseFallbackDirection(runtime: Runtime, enemy: RuntimeTank, avoidReverse = true): Direction {
  const start = nextRandom(runtime, 0, DIRECTIONS.length - 1);
  const reverse = reverseDirection(enemy.direction);

  for (let offset = 0; offset < DIRECTIONS.length; offset += 1) {
    const direction = DIRECTIONS[(start + offset) % DIRECTIONS.length];

    if (direction !== enemy.direction && (!avoidReverse || direction !== reverse) && canMoveOnePixel(runtime, enemy, direction)) {
      return direction;
    }
  }

  if (avoidReverse && canMoveOnePixel(runtime, enemy, reverse)) {
    return reverse;
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

  if (activePlayers(runtime).length === 0) {
    runtime.status = "defeat";
    return;
  }

  if (runtime.enemyQueue.length === 0 && runtime.enemies.length === 0) {
    if (runtime.levelClearAt === undefined && hasEnemyClearActivity(runtime)) {
      runtime.levelClearAt = runtime.elapsedMs + CONFIG.levelClearDelayMs;
      return;
    }

    if (runtime.levelClearAt !== undefined && runtime.elapsedMs < runtime.levelClearAt) {
      return;
    }

    runtime.status = runtime.isCustomStage || runtime.levelIndex >= LEVELS.length - 1 ? "victory" : "level-complete";
    events.push({ type: "level-complete", score: runtime.score });
  }
}

function hasEnemyClearActivity(runtime: Runtime): boolean {
  return runtime.nextEnemySpawnIndex > 0 || Object.values(runtime.stageStats.destroyedEnemies).some((count) => count > 0);
}

function terrainAt(runtime: Runtime, tile: GridPoint): TileType {
  if (!inGrid(tile)) {
    return "steel";
  }

  if (isFortifiedBaseGuardTile(runtime, tile)) {
    return "steel";
  }

  return runtime.grid[tile.y][tile.x];
}

function setTile(runtime: Runtime, tile: GridPoint, tileType: TileType): void {
  if (inGrid(tile)) {
    runtime.grid[tile.y][tile.x] = tileType;

    if (tileType !== "brick" && tileType !== "steel") {
      removeTerrainDamage(runtime, tile);
    } else {
      removeTerrainDamage(runtime, tile, tileType);
    }
  }
}

function isFortifiedBaseGuardTile(runtime: Runtime, tile: GridPoint): boolean {
  return runtime.elapsedMs < runtime.baseFortifiedUntil && isBaseGuardTile(runtime, tile);
}

function isBaseGuardTile(runtime: Runtime, tile: GridPoint): boolean {
  return baseGuardTiles(runtime.level.base).some((guard) => guard.x === tile.x && guard.y === tile.y);
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

function repairBaseGuard(runtime: Runtime): void {
  for (const tile of baseGuardTiles(runtime.level.base)) {
    setTile(runtime, tile, "brick");
  }
}

function getOrCreateTerrainDamage(runtime: Runtime, tile: GridPoint, kind: "brick" | "steel"): RuntimeTerrainDamage {
  const existing = runtime.terrainDamage.find((damage) => damage.kind === kind && sameTile(damage.tile, tile));

  if (existing) {
    return existing;
  }

  const damage: RuntimeTerrainDamage = {
    tile: { ...tile },
    kind,
    brickMask: kind === "brick" ? FULL_BRICK_MASK : undefined,
    steelHits: kind === "steel" ? {} : undefined,
  };

  runtime.terrainDamage.push(damage);
  return damage;
}

function removeTerrainDamage(runtime: Runtime, tile: GridPoint, kind?: "brick" | "steel"): void {
  runtime.terrainDamage = runtime.terrainDamage.filter((damage) => {
    if (!sameTile(damage.tile, tile)) {
      return true;
    }

    return kind !== undefined && damage.kind !== kind;
  });
}

function sameTile(first: GridPoint, second: GridPoint): boolean {
  return first.x === second.x && first.y === second.y;
}

function isTankOnIce(runtime: Runtime, tank: RuntimeTank): boolean {
  return terrainAt(runtime, pixelToTile(tank.position)) === "ice";
}

function isTankAt(runtime: Runtime, tile: GridPoint): boolean {
  return [...activePlayers(runtime), ...runtime.enemies].some((tank) => {
    const tankTile = pixelToTile(tank.position);
    return tankTile.x === tile.x && tankTile.y === tile.y;
  });
}

function activePlayers(runtime: Runtime): RuntimeTank[] {
  return [runtime.player, runtime.player2].filter((player): player is RuntimeTank => player !== undefined && player.lives > 0);
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

function enemyFireCooldown(runtime: Runtime, type: EnemyType): number {
  return Math.round(CONFIG.enemyTypes[type].fireCooldownMs * getStageTuning(runtime.levelIndex).enemyFireCooldownScale);
}

function enemyBulletSpeed(type: EnemyType): number {
  return CONFIG.enemyTypes[type].bulletSpeed;
}

function isNearTileCenter(position: { x: number; y: number }): boolean {
  const tile = pixelToTile(position);
  const center = tileToCenter(tile);

  return Math.abs(position.x - center.x) < 0.5 && Math.abs(position.y - center.y) < 0.5;
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
    stunnedUntil: tank.stunnedUntil,
    carriesPowerUp: tank.carriesPowerUp,
    spawningUntil: tank.spawningUntil,
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

function playerFirepower(powerLevel: number): (typeof CONFIG.playerFirepower)[keyof typeof CONFIG.playerFirepower] {
  const normalized = Math.min(Math.max(Math.trunc(powerLevel), 1), CONFIG.maxPlayerPowerLevel) as keyof typeof CONFIG.playerFirepower;

  return CONFIG.playerFirepower[normalized];
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

function terrainDamageSnapshot(damage: RuntimeTerrainDamage): RuntimeTerrainDamageSnapshot {
  return {
    tile: { ...damage.tile },
    kind: damage.kind,
    brickMask: damage.brickMask,
    steelHits: damage.steelHits ? { ...damage.steelHits } : undefined,
  };
}

function stageStatsSnapshot(runtime: Runtime): RuntimeStageStatsSnapshot {
  return {
    destroyedEnemies: { ...runtime.stageStats.destroyedEnemies },
    enemyScore: { ...runtime.stageStats.enemyScore },
    powerUpScore: runtime.stageStats.powerUpScore,
    bonusLives: runtime.stageStats.bonusLives,
    totalScore: runtime.score,
  };
}

function hudSnapshot(runtime: Runtime): RuntimeHudSnapshot {
  return {
    stageLabel: runtime.isCustomStage ? "EDIT" : `${runtime.levelIndex + 1}/${LEVELS.length}`,
    isCustomStage: runtime.isCustomStage,
    lives: runtime.player.lives,
    livesP2: runtime.player2?.lives,
    enemies: runtime.enemyQueue.length + runtime.enemies.length,
    score: runtime.score,
    power: runtime.player.powerLevel,
    powerP2: runtime.player2?.powerLevel,
    item: runtime.powerUps[0]?.type,
  };
}
