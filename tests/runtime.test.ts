import { describe, expect, it } from "vitest";
import { CONFIG } from "../src/game/config";
import { buildConstructionLevel, createConstructionGrid } from "../src/game/construction";
import { tileToCenter } from "../src/game/geometry";
import type { RuntimeInput, RuntimeInputFrame } from "../src/game/runtime/types";
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

function runRuntimeFrame(runtime: ReturnType<typeof createRuntime>, input: RuntimeInputFrame, ms: number) {
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

  return stepRuntime(runtime, idleInput, 16);
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

function dropSeededCarrierPowerUp(seed: number) {
  const runtime = createRuntime(0, 0, {
    suppressInitialEnemies: true,
    disableEnemySpawns: true,
    playerTile: { x: 3, y: 12 },
    playerDirection: "up",
    seed,
    initialEnemies: [
      {
        type: "armor",
        tile: { x: 3, y: 10 },
        direction: "down",
        invulnerableUntil: 99999,
        cooldownUntil: 99999,
        spawningUntil: 99999,
        carriesPowerUp: true,
      },
    ],
  });

  for (let y = 0; y < CONFIG.gridRows; y += 1) {
    for (let x = 0; x < CONFIG.gridColumns; x += 1) {
      runtime.grid[y][x] = "empty";
    }
  }

  stepRuntime(runtime, { ...idleInput, fire: true }, 16);
  runRuntime(runtime, idleInput, 520);

  return getRuntimeSnapshot(runtime).powerUps[0];
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

describe("runtime two-player mode", () => {
  it("spawns a second player at the classic right-side base position", () => {
    const runtime = createRuntime(0, 0, { twoPlayers: true, suppressInitialEnemies: true, disableEnemySpawns: true });
    const snapshot = getRuntimeSnapshot(runtime);

    expect(snapshot.player.tile).toEqual({ x: 4, y: 12 });
    expect(snapshot.player2?.tile).toEqual({ x: 8, y: 12 });
    expect(snapshot.hud.livesP2).toBe(CONFIG.playerLives);
  });

  it("keeps player bullet caps independent in co-op", () => {
    const runtime = createRuntime(0, 0, { twoPlayers: true, suppressInitialEnemies: true, disableEnemySpawns: true });

    for (let y = 0; y < CONFIG.gridRows; y += 1) {
      runtime.grid[y][4] = "empty";
      runtime.grid[y][8] = "empty";
    }

    stepRuntime(runtime, { player1: { ...idleInput, fire: true }, player2: { ...idleInput, fire: true } }, 16);

    expect(getRuntimeSnapshot(runtime).bullets.filter((bullet) => bullet.owner === "player")).toHaveLength(2);
  });

  it("lets player two collect individual power ups", () => {
    const runtime = createRuntime(0, 0, { twoPlayers: true, suppressInitialEnemies: true, disableEnemySpawns: true });
    const player2Tile = getRuntimeSnapshot(runtime).player2?.tile;

    expect(player2Tile).toBeDefined();

    if (!player2Tile) {
      return;
    }

    runtime.powerUps.push({ type: "star", tile: player2Tile, expiresAt: runtime.elapsedMs + 1000 });
    stepRuntime(runtime, { player1: idleInput, player2: idleInput }, 16);

    const snapshot = getRuntimeSnapshot(runtime);
    expect(snapshot.player.powerLevel).toBe(1);
    expect(snapshot.player2?.powerLevel).toBe(2);
  });

  it("awards threshold bonus lives to the co-op player who scores", () => {
    const runtime = createRuntime(0, 19500, {
      twoPlayers: true,
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
    });
    const player2Tile = getRuntimeSnapshot(runtime).player2?.tile;

    expect(player2Tile).toBeDefined();

    if (!player2Tile) {
      return;
    }

    runtime.powerUps.push({ type: "helmet", tile: player2Tile, expiresAt: runtime.elapsedMs + 1000 });
    const events = stepRuntime(runtime, { player1: idleInput, player2: idleInput }, 16);

    const snapshot = getRuntimeSnapshot(runtime);
    expect(snapshot.hud.score).toBe(20000);
    expect(snapshot.hud.lives).toBe(CONFIG.playerLives);
    expect(snapshot.hud.livesP2).toBe(CONFIG.playerLives + 1);
    expect(events.some((event) => event.type === "bonus-life" && event.score === 20000)).toBe(true);
  });

  it("continues while one co-op player is out and defeats only when both are out", () => {
    const runtime = createRuntime(0, 0, { twoPlayers: true, suppressInitialEnemies: true, disableEnemySpawns: true });
    runtime.player.lives = 0;

    stepRuntime(runtime, { player1: idleInput, player2: idleInput }, 16);
    expect(getRuntimeSnapshot(runtime).status).toBe("playing");

    if (runtime.player2) {
      runtime.player2.lives = 0;
    }

    stepRuntime(runtime, { player1: idleInput, player2: idleInput }, 16);
    expect(getRuntimeSnapshot(runtime).status).toBe("defeat");
  });

  it("stuns the other player with friendly fire without costing a life", () => {
    const runtime = createRuntime(0, 0, {
      twoPlayers: true,
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 3, y: 12 },
      player2Tile: { x: 3, y: 10 },
      playerDirection: "up",
      player2Direction: "up",
    });

    for (let y = 0; y < CONFIG.gridRows; y += 1) {
      runtime.grid[y][3] = "empty";
      runtime.grid[y][4] = "empty";
    }

    stepRuntime(runtime, { player1: { ...idleInput, fire: true }, player2: idleInput }, 16);
    const events = runRuntimeFrame(runtime, { player1: idleInput, player2: idleInput }, 520);

    const snapshot = getRuntimeSnapshot(runtime);
    const stunned = snapshot.player2;
    expect(events.some((event) => event.type === "player-stunned")).toBe(true);
    expect(stunned?.lives).toBe(CONFIG.playerLives);
    expect(stunned?.stunnedUntil).toBeGreaterThan(snapshot.elapsedMs);

    if (!stunned) {
      return;
    }

    const beforeMove = stunned.position;
    const fireEvents = runRuntimeFrame(runtime, { player1: idleInput, player2: { ...idleInput, right: true, fire: true } }, 32);
    const afterInput = getRuntimeSnapshot(runtime).player2;

    expect(afterInput?.position).toEqual(beforeMove);
    expect(afterInput?.direction).toBe("right");
    expect(fireEvents.some((event) => event.type === "shot" && event.owner === "player")).toBe(true);
  });
});

describe("runtime construction stages", () => {
  it("treats a custom construction level as a single-stage victory", () => {
    const runtime = createRuntime(0, 0, {
      customLevel: buildConstructionLevel(createConstructionGrid()),
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
    });

    runtime.enemyQueue = [];
    stepRuntime(runtime, idleInput, 16);

    const snapshot = getRuntimeSnapshot(runtime);
    expect(snapshot.status).toBe("victory");
    expect(snapshot.hud.stageLabel).toBe("EDIT");
    expect(snapshot.hud.isCustomStage).toBe(true);
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

  it("keeps the full-power player cap at two bullets while adding steel-breaking fire", () => {
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

    expect(getRuntimeSnapshot(runtime).player.powerLevel).toBe(4);
    expect(getRuntimeSnapshot(runtime).bullets.filter((bullet) => bullet.owner === "player")).toHaveLength(2);
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

    expect(getRuntimeSnapshot(fullPower).bullets.filter((bullet) => bullet.owner === "player")).toHaveLength(2);
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

  it("lets full-power player shots clear a brick tile in one hit while normal fire still damages sub-blocks", () => {
    const normalPower = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 2, y: 3 },
      playerDirection: "up",
    });

    stepRuntime(normalPower, { ...idleInput, fire: true }, 16);
    runRuntime(normalPower, idleInput, 160);

    const normalSnapshot = getRuntimeSnapshot(normalPower);
    expect(normalSnapshot.grid[2][2]).toBe("brick");
    expect(normalSnapshot.terrainDamage.find((damage) => damage.tile.x === 2 && damage.tile.y === 2)?.brickMask).not.toBe(0);

    const fullPower = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 2, y: 3 },
      playerDirection: "up",
    });
    fullPower.player.powerLevel = 4;

    stepRuntime(fullPower, { ...idleInput, fire: true }, 16);
    runRuntime(fullPower, idleInput, 160);

    expect(getRuntimeSnapshot(fullPower).grid[2][2]).toBe("empty");
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
    const events = runRuntime(runtime, idleInput, 520);

    const snapshot = getRuntimeSnapshot(runtime);
    expect(snapshot.powerUps).toHaveLength(1);
    expect(events.some((event) => event.type === "powerup-spawned" && event.powerUp === snapshot.powerUps[0].type)).toBe(true);
    expect(snapshot.enemies[0].armor).toBe(2);
    expect("carriesPowerUp" in snapshot.enemies[0] && Boolean(snapshot.enemies[0].carriesPowerUp)).toBe(false);
  });

  it("spawns a power up when a carrying one-hit enemy is destroyed", () => {
    const runtime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 3, y: 12 },
      playerDirection: "up",
      initialEnemies: [
        {
          type: "normal",
          tile: { x: 3, y: 10 },
          direction: "down",
          invulnerableUntil: 0,
          cooldownUntil: 99999,
          spawningUntil: 0,
          carriesPowerUp: true,
        },
      ],
    });

    stepRuntime(runtime, { ...idleInput, fire: true }, 16);
    runRuntime(runtime, idleInput, 520);

    const snapshot = getRuntimeSnapshot(runtime);
    expect(snapshot.enemies).toHaveLength(0);
    expect(snapshot.powerUps).toHaveLength(1);
  });

  it("spawns a power up when a carrying enemy is hit during its spawn shield", () => {
    const runtime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 3, y: 12 },
      playerDirection: "up",
      initialEnemies: [
        {
          type: "normal",
          tile: { x: 3, y: 10 },
          direction: "down",
          invulnerableUntil: 99999,
          cooldownUntil: 99999,
          spawningUntil: 99999,
          carriesPowerUp: true,
        },
      ],
    });

    stepRuntime(runtime, { ...idleInput, fire: true }, 16);
    runRuntime(runtime, idleInput, 520);

    const snapshot = getRuntimeSnapshot(runtime);
    expect(snapshot.enemies).toHaveLength(1);
    expect(snapshot.enemies[0].armor).toBe(1);
    expect(snapshot.enemies[0].carriesPowerUp).toBe(false);
    expect(snapshot.powerUps).toHaveLength(1);
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

  it("freezes enemy movement and firing with the clock while the player can still move and shoot", () => {
    const runtime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 3, y: 12 },
      playerDirection: "up",
      initialEnemies: [{ type: "normal", tile: { x: 5, y: 8 }, direction: "down", cooldownUntil: 0, decisionAt: 0, spawningUntil: 0 }],
    });

    for (let y = 0; y < CONFIG.gridRows; y += 1) {
      runtime.grid[y][3] = "empty";
    }

    const beforeClock = getRuntimeSnapshot(runtime).enemies[0];
    collectPowerUp(runtime, "clock");
    const events = runRuntime(runtime, { ...idleInput, up: true, fire: true }, 420);
    const frozen = getRuntimeSnapshot(runtime);

    expect(frozen.enemies[0].position).toEqual(beforeClock.position);
    expect(frozen.bullets.filter((bullet) => bullet.owner === "enemy")).toHaveLength(0);
    expect(frozen.player.position.y).toBeLessThan(tileToCenter({ x: 3, y: 12 }).y);
    expect(events.some((event) => event.type === "shot" && event.owner === "player")).toBe(true);
  });

  it("cycles carrier drops through every FC power up before repeating", () => {
    const drops = Array.from({ length: 6 }, (_, cursor) => dropCarrierPowerUpAtCursor(cursor));

    expect(drops).toEqual(["star", "helmet", "shovel", "bomb", "clock", "tank"]);
  });

  it("uses seeded runtime randomness for flashing enemy power-up positions", () => {
    const first = dropSeededCarrierPowerUp(1);
    const repeated = dropSeededCarrierPowerUp(1);
    const different = dropSeededCarrierPowerUp(2);

    expect(first?.tile).toEqual(repeated?.tile);
    expect(first?.tile).not.toEqual(different?.tile);
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
    expect(allEvents).toContainEqual(
      expect.objectContaining({
        type: "enemy-destroyed",
        owner: "player",
        enemyType: "normal",
        score: CONFIG.enemyTypes.normal.score,
      }),
    );
    expect(snapshot.enemies).toHaveLength(0);
    expect(snapshot.hud.score).toBeGreaterThan(0);
  });

  it("clears enemies with the bomb without counting them in score or end-stage kill stats", () => {
    const runtime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 6, y: 12 },
      initialEnemies: [
        { type: "normal", tile: { x: 3, y: 10 }, direction: "down", invulnerableUntil: 0, spawningUntil: 0 },
        { type: "fast", tile: { x: 8, y: 10 }, direction: "down", invulnerableUntil: 0, spawningUntil: 0 },
      ],
    });

    const events = collectPowerUp(runtime, "bomb");
    const destroyedEvents = events.filter((event) => event.type === "enemy-destroyed");
    const snapshot = getRuntimeSnapshot(runtime);

    expect(snapshot.enemies).toHaveLength(0);
    expect(snapshot.hud.score).toBe(CONFIG.powerUpScore);
    expect(snapshot.stageStats.powerUpScore).toBe(CONFIG.powerUpScore);
    expect(snapshot.stageStats.destroyedEnemies.normal).toBe(0);
    expect(snapshot.stageStats.destroyedEnemies.fast).toBe(0);
    expect(snapshot.stageStats.enemyScore.normal).toBe(0);
    expect(snapshot.stageStats.enemyScore.fast).toBe(0);
    expect(destroyedEvents).toHaveLength(2);
    expect(destroyedEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ enemyType: "normal", score: 0 }),
        expect.objectContaining({ enemyType: "fast", score: 0 }),
      ]),
    );
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

    runRuntime(brickRuntime, idleInput, CONFIG.playerFireCooldownMs + 16);
    stepRuntime(brickRuntime, { ...idleInput, fire: true }, 16);
    runRuntime(brickRuntime, idleInput, 220);

    expect(getRuntimeSnapshot(brickRuntime).grid[2][2]).toBe("empty");

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

  it("locks player movement and firing during the post-death respawn animation", () => {
    const runtime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerInvulnerableUntil: 0,
    });
    const playerStart = getRuntimeSnapshot(runtime).player.position;

    runtime.bullets.push({
      id: "enemy-hit",
      owner: "enemy",
      position: { ...playerStart },
      direction: "up",
      speed: 0,
      power: 1,
    });

    stepRuntime(runtime, idleInput, 16);
    const respawning = getRuntimeSnapshot(runtime);
    const lockedEvents = stepRuntime(runtime, { ...idleInput, up: true, fire: true }, 16);
    const locked = getRuntimeSnapshot(runtime);

    expect(respawning.player.lives).toBe(CONFIG.playerLives - 1);
    expect(respawning.player.spawningUntil).toBeGreaterThan(respawning.elapsedMs);
    expect(locked.player.position).toEqual(respawning.player.position);
    expect(lockedEvents.some((event) => event.type === "shot" && event.owner === "player")).toBe(false);

    runRuntime(runtime, idleInput, CONFIG.playerRespawnLockMs + 16);
    const readyEvents = stepRuntime(runtime, { ...idleInput, fire: true }, 16);

    expect(getRuntimeSnapshot(runtime).player.spawningUntil).toBeLessThanOrEqual(getRuntimeSnapshot(runtime).elapsedMs);
    expect(readyEvents.some((event) => event.type === "shot" && event.owner === "player")).toBe(true);
  });

  it("clears the destroyed player's active bullets when a life is lost", () => {
    const runtime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerInvulnerableUntil: 0,
    });
    const playerStart = getRuntimeSnapshot(runtime).player.position;

    for (let y = 0; y < CONFIG.gridRows; y += 1) {
      for (let x = 0; x < CONFIG.gridColumns; x += 1) {
        runtime.grid[y][x] = "empty";
      }
    }

    runtime.bullets.push(
      {
        id: "old-player-shot",
        owner: "player",
        sourceTankId: "player",
        position: tileToCenter({ x: 1, y: 6 }),
        direction: "up",
        speed: 0,
        power: 1,
      },
      {
        id: "enemy-hit",
        owner: "enemy",
        sourceTankId: "enemy-test",
        position: { ...playerStart },
        direction: "up",
        speed: 0,
        power: 1,
      },
    );

    stepRuntime(runtime, idleInput, 16);

    const snapshot = getRuntimeSnapshot(runtime);
    expect(snapshot.player.lives).toBe(CONFIG.playerLives - 1);
    expect(snapshot.bullets.some((bullet) => bullet.owner === "player")).toBe(false);
  });

  it("lets the opening or helmet shield absorb enemy bullets instead of letting them pass through", () => {
    const runtime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 3, y: 12 },
      playerInvulnerableUntil: 99999,
      initialEnemies: [{ type: "normal", tile: { x: 3, y: 10 }, direction: "down", cooldownUntil: 0, decisionAt: 99999, spawningUntil: 0 }],
    });
    runtime.enemies[0].speed = 0;

    for (let y = 0; y < CONFIG.gridRows; y += 1) {
      runtime.grid[y][3] = "empty";
    }

    const events = runRuntime(runtime, idleInput, 520);
    const snapshot = getRuntimeSnapshot(runtime);

    expect(snapshot.player.lives).toBe(CONFIG.playerLives);
    expect(snapshot.bullets.filter((bullet) => bullet.owner === "enemy")).toHaveLength(0);
    expect(events.some((event) => event.type === "hit" && event.owner === "enemy")).toBe(true);
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
    const events = runRuntime(runtime, idleInput, 520);

    const snapshot = getRuntimeSnapshot(runtime);
    expect(snapshot.hud.score).toBe(20000);
    expect(snapshot.hud.lives).toBe(CONFIG.playerLives + 1);
    expect(snapshot.stageStats.destroyedEnemies.normal).toBe(1);
    expect(snapshot.stageStats.enemyScore.normal).toBe(100);
    expect(snapshot.stageStats.bonusLives).toBe(1);
    expect(events.some((event) => event.type === "bonus-life" && event.score === 20000)).toBe(true);
  });

  it("delays level completion long enough for the final enemy explosion to play out", () => {
    const runtime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 3, y: 12 },
      playerDirection: "up",
      initialEnemies: [{ type: "normal", tile: { x: 3, y: 10 }, direction: "down", invulnerableUntil: 0, cooldownUntil: 99999, spawningUntil: 0 }],
    });
    runtime.enemyQueue = [];

    stepRuntime(runtime, { ...idleInput, fire: true }, 16);
    runRuntime(runtime, idleInput, 520);

    const afterKill = getRuntimeSnapshot(runtime);
    expect(afterKill.enemies).toHaveLength(0);
    expect(afterKill.status).toBe("playing");

    runRuntime(runtime, idleInput, CONFIG.levelClearDelayMs + 16);

    const completed = getRuntimeSnapshot(runtime);
    expect(completed.status).toBe("level-complete");
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
    expect(CONFIG.playerFirepower[4].bulletSpeed).toBe(CONFIG.playerFirepower[3].bulletSpeed);
    expect(CONFIG.playerFirepower[4].maxBullets).toBe(2);
    expect(CONFIG.playerFirepower[4].destroysSteel).toBe(true);
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

  it("caps each enemy tank at one active bullet on screen", () => {
    const runtime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 9, y: 12 },
      initialEnemies: [{ type: "normal", tile: { x: 3, y: 8 }, direction: "down", cooldownUntil: 0, decisionAt: 99999, spawningUntil: 0 }],
    });
    runtime.enemies[0].speed = 0;

    for (let y = 0; y < CONFIG.gridRows; y += 1) {
      for (let x = 0; x < CONFIG.gridColumns; x += 1) {
        runtime.grid[y][x] = "empty";
      }
    }

    runRuntime(runtime, idleInput, CONFIG.enemyTypes.normal.fireCooldownMs * 2 + 120);

    expect(getRuntimeSnapshot(runtime).bullets.filter((bullet) => bullet.owner === "enemy")).toHaveLength(CONFIG.enemyMaxBulletsPerTank);
  });

  it("uses the next open spawn portal instead of stacking enemies on an occupied portal", () => {
    const runtime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      initialEnemies: [{ type: "normal", tile: { x: 0, y: 0 }, direction: "down", cooldownUntil: 99999, spawningUntil: 99999 }],
    });

    const events = stepRuntime(runtime, idleInput, 16);

    const spawned = getRuntimeSnapshot(runtime).enemies.find((enemy) => enemy.spawnPointIndex !== undefined);
    expect(spawned?.spawnPointIndex).toBe(1);
    expect(events.some((event) => event.type === "enemy-spawned" && event.position?.x === tileToCenter({ x: 6, y: 0 }).x)).toBe(true);
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

    expect(runtime.grid[11][6]).toBe("empty");
    expect(getRuntimeSnapshot(runtime).terrainDamage.some((damage) => damage.tile.x === 6 && damage.tile.y === 11)).toBe(false);
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

  it("makes later-stage enemies fire sooner from the same default cooldown", () => {
    const firstStage = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 9, y: 12 },
      initialEnemies: [{ type: "normal", tile: { x: 3, y: 8 }, direction: "down", decisionAt: 99999, spawningUntil: 0 }],
    });
    const thirdStage = createRuntime(2, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 9, y: 12 },
      initialEnemies: [{ type: "normal", tile: { x: 3, y: 8 }, direction: "down", decisionAt: 99999, spawningUntil: 0 }],
    });

    firstStage.enemies[0].speed = 0;
    thirdStage.enemies[0].speed = 0;

    for (const runtime of [firstStage, thirdStage]) {
      for (let y = 0; y < CONFIG.gridRows; y += 1) {
        for (let x = 0; x < CONFIG.gridColumns; x += 1) {
          runtime.grid[y][x] = "empty";
        }
      }
    }

    runRuntime(firstStage, idleInput, 1100);
    runRuntime(thirdStage, idleInput, 1100);

    expect(getRuntimeSnapshot(firstStage).bullets.filter((bullet) => bullet.owner === "enemy")).toHaveLength(0);
    expect(getRuntimeSnapshot(thirdStage).bullets.filter((bullet) => bullet.owner === "enemy")).toHaveLength(1);
  });

  it("uses stage base pressure to choose between hunting the player and pressing the base", () => {
    const makeBlockedRuntime = (levelIndex: number) => {
      const runtime = createRuntime(levelIndex, 0, {
        suppressInitialEnemies: true,
        disableEnemySpawns: true,
        playerTile: { x: 1, y: 6 },
        seed: 2,
        initialEnemies: [{ type: "normal", tile: { x: 5, y: 6 }, direction: "up", cooldownUntil: 99999, decisionAt: 0, spawningUntil: 0 }],
      });

      for (let y = 0; y < CONFIG.gridRows; y += 1) {
        for (let x = 0; x < CONFIG.gridColumns; x += 1) {
          runtime.grid[y][x] = "empty";
        }
      }

      runtime.grid[5][5] = "brick";
      runtime.level.base = { x: 10, y: 6 };
      runtime.enemies[0].position.y -= 3;
      return runtime;
    };
    const firstStage = makeBlockedRuntime(0);
    const thirdStage = makeBlockedRuntime(2);

    stepRuntime(firstStage, idleInput, 16);
    stepRuntime(thirdStage, idleInput, 16);

    expect(getRuntimeSnapshot(firstStage).enemies[0].direction).toBe("left");
    expect(getRuntimeSnapshot(thirdStage).enemies[0].direction).toBe("right");
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
