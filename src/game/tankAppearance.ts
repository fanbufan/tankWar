import { CONFIG } from "./config";
import type { RuntimeTankSnapshot } from "./runtime/types";

export const TANK_TINTS = {
  powerUpCarrier: 0xf5c451,
  stunned: 0x7dd3fc,
  armorDamaged: 0xf8d878,
  armorCritical: 0xd82800,
  armorLastHit: 0xfcfcfc,
} as const;

export function tankTint(tank: RuntimeTankSnapshot, elapsedMs: number): number | undefined {
  const blinkFrame = Math.floor(elapsedMs / 120) % 2 === 0;

  if (tank.stunnedUntil > elapsedMs && blinkFrame) {
    return TANK_TINTS.stunned;
  }

  if (tank.owner === "enemy" && tank.carriesPowerUp && blinkFrame) {
    return TANK_TINTS.powerUpCarrier;
  }

  if (tank.owner !== "enemy" || tank.type !== "armor") {
    return undefined;
  }

  const maxArmor = CONFIG.enemyTypes.armor.health;

  if (tank.armor >= maxArmor) {
    return undefined;
  }

  if (tank.armor <= 1) {
    return TANK_TINTS.armorCritical;
  }

  if (tank.armor === 2) {
    return TANK_TINTS.armorLastHit;
  }

  return TANK_TINTS.armorDamaged;
}
