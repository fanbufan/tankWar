import { describe, expect, it } from "vitest";
import { CONFIG } from "../src/game/config";
import { tileToCenter } from "../src/game/geometry";
import type { RuntimeInput } from "../src/game/runtime/types";
import { createRuntime, getRuntimeSnapshot, getStageTuning, stepRuntime } from "../src/game/runtime";
import type { PowerUpType } from "../src/game/types";
import { LEVELS } from "../src/levels";

const idleInput: RuntimeInput = {
  up: false,
  down: false,
  left: false,
  right: false,
  fire: false,
  pause: false,
};

function runRuntime(runtime: ReturnType<typeof createRuntime>, input: RuntimeInput, ms: number) {
  const events = [];

  for (let elapsed = 0; elapsed < ms; elapsed += 16) {
    events.push(...stepRuntime(runtime, input, 16));
  }

  return events;
}

function collectPowerUp(runtime: ReturnType<typeof createRuntime>, type: PowerUpType) {
  runtime.powerUps.push({
    type,
    tile: getRuntimeSnapshot(runtime).player.tile,
    expiresAt: runtime.elapsedMs + 1000,
  });

  stepRuntime(runtime, idleInput, 16);
}

function advanceToNextSpawn(runtime: ReturnType<typeof createRuntime>, clearAfter = true) {
  const before = runtime.nextEnemySpawnIndex;

  for (let guard = 0; guard < 200 && runtime.nextEnemySpawnIndex === before; guard += 1) {
    stepRuntime(runtime, idleInput, 16);
  }

  if (clearAfter) {
    runtime.enemies = [];
  }
}

function dropCarrierPowerUpAtCursor(cursor: number): PowerUpType | undefined {
  const runtime = createRuntime(0, 0, {
    suppressInitialEnemies: true,
    disableEnemySpawns: true,
    playerTile: { x: 3, y: 12 },
    playerDirection: "up",
    initialEnemies: [
      {
        type: "armor",
        tile: { x: 3, y: 10 },
        direction: "down",
        invulnerableUntil: 0,
        cooldownUntil: 99999,
        spawningUntil: 0,
        carriesPowerUp: true,
      },
    ],
  });
  runtime.powerUpCursor = cursor;

  stepRuntime(runtime, { ...idleInput, fire: true }, 16);
  runRuntime(runtime, idleInput, 520);

  return getRuntimeSnapshot(runtime).powerUps[0]?.type;
}

describe("runtime movement feel", () => {
  it("keeps the player from entering blocked tiles and reports a stable snapshot contract", () => {
    const runtime = createRuntime(0, 500, { suppressInitialEnemies: true });
    const initial = getRuntimeSnapshot(runtime);

    expect(initial.hud.score).toBe(500);
    expect(initial.hud.stageLabel).toBe(`1/${LEVELS.length}`);
    expect(initial.player.position).toEqual(tileToCenter({ x: 4, y: 12 }));

    runRuntime(runtime, { ...idleInput, right: true }, 240);

    const blocked = getRuntimeSnapshot(runtime);
    expect(blocked.player.tile).toEqual(initial.player.tile);
    expect(blocked.player.position.x).toBeLessThan(5 * CONFIG.tileSize - CONFIG.tankSize / 2);
    expect(blocked.player.direction).toBe("right");
  });

  it("snaps to the grid center when turning so corners feel forgiving", () => {
    const runtime = createRuntime(0, 0, { suppressInitialEnemies: true });

    runRuntime(runtime, { ...idleInput, left: true }, 130);
    runRuntime(runtime, { ...idleInput, up: true }, 180);

    const player = getRuntimeSnapshot(runtime).player;
    const nearestTileCenterX = Math.round((player.position.x - CONFIG.tileSize / 2) / CONFIG.tileSize) * CONFIG.tileSize + CONFIG.tileSize / 2;

    expect(player.direction).toBe("up");
    expect(Math.abs(player.position.x - nearestTileCenterX)).toBeLessThanOrEqual(CONFIG.turnSnapPixels);
  });
});

