import { ARC_GRAZE, ARC_MARK } from '../heroes/arcKit';
import { collisionThreshold } from './collisionDamage';
import type { CollisionHit } from './collisionDamage';
import type { BallBody } from './ballBody';
import { applySkillDamage } from './skillHits';

const EPS = 1e-8;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** 相对速度与接触法线的夹角（0=对撞，90=擦肩）。 */
export function grazeContactAngleDeg(relVx: number, relVy: number, nx: number, ny: number): number {
  const len = Math.hypot(relVx, relVy);
  const nlen = Math.hypot(nx, ny);
  if (len < EPS || nlen < EPS) {
    return 0;
  }
  const dot = clamp((relVx * nx + relVy * ny) / (len * nlen), -1, 1);
  return (Math.acos(dot) * 180) / Math.PI;
}

export function isGrazeAngle(deg: number): boolean {
  return deg >= ARC_GRAZE.minDeg - 1e-6 && deg <= ARC_GRAZE.maxDeg + 1e-6;
}

function grazeLocked(source: BallBody, targetId: number): boolean {
  return source.grazeLocks.some((lock) => lock.id === targetId && lock.remain > 1e-9);
}

function lockGraze(source: BallBody, targetId: number, remain: number): void {
  const existing = source.grazeLocks.find((lock) => lock.id === targetId);
  if (existing) {
    existing.remain = remain;
    return;
  }
  source.grazeLocks.push({ id: targetId, remain });
}

/** 擦伤刃：窗内、相对速度达标、夹角 60–120° 时伤 11；同目标 1s 最多 1 次。 */
export function tryGrazeBlade(
  source: BallBody,
  target: BallBody,
  relSpeed: number,
  nx: number,
  ny: number,
  relVx: number,
  relVy: number,
): CollisionHit | null {
  if (source.grazeRemain <= 0) {
    return null;
  }
  const activeRam = source.activeRamRemain > 0 || target.activeRamRemain > 0;
  if (relSpeed + 1e-9 < collisionThreshold(activeRam)) {
    return null;
  }
  if (!isGrazeAngle(grazeContactAngleDeg(relVx, relVy, nx, ny))) {
    return null;
  }
  if (grazeLocked(source, target.id)) {
    return null;
  }
  const hit = applySkillDamage(target, source, ARC_GRAZE.damage);
  if (!hit) {
    return null;
  }
  lockGraze(source, target.id, ARC_GRAZE.targetCd);
  return hit;
}

/** 标记回响：下一次主动撞或擦伤额外 14，然后清标记。 */
export function tryEchoMark(
  victim: BallBody,
  source: BallBody,
  trigger: boolean,
): CollisionHit | null {
  if (!trigger || victim.echoMarkRemain <= 0) {
    return null;
  }
  const hit = applySkillDamage(victim, source, ARC_MARK.extra);
  victim.echoMarkRemain = 0;
  victim.echoMarkSourceId = -1;
  return hit;
}

/** 碰撞结算后：双方各试擦伤，再吃标记回响（同帧擦伤可触发）。 */
export function applyArcOnCollision(
  a: BallBody,
  b: BallBody,
  nx: number,
  ny: number,
  relSpeed: number,
  relVx: number,
  relVy: number,
): CollisionHit[] {
  const hits: CollisionHit[] = [];
  const grazeAB = tryGrazeBlade(a, b, relSpeed, nx, ny, relVx, relVy);
  if (grazeAB) {
    hits.push(grazeAB);
  }
  const grazeBA = tryGrazeBlade(b, a, relSpeed, -nx, -ny, -relVx, -relVy);
  if (grazeBA) {
    hits.push(grazeBA);
  }
  const markB = tryEchoMark(b, a, a.activeRamRemain > 0 || !!grazeAB);
  if (markB) {
    hits.push(markB);
  }
  const markA = tryEchoMark(a, b, b.activeRamRemain > 0 || !!grazeBA);
  if (markA) {
    hits.push(markA);
  }
  return hits;
}
