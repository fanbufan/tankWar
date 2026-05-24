import { describe, expect, it } from "vitest";
import { TANK_TINTS, tankTint } from "../src/game/tankAppearance";
import type { RuntimeTankSnapshot } from "../src/game/runtime/types";

function enemyArmor(armor: number, overrides: Partial<RuntimeTankSnapshot> = {}): RuntimeTankSnapshot {
  return {
    id: "enemy",
    owner: "enemy",
    type: "armor",
    position: { x: 0, y: 0 },
    tile: { x: 0, y: 0 },
    direction: "down",
    armor,
    lives: 1,
    powerLevel: 1,
    invulnerableUntil: 0,
    stunnedUntil: 0,
    carriesPowerUp: false,
    spawningUntil: 0,
    ...overrides,
  };
}

describe("tank appearance", () => {
  it("shows FC-style armor damage colors as armor tanks lose health", () => {
    expect(tankTint(enemyArmor(4), 0)).toBeUndefined();
    expect(tankTint(enemyArmor(3), 0)).toBe(TANK_TINTS.armorDamaged);
    expect(tankTint(enemyArmor(2), 0)).toBe(TANK_TINTS.armorLastHit);
    expect(tankTint(enemyArmor(1), 0)).toBe(TANK_TINTS.armorCritical);
  });

  it("keeps stun and power-up carrier flashes higher priority than armor damage", () => {
    expect(tankTint(enemyArmor(1, { stunnedUntil: 1000 }), 0)).toBe(TANK_TINTS.stunned);
    expect(tankTint(enemyArmor(1, { carriesPowerUp: true }), 0)).toBe(TANK_TINTS.powerUpCarrier);
    expect(tankTint(enemyArmor(1, { carriesPowerUp: true }), 160)).toBe(TANK_TINTS.armorCritical);
  });
});
