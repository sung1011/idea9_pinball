import type { BallBody } from './ballBody';
import type { HealPulse } from './combatFloat';
import { HOOK_SHOVE_TECH } from './hookTech';

const grants: HealPulse[] = [];

export function takeHookShieldGrants(): HealPulse[] {
  if (grants.length === 0) {
    return [];
  }
  const out = grants.slice();
  grants.length = 0;
  return out;
}

export function clearHookShoveShield(ball: BallBody): void {
  ball.hookShoveShieldHp = 0;
  ball.hookShoveShieldRemain = 0;
}

/** 再触发重置 12 点与 2 秒，不叠加；不改药水盾或其他来源。 */
export function grantHookShoveShield(ball: BallBody): boolean {
  if (!ball.inPlay || ball.hp <= 0) {
    return false;
  }
  ball.hookShoveShieldHp = HOOK_SHOVE_TECH.shieldHp;
  ball.hookShoveShieldRemain = HOOK_SHOVE_TECH.shieldSec;
  grants.push({
    unitId: ball.id,
    amount: HOOK_SHOVE_TECH.shieldHp,
    x: ball.x,
    y: ball.y,
    sourceId: ball.id,
  });
  return true;
}

export function tickHookShoveShield(ball: BallBody, dt: number): void {
  if (ball.hookShoveShieldRemain <= 0) {
    clearHookShoveShield(ball);
    return;
  }
  ball.hookShoveShieldRemain = Math.max(0, ball.hookShoveShieldRemain - Math.max(0, dt));
  if (ball.hookShoveShieldRemain <= 0) {
    clearHookShoveShield(ball);
  }
}

type AbsorbLayer = {
  remain: number;
  getHp: () => number;
  setHp: (hp: number) => void;
  clear: () => void;
};

/** 吸收层按先到期先消耗；药水盾与盾冲强化盾独立计时。 */
export function absorbWithShieldLayers(victim: BallBody, incoming: number): { applied: number; absorbed: number } {
  let applied = incoming;
  let absorbed = 0;
  if (applied <= 0) {
    return { applied: 0, absorbed: 0 };
  }
  const layers: AbsorbLayer[] = [];
  if (victim.potionShieldHp > 0 && victim.potionShieldRemain > 0) {
    layers.push({
      remain: victim.potionShieldRemain,
      getHp: () => victim.potionShieldHp,
      setHp: (hp) => {
        victim.potionShieldHp = hp;
      },
      clear: () => {
        victim.potionShieldHp = 0;
        victim.potionShieldRemain = 0;
      },
    });
  }
  if (victim.hookShoveShieldHp > 0 && victim.hookShoveShieldRemain > 0) {
    layers.push({
      remain: victim.hookShoveShieldRemain,
      getHp: () => victim.hookShoveShieldHp,
      setHp: (hp) => {
        victim.hookShoveShieldHp = hp;
      },
      clear: () => {
        clearHookShoveShield(victim);
      },
    });
  }
  layers.sort((a, b) => a.remain - b.remain);
  for (const layer of layers) {
    if (applied <= 0) {
      break;
    }
    const take = Math.min(layer.getHp(), applied);
    if (take <= 0) {
      continue;
    }
    layer.setHp(layer.getHp() - take);
    applied -= take;
    absorbed += take;
    if (layer.getHp() <= 1e-6) {
      layer.clear();
    }
  }
  return { applied, absorbed };
}
