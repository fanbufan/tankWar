import { describe, expect, it } from "vitest";
import { createGameState, spawnEnemy, fireBullet, tickGame, applyPowerUp } from "../src/game/simulation";
import { CONFIG } from "../src/game/config";

describe("game simulation", () => {
  it("spawns at most four active enemies from a 20 enemy queue", () => {
    const state = createGameState(0);

    for (let index = 0; index < 8; index += 1) {
      spawnEnemy(state);
    }

    expect(state.enemies).toHaveLength(CONFIG.maxActiveEnemies);
    expect(state.remainingEnemies).toBe(CONFIG.enemiesPerLevel - CONFIG.maxActiveEnemies);
  });

  it("lets the player fire one bullet and respects cooldown", () => {
    const state = createGameState(0);

    expect(fireBullet(state, "player")).toBe(true);
    expect(fireBullet(state, "player")).toBe(false);

    tickGame(state, CONFIG.playerFireCooldownMs);

    expect(fireBullet(state, "player")).toBe(true);
  });

  it("applies all v1 power ups with their expected state changes", () => {
    const state = createGameState(0);

    applyPowerUp(state, "star");
    applyPowerUp(state, "helmet");
    applyPowerUp(state, "shovel");
    applyPowerUp(state, "tank");
    spawnEnemy(state);
    applyPowerUp(state, "clock");
    applyPowerUp(state, "bomb");

    expect(state.player.powerLevel).toBe(2);
    expect(state.player.invulnerableUntil).toBeGreaterThan(state.elapsedMs);
    expect(state.baseFortifiedUntil).toBeGreaterThan(state.elapsedMs);
    expect(state.player.lives).toBe(CONFIG.playerLives + 1);
    expect(state.enemyFrozenUntil).toBeGreaterThan(state.elapsedMs);
    expect(state.enemies).toHaveLength(0);
  });
});