describe("runtime FC firepower progression", () => {
  it("caps three star upgrades at full power and resets firepower after the player loses a life", () => {
    const runtime = createRuntime(0, 0, { suppressInitialEnemies: true, disableEnemySpawns: true });

    collectPowerUp(runtime, "star");
    collectPowerUp(runtime, "star");
    collectPowerUp(runtime, "star");

    expect(getRuntimeSnapshot(runtime).player.powerLevel).toBe(4);

    const damageRuntime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 3, y: 12 },
      playerInvulnerableUntil: 0,
      initialEnemies: [{ type: "normal", tile: { x: 3, y: 10 }, direction: "down", cooldownUntil: 0, decisionAt: 99999 }],
    });
    damageRuntime.player.powerLevel = 4;

    runRuntime(damageRuntime, idleInput, 520);

    const snapshot = getRuntimeSnapshot(damageRuntime);
    expect(snapshot.player.lives).toBe(CONFIG.playerLives - 1);
    expect(snapshot.player.powerLevel).toBe(1);
  });

  it("lets level three firepower keep two player bullets on screen", () => {
    const levelOne = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 3, y: 12 },
      playerDirection: "up",
    });

    stepRuntime(levelOne, { ...idleInput, fire: true }, 16);
    runRuntime(levelOne, idleInput, CONFIG.playerFireCooldownMs + 16);
    stepRuntime(levelOne, { ...idleInput, fire: true }, 16);

    expect(getRuntimeSnapshot(levelOne).bullets.filter((bullet) => bullet.owner === "player")).toHaveLength(1);

    const levelThree = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 3, y: 12 },
      playerDirection: "up",
    });
    levelThree.player.powerLevel = 3;

    stepRuntime(levelThree, { ...idleInput, fire: true }, 16);
    runRuntime(levelThree, idleInput, CONFIG.playerFireCooldownMs + 16);
    stepRuntime(levelThree, { ...idleInput, fire: true }, 16);

    expect(getRuntimeSnapshot(levelThree).bullets.filter((bullet) => bullet.owner === "player")).toHaveLength(2);
  });

  it("lets three star upgrades keep three player bullets on screen", () => {
    const runtime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 1, y: 12 },
      playerDirection: "up",
    });
    collectPowerUp(runtime, "star");
    collectPowerUp(runtime, "star");
    collectPowerUp(runtime, "star");

    for (let y = 0; y < CONFIG.gridRows; y += 1) {
      runtime.grid[y][1] = "empty";
    }

    stepRuntime(runtime, { ...idleInput, fire: true }, 16);
    runRuntime(runtime, idleInput, CONFIG.playerFireCooldownMs + 16);
    stepRuntime(runtime, { ...idleInput, fire: true }, 16);
    runRuntime(runtime, idleInput, CONFIG.playerFireCooldownMs + 16);
    stepRuntime(runtime, { ...idleInput, fire: true }, 16);

    expect(getRuntimeSnapshot(runtime).bullets.filter((bullet) => bullet.owner === "player")).toHaveLength(3);
  });

  it("keeps firing while fire is held without exceeding the active bullet cap", () => {
    const levelOne = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 1, y: 12 },
      playerDirection: "up",
    });

    for (let y = 0; y < CONFIG.gridRows; y += 1) {
      levelOne.grid[y][1] = "empty";
    }

    const heldEvents = runRuntime(levelOne, { ...idleInput, fire: true }, 2300);

    expect(heldEvents.filter((event) => event.type === "shot" && event.owner === "player").length).toBeGreaterThanOrEqual(2);
    expect(getRuntimeSnapshot(levelOne).bullets.filter((bullet) => bullet.owner === "player")).toHaveLength(1);

    const fullPower = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 1, y: 12 },
      playerDirection: "up",
    });
    fullPower.player.powerLevel = 4;

    for (let y = 0; y < CONFIG.gridRows; y += 1) {
      fullPower.grid[y][1] = "empty";
    }

    runRuntime(fullPower, { ...idleInput, fire: true }, CONFIG.playerFireCooldownMs * 3 + 80);

    expect(getRuntimeSnapshot(fullPower).bullets.filter((bullet) => bullet.owner === "player")).toHaveLength(3);
  });

  it("moves upgraded player bullets faster than level one bullets", () => {
    const levelOne = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 1, y: 12 },
      playerDirection: "up",
    });
    const levelTwo = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 1, y: 12 },
      playerDirection: "up",
    });
    levelTwo.player.powerLevel = 2;

    stepRuntime(levelOne, { ...idleInput, fire: true }, 16);
    stepRuntime(levelTwo, { ...idleInput, fire: true }, 16);
    runRuntime(levelOne, idleInput, 96);
    runRuntime(levelTwo, idleInput, 96);

    const levelOneBullet = getRuntimeSnapshot(levelOne).bullets[0];
    const levelTwoBullet = getRuntimeSnapshot(levelTwo).bullets[0];

    expect(levelTwoBullet.position.y).toBeLessThan(levelOneBullet.position.y);
  });

  it("lets only level four firepower destroy steel after two hits from the same side without one-shotting armor tanks", () => {
    const lowPower = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 6, y: 6 },
      playerDirection: "up",
    });

    stepRuntime(lowPower, { ...idleInput, fire: true }, 16);
    runRuntime(lowPower, idleInput, 180);

    expect(getRuntimeSnapshot(lowPower).grid[4][6]).toBe("steel");

    const maxPower = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 6, y: 6 },
      playerDirection: "up",
    });
    maxPower.player.powerLevel = 4;

    stepRuntime(maxPower, { ...idleInput, fire: true }, 16);
    runRuntime(maxPower, idleInput, 180);

    expect(getRuntimeSnapshot(maxPower).grid[4][6]).toBe("steel");

    runRuntime(maxPower, idleInput, CONFIG.playerFireCooldownMs + 16);
    stepRuntime(maxPower, { ...idleInput, fire: true }, 16);
    runRuntime(maxPower, idleInput, 180);

    expect(getRuntimeSnapshot(maxPower).grid[4][6]).toBe("empty");

    const armorRuntime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 3, y: 12 },
      playerDirection: "up",
      initialEnemies: [{ type: "armor", tile: { x: 3, y: 10 }, direction: "down", invulnerableUntil: 0, cooldownUntil: 99999 }],
    });
    armorRuntime.player.powerLevel = 4;

    stepRuntime(armorRuntime, { ...idleInput, fire: true }, 16);
    runRuntime(armorRuntime, idleInput, 520);

    const armor = getRuntimeSnapshot(armorRuntime).enemies[0];
    expect(armor.armor).toBe(3);
  });

  it("does not include the non-FC handgun power up in carrier drops", () => {
    const runtime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 6, y: 6 },
      playerDirection: "up",
    });

    collectPowerUp(runtime, "star");
    collectPowerUp(runtime, "star");
    collectPowerUp(runtime, "star");

    expect(getRuntimeSnapshot(runtime).player.powerLevel).toBe(4);
    expect(Array.from({ length: 6 }, (_, cursor) => dropCarrierPowerUpAtCursor(cursor))).toEqual([
      "star",
      "helmet",
      "shovel",
      "bomb",
      "clock",
      "tank",
    ]);
  });
});

