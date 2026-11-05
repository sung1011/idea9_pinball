import { applyArcOnCollision } from './arcCombat';
import type { BallBody } from './ballBody';
import { applyHpLoss } from './hpLoss';
import { applyNailReflect, applyPinRamBonus } from './nailCombat';
import {
  ACTIVE_RAM_SPEED_THRESHOLD,
  COLLISION_DAMAGE_CAP,
  COLLISION_DAMAGE_SCALE,
  COLLISION_SPEED_THRESHOLD,
  KNOCKBACK_FEEL_CAP,
  KNOCKBACK_SCALE,
  KNOCKBACK_SPEED_SPAN,
  SPEAR_TIP_DIST,
  SPEAR_TIP_RADIUS,
} from './constants';

export type CollisionHit = {
  victimId: number;
  sourceId: number;
  victimLabel: string;
  sourceLabel: string;
  damage: number;
  knockback: number;
  relSpeed: number;
  threshold: number;
};

const EPS = 1e-8;

export type SpearAim = Pick<BallBody, 'x' | 'y' | 'facingX' | 'facingY' | 'aimX' | 'aimY' | 'hasAim'>;
export type SpearVictim = Pick<BallBody, 'x' | 'y' | 'radius'>;

export function collisionThreshold(activeRam: boolean): number {
  return activeRam ? ACTIVE_RAM_SPEED_THRESHOLD : COLLISION_SPEED_THRESHOLD;
}

/** 枪尖方向：有瞄准跟 aim，否则跟 facing。与视觉矛尖一致。 */
export function spearAimDir(ball: SpearAim): { x: number; y: number } {
  if (ball.hasAim) {
    const len = Math.hypot(ball.aimX, ball.aimY);
    if (len >= EPS) {
      return { x: ball.aimX / len, y: ball.aimY / len };
    }
  }
  const facingLen = Math.hypot(ball.facingX, ball.facingY);
  if (facingLen < EPS) {
    return { x: 1, y: 0 };
  }
  return { x: ball.facingX / facingLen, y: ball.facingY / facingLen };
}

export function spearTipPos(ball: SpearAim): { x: number; y: number } {
  const dir = spearAimDir(ball);
  return {
    x: ball.x + dir.x * SPEAR_TIP_DIST,
    y: ball.y + dir.y * SPEAR_TIP_DIST,
  };
}

/** 攻击方枪尖小圆是否碰到受击方身体圆。 */
export function spearTipHitsBody(attacker: SpearAim, victim: SpearVictim): boolean {
  const tip = spearTipPos(attacker);
  const dist = Math.hypot(tip.x - victim.x, tip.y - victim.y);
  return dist <= victim.radius + SPEAR_TIP_RADIUS + EPS;
}

export function collisionDamage(relSpeed: number, threshold: number): number {
  const raw = COLLISION_DAMAGE_SCALE * (relSpeed - threshold);
  if (raw <= 0) {
    return 0;
  }
  return Math.min(COLLISION_DAMAGE_CAP, raw);
}

export function knockbackSpeed(relSpeed: number, threshold: number): number {
  const t = Math.min(1, (relSpeed - threshold) / KNOCKBACK_SPEED_SPAN);
  if (t <= 0) {
    return 0;
  }
  return Math.min(KNOCKBACK_FEEL_CAP, KNOCKBACK_SCALE * t);
}

function hitVictim(
  victim: BallBody,
  source: BallBody,
  knockNx: number,
  knockNy: number,
  relSpeed: number,
  threshold: number,
): CollisionHit | null {
  if (!spearTipHitsBody(source, victim)) {
    return null;
  }
  const shieldMul = victim.shieldRemain > 0 ? victim.shieldMul : 1;
  const armorMul = victim.armorRemain > 0 ? victim.armorMul : 1;
  const incoming = collisionDamage(relSpeed, threshold) * shieldMul * armorMul;
  if (incoming <= 0) {
    return null;
  }
  const damage = applyHpLoss(victim, incoming);
  if (damage <= 0) {
    return null;
  }
  if (victim.armorRemain > 0) {
    victim.armorBroken = true;
  }
  const kb = knockbackSpeed(relSpeed, threshold);
  victim.vx += knockNx * kb;
  victim.vy += knockNy * kb;
  return {
    victimId: victim.id,
    sourceId: source.id,
    victimLabel: victim.label,
    sourceLabel: source.label,
    damage,
    knockback: kb,
    relSpeed,
    threshold,
  };
}

