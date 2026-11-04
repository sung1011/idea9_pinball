import type { BallBody } from './ballBody';
import {
  ACTIVE_RAM_SPEED_THRESHOLD,
  COLLISION_DAMAGE_CAP,
  COLLISION_DAMAGE_SCALE,
  COLLISION_SPEED_THRESHOLD,
  FACING_FRONT_COEFF,
  FACING_FRONT_DEG,
  FACING_REAR_COEFF,
  FACING_SIDE_COEFF,
  FACING_SIDE_DEG,
  KNOCKBACK_FEEL_CAP,
  KNOCKBACK_SCALE,
  KNOCKBACK_SPEED_SPAN,
} from './constants';

export type FacingZone = 'front' | 'side' | 'rear';

export type CollisionHit = {
  victimId: number;
  sourceId: number;
  victimLabel: string;
  sourceLabel: string;
  damage: number;
  zone: FacingZone;
  coeff: number;
  knockback: number;
  relSpeed: number;
  threshold: number;
};

const EPS = 1e-8;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function collisionThreshold(activeRam: boolean): number {
  return activeRam ? ACTIVE_RAM_SPEED_THRESHOLD : COLLISION_SPEED_THRESHOLD;
}

export function facingZone(angleDeg: number): FacingZone {
  if (angleDeg <= FACING_FRONT_DEG) {
    return 'front';
  }
  if (angleDeg <= FACING_SIDE_DEG) {
    return 'side';
  }
  return 'rear';
}

export function facingCoeff(zone: FacingZone): number {
  if (zone === 'front') {
    return FACING_FRONT_COEFF;
  }
  if (zone === 'side') {
    return FACING_SIDE_COEFF;
  }
  return FACING_REAR_COEFF;
}

/**
 * 撞入方向相对受击方朝向。incomingFrom = 对方相对自己的位置方向。
 * 对齐朝向 = 正面；反向 = 背面。速度档 0 时沿用上一帧朝向。
 */
export function incomingFacing(
  facingX: number,
  facingY: number,
  incomingFromX: number,
  incomingFromY: number,
): { zone: FacingZone; coeff: number; angleDeg: number } {
  const facingLen = Math.hypot(facingX, facingY);
  const incomingLen = Math.hypot(incomingFromX, incomingFromY);
  if (facingLen < EPS || incomingLen < EPS) {
    return { zone: 'front', coeff: FACING_FRONT_COEFF, angleDeg: 0 };
  }
  const dot = clamp(
    (facingX * incomingFromX + facingY * incomingFromY) / (facingLen * incomingLen),
    -1,
    1,
  );
  const angleDeg = (Math.acos(dot) * 180) / Math.PI;
  const zone = facingZone(angleDeg);
  return { zone, coeff: facingCoeff(zone), angleDeg };
}

export function collisionDamage(relSpeed: number, threshold: number, coeff: number): number {
  const raw = COLLISION_DAMAGE_SCALE * (relSpeed - threshold) * coeff;
  if (raw <= 0) {
    return 0;
  }
  return Math.min(COLLISION_DAMAGE_CAP, raw);
}

export function knockbackSpeed(relSpeed: number, threshold: number, coeff: number): number {
  const t = Math.min(1, (relSpeed - threshold) / KNOCKBACK_SPEED_SPAN);
  if (t <= 0) {
    return 0;
  }
  return Math.min(KNOCKBACK_FEEL_CAP, KNOCKBACK_SCALE * coeff * t);
}

function hitVictim(
  victim: BallBody,
  source: BallBody,
  incomingX: number,
  incomingY: number,
  knockNx: number,
  knockNy: number,
  relSpeed: number,
  threshold: number,
): CollisionHit | null {
  const facing = incomingFacing(victim.facingX, victim.facingY, incomingX, incomingY);
  const shieldMul = victim.shieldRemain > 0 ? victim.shieldMul : 1;
  const damage = collisionDamage(relSpeed, threshold, facing.coeff) * shieldMul;
  if (damage <= 0) {
    return null;
  }
  victim.hp = Math.max(0, victim.hp - damage);
  const kb = knockbackSpeed(relSpeed, threshold, facing.coeff);
  victim.vx += knockNx * kb;
  victim.vy += knockNy * kb;
  return {
    victimId: victim.id,
    sourceId: source.id,
    victimLabel: victim.label,
    sourceLabel: source.label,
    damage,
    zone: facing.zone,
    coeff: facing.coeff,
    knockback: kb,
    relSpeed,
    threshold,
  };
}

/**
 * 达标碰撞：双方各按受击朝向结算伤害；仅掉血时沿法线轻弹。
 * nx, ny = 由 a 指向 b 的接触法线。
 */
export function applyCollisionCombat(
  a: BallBody,
  b: BallBody,
  nx: number,
  ny: number,
  relSpeed: number,
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
  const hitA = hitVictim(a, b, nx, ny, -nx, -ny, relSpeed, threshold);
  const hitB = hitVictim(b, a, -nx, -ny, nx, ny, relSpeed, threshold);
  if (hitA) {
    hits.push(hitA);
  }
  if (hitB) {
    hits.push(hitB);
  }
  return hits;
}

/** 锁点公式自检：启动时跑一遍，避免朝向/伤害/弹开算错。 */
export function selfCheckCollisionDamage(): void {
  const front = incomingFacing(1, 0, 1, 0);
  const side = incomingFacing(1, 0, 0, 1);
  const rear = incomingFacing(1, 0, -1, 0);
  if (front.zone !== 'front' || front.coeff !== FACING_FRONT_COEFF) {
    throw new Error('朝向乘区：正面应为 ×1.0');
  }
  if (side.zone !== 'side' || side.coeff !== FACING_SIDE_COEFF) {
    throw new Error('朝向乘区：侧面应为 ×0.7');
  }
  if (rear.zone !== 'rear' || rear.coeff !== FACING_REAR_COEFF) {
    throw new Error('朝向乘区：背面应为 ×1.35');
  }
  if (collisionDamage(8, COLLISION_SPEED_THRESHOLD, FACING_FRONT_COEFF) !== 24) {
    throw new Error('碰撞伤害：相对速度 8 正面应为 24');
  }
  if (collisionDamage(16, COLLISION_SPEED_THRESHOLD, FACING_REAR_COEFF) !== COLLISION_DAMAGE_CAP) {
    throw new Error('碰撞伤害：应先乘再 cap 28');
  }
  if (collisionDamage(3, COLLISION_SPEED_THRESHOLD, FACING_FRONT_COEFF) !== 0) {
    throw new Error('轻蹭：相对速度 3 不应掉血');
  }
  const kb = knockbackSpeed(16, COLLISION_SPEED_THRESHOLD, FACING_REAR_COEFF);
  if (Math.abs(kb - KNOCKBACK_FEEL_CAP) > 1e-6) {
    throw new Error('弹开：背面满额应顶到 2.5');
  }
}