describe("runtime FC flashing enemy power ups", () => {
  it("marks the fourth spawned enemy as carrying a power up", () => {
    const runtime = createRuntime(0, 0);

    runRuntime(runtime, idleInput, CONFIG.enemySpawnIntervalMs + 160);

    expect(getRuntimeSnapshot(runtime).enemies.some((enemy) => "carriesPowerUp" in enemy && Boolean(enemy.carriesPowerUp))).toBe(true);
  });

  it("spawns a power up the first time a carrying enemy is hit", () => {
    const runtime = createRuntime(0, 0);

    runRuntime(runtime, idleInput, CONFIG.enemySpawnIntervalMs + 160);

    const carrier = runtime.enemies.find((enemy) => Boolean((enemy as { carriesPowerUp?: boolean }).carriesPowerUp));
    expect(carrier).toBeDefined();

    if (!carrier) {
      return;
    }

    runtime.enemySpawnsDisabled = true;
    carrier.type = "armor";
    carrier.armor = 3;
    carrier.position = tileToCenter({ x: 3, y: 10 });
    carrier.direction = "down";
    carrier.invulnerableUntil = 0;
    carrier.cooldownUntil = 99999;
    runtime.enemies = [carrier];
    runtime.player.position = tileToCenter({ x: 3, y: 12 });
    runtime.player.direction = "up";

    stepRuntime(runtime, { ...idleInput, fire: true }, 16);
    runRuntime(runtime, idleInput, 520);

    const snapshot = getRuntimeSnapshot(runtime);
    expect(snapshot.powerUps).toHaveLength(1);
    expect(snapshot.enemies[0].armor).toBe(2);
    expect("carriesPowerUp" in snapshot.enemies[0] && Boolean(snapshot.enemies[0].carriesPowerUp)).toBe(false);
  });

  it("clears an existing power up when the eleventh carrying enemy spawns", () => {
    const runtime = createRuntime(0, 0, { suppressInitialEnemies: true });

    while (runtime.nextEnemySpawnIndex < 10) {
      advanceToNextSpawn(runtime);
    }

    runtime.powerUps = [{ type: "helmet", tile: { x: 1, y: 1 }, expiresAt: Number.POSITIVE_INFINITY }];

    advanceToNextSpawn(runtime, false);

    expect(runtime.nextEnemySpawnIndex).toBe(11);
    expect(getRuntimeSnapshot(runtime).powerUps).toHaveLength(0);
    expect(getRuntimeSnapshot(runtime).enemies.some((enemy) => "carriesPowerUp" in enemy && Boolean(enemy.carriesPowerUp))).toBe(true);
  });

  it("uses the FC carrier slots for flashing power-up enemies", () => {
    const runtime = createRuntime(0, 0, { suppressInitialEnemies: true });
    const carriers: number[] = [];

    while (runtime.nextEnemySpawnIndex < CONFIG.enemiesPerLevel) {
      advanceToNextSpawn(runtime, false);

      if (getRuntimeSnapshot(runtime).enemies.some((enemy) => enemy.carriesPowerUp)) {
        carriers.push(runtime.nextEnemySpawnIndex);
      }

      runtime.enemies = [];
    }

    expect(carriers).toEqual([4, 11, 18]);
  });

  it("awards 500 points when the player collects a power up", () => {
    const runtime = createRuntime(0, 0, { suppressInitialEnemies: true, disableEnemySpawns: true });

    collectPowerUp(runtime, "helmet");

    expect(getRuntimeSnapshot(runtime).hud.score).toBe(500);
  });

  it("cycles carrier drops through every FC power up before repeating", () => {
    const drops = Array.from({ length: 6 }, (_, cursor) => dropCarrierPowerUpAtCursor(cursor));

    expect(drops).toEqual(["star", "helmet", "shovel", "bomb", "clock", "tank"]);
  });
});

