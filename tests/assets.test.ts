import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { SPRITE_SHEETS, SPRITE_FRAMES } from "../src/game/assets/spriteManifest";

function readPngSize(path: string): { width: number; height: number } {
  const buffer = readFileSync(new URL(`../src/assets/sprites/${path}`, import.meta.url));

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

describe("sprite assets", () => {
  it("keeps sprite sheets aligned to exact 32px grids", () => {
    expect(readPngSize(SPRITE_SHEETS.tanks.path)).toEqual({ width: 128, height: 128 });
    expect(readPngSize(SPRITE_SHEETS.terrain.path)).toEqual({ width: 256, height: 32 });
    expect(readPngSize(SPRITE_SHEETS.effects.path)).toEqual({ width: 256, height: 32 });
    expect(readPngSize(SPRITE_SHEETS.powerups.path)).toEqual({ width: 192, height: 32 });
  });

  it("maps gameplay concepts to deterministic sprite frame indexes", () => {
    expect(SPRITE_FRAMES.tanks.player.up).toBe(0);
    expect(SPRITE_FRAMES.tanks.player.right).toBe(1);
    expect(SPRITE_FRAMES.tanks.normal.up).toBe(4);
    expect(SPRITE_FRAMES.tanks.armor.left).toBe(15);
    expect(SPRITE_FRAMES.terrain.brick).toBe(1);
    expect(SPRITE_FRAMES.terrain.baseDestroyed).toBe(7);
    expect(SPRITE_FRAMES.powerups.tank).toBe(5);
  });
});

