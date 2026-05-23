import type { Direction, EnemyType, PowerUpType, TileType } from "../types";

export const SPRITE_SIZE = 32;
export type PlayerPowerLevel = 1 | 2 | 3 | 4;

export const SPRITE_SHEETS = {
  tanks: { key: "tanks", path: "tanks.png", frameWidth: SPRITE_SIZE, frameHeight: SPRITE_SIZE },
  terrain: { key: "terrain", path: "terrain.png", frameWidth: SPRITE_SIZE, frameHeight: SPRITE_SIZE },
  effects: { key: "effects", path: "effects.png", frameWidth: SPRITE_SIZE, frameHeight: SPRITE_SIZE },
  powerups: { key: "powerups", path: "powerups.png", frameWidth: SPRITE_SIZE, frameHeight: SPRITE_SIZE },
} as const;

export const SPRITE_FRAMES: {
  tanks: { player: Record<PlayerPowerLevel, Record<Direction, number>> } & Record<EnemyType, Record<Direction, number>>;
  terrain: Record<TileType, number>;
  effects: Record<"bullet" | "muzzle" | "explosion1" | "explosion2" | "explosion3" | "explosion4" | "hitSpark" | "powerBurst", number>;
  powerups: Record<PowerUpType, number>;
} = {
  tanks: {
    player: {
      1: { up: 0, right: 1, down: 2, left: 3 },
      2: { up: 4, right: 5, down: 6, left: 7 },
      3: { up: 8, right: 9, down: 10, left: 11 },
      4: { up: 12, right: 13, down: 14, left: 15 },
    },
    normal: { up: 16, right: 17, down: 18, left: 19 },
    fast: { up: 20, right: 21, down: 22, left: 23 },
    power: { up: 24, right: 25, down: 26, left: 27 },
    armor: { up: 28, right: 29, down: 30, left: 31 },
  },
  terrain: {
    empty: 0,
    brick: 1,
    steel: 2,
    grass: 3,
    water: 4,
    ice: 5,
    base: 6,
    baseDestroyed: 7,
  },
  effects: {
    bullet: 0,
    muzzle: 1,
    explosion1: 2,
    explosion2: 3,
    explosion3: 4,
    explosion4: 5,
    hitSpark: 6,
    powerBurst: 7,
  },
  powerups: {
    star: 0,
    bomb: 1,
    clock: 2,
    shovel: 3,
    helmet: 4,
    tank: 5,
  },
};