describe("runtime combat", () => {
  it("lets player bullets destroy enemies and emits combat events", () => {
    const runtime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 3, y: 12 },
      initialEnemies: [{ type: "normal", tile: { x: 3, y: 10 }, direction: "down", invulnerableUntil: 0 }],
    });

    const shotEvents = stepRuntime(runtime, { ...idleInput, fire: true }, 16);
    const runtimeEvents = runRuntime(runtime, idleInput, 520);

    const allEvents = [...shotEvents, ...runtimeEvents];
    const snapshot = getRuntimeSnapshot(runtime);

    expect(allEvents.some((event) => event.type === "shot")).toBe(true);
    expect(allEvents.some((event) => event.type === "hit")).toBe(true);
    expect(snapshot.enemies).toHaveLength(0);
    expect(snapshot.hud.score).toBeGreaterThan(0);
  });

  it("damages brick by 2x2 sub-blocks and destroys the base through the same bullet collision pipeline", () => {
    const brickRuntime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 2, y: 3 },
      playerDirection: "up",
    });

    stepRuntime(brickRuntime, { ...idleInput, fire: true }, 16);
    runRuntime(brickRuntime, idleInput, 160);

    const brickSnapshot = getRuntimeSnapshot(brickRuntime);
    const brickDamage = brickSnapshot.terrainDamage.find((damage) => damage.tile.x === 2 && damage.tile.y === 2);
    expect(brickSnapshot.grid[2][2]).toBe("brick");
    expect(brickDamage?.kind).toBe("brick");
    expect(brickDamage?.brickMask).not.toBe(0b1111);
    expect(brickDamage?.brickMask).not.toBe(0);

    const baseRuntime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 6, y: 10 },
      playerDirection: "down",
    });
    baseRuntime.grid[11][6] = "empty";

    stepRuntime(baseRuntime, { ...idleInput, fire: true }, 16);
    runRuntime(baseRuntime, idleInput, 300);

    const baseSnapshot = getRuntimeSnapshot(baseRuntime);
    expect(baseSnapshot.grid[12][6]).toBe("baseDestroyed");
    expect(baseSnapshot.status).toBe("defeat");
  });

  it("cancels player and enemy bullets when they collide", () => {
    const runtime = createRuntime(0, 0, { suppressInitialEnemies: true, disableEnemySpawns: true });
    const center = tileToCenter({ x: 1, y: 7 });

    runtime.bullets.push(
      { id: "player-bullet", owner: "player", position: { x: center.x - 3, y: center.y }, direction: "right", speed: 0, power: 1 },
      { id: "enemy-bullet", owner: "enemy", position: { x: center.x + 3, y: center.y }, direction: "left", speed: 0, power: 1 },
    );

    const events = stepRuntime(runtime, idleInput, 16);
    const snapshot = getRuntimeSnapshot(runtime);

    expect(snapshot.bullets).toHaveLength(0);
    expect(events.some((event) => event.type === "explosion")).toBe(true);
  });

  it("gives the player a respawn invulnerability window after enemy fire", () => {
    const runtime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 3, y: 12 },
      playerInvulnerableUntil: 0,
      initialEnemies: [{ type: "normal", tile: { x: 3, y: 10 }, direction: "down", cooldownUntil: 0, decisionAt: 99999 }],
    });

    runRuntime(runtime, idleInput, 520);

    const snapshot = getRuntimeSnapshot(runtime);
    expect(snapshot.player.lives).toBe(CONFIG.playerLives - 1);
    expect(snapshot.player.invulnerableUntil).toBeGreaterThan(snapshot.elapsedMs);
  });

  it("awards score, kill statistics, and bonus lives when score crosses each 20000-point threshold", () => {
    const runtime = createRuntime(0, 19900, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 3, y: 12 },
      playerDirection: "up",
      initialEnemies: [{ type: "normal", tile: { x: 3, y: 10 }, direction: "down", invulnerableUntil: 0, cooldownUntil: 99999 }],
    });

    stepRuntime(runtime, { ...idleInput, fire: true }, 16);
    runRuntime(runtime, idleInput, 520);

    const snapshot = getRuntimeSnapshot(runtime);
    expect(snapshot.hud.score).toBe(20000);
    expect(snapshot.hud.lives).toBe(CONFIG.playerLives + 1);
    expect(snapshot.stageStats.destroyedEnemies.normal).toBe(1);
    expect(snapshot.stageStats.enemyScore.normal).toBe(100);
    expect(snapshot.stageStats.bonusLives).toBe(1);
  });

  it("prevents the center spawn enemy from shooting straight through to the base", () => {
    const runtime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 1, y: 12 },
      initialEnemies: [{ type: "normal", tile: { x: 6, y: 1 }, direction: "down", cooldownUntil: 0, decisionAt: 99999, spawningUntil: 0 }],
    });
    runtime.enemies[0].speed = 0;

    runRuntime(runtime, idleInput, 4200);

    const snapshot = getRuntimeSnapshot(runtime);
    expect(snapshot.grid[2][6]).toBe("steel");
    expect(snapshot.grid[12][6]).toBe("base");
    expect(snapshot.status).toBe("playing");
  });
});

