import { describe, expect, it } from "vitest";
import { LEVELS } from "../src/levels";
import { parseLevel } from "../src/game/level";
import { CONFIG } from "../src/game/config";

describe("level parsing", () => {
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
});