/**
 * 达标碰撞：仅枪尖戳中对方身体才掉血（单向，可互戳）；仅掉血时沿法线轻弹。
 * 身子圆碰圆仍由物理分离/弹开，无枪尖命中则不掉血。
 * nx, ny = 由 a 指向 b 的接触法线。
 */
export function applyCollisionCombat(
  a: BallBody,
  b: BallBody,
  nx: number,
  ny: number,
  relSpeed: number,
  relVx = a.vx - b.vx,
  relVy = a.vy - b.vy,
): CollisionHit[] {
  if (a.invincibleRemain > 0 || b.invincibleRemain > 0) {
    return [];
  }
  if (a.suppressCombat || b.suppressCombat) {
    return [];
  }
  if (a.team && b.team && a.team === b.team) {
    return [];
  }
  const activeRam = a.activeRamRemain > 0 || b.activeRamRemain > 0;
  const threshold = collisionThreshold(activeRam);
  if (relSpeed < threshold) {
    return [];
  }

  const hits: CollisionHit[] = [];
  const hitA = hitVictim(a, b, -nx, -ny, relSpeed, threshold);
  const hitB = hitVictim(b, a, nx, ny, relSpeed, threshold);
  if (hitA) {
    hits.push(hitA);
  }
  if (hitB) {
    hits.push(hitB);
  }
  const aRammed = b.activeRamRemain > 0;
  const bRammed = a.activeRamRemain > 0;
  if (hitA) {
    const extra = applyPinRamBonus(a, b);
    if (extra) {
      hits.push(extra);
    }
    const reflect = applyNailReflect(a, b, aRammed);
    if (reflect) {
      hits.push(reflect);
    }
  }
  if (hitB) {
    const extra = applyPinRamBonus(b, a);
    if (extra) {
      hits.push(extra);
    }
    const reflect = applyNailReflect(b, a, bRammed);
    if (reflect) {
      hits.push(reflect);
    }
  }
  hits.push(...applyArcOnCollision(a, b, nx, ny, relSpeed, relVx, relVy));
  return hits;
}

/** 锁点公式自检：启动时跑一遍，避免枪尖门闩 / 伤害 / 弹开算错。 */
export function selfCheckCollisionDamage(): void {
  if (collisionDamage(8, COLLISION_SPEED_THRESHOLD) !== 24) {
    throw new Error('碰撞伤害：相对速度 8 应为 24');
  }
  if (collisionDamage(16, COLLISION_SPEED_THRESHOLD) !== COLLISION_DAMAGE_CAP) {
    throw new Error('碰撞伤害：应 cap 28');
  }
  if (collisionDamage(3, COLLISION_SPEED_THRESHOLD) !== 0) {
    throw new Error('轻蹭：相对速度 3 不应掉血');
  }
  const kb = knockbackSpeed(16, COLLISION_SPEED_THRESHOLD);
  if (Math.abs(kb - KNOCKBACK_SCALE) > 1e-6) {
    throw new Error('弹开：满额应只按速度顶在 2.0，不再乘朝向');
  }
  const stabber = {
    x: 0,
    y: 0,
    facingX: 1,
    facingY: 0,
    aimX: 1,
    aimY: 0,
    hasAim: false,
  };
  const frontBody = { x: 1, y: 0, radius: 0.5 };
  const sideBody = { x: 0, y: 1, radius: 0.5 };
  if (!spearTipHitsBody(stabber, frontBody)) {
    throw new Error('枪尖：正对接触应戳中身体');
  }
  if (spearTipHitsBody(stabber, sideBody)) {
    throw new Error('枪尖：侧身圆蹭不应算枪尖命中');
  }
  const aimer = { ...stabber, hasAim: true, aimX: 0, aimY: 1 };
  if (!spearTipHitsBody(aimer, sideBody) || spearTipHitsBody(aimer, frontBody)) {
    throw new Error('枪尖：有瞄准时应跟 aim，不跟 facing');
  }
}
