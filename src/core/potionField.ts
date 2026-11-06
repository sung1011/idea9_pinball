import type { BallBody } from './ballBody';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  POTION_DAMAGE_SEC,
  POTION_FIRST_SEC,
  POTION_HEAL,
  POTION_INSET,
  POTION_INTERVAL_SEC,
  POTION_RADIUS,
  POTION_SHIELD,
  POTION_SHIELD_SEC,
  POTION_SPEED_CAP,
  POTION_SPEED_SEC,
  SPEED_CAP,
} from './constants';

export const POTION_KINDS = ['damage', 'speed', 'heal', 'shield'] as const;
export type PotionKind = (typeof POTION_KINDS)[number];

export type PotionPickup = {
  kind: PotionKind;
  x: number;
  y: number;
};

export type PotionGrab = {
  kind: PotionKind;
  ball: BallBody;
  healed: number;
};

export const POTION_KIND_LABEL: Record<PotionKind, string> = {
  damage: '伤害加成',
  speed: '加速',
  heal: '加血',
  shield: '护盾',
};

export const POTION_KIND_COLOR = {
  damage: 0xe85a2a,
  speed: 0xd4a017,
  heal: 0x3cb371,
  shield: 0x3db8c5,
} as const;

const CORNERS: ReadonlyArray<{ x: number; y: number }> = [
  { x: POTION_INSET, y: POTION_INSET },
  { x: MAP_WIDTH - POTION_INSET, y: POTION_INSET },
  { x: POTION_INSET, y: MAP_HEIGHT - POTION_INSET },
  { x: MAP_WIDTH - POTION_INSET, y: MAP_HEIGHT - POTION_INSET },
];

export function potionCorners(): readonly { x: number; y: number }[] {
  return CORNERS;
}

export function applyPotionToBall(ball: BallBody, kind: PotionKind): number {
  if (kind === 'heal') {
    const before = ball.hp;
    ball.hp = Math.min(ball.maxHp, ball.hp + POTION_HEAL);
    return ball.hp - before;
  }
  if (kind === 'damage') {
    ball.potionDamageRemain = POTION_DAMAGE_SEC;
    return 0;
  }
  if (kind === 'speed') {
    const fresh = ball.potionSpeedRemain <= 0;
    ball.potionSpeedRemain = POTION_SPEED_SEC;
    if (fresh) {
      const scale = POTION_SPEED_CAP / SPEED_CAP;
      ball.vx *= scale;
      ball.vy *= scale;
    }
    return 0;
  }
  ball.potionShieldRemain = POTION_SHIELD_SEC;
  ball.potionShieldHp = POTION_SHIELD;
  return 0;
}

export function createPotionField(random: () => number = Math.random) {
  let pickup: PotionPickup | null = null;
  let nextAt = POTION_FIRST_SEC;

  const spawn = (): void => {
    const corner = CORNERS[Math.floor(random() * CORNERS.length) % CORNERS.length];
    const kind = POTION_KINDS[Math.floor(random() * POTION_KINDS.length) % POTION_KINDS.length];
    pickup = { kind, x: corner.x, y: corner.y };
  };

  return {
    reset(): void {
      pickup = null;
      nextAt = POTION_FIRST_SEC;
    },
    tick(balls: readonly BallBody[], elapsedSec: number, enabled: boolean): PotionGrab[] {
      if (!enabled) {
        pickup = null;
        return [];
      }
      while (elapsedSec + 1e-9 >= nextAt) {
        spawn();
        nextAt += POTION_INTERVAL_SEC;
      }
      if (!pickup) {
        return [];
      }
      for (const ball of balls) {
        if (!ball.inPlay) {
          continue;
        }
        const dist = Math.hypot(ball.x - pickup.x, ball.y - pickup.y);
        if (dist > ball.radius + POTION_RADIUS) {
          continue;
        }
        const healed = applyPotionToBall(ball, pickup.kind);
        const grab: PotionGrab = { kind: pickup.kind, ball, healed };
        pickup = null;
        return [grab];
      }
      return [];
    },
    snapshot(): PotionPickup | null {
      return pickup ? { ...pickup } : null;
    },
  };
}

export type PotionField = ReturnType<typeof createPotionField>;