describe("runtime enemy AI and pacing", () => {
  it("applies FC-style tuning for enemy health, scores, firing cadence, and bullet speed", () => {
    expect(CONFIG.playerSpeed).toBe(80);
    expect(CONFIG.playerFirepower[1].bulletSpeed).toBe(225);
    expect(CONFIG.enemyTypes.normal.movementSpeed).toBe(50);
    expect(CONFIG.enemyTypes.fast.movementSpeed).toBe(70);
    expect(CONFIG.enemyTypes.armor.movementSpeed).toBe(58);
    expect(CONFIG.enemyTypes.power.bulletSpeed).toBe(300);

    const powerScoreRuntime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 3, y: 12 },
      playerDirection: "up",
      initialEnemies: [{ type: "power", tile: { x: 3, y: 10 }, direction: "down", invulnerableUntil: 0, cooldownUntil: 99999, spawningUntil: 0 }],
    });

    expect(getRuntimeSnapshot(powerScoreRuntime).enemies[0].armor).toBe(1);

    stepRuntime(powerScoreRuntime, { ...idleInput, fire: true }, 16);
    runRuntime(powerScoreRuntime, idleInput, 520);

    expect(getRuntimeSnapshot(powerScoreRuntime).hud.score).toBe(300);

    const armorRuntime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      initialEnemies: [{ type: "armor", tile: { x: 3, y: 8 }, direction: "down", cooldownUntil: 99999, spawningUntil: 0 }],
    });

    expect(getRuntimeSnapshot(armorRuntime).enemies[0].armor).toBe(4);

    const normalFire = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 9, y: 12 },
      initialEnemies: [{ type: "normal", tile: { x: 3, y: 8 }, direction: "down", decisionAt: 99999, spawningUntil: 0 }],
    });
    const powerFire = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 9, y: 12 },
      initialEnemies: [{ type: "power", tile: { x: 3, y: 8 }, direction: "down", decisionAt: 99999, spawningUntil: 0 }],
    });

    runRuntime(normalFire, idleInput, 900);
    runRuntime(powerFire, idleInput, 900);

    expect(getRuntimeSnapshot(normalFire).bullets.filter((bullet) => bullet.owner === "enemy")).toHaveLength(0);
    expect(getRuntimeSnapshot(powerFire).bullets.filter((bullet) => bullet.owner === "enemy")).toHaveLength(1);

    const normalBulletSpeed = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 9, y: 12 },
      initialEnemies: [{ type: "normal", tile: { x: 3, y: 8 }, direction: "down", cooldownUntil: 0, decisionAt: 99999, spawningUntil: 0 }],
    });
    const powerBulletSpeed = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 9, y: 12 },
      initialEnemies: [{ type: "power", tile: { x: 3, y: 8 }, direction: "down", cooldownUntil: 0, decisionAt: 99999, spawningUntil: 0 }],
    });

    runRuntime(normalBulletSpeed, idleInput, 96);
    runRuntime(powerBulletSpeed, idleInput, 96);

    expect(getRuntimeSnapshot(powerBulletSpeed).bullets[0].position.y).toBeGreaterThan(getRuntimeSnapshot(normalBulletSpeed).bullets[0].position.y);
  });

  it("keeps spawned enemies locked until their spawn window ends", () => {
    const runtime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 9, y: 12 },
      initialEnemies: [{ type: "normal", tile: { x: 3, y: 7 }, direction: "right", cooldownUntil: 0, decisionAt: 0, spawningUntil: 500 }],
    });
    const initial = getRuntimeSnapshot(runtime).enemies[0];

    runRuntime(runtime, idleInput, 480);

    const locked = getRuntimeSnapshot(runtime);
    expect(locked.enemies[0].position).toEqual(initial.position);
    expect(locked.enemies[0].spawningUntil).toBe(500);
    expect(locked.bullets.filter((bullet) => bullet.owner === "enemy")).toHaveLength(0);

    runRuntime(runtime, idleInput, 120);

    const released = getRuntimeSnapshot(runtime);
    expect(released.enemies[0].position.x).toBeGreaterThan(initial.position.x);
    expect(released.bullets.filter((bullet) => bullet.owner === "enemy")).toHaveLength(1);
  });

  it("uses the next open spawn portal instead of stacking enemies on an occupied portal", () => {
    const runtime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      initialEnemies: [{ type: "normal", tile: { x: 0, y: 0 }, direction: "down", cooldownUntil: 99999, spawningUntil: 99999 }],
    });

    stepRuntime(runtime, idleInput, 16);

    const spawned = getRuntimeSnapshot(runtime).enemies.find((enemy) => enemy.spawnPointIndex !== undefined);
    expect(spawned?.spawnPointIndex).toBe(1);
    expect(getRuntimeSnapshot(runtime).enemies.map((enemy) => enemy.position)).toEqual([
      tileToCenter({ x: 0, y: 0 }),
      tileToCenter({ x: 6, y: 0 }),
    ]);
  });

  it("does not consume queued enemies when every spawn portal is occupied", () => {
    const runtime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      initialEnemies: [
        { type: "normal", tile: { x: 0, y: 0 }, direction: "down", cooldownUntil: 99999, spawningUntil: 99999 },
        { type: "normal", tile: { x: 6, y: 0 }, direction: "down", cooldownUntil: 99999, spawningUntil: 99999 },
        { type: "normal", tile: { x: 12, y: 0 }, direction: "down", cooldownUntil: 99999, spawningUntil: 99999 },
      ],
    });

    stepRuntime(runtime, idleInput, 16);

    expect(runtime.nextEnemySpawnIndex).toBe(0);
    expect(runtime.enemyQueue).toHaveLength(CONFIG.enemiesPerLevel);
    expect(getRuntimeSnapshot(runtime).enemies).toHaveLength(3);
  });

  it("keeps enemies driving in an open lane instead of constantly retargeting sideways", () => {
    const runtime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 3, y: 12 },
      initialEnemies: [{ type: "normal", tile: { x: 3, y: 7 }, direction: "right", cooldownUntil: 99999, decisionAt: 0, spawningUntil: 0 }],
    });

    stepRuntime(runtime, idleInput, 16);

    const enemy = getRuntimeSnapshot(runtime).enemies[0];
    expect(enemy.direction).toBe("right");
    expect(enemy.position.x).toBeGreaterThan(tileToCenter({ x: 3, y: 7 }).x);
  });

  it("repairs and temporarily fortifies the classic base guard tiles with the shovel", () => {
    const runtime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 6, y: 10 },
      playerDirection: "down",
    });
    runtime.grid[11][6] = "empty";

    collectPowerUp(runtime, "shovel");

    expect(runtime.grid[11][6]).toBe("brick");

    runtime.player.powerLevel = 4;
    stepRuntime(runtime, { ...idleInput, fire: true }, 16);
    runRuntime(runtime, idleInput, 160);

    expect(runtime.grid[11][6]).toBe("brick");

    runRuntime(runtime, idleInput, CONFIG.powerUpDurations.shovelMs + CONFIG.playerFireCooldownMs);
    stepRuntime(runtime, { ...idleInput, fire: true }, 16);
    runRuntime(runtime, idleInput, 160);

    expect(runtime.grid[11][6]).toBe("brick");
    expect(getRuntimeSnapshot(runtime).terrainDamage).toContainEqual({ tile: { x: 6, y: 11 }, kind: "brick", brickMask: 0b1100 });
  });

  it("keeps the player sliding briefly after releasing movement on ice", () => {
    const runtime = createRuntime(1, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 6, y: 7 },
      playerDirection: "right",
    });
    runtime.grid[7][6] = "ice";
    runtime.grid[7][7] = "ice";

    runRuntime(runtime, { ...idleInput, right: true }, 120);
    const beforeRelease = getRuntimeSnapshot(runtime).player.position.x;
    runRuntime(runtime, idleInput, CONFIG.iceSlideMs / 2);
    const sliding = getRuntimeSnapshot(runtime).player.position.x;
    runRuntime(runtime, idleInput, CONFIG.iceSlideMs + 80);
    const stopped = getRuntimeSnapshot(runtime).player.position.x;
    runRuntime(runtime, idleInput, 200);
    const settled = getRuntimeSnapshot(runtime).player.position.x;

    expect(sliding).toBeGreaterThan(beforeRelease);
    expect(settled).toBe(stopped);
  });

  it("rotates spawn points and caps active enemies at four", () => {
    const runtime = createRuntime(0, 0);

    runRuntime(runtime, idleInput, CONFIG.enemySpawnIntervalMs * 5);

    const snapshot = getRuntimeSnapshot(runtime);
    expect(snapshot.enemies).toHaveLength(CONFIG.maxActiveEnemies);
    expect(snapshot.enemies.map((enemy) => enemy.spawnPointIndex).slice(0, 3)).toEqual([0, 1, 2]);
  });

  it("increases base pressure and spawn pace by stage", () => {
    const first = getStageTuning(0);
    const third = getStageTuning(2);

    expect(third.basePressure).toBeGreaterThan(first.basePressure);
    expect(third.enemySpawnIntervalMs).toBeLessThan(first.enemySpawnIntervalMs);
    expect(third.powerUpSpawnIntervalMs).toBeGreaterThan(first.powerUpSpawnIntervalMs);
  });

  it("changes enemy direction when the chosen path is blocked", () => {
    const runtime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 9, y: 12 },
      initialEnemies: [{ type: "normal", tile: { x: 3, y: 7 }, direction: "right", cooldownUntil: 99999, decisionAt: 0, spawningUntil: 0 }],
    });
    runtime.grid[7][4] = "brick";
    runtime.enemies[0].position.x = tileToCenter({ x: 3, y: 7 }).x + 2;

    stepRuntime(runtime, idleInput, 16);

    const enemy = getRuntimeSnapshot(runtime).enemies[0];
    expect(enemy.direction).not.toBe("right");
  });
});
