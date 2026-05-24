import { describe, expect, it } from "vitest";
import {
  buildConstructionLevel,
  CONSTRUCTION_BASE,
  CONSTRUCTION_ENEMY_SPAWNS,
  createConstructionGrid,
  cycleConstructionTile,
  isConstructionLockedTile,
  setConstructionTile,
} from "../src/game/construction";
import { CONFIG } from "../src/game/config";
import { parseLevel } from "../src/game/level";

describe("construction mode", () => {
  it("creates a 13x13 editable grid with fixed base and spawn anchors", () => {
    const grid = createConstructionGrid();

    expect(grid).toHaveLength(CONFIG.gridRows);
    expect(grid.every((row) => row.length === CONFIG.gridColumns)).toBe(true);
    expect(grid[CONSTRUCTION_BASE.y][CONSTRUCTION_BASE.x]).toBe("base");
    expect(grid[CONSTRUCTION_BASE.y - 1].slice(CONSTRUCTION_BASE.x - 1, CONSTRUCTION_BASE.x + 2)).toEqual(["brick", "brick", "brick"]);

    for (const spawn of CONSTRUCTION_ENEMY_SPAWNS) {
      expect(grid[spawn.y][spawn.x]).toBe("empty");
    }
  });

  it("cycles editable terrain without changing locked tiles", () => {
    const grid = createConstructionGrid();
    const cycled = cycleConstructionTile(grid, { x: 3, y: 3 });
    const locked = cycleConstructionTile(grid, CONSTRUCTION_BASE);

    expect(cycled[3][3]).toBe("brick");
    expect(locked[CONSTRUCTION_BASE.y][CONSTRUCTION_BASE.x]).toBe("base");
    expect(isConstructionLockedTile(CONSTRUCTION_BASE)).toBe(true);
  });

  it("builds a runtime-compatible custom level definition", () => {
    const edited = setConstructionTile(createConstructionGrid(), { x: 3, y: 3 }, "water");
    const level = buildConstructionLevel(edited);
    const parsed = parseLevel(level);

    expect(level.name).toBe("CONSTRUCTION");
    expect(parsed.grid[3][3]).toBe("water");
    expect(parsed.enemyQueue).toHaveLength(CONFIG.enemiesPerLevel);
    expect(parsed.enemySpawnPoints).toEqual(CONSTRUCTION_ENEMY_SPAWNS);
  });
});
