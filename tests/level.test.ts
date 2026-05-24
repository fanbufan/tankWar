import { describe, expect, it } from "vitest";
import { LEVELS } from "../src/levels";
import { parseLevel } from "../src/game/level";
import { CONFIG } from "../src/game/config";

describe("level parsing", () => {
  it("provides a 35-stage arcade-length level set with stable ids", () => {
    expect(LEVELS).toHaveLength(35);
    expect(LEVELS.map((level) => level.id)).toEqual(Array.from({ length: 35 }, (_, index) => index + 1));
    expect(new Set(LEVELS.map((level) => level.name)).size).toBe(LEVELS.length);
  });

  it("parses each v1 level into a 13 by 13 grid with 20 enemies", () => {
    for (const level of LEVELS) {
      const parsed = parseLevel(level);

      expect(parsed.grid).toHaveLength(CONFIG.gridRows);
      expect(parsed.grid.every((row) => row.length === CONFIG.gridColumns)).toBe(true);
      expect(parsed.enemyQueue).toHaveLength(CONFIG.enemiesPerLevel);
      expect(parsed.enemySpawnPoints).toHaveLength(3);
    }
  });

  it("keeps the player spawn and base inside the map", () => {
    for (const level of LEVELS) {
      const parsed = parseLevel(level);

      expect(parsed.playerSpawn.x).toBeGreaterThanOrEqual(0);
      expect(parsed.playerSpawn.y).toBeGreaterThanOrEqual(0);
      expect(parsed.base.x).toBeLessThan(CONFIG.gridColumns);
      expect(parsed.base.y).toBeLessThan(CONFIG.gridRows);
    }
  });

  it("keeps all tank spawn tiles clear after parsing", () => {
    for (const level of LEVELS) {
      const parsed = parseLevel(level);
      const spawnTiles = [parsed.playerSpawn, ...parsed.enemySpawnPoints];

      for (const spawn of spawnTiles) {
        expect(parsed.grid[spawn.y][spawn.x]).toBe("empty");
      }
    }
  });

  it("keeps the enemy spawn portals clear after parsing", () => {
    for (const level of LEVELS) {
      const parsed = parseLevel(level);

      for (const spawn of parsed.enemySpawnPoints) {
        for (let y = spawn.y; y <= spawn.y + 1; y += 1) {
          for (let x = Math.max(0, spawn.x - 1); x <= Math.min(CONFIG.gridColumns - 1, spawn.x + 1); x += 1) {
            expect(parsed.grid[y][x]).toBe("empty");
          }
        }
      }
    }
  });

  it("blocks direct fire lanes from a center enemy spawn to the base", () => {
    for (const level of LEVELS) {
      const parsed = parseLevel(level);

      for (const spawn of parsed.enemySpawnPoints) {
        if (spawn.x === parsed.base.x) {
          expect(parsed.grid[spawn.y + 2][spawn.x]).toBe("steel");
        }
      }
    }
  });

  it("normalizes the base guard to the classic five-brick shape", () => {
    for (const level of LEVELS) {
      const parsed = parseLevel(level);
      const { x, y } = parsed.base;

      expect(parsed.grid[y - 1].slice(x - 2, x + 3)).toEqual(["empty", "brick", "brick", "brick", "empty"]);
      expect(parsed.grid[y].slice(x - 2, x + 3)).toEqual(["empty", "brick", "base", "brick", "empty"]);
    }
  });
});
