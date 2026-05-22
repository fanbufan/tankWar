import { describe, expect, it } from "vitest";
import { CONFIG } from "../src/game/config";
import { tileToCenter } from "../src/game/geometry";
import type { RuntimeInput } from "../src/game/runtime/types";
import { createRuntime, getRuntimeSnapshot, getStageTuning, stepRuntime } from "../src/game/runtime";

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

describe("runtime movement feel", () => {
  it("keeps the player from entering blocked tiles and reports a stable snapshot contract", () => {
    const runtime = createRuntime(0, 500, { suppressInitialEnemies: true });
    const initial = getRuntimeSnapshot(runtime);

    expect(initial.hud.score).toBe(500);
    expect(initial.hud.stageLabel).toBe("1/3");
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

  it("destroys brick and the base through the same bullet collision pipeline", () => {
    const brickRuntime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      playerTile: { x: 2, y: 2 },
      playerDirection: "up",
    });

    stepRuntime(brickRuntime, { ...idleInput, fire: true }, 16);
    runRuntime(brickRuntime, idleInput, 160);

    expect(getRuntimeSnapshot(brickRuntime).grid[1][2]).toBe("empty");

    const baseRuntime = createRuntime(0, 0, {
      suppressInitialEnemies: true,
      disableEnemySpawns: true,
      playerTile: { x: 6, y: 10 },
      playerDirection: "down",
    });

    stepRuntime(baseRuntime, { ...idleInput, fire: true }, 16);
    runRuntime(baseRuntime, idleInput, 300);

    const baseSnapshot = getRuntimeSnapshot(baseRuntime);
    expect(baseSnapshot.grid[12][6]).toBe("baseDestroyed");
    expect(baseSnapshot.status).toBe("defeat");
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
});

describe("runtime enemy AI and pacing", () => {
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
      initialEnemies: [{ type: "normal", tile: { x: 0, y: 0 }, direction: "left", cooldownUntil: 99999 }],
    });

    stepRuntime(runtime, idleInput, 120);

    const enemy = getRuntimeSnapshot(runtime).enemies[0];
    expect(enemy.direction).not.toBe("left");
  });
});
